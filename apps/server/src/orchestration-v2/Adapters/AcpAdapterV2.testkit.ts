import {
  MessageId,
  type ModelSelection,
  NodeId,
  ProjectId,
  type ProviderInstanceId,
  RunAttemptId,
  RunId,
  type OrchestrationV2ProviderThread,
  type ThreadId,
  ProviderDriverKind,
  ProviderReplayEntry,
  type ProviderReplayTranscript,
} from "@cctools/contracts";
import type * as DateTime from "effect/DateTime";
import type * as ProviderAdapter from "@cctools/provider-core/server/ProviderAdapter";
import * as Effect from "effect/Effect";
import * as Crypto from "effect/Crypto";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as EffectAcpErrors from "effect-acp/errors";

import * as AcpSessionRuntime from "@cctools/provider-acp/server/AcpSessionRuntime";
import type { ProviderReplayGate } from "@cctools/provider-testing/replayGate";
import { ACP_PROTOCOL, type AcpAdapterV2RuntimeInput } from "@cctools/provider-acp/server/adapter";

export const AcpReplayTranscript = Schema.Struct({
  provider: ProviderDriverKind,
  protocol: Schema.Literal(ACP_PROTOCOL),
  version: Schema.String,
  scenario: Schema.String,
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  entries: Schema.Array(ProviderReplayEntry),
});
export type AcpReplayTranscript = typeof AcpReplayTranscript.Type;

const decodeAcpReplayTranscriptSchema = Schema.decodeUnknownEffect(AcpReplayTranscript);
const encodeReplayTranscriptJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

export class AcpReplayTranscriptDecodeError extends Schema.TaggedError<AcpReplayTranscriptDecodeError>()(
  "AcpReplayTranscriptDecodeError",
  {
    expectedProvider: ProviderDriverKind,
    driver: Schema.optional(Schema.String),
    protocol: Schema.optional(Schema.String),
    scenario: Schema.optional(Schema.String),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to decode ${this.expectedProvider} ACP replay transcript for scenario ${this.scenario ?? "<unknown>"}.`;
  }
}

const isAcpReplayTranscriptDecodeError = Schema.is(AcpReplayTranscriptDecodeError);

function metadataFromTranscript(transcript: ProviderReplayTranscript): {
  readonly provider?: string;
  readonly protocol?: string;
  readonly scenario?: string;
} {
  return {
    provider: transcript.provider,
    protocol: transcript.protocol,
    scenario: transcript.scenario,
  };
}

export function decodeAcpReplayTranscript(
  transcript: ProviderReplayTranscript,
  expectedProvider: ProviderDriverKind,
  options: { readonly retargetProvider?: boolean } = {},
): Effect.Effect<AcpReplayTranscript, AcpReplayTranscriptDecodeError> {
  const candidate = options.retargetProvider
    ? { ...transcript, provider: expectedProvider }
    : transcript;
  return decodeAcpReplayTranscriptSchema(candidate).pipe(
    Effect.filterOrFail(
      (decoded) => decoded.provider === expectedProvider,
      () =>
        new AcpReplayTranscriptDecodeError({
          expectedProvider,
          ...metadataFromTranscript(transcript),
          cause: `Expected provider ${expectedProvider}, received ${transcript.provider}`,
        }),
    ),
    Effect.mapError((cause) =>
      isAcpReplayTranscriptDecodeError(cause)
        ? cause
        : new AcpReplayTranscriptDecodeError({
            expectedProvider,
            ...metadataFromTranscript(transcript),
            cause,
          }),
    ),
  );
}

interface ReplayStatus {
  readonly cursor: number;
  readonly total: number;
  readonly failure?: unknown;
}

function decodeReplayStatus(raw: string): ReplayStatus {
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== "object" ||
    value === null ||
    typeof Reflect.get(value, "cursor") !== "number" ||
    typeof Reflect.get(value, "total") !== "number"
  ) {
    throw new Error("ACP replay status is malformed.");
  }
  return value as ReplayStatus;
}

export function makeAcpReplayCompletenessAssertion(
  fileSystem: FileSystem.FileSystem,
  statusPath: string,
  transcript: AcpReplayTranscript,
): Effect.Effect<void, EffectAcpErrors.AcpError> {
  return fileSystem.readFileString(statusPath).pipe(
    Effect.mapError(
      (cause) =>
        new EffectAcpErrors.AcpTransportError({
          detail: `Failed to read ACP replay status for ${transcript.scenario}`,
          cause,
        }),
    ),
    Effect.flatMap((raw) =>
      Effect.try({
        try: () => decodeReplayStatus(raw),
        catch: (cause) =>
          new EffectAcpErrors.AcpTransportError({
            detail: `Failed to decode ACP replay status for ${transcript.scenario}`,
            cause,
          }),
      }),
    ),
    Effect.flatMap((status) => {
      if (
        status.failure === undefined &&
        status.cursor === transcript.entries.length &&
        status.total === transcript.entries.length
      ) {
        return Effect.void;
      }
      return Effect.fail(
        new EffectAcpErrors.AcpTransportError({
          detail: `ACP replay did not consume all frames for ${transcript.scenario}`,
          cause: status,
        }),
      );
    }),
  );
}

function acpReplayAgentArgs(scriptPath: string): ReadonlyArray<string> {
  return ["--experimental-strip-types", scriptPath];
}

const REPLAY_BOUNDARY_METHOD = "_t3/replay/boundary";

function holdGatedReplayLines(
  transcript: AcpReplayTranscript,
  replayGate: ProviderReplayGate,
  progress?: { readonly resumed: () => void; readonly sequence: { value: number } },
): NonNullable<AcpSessionRuntime.AcpSessionRuntimeOptions["transformStdout"]> {
  const inboundEntries = transcript.entries.flatMap((entry, index) =>
    entry.type === "emit_inbound"
      ? [{ label: entry.label, endsBurst: transcript.entries[index + 1]?.type !== "emit_inbound" }]
      : [],
  );
  let inboundIndex = 0;
  const reachedLabels = new Set<string>();
  const encoder = new TextEncoder();
  const boundary = () =>
    encoder.encode(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: REPLAY_BOUNDARY_METHOD,
        params: progress?.sequence.value,
      })}\n`,
    );
  return (stdout) =>
    stdout.pipe(
      Stream.decodeText,
      Stream.splitLines,
      Stream.flatMap((line) =>
        Stream.unwrap(
          Effect.sync(() => {
            const entry = line.trim().length === 0 ? undefined : inboundEntries[inboundIndex++];
            const waiting = replayGate.beforeEmit(entry?.label);
            // A held frame ends the preceding burst. A marker travels through
            // the same protocol queue, acknowledging all earlier notifications.
            const held =
              entry?.label !== undefined &&
              !reachedLabels.has(entry.label) &&
              replayGate.hasReached(entry.label);
            if (held && entry?.label !== undefined) reachedLabels.add(entry.label);
            const deliver = Stream.fromEffect(
              Effect.promise(() => waiting).pipe(
                Effect.map(() => {
                  if (progress !== undefined) {
                    progress.resumed();
                    progress.sequence.value += 1;
                  }
                  return encoder.encode(`${line}\n`);
                }),
              ),
            );
            return Stream.concat(
              progress !== undefined && held
                ? Stream.fromEffect(Effect.sync(boundary))
                : Stream.empty,
              Stream.concat(
                deliver,
                progress !== undefined && entry?.endsBurst
                  ? Stream.fromEffect(Effect.sync(boundary))
                  : Stream.empty,
              ),
            );
          }),
        ),
      ),
    );
}

export function makeAcpReplayRuntime(input: {
  readonly transcript: AcpReplayTranscript;
  readonly statusPath: string;
  readonly scriptPath: string;
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly fileSystem: FileSystem.FileSystem;
  readonly customModels?: AcpSessionRuntime.AcpSessionRuntimeOptions["customModels"];
  readonly cancelMeta?: AcpSessionRuntime.AcpSessionRuntimeOptions["cancelMeta"];
  readonly cancelBehavior?: AcpSessionRuntime.AcpSessionRuntimeOptions["cancelBehavior"];
  readonly initializeMeta?: AcpSessionRuntime.AcpSessionRuntimeOptions["initializeMeta"];
  /** Acknowledges replay bursts before a scenario advances a finish debounce. */
  readonly replayClock?: {
    readonly resumed: () => void;
    readonly caughtUp: Effect.Effect<void>;
  };
  readonly replayGate?: ProviderReplayGate;
}): (
  runtimeInput: AcpAdapterV2RuntimeInput,
) => Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope
> {
  // Transcripts exceed the kernel's 128 KiB per-environment-variable limit.
  const transcriptPath = `${input.statusPath}.transcript.json`;
  return (runtimeInput) =>
    Effect.gen(function* () {
      yield* input.fileSystem
        .writeFileString(transcriptPath, encodeReplayTranscriptJson(input.transcript))
        .pipe(
          Effect.mapError(
            (cause) =>
              new EffectAcpErrors.AcpTransportError({
                detail: `Failed to write ACP replay transcript for ${input.transcript.scenario}`,
                cause,
              }),
          ),
        );
      const sequence = { value: 0 };
      const context = yield* Layer.build(
        AcpSessionRuntime.layer({
          ...runtimeInput,
          spawn: {
            command: process.execPath,
            args: acpReplayAgentArgs(input.scriptPath),
            cwd: runtimeInput.cwd,
            env: {
              ...process.env,
              CHATANDCODE_ACP_REPLAY_TRANSCRIPT_PATH: transcriptPath,
              CHATANDCODE_ACP_REPLAY_STATUS_PATH: input.statusPath,
              CHATANDCODE_ACP_REPLAY_WORKSPACE: runtimeInput.cwd,
            },
          },
          authMethodId: "replay",
          ...(input.customModels === undefined ? {} : { customModels: input.customModels }),
          ...(input.cancelMeta === undefined ? {} : { cancelMeta: input.cancelMeta }),
          ...(input.cancelBehavior === undefined ? {} : { cancelBehavior: input.cancelBehavior }),
          ...(input.initializeMeta === undefined ? {} : { initializeMeta: input.initializeMeta }),
          ...(input.replayGate === undefined
            ? {}
            : {
                transformStdout: holdGatedReplayLines(
                  input.transcript,
                  input.replayGate,
                  input.replayClock === undefined
                    ? undefined
                    : { resumed: input.replayClock.resumed, sequence },
                ),
              }),
        }).pipe(
          Layer.provide(
            Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
          ),
        ),
      );
      const runtime = yield* Effect.service(AcpSessionRuntime.AcpSessionRuntime).pipe(
        Effect.provide(context),
      );
      if (input.replayClock !== undefined) {
        const clock = input.replayClock;
        yield* runtime.handleExtNotification(REPLAY_BOUNDARY_METHOD, Schema.Number, (received) =>
          runtime.drainEvents.pipe(
            Effect.andThen(
              Effect.suspend(() => (received === sequence.value ? clock.caughtUp : Effect.void)),
            ),
          ),
        );
      }
      return runtime;
    });
}

export function makeTurnInput(input: {
  readonly threadId: ThreadId;
  readonly providerThread: OrchestrationV2ProviderThread;
  readonly instanceId: ProviderInstanceId;
  readonly runtimePolicy: ProviderAdapter.ProviderAdapterV2RuntimePolicy;
  readonly now: DateTime.Utc;
  readonly ordinal?: number;
  readonly modelSelection?: ModelSelection;
  readonly messageCreatedBy?: "user" | "agent";
  readonly messageCreationSource?: "web" | "mobile" | "mcp" | "provider" | "server";
  readonly messageText?: string;
}): ProviderAdapter.ProviderAdapterV2TurnInput {
  const ordinal = input.ordinal ?? 1;
  const suffix = `${input.threadId}:${ordinal}`;
  const modelSelection =
    input.modelSelection ?? ({ instanceId: input.instanceId, model: "default" } as const);
  return {
    appThread: {
      chatSubMode: "chat" as const,
      createdBy: "user",
      creationSource: "web",
      id: input.threadId,
      projectId: ProjectId.make(`project:${input.threadId}`),
      title: "ACP adapter test",
      providerInstanceId: input.instanceId,
      modelSelection,
      runtimeMode: "approval-required",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      activeProviderThreadId: input.providerThread.id,
      lineage: {
        parentThreadId: null,
        relationshipToParent: null,
        rootThreadId: input.threadId,
      },
      forkedFrom: null,
      createdAt: input.now,
      updatedAt: input.now,
      archivedAt: null,
      settledOverride: null,
      settledAt: null,
      lastVisitedAt: null,
      deletedAt: null,
    },
    threadId: input.threadId,
    runId: RunId.make(`run:${suffix}`),
    runOrdinal: ordinal,
    providerTurnOrdinal: ordinal,
    attemptId: RunAttemptId.make(`attempt:${suffix}`),
    rootNodeId: NodeId.make(`node:${suffix}`),
    providerThread: input.providerThread,
    message: {
      createdBy: input.messageCreatedBy ?? "user",
      creationSource: input.messageCreationSource ?? "web",
      messageId: MessageId.make(`message:${suffix}`),
      text: input.messageText ?? "test prompt",
      attachments: [],
    },
    modelSelection,
    runtimePolicy: input.runtimePolicy,
  };
}
