// @effect-diagnostics nodeBuiltinImport:off - Tests exercise root env file precedence directly.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { loadRepoEnv, resolvePublicConfig } from "./public-config.ts";

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

  it("does not project cloud configuration for an unconfigured clone", () => {
    const env = loadRepoEnv({ baseEnv: {}, repoRoot: makeTemporaryDirectory() });

    expect(env.CHATANDCODE_CLERK_PUBLISHABLE_KEY).toBeUndefined();
    expect(env.CHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID).toBeUndefined();
    expect(env.VITE_CLERK_PUBLISHABLE_KEY).toBeUndefined();
    expect(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY).toBeUndefined();
    expect(env.CHATANDCODE_CLERK_JWT_TEMPLATE).toBeUndefined();
    expect(env.VITE_CLERK_JWT_TEMPLATE).toBeUndefined();
    expect(env.EXPO_PUBLIC_CLERK_JWT_TEMPLATE).toBeUndefined();
    expect(env.CHATANDCODE_RELAY_URL).toBeUndefined();
    expect(env.VITE_CHATANDCODE_RELAY_URL).toBeUndefined();
    expect(env.CHATANDCODE_MOBILE_OTLP_TRACES_URL).toBeUndefined();
    expect(env.CHATANDCODE_MOBILE_OTLP_TRACES_DATASET).toBeUndefined();
    expect(env.CHATANDCODE_MOBILE_OTLP_TRACES_TOKEN).toBeUndefined();
    expect(env.EXPO_PUBLIC_OTLP_TRACES_URL).toBeUndefined();
    expect(env.EXPO_PUBLIC_OTLP_TRACES_DATASET).toBeUndefined();
    expect(env.EXPO_PUBLIC_OTLP_TRACES_TOKEN).toBeUndefined();
    expect(env.CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_URL).toBeUndefined();
    expect(env.CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_DATASET).toBeUndefined();
    expect(env.CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_TOKEN).toBeUndefined();
    expect(env.VITE_RELAY_OTLP_TRACES_URL).toBeUndefined();
    expect(env.VITE_RELAY_OTLP_TRACES_DATASET).toBeUndefined();
    expect(env.VITE_RELAY_OTLP_TRACES_TOKEN).toBeUndefined();
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

  it("accepts legacy framework aliases as root overrides", () => {
    expect(
      resolvePublicConfig({
        VITE_CLERK_PUBLISHABLE_KEY: "pk_legacy",
        VITE_CLERK_JWT_TEMPLATE: "template_legacy",
        CHATANDCODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_canonical",
        VITE_CHATANDCODE_RELAY_URL: "https://legacy.example.test",
        EXPO_PUBLIC_OTLP_TRACES_URL: "https://api.axiom.co/v1/traces",
        EXPO_PUBLIC_OTLP_TRACES_DATASET: "mobile-traces",
        EXPO_PUBLIC_OTLP_TRACES_TOKEN: "mobile-token",
      }),
    ).toEqual({
      clerkPublishableKey: "pk_legacy",
      clerkJwtTemplate: "template_legacy",
      clerkCliOAuthClientId: "oauth_canonical",
      relayUrl: "https://legacy.example.test",
      mobileOtlpTracesUrl: "https://api.axiom.co/v1/traces",
      mobileOtlpTracesDataset: "mobile-traces",
      mobileOtlpTracesToken: "mobile-token",
      relayClientOtlpTracesUrl: undefined,
      relayClientOtlpTracesDataset: undefined,
      relayClientOtlpTracesToken: undefined,
    });
  });

  it("projects canonical relay client tracing values to web build aliases", () => {
    expect(
      loadRepoEnv({
        baseEnv: {
          CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_URL: "https://api.axiom.co/v1/traces",
          CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_DATASET: "relay-client-traces",
          CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_TOKEN: "relay-client-token",
        },
        repoRoot: makeTemporaryDirectory(),
      }),
    ).toEqual({
      CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_URL: "https://api.axiom.co/v1/traces",
      CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_DATASET: "relay-client-traces",
      CHATANDCODE_RELAY_CLIENT_OTLP_TRACES_TOKEN: "relay-client-token",
      VITE_RELAY_OTLP_TRACES_URL: "https://api.axiom.co/v1/traces",
      VITE_RELAY_OTLP_TRACES_DATASET: "relay-client-traces",
      VITE_RELAY_OTLP_TRACES_TOKEN: "relay-client-token",
    });
  });

  it("projects canonical mobile tracing values to Expo public aliases", () => {
    expect(
      loadRepoEnv({
        baseEnv: {
          CHATANDCODE_RELAY_URL: "https://relay.example.test",
          CHATANDCODE_MOBILE_OTLP_TRACES_URL: "https://api.axiom.co/v1/traces",
          CHATANDCODE_MOBILE_OTLP_TRACES_DATASET: "mobile-traces",
          CHATANDCODE_MOBILE_OTLP_TRACES_TOKEN: "mobile-token",
        },
        repoRoot: makeTemporaryDirectory(),
      }),
    ).toEqual({
      CHATANDCODE_RELAY_URL: "https://relay.example.test",
      VITE_CHATANDCODE_RELAY_URL: "https://relay.example.test",
      CHATANDCODE_MOBILE_OTLP_TRACES_URL: "https://api.axiom.co/v1/traces",
      CHATANDCODE_MOBILE_OTLP_TRACES_DATASET: "mobile-traces",
      CHATANDCODE_MOBILE_OTLP_TRACES_TOKEN: "mobile-token",
      EXPO_PUBLIC_OTLP_TRACES_URL: "https://api.axiom.co/v1/traces",
      EXPO_PUBLIC_OTLP_TRACES_DATASET: "mobile-traces",
      EXPO_PUBLIC_OTLP_TRACES_TOKEN: "mobile-token",
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
