#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off - Node's built-in glob matcher is required by the allowlist format.

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodePath from "node:path";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { Command, Flag } from "effect/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const legacyLower = `t${3}`;
const legacyUpper = `T${3}`;

export interface BrandAllowlistEntry {
  readonly path: string;
  readonly pattern?: string;
  readonly reason: string;
  readonly ticket?: string;
}

export interface BrandAuditFile {
  readonly path: string;
  readonly contents: string;
}

export interface BrandAuditHit {
  readonly path: string;
  readonly line: number;
  readonly pattern: string;
  readonly match: string;
}

export interface BrandAuditResult {
  readonly hits: ReadonlyArray<BrandAuditHit>;
  readonly allowlistedTotal: number;
}

export interface BrandAuditReplacement {
  readonly path: string;
  readonly line: number;
  readonly id: string;
  readonly before: string;
  readonly after: string;
}

export interface BrandAuditFilters {
  readonly paths?: ReadonlyArray<string>;
  readonly patterns?: ReadonlyArray<string>;
  readonly excludePatterns?: ReadonlyArray<string>;
}

interface AuditPattern {
  readonly id: string;
  readonly source: string;
  readonly flags?: string;
  readonly replacement?: (match: string) => string;
}

const replaceCliToken = (match: string) => match.replace(legacyLower, "chatandcode");

const AUDIT_PATTERNS: ReadonlyArray<AuditPattern> = [
  { id: "name-spaced", source: `${legacyUpper} Code`, replacement: () => "ChatAndCode" },
  { id: "name-pascal", source: `${legacyUpper}Code`, replacement: () => "ChatAndCode" },
  {
    id: "name-lower",
    source: `${legacyLower}code`,
    flags: "i",
    replacement: (match) =>
      match === match.toUpperCase()
        ? "CHATANDCODE"
        : match === match.toLowerCase()
          ? "chatandcode"
          : match,
  },
  {
    id: `env-${legacyLower}code`,
    source: `${legacyUpper}CODE_`,
    replacement: () => "CHATANDCODE_",
  },
  {
    id: "sym-t3",
    source: `\\b${legacyUpper}_[A-Z]`,
    replacement: (match) => match.replace(`${legacyUpper}_`, "CHATANDCODE_"),
  },
  { id: "scope-at", source: `@${legacyLower}tools`, replacement: () => "@cctools" },
  { id: "scope-bare", source: `(?<!@)${legacyLower}tools` },
  { id: "name-my", source: `my${legacyLower}code`, flags: "i" },
  {
    id: "dotdir",
    source: `(?<![A-Za-z0-9])\\.${legacyLower}\\b`,
    replacement: () => ".chatandcode",
  },
  {
    id: "app-id",
    source: `com\\.${legacyLower}tools\\.${legacyLower}code`,
    replacement: () => "ca.chatcode.chatandcode", // must equal BRAND.appIdBase
  },
  {
    id: "rdns",
    source: `(?<![A-Za-z0-9.])com[./]${legacyLower}tools(?:[./](?!${legacyLower}code)[A-Za-z][A-Za-z0-9-]*)+`,
  },
  {
    id: "project-file",
    source: `\\b${legacyLower}\\.json\\b`,
    replacement: () => "chatandcode.json",
  },
  { id: "domain", source: `${legacyLower}\\.codes`, replacement: () => "chatcode.ca" },
  { id: "domain-sh", source: `${legacyLower}\\.sh` },
  {
    id: "repo",
    source: `(?:pingdotgg|${legacyLower}tools)/${legacyLower}code`,
    replacement: () => "karyashaala/chatandcode",
  },
  {
    id: "name-connect",
    source: `${legacyUpper} Connect`,
    replacement: () => "ChatAndCode Connect",
  },
  {
    id: "name-bare",
    source: `${legacyUpper} (?!Code|Connect|Tools|Chat)(?=[A-Za-z])`,
    replacement: () => "ChatAndCode ",
  },
  {
    id: "dash",
    source: `(?<![A-Za-z0-9])${legacyLower}-(code|mobile|web|relay|env|cloud|link|chat)(?![A-Za-z0-9])`,
    replacement: (match) =>
      match === `${legacyLower}-code` ? "chatandcode" : replaceCliToken(match),
  },
  { id: "cli-npx", source: `\\bnpx ${legacyLower}\\b`, replacement: replaceCliToken },
  { id: "refs", source: `refs/${legacyLower}/`, replacement: () => "refs/chatandcode/" },
  { id: "cli-at", source: `\\b${legacyLower}@`, replacement: replaceCliToken },
  { id: "cli-backtick", source: `\`${legacyLower} `, replacement: replaceCliToken },
  {
    id: "cli-subcommand",
    source: `\\b${legacyLower} (serve|pair|connect|service|app|theme|project|triage|start|auth|__service-preflight)\\b`,
    replacement: replaceCliToken,
  },
  { id: "cli-filter", source: `--filter[ =]!?${legacyLower}\\b`, replacement: replaceCliToken },
  {
    id: "cli-node-modules",
    source: `node_modules(?:/|\\\\|", ")${legacyLower}\\b`,
    replacement: replaceCliToken,
  },
  { id: "cli-command-v", source: `command -v ${legacyLower}\\b`, replacement: replaceCliToken },
  { id: "cli-quoted", source: `"${legacyLower}"` },
];

const AUDIT_PATTERN_IDS = AUDIT_PATTERNS.map((pattern) => pattern.id);

export class BrandAuditAllowlistError extends Schema.TaggedError<BrandAuditAllowlistError>()(
  "BrandAuditAllowlistError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Failed to load scripts/brand-allowlist.json.";
  }
}

export class BrandAuditGitError extends Schema.TaggedError<BrandAuditGitError>()(
  "BrandAuditGitError",
  {
    exitCode: Schema.Int,
    stderr: Schema.String,
  },
) {
  override get message(): string {
    return `git ls-files failed with exit code ${this.exitCode}: ${this.stderr}`;
  }
}

export class BrandAuditStrictError extends Schema.TaggedError<BrandAuditStrictError>()(
  "BrandAuditStrictError",
  { hitCount: Schema.Int },
) {
  override get message(): string {
    return `Brand audit found ${this.hitCount} non-allowlisted hits.`;
  }
}

export class BrandAuditFixError extends Schema.TaggedError<BrandAuditFixError>()(
  "BrandAuditFixError",
  { message: Schema.String },
) {}

export class BrandAuditPatternFilterError extends Schema.TaggedError<BrandAuditPatternFilterError>()(
  "BrandAuditPatternFilterError",
  {
    option: Schema.String,
    glob: Schema.String,
  },
) {
  override get message(): string {
    return `${this.option} glob "${this.glob}" matched no pattern ids. Valid ids: ${AUDIT_PATTERN_IDS.join(", ")}.`;
  }
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".webp",
  ".gif",
  ".ico",
  ".icns",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".sqlite",
  ".zip",
  ".gz",
  ".tgz",
  ".dmg",
  ".wasm",
  ".so",
  ".dylib",
  ".mp3",
  ".mp4",
  ".jar",
  ".keystore",
  ".p12",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const loadBrandAllowlist = (source: string): ReadonlyArray<BrandAllowlistEntry> => {
  const parsed: unknown = JSON.parse(source);
  if (!Array.isArray(parsed)) {
    throw new Error("Brand allowlist must be a JSON array.");
  }

  return parsed.map((value, index) => {
    if (!isRecord(value) || typeof value.path !== "string" || value.path.length === 0) {
      throw new Error(`Brand allowlist entry ${index + 1} must have a non-empty path.`);
    }
    if (typeof value.reason !== "string" || value.reason.trim().length === 0) {
      throw new Error(`Brand allowlist entry ${index + 1} must have a non-empty reason.`);
    }
    if (value.pattern !== undefined && typeof value.pattern !== "string") {
      throw new Error(`Brand allowlist entry ${index + 1} has an invalid pattern.`);
    }
    if (value.ticket !== undefined && typeof value.ticket !== "string") {
      throw new Error(`Brand allowlist entry ${index + 1} has an invalid ticket.`);
    }
    if (typeof value.pattern === "string") {
      void new RegExp(value.pattern, "g");
    }
    return {
      path: value.path,
      reason: value.reason,
      ...(typeof value.pattern === "string" ? { pattern: value.pattern } : {}),
      ...(typeof value.ticket === "string" ? { ticket: value.ticket } : {}),
    };
  });
};

const pathMatches = (path: string, entryPath: string) =>
  path === entryPath ||
  NodePath.matchesGlob(
    path.replace(/(^|\/)\./g, "$1\u0001"),
    entryPath.replace(/(^|\/)\./g, "$1\u0001"),
  );

const matchesFilters = (value: string, globs: ReadonlyArray<string> = []) =>
  globs.length === 0 || globs.some((glob) => pathMatches(value, glob));

const patternFilterError = (filters: BrandAuditFilters) => {
  for (const [option, globs] of [
    ["--pattern", filters.patterns],
    ["--exclude-pattern", filters.excludePatterns],
  ] as const) {
    for (const glob of globs ?? []) {
      if (AUDIT_PATTERN_IDS.some((id) => pathMatches(id, glob))) continue;
      return new BrandAuditPatternFilterError({ option, glob });
    }
  }
};

const validatePatternFilters = (filters: BrandAuditFilters) => {
  const error = patternFilterError(filters);
  if (error !== undefined) throw error;
};

const selectedPatterns = (filters: BrandAuditFilters) => {
  validatePatternFilters(filters);
  return AUDIT_PATTERNS.filter(
    (pattern) =>
      matchesFilters(pattern.id, filters.patterns) &&
      !filters.excludePatterns?.some((glob) => pathMatches(pattern.id, glob)),
  );
};

const allowlistedSpans = (
  path: string,
  line: string,
  allowlist: ReadonlyArray<BrandAllowlistEntry>,
) =>
  allowlist.flatMap((entry) => {
    if (!pathMatches(path, entry.path)) return [];
    if (entry.pattern === undefined) return [{ start: 0, end: line.length }];
    return [...line.matchAll(new RegExp(entry.pattern, "g"))].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
    }));
  });

const spanIsAllowlisted = (
  path: string,
  line: string,
  start: number,
  end: number,
  allowlist: ReadonlyArray<BrandAllowlistEntry>,
) => allowlistedSpans(path, line, allowlist).some((span) => start >= span.start && end <= span.end);

export const auditBrandFiles = (
  files: ReadonlyArray<BrandAuditFile>,
  allowlist: ReadonlyArray<BrandAllowlistEntry>,
  filters: BrandAuditFilters = {},
): BrandAuditResult => {
  const hits: Array<BrandAuditHit> = [];
  let allowlistedTotal = 0;
  const patterns = selectedPatterns(filters);

  for (const file of files) {
    if (!matchesFilters(file.path, filters.paths)) continue;
    const lines = file.contents.split(/\r?\n/);
    for (const [lineIndex, line] of lines.entries()) {
      for (const pattern of patterns) {
        for (const match of line.matchAll(new RegExp(pattern.source, `${pattern.flags ?? ""}g`))) {
          const start = match.index;
          const end = start + match[0].length;
          if (spanIsAllowlisted(file.path, line, start, end, allowlist)) {
            allowlistedTotal += 1;
          } else {
            hits.push({
              path: file.path,
              line: lineIndex + 1,
              pattern: pattern.id,
              match: match[0],
            });
          }
        }
      }
    }
  }

  return { hits, allowlistedTotal };
};

export const fixBrandFiles = (
  files: ReadonlyArray<BrandAuditFile>,
  allowlist: ReadonlyArray<BrandAllowlistEntry>,
  filters: BrandAuditFilters = {},
) => {
  const selected = new Set(selectedPatterns(filters));
  const replacements: Array<BrandAuditReplacement> = [];
  const rewrittenFiles = files.map((file) => {
    if (!matchesFilters(file.path, filters.paths)) return file;
    // Keep separators verbatim, including CRLF and the absence of a final newline.
    const contents = file.contents
      .split(/(\r?\n)/)
      .map((part, index) => {
        if (index % 2 !== 0) return part;
        let line = part;
        // Keep original exceptions protected even if a neighboring edit changes their context.
        const protectedSpans = allowlistedSpans(file.path, line, allowlist);
        while (true) {
          const hits = AUDIT_PATTERNS.flatMap((pattern, patternIndex) =>
            [...line.matchAll(new RegExp(pattern.source, `${pattern.flags ?? ""}g`))].map(
              (match) => ({
                pattern,
                patternIndex,
                match: match[0],
                start: match.index,
                end: match.index + match[0].length,
              }),
            ),
          );
          const owners = hits
            .filter(
              (candidate) =>
                !hits.some(
                  (other) =>
                    candidate !== other &&
                    candidate.start < other.end &&
                    candidate.end > other.start &&
                    (other.match.length > candidate.match.length ||
                      (other.match.length === candidate.match.length &&
                        other.patternIndex < candidate.patternIndex)),
                ),
            )
            .sort(
              (left, right) => left.start - right.start || left.patternIndex - right.patternIndex,
            );
          const owner = owners.find(
            ({ start, end }) =>
              !protectedSpans.some((span) => start < span.end && end > span.start),
          );
          if (owner === undefined) break;
          const { pattern, match, start, end } = owner;
          if (!selected.has(pattern) || pattern.replacement === undefined) {
            protectedSpans.push({ start, end });
            continue;
          }
          const replacement = pattern.replacement(match);
          if (replacement === match) {
            protectedSpans.push({ start, end });
            continue;
          }
          const before = line;
          line = line.slice(0, start) + replacement + line.slice(end);
          replacements.push({
            path: file.path,
            line: index / 2 + 1,
            id: pattern.id,
            before,
            after: line,
          });
          const delta = replacement.length - match.length;
          for (const span of protectedSpans) {
            if (span.start >= end) {
              span.start += delta;
              span.end += delta;
            }
          }
        }
        return line;
      })
      .join("");
    return { ...file, contents };
  });
  return { files: rewrittenFiles, changes: replacements.length, replacements };
};

const shouldSkipPath = (filePath: string) =>
  filePath.startsWith(".repos/") ||
  filePath === "pnpm-lock.yaml" ||
  filePath.startsWith("plan/") ||
  BINARY_EXTENSIONS.has(NodePath.extname(filePath).toLowerCase());

const collectStreamAsString = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (acc, chunk) => acc + chunk,
    ),
  );

const repositoryRoot = Effect.service(Path.Path).pipe(
  Effect.flatMap((path) => path.fromFileUrl(new URL("..", import.meta.url))),
);

const trackedFiles = Effect.fn("brandAudit.trackedFiles")(function* (root: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const child = yield* spawner.spawn(
    ChildProcess.make("git", ["ls-files", "-z", "-t"], { cwd: root }),
  );
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [collectStreamAsString(child.stdout), collectStreamAsString(child.stderr), child.exitCode],
    { concurrency: "unbounded" },
  );
  if (Number(exitCode) !== 0) {
    return yield* new BrandAuditGitError({
      exitCode: Number(exitCode),
      stderr: stderr.trim(),
    });
  }
  // `-t` tags files a sparse checkout left off disk (CI's lint job skips vendored `.a` files) with "S".
  return stdout
    .split("\0")
    .filter((entry) => entry.length > 2 && !entry.startsWith("S "))
    .map((entry) => entry.slice(2))
    .filter((filePath) => !shouldSkipPath(filePath));
});

const readAuditFiles = Effect.fn("brandAudit.readFiles")(function* (
  root: string,
  filePaths: ReadonlyArray<string>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* Effect.forEach(
    filePaths,
    (filePath) => {
      const absolutePath = path.join(root, filePath);
      return fs.readLink(absolutePath).pipe(
        Effect.option,
        Effect.flatMap((linkTarget) =>
          Option.isSome(linkTarget)
            ? Effect.succeed({ path: filePath, contents: linkTarget.value })
            : fs.stream(absolutePath, { bytesToRead: 8192 }).pipe(
                Stream.runCollect,
                Effect.flatMap((chunks) =>
                  chunks.some((chunk) => chunk.includes(0))
                    ? Effect.succeed(null)
                    : fs.readFile(absolutePath).pipe(
                        Effect.map((bytes) => ({
                          path: filePath,
                          contents: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes),
                        })),
                      ),
                ),
              ),
        ),
      );
    },
    { concurrency: 16 },
  );
  return files.filter((file): file is BrandAuditFile => file !== null);
});

const printAuditResult = Effect.fn("brandAudit.printResult")(function* (
  result: BrandAuditResult,
  list: boolean,
) {
  const grouped = new Map<string, Map<string, number>>();
  for (const hit of result.hits) {
    if (list) {
      yield* Console.log(`${hit.path}:${hit.line}: [${hit.pattern}] ${hit.match}`);
      continue;
    }
    const patterns = grouped.get(hit.path) ?? new Map<string, number>();
    patterns.set(hit.pattern, (patterns.get(hit.pattern) ?? 0) + 1);
    grouped.set(hit.path, patterns);
  }

  for (const [filePath, patterns] of [...grouped].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    yield* Console.log(filePath);
    for (const [pattern, count] of patterns) {
      yield* Console.log(`  ${pattern}: ${count}`);
    }
  }
  yield* Console.log(`Non-allowlisted total: ${result.hits.length}`);
  yield* Console.log(`Allowlisted total: ${result.allowlistedTotal}`);
});

export const runBrandAudit = Effect.fn("runBrandAudit")(function* (
  options: BrandAuditFilters & {
    readonly strict: boolean;
    readonly list: boolean;
    readonly fix: boolean;
    readonly dryRun: boolean;
  },
) {
  const invalidFilter = patternFilterError(options);
  if (invalidFilter !== undefined) return yield* invalidFilter;
  if (options.dryRun && !options.fix) {
    return yield* new BrandAuditFixError({ message: "--dry-run requires --fix." });
  }
  if (options.fix && !options.dryRun && !options.paths?.length && !options.patterns?.length) {
    return yield* new BrandAuditFixError({
      message: "--fix requires at least one --path or --pattern filter.",
    });
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* repositoryRoot;
  const allowlistSource = yield* fs.readFileString(path.join(root, "scripts/brand-allowlist.json"));
  const allowlist = yield* Effect.try({
    try: () => loadBrandAllowlist(allowlistSource),
    catch: (cause) => new BrandAuditAllowlistError({ cause }),
  });
  let files = yield* readAuditFiles(
    root,
    (yield* trackedFiles(root)).filter((filePath) => matchesFilters(filePath, options.paths)),
  );
  if (options.fix) {
    const fixed = fixBrandFiles(files, allowlist, options);
    const changedFiles = fixed.files.filter(
      (file, index) => file.contents !== files[index]?.contents,
    );
    if (options.dryRun) {
      for (const replacement of fixed.replacements) {
        yield* Console.log(
          `${replacement.path}:${replacement.line}: [${replacement.id}] ${replacement.before} → ${replacement.after}`,
        );
      }
    } else {
      // The reader audits link targets as text; never write through a link into another file.
      for (const file of changedFiles) {
        const target = yield* fs.readLink(path.join(root, file.path)).pipe(Effect.option);
        if (Option.isSome(target)) {
          return yield* new BrandAuditFixError({
            message: `Cannot rewrite symbolic link ${file.path}.`,
          });
        }
      }
      for (const file of changedFiles) {
        yield* fs.writeFileString(path.join(root, file.path), file.contents);
      }
    }
    files = fixed.files;
    yield* Console.log(`Changes: ${fixed.changes} in ${changedFiles.length} files`);
  }
  const result = auditBrandFiles(files, allowlist, options);
  yield* printAuditResult(result, options.list);
  if (options.strict && result.hits.length > 0) {
    return yield* new BrandAuditStrictError({ hitCount: result.hits.length });
  }
  return result;
});

export const brandAuditCommand = Command.make(
  "brand-audit",
  {
    paths: Flag.String("path").pipe(
      Flag.withDescription("Limit the audit to matching paths (repeatable)."),
      Flag.atLeast(0),
    ),
    patterns: Flag.String("pattern").pipe(
      Flag.withDescription("Include matching pattern ids (repeatable)."),
      Flag.atLeast(0),
    ),
    excludePatterns: Flag.String("exclude-pattern").pipe(
      Flag.withDescription("Exclude matching pattern ids (repeatable)."),
      Flag.atLeast(0),
    ),
    list: Flag.Boolean("list").pipe(
      Flag.withDescription("Print every hit with its line and pattern id."),
      Flag.withDefault(false),
    ),
    fix: Flag.Boolean("fix").pipe(
      Flag.withDescription("Rewrite supported hits in an explicit path or pattern slice."),
      Flag.withDefault(false),
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDescription(
        "With --fix, print replacements without writing files; filters are optional.",
      ),
      Flag.withDefault(false),
    ),
    strict: Flag.Boolean("strict").pipe(
      Flag.withDescription("Exit with an error when non-allowlisted hits remain."),
      Flag.withDefault(false),
    ),
  },
  (options) => runBrandAudit(options).pipe(Effect.scoped),
).pipe(Command.withDescription("Audit tracked source files for legacy brand identifiers."));

if (import.meta.main) {
  Command.run(brandAuditCommand, { version: "0.0.0" }).pipe(
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
  );
}
