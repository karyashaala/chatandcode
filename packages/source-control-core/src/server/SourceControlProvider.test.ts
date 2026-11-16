import { assert, it } from "@effect/vitest";

import {
  repositoryPathFromRemoteUrl,
  transportSafeSourceControlErrorValue,
} from "./SourceControlProvider.ts";

it("removes URL credentials, query parameters, and fragments from error transport values", () => {
  assert.strictEqual(
    transportSafeSourceControlErrorValue(
      "https://user:secret@example.test/org/repo/pull/42?token=secret#discussion",
    ),
    "https://example.test/org/repo/pull/42",
  );
});

it.each([
  ["git@github.com:T3Tools/chatandcode.git", "T3Tools/chatandcode"],
  ["github.com:T3Tools/chatandcode.git", "T3Tools/chatandcode"],
  ["gitlab.com:T3Tools/platform/chatandcode", "T3Tools/platform/chatandcode"],
  ["https://github.com/T3Tools/chatandcode.git", "T3Tools/chatandcode"],
  ["C:/repos/chatandcode", null],
])("reads the repository path of %s", (remoteUrl, expected) => {
  assert.strictEqual(repositoryPathFromRemoteUrl(remoteUrl), expected);
});
