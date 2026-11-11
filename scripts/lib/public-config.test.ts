// @effect-diagnostics nodeBuiltinImport:off - Tests exercise root env file precedence directly.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { loadRepoEnv } from "./public-config.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    NodeFS.rmSync(directory, { recursive: true, force: true });
  }
});

describe("loadRepoEnv", () => {
  it.each([
    "CHATANDCODE_CLERK_PUBLISHABLE_KEY",
    "CHATANDCODE_CLERK_JWT_TEMPLATE",
    "CHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID",
    "CHATANDCODE_RELAY_URL",
  ])("requires %s without exposing configuration values", (missingKey) => {
    const config = {
      CHATANDCODE_CLERK_PUBLISHABLE_KEY: "pk_guard",
      CHATANDCODE_CLERK_JWT_TEMPLATE: "template_guard",
      CHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_guard",
      CHATANDCODE_RELAY_URL: "https://guard.example.test",
    };

    expect(() =>
      loadRepoEnv({
        baseEnv: { ...config, CHATANDCODE_REQUIRE_CONNECT: "1", [missingKey]: undefined },
        repoRoot: makeTemporaryDirectory(),
      }),
    ).toThrowError(
      new Error(
        `ChatAndCode Connect is required for this build. Set ${missingKey} in the repository-root .env.local or build environment. See docs/operations/connect-setup.md.`,
      ),
    );
  });

  it("rejects an HTTP relay when Connect is required", () => {
    expect(() =>
      loadRepoEnv({
        baseEnv: {
          CHATANDCODE_REQUIRE_CONNECT: "1",
          CHATANDCODE_CLERK_PUBLISHABLE_KEY: "pk_guard",
          CHATANDCODE_CLERK_JWT_TEMPLATE: "template_guard",
          CHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_guard",
          CHATANDCODE_RELAY_URL: "http://guard.example.test",
        },
        repoRoot: makeTemporaryDirectory(),
      }),
    ).toThrowError(
      new Error(
        "ChatAndCode Connect is required for this build. CHATANDCODE_RELAY_URL must be an HTTPS origin without credentials, a path, query, or fragment.",
      ),
    );
  });

  it("accepts complete configuration when root local env requires Connect", () => {
    const repoRoot = makeTemporaryDirectory();
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env.local"),
      "CHATANDCODE_REQUIRE_CONNECT=1\nCHATANDCODE_CLERK_PUBLISHABLE_KEY=pk_local\nCHATANDCODE_CLERK_JWT_TEMPLATE=template_local\nCHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID=oauth_local\nCHATANDCODE_RELAY_URL=https://local.example.test\n",
    );

    expect(loadRepoEnv({ baseEnv: {}, repoRoot })).toMatchObject({
      CHATANDCODE_REQUIRE_CONNECT: "1",
      CHATANDCODE_CLERK_PUBLISHABLE_KEY: "pk_local",
      CHATANDCODE_CLERK_JWT_TEMPLATE: "template_local",
      CHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_local",
      CHATANDCODE_RELAY_URL: "https://local.example.test",
    });
  });

  it("applies process, root local, and root precedence in that order", () => {
    const repoRoot = makeTemporaryDirectory();
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env"),
      "CHATANDCODE_CLERK_PUBLISHABLE_KEY=pk_root\nCHATANDCODE_CLERK_JWT_TEMPLATE=template_root\nCHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID=oauth_root\nCHATANDCODE_RELAY_URL=https://root.example.test\n",
    );
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env.local"),
      "CHATANDCODE_CLERK_PUBLISHABLE_KEY=pk_local\nCHATANDCODE_CLERK_JWT_TEMPLATE=template_local\nCHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID=oauth_local\nCHATANDCODE_RELAY_URL=https://local.example.test\n",
    );

    expect(loadRepoEnv({ baseEnv: {}, repoRoot }).CHATANDCODE_RELAY_URL).toBe(
      "https://local.example.test",
    );
    expect(
      loadRepoEnv({
        baseEnv: {
          CHATANDCODE_CLERK_PUBLISHABLE_KEY: "pk_ci",
          CHATANDCODE_CLERK_JWT_TEMPLATE: "template_ci",
          CHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_ci",
          CHATANDCODE_RELAY_URL: "https://ci.example.test",
        },
        repoRoot,
      }),
    ).toMatchObject({
      CHATANDCODE_CLERK_PUBLISHABLE_KEY: "pk_ci",
      CHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_ci",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_ci",
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_ci",
      CHATANDCODE_CLERK_JWT_TEMPLATE: "template_ci",
      VITE_CLERK_JWT_TEMPLATE: "template_ci",
      EXPO_PUBLIC_CLERK_JWT_TEMPLATE: "template_ci",
      CHATANDCODE_RELAY_URL: "https://ci.example.test",
      VITE_CHATANDCODE_RELAY_URL: "https://ci.example.test",
    });
  });
});

function makeTemporaryDirectory() {
  const directory = NodeFS.mkdtempSync(
    NodePath.join(NodeOS.tmpdir(), "chatandcode-public-config-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}
