import { describe, expect, it } from "@effect/vitest";
import { EnvironmentId, ProjectId, type ScopedProjectRef } from "@cctools/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Atom, AtomRegistry } from "effect/reactivity";

import * as EnvironmentRegistry from "../connection/registry.ts";
import * as EnvironmentSupervisor from "../connection/supervisor.ts";
import type { RpcSession } from "../rpc/session.ts";
import type { EnvironmentProject } from "./models.ts";
import { createProjectEnvironmentAtoms } from "./projectCommands.ts";

const ENVIRONMENT_ID = EnvironmentId.make("environment-1");
const PROJECT_ID = ProjectId.make("scratch");
const PROJECT = {
  id: PROJECT_ID,
  environmentId: ENVIRONMENT_ID,
  workspaceRoot: "/scratch",
} as EnvironmentProject;

const makeHarness = Effect.fn("TestProjectCommands.makeHarness")(function* (
  command: "openScratch" | "openChats",
  expectedTag: "projects.ensureScratch" | "projects.ensureChats",
) {
  const supervisor = EnvironmentSupervisor.EnvironmentSupervisor.of({
    target: { environmentId: ENVIRONMENT_ID },
    session: yield* SubscriptionRef.make(
      Option.some({
        client: {
          [expectedTag]: () => Effect.succeed({ projectId: PROJECT_ID }),
        },
      } as unknown as RpcSession),
    ),
  } as EnvironmentSupervisor.EnvironmentSupervisor["Service"]);
  const runtime = Atom.runtime(
    Layer.mergeAll(
      Layer.succeed(EnvironmentRegistry.EnvironmentRegistry, {
        run: (_environmentId, effect) =>
          Effect.provideService(effect, EnvironmentSupervisor.EnvironmentSupervisor, supervisor),
      } as EnvironmentRegistry.EnvironmentRegistry["Service"]),
      Layer.succeed(
        Crypto.Crypto,
        Crypto.make({
          randomBytes: (size) => new Uint8Array(size),
          digest: (_algorithm, data) => Effect.succeed(data),
        }),
      ),
    ),
  );
  const storedProject = Atom.make<EnvironmentProject | null>(null);
  const commands = createProjectEnvironmentAtoms(runtime, {
    projectAtom: (ref: ScopedProjectRef) =>
      ref.environmentId === ENVIRONMENT_ID && ref.projectId === PROJECT_ID
        ? storedProject
        : Atom.make(null),
  });
  const registry = AtomRegistry.make();
  yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
  const open = Effect.promise(async () =>
    commands[command].run(registry, { environmentId: ENVIRONMENT_ID, input: {} }),
  );
  return { registry, storedProject, open };
});

describe.each([
  { command: "openScratch", expectedTag: "projects.ensureScratch" },
  { command: "openChats", expectedTag: "projects.ensureChats" },
] as const)("$command", ({ command, expectedTag }) => {
  it.effect("resolves once the created project reaches the client store", () =>
    Effect.gen(function* () {
      const { registry, storedProject, open } = yield* makeHarness(command, expectedTag);
      const opening = yield* Effect.forkChild(open);
      yield* Effect.yieldNow;
      registry.set(storedProject, PROJECT);
      const result = yield* Fiber.join(opening);
      expect(result).toMatchObject({ _tag: "Success", value: PROJECT });
    }).pipe(Effect.scoped),
  );
});
