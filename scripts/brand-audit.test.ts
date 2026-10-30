import { describe, expect, it } from "vite-plus/test";

import { auditBrandFiles, fixBrandFiles, loadBrandAllowlist } from "./brand-audit.ts";

const scopedPackage = `@t${3}tools`;

describe("brand audit", () => {
  it("excludes a hit covered by an allowlisted path and pattern", () => {
    const allowlist = loadBrandAllowlist(
      JSON.stringify([{ path: "src/kept.ts", pattern: scopedPackage, reason: "Kept on purpose." }]),
    );

    expect(auditBrandFiles([{ path: "src/kept.ts", contents: scopedPackage }], allowlist)).toEqual({
      hits: [],
      allowlistedTotal: 1,
    });
  });

  it("counts a hit when the allowlisted path pattern does not match", () => {
    const allowlist = loadBrandAllowlist(
      JSON.stringify([{ path: "src/file.ts", pattern: "unrelated", reason: "Kept on purpose." }]),
    );

    expect(
      auditBrandFiles([{ path: "src/file.ts", contents: scopedPackage }], allowlist).hits,
    ).toHaveLength(1);
  });

  it("counts a hit in an unlisted file", () => {
    expect(
      auditBrandFiles([{ path: "src/file.ts", contents: scopedPackage }], []).hits,
    ).toHaveLength(1);
  });

  it("rejects an allowlist entry without a reason", () => {
    expect(() => loadBrandAllowlist(JSON.stringify([{ path: "src/file.ts" }]))).toThrow(
      "must have a non-empty reason",
    );
  });

  it("matches allowlist patterns against each whole source line and hit span", () => {
    const tag = `${scopedPackage}/desktop/electron/ElectronPowerMonitor`;
    const source = [`>()("${tag}") {}`, `see ${scopedPackage} docs`].join("\n");
    const allowlist = loadBrandAllowlist(
      JSON.stringify([
        {
          path: "src/file.ts",
          pattern: `${scopedPackage}/[A-Za-z0-9/_-]+`,
          reason: "Service tag under test.",
        },
      ]),
    );

    const result = auditBrandFiles([{ path: "src/file.ts", contents: source }], allowlist);

    expect(result.allowlistedTotal).toBe(1);
    expect(result.hits).toHaveLength(1);
    expect(result.hits.every((hit) => hit.line === 2)).toBe(true);
  });

  it("filters paths and pattern ids, including exclusions", () => {
    const command = `npx t${3} serve`;
    const files = [
      { path: "packages/ssh/src/client.ts", contents: `${command}\n${scopedPackage}` },
      { path: "scripts/run.ts", contents: command },
      { path: "apps/server/src/run.ts", contents: command },
    ];
    const filters = {
      paths: ["packages/ssh/**", "scripts/**"],
      patterns: ["cli-*", "scope-*"],
      excludePatterns: ["cli-subcommand", "scope-*"],
    };
    expect(auditBrandFiles(files, [], filters)).toEqual({
      hits: [
        { path: files[0]!.path, line: 1, pattern: "cli-npx", match: `npx t${3}` },
        { path: files[1]!.path, line: 1, pattern: "cli-npx", match: `npx t${3}` },
      ],
      allowlistedTotal: 0,
    });
    expect(fixBrandFiles(files, [], filters).files).toEqual([files[0], files[1], files[2]]);
    expect(() => auditBrandFiles(files, [], { patterns: ["cli_*"] })).toThrow("cli_*");
    expect(() => fixBrandFiles(files, [], { excludePatterns: ["scope_at"] })).toThrow("scope_at");
  });

  it("fixes an unlisted span while preserving an allowlisted span on the same line", () => {
    const legacyName = `T${3} Code`;
    const legacyDomain = `t${3}.codes`;
    const files = [
      {
        path: "src/file.ts",
        contents: `${legacyName}; ${legacyDomain}; keep ${legacyName}; ${legacyName}\r\n`,
      },
    ];
    const allowlist = [
      {
        path: "src/file.ts",
        pattern: `keep ${legacyName}`,
        reason: "Keep the exception as edits on both sides shift its position.",
      },
    ];
    expect(fixBrandFiles(files, allowlist)).toEqual({
      files: [
        {
          path: "src/file.ts",
          contents: `ChatAndCode; chatcode.ca; keep ${legacyName}; ChatAndCode\r\n`,
        },
      ],
      changes: 3,
      replacements: [
        {
          path: "src/file.ts",
          line: 1,
          id: "name-spaced",
          before: `${legacyName}; ${legacyDomain}; keep ${legacyName}; ${legacyName}`,
          after: `ChatAndCode; ${legacyDomain}; keep ${legacyName}; ${legacyName}`,
        },
        {
          path: "src/file.ts",
          line: 1,
          id: "domain",
          before: `ChatAndCode; ${legacyDomain}; keep ${legacyName}; ${legacyName}`,
          after: `ChatAndCode; chatcode.ca; keep ${legacyName}; ${legacyName}`,
        },
        {
          path: "src/file.ts",
          line: 1,
          id: "name-spaced",
          before: `ChatAndCode; chatcode.ca; keep ${legacyName}; ${legacyName}`,
          after: `ChatAndCode; chatcode.ca; keep ${legacyName}; ChatAndCode`,
        },
      ],
    });
  });

  it("fixes specific overlaps first and preserves the context around brand tokens", () => {
    const legacyLower = `t${3}`;
    const legacyUpper = `T${3}`;
    const contents = [
      `https://app.${legacyLower}.codes`,
      `github.com/pingdotgg/${legacyLower}code`,
      `${legacyUpper}_PROJECT_FILE_NAME`,
      scopedPackage,
      `${legacyLower}-mobile`,
      `\`${legacyLower} pair\``,
      `${legacyLower} auth`,
      `${legacyLower} __service-preflight`,
      `node_modules/${legacyLower}`,
      `node_modules\\${legacyLower}`,
      `"node_modules", "${legacyLower}"`,
      `--filter=!${legacyLower}`,
      `command -v ${legacyLower}`,
      `npx ${legacyLower}@latest`,
      `${legacyLower}code ${legacyUpper}CODE ${legacyUpper}cOdE ${legacyUpper}Code`,
      `${legacyUpper}CODE_PORT`,
      `my${legacyLower}code ${legacyLower}tools "${legacyLower}"`,
    ].join("\n");
    const fixed = fixBrandFiles([{ path: "src/file.ts", contents }], []);
    expect(fixed.files[0]?.contents).toBe(
      [
        "https://app.chatcode.ca",
        "github.com/karyashaala/chatandcode",
        "CHATANDCODE_PROJECT_FILE_NAME",
        "@cctools",
        "chatandcode-mobile",
        "`chatandcode pair`",
        "chatandcode auth",
        "chatandcode __service-preflight",
        "node_modules/chatandcode",
        "node_modules\\chatandcode",
        '"node_modules", "chatandcode"',
        "--filter=!chatandcode",
        "command -v chatandcode",
        "npx chatandcode@latest",
        `chatandcode CHATANDCODE ${legacyUpper}cOdE ChatAndCode`,
        "CHATANDCODE_PORT",
        `my${legacyLower}code ${legacyLower}tools "${legacyLower}"`,
      ].join("\n"),
    );
    expect(auditBrandFiles(fixed.files, []).hits.map((hit) => hit.pattern)).toEqual([
      "name-lower",
      "name-lower",
      "scope-bare",
      "name-my",
      "cli-quoted",
    ]);
    for (const [contents, pattern, expected] of [
      [`https://app.${legacyLower}.codes`, "dotdir", "https://app.chatcode.ca"],
      [`github.com/pingdotgg/${legacyLower}code`, "name-*", "github.com/karyashaala/chatandcode"],
      [`~/.my${legacyLower}code`, "name-lower", `~/.my${legacyLower}code`],
    ] as const) {
      const files = [{ path: "src/file.ts", contents }];
      expect(fixBrandFiles(files, [], { patterns: [pattern] })).toEqual({
        files,
        changes: 0,
        replacements: [],
      });
      expect(fixBrandFiles(files, []).files[0]?.contents).toBe(expected);
    }
    for (const [contents, filters, expected] of [
      [`${legacyUpper}CODE_PORT=1`, { patterns: [`env-${legacyLower}code`] }, "CHATANDCODE_PORT=1"],
      [`\`${legacyLower} serve\``, { patterns: ["cli-subcommand"] }, "`chatandcode serve`"],
      [`npx ${legacyLower} serve`, { patterns: ["cli-subcommand"] }, "npx chatandcode serve"],
      [
        `${legacyUpper}CODE_HOME`,
        { excludePatterns: [`env-${legacyLower}code`] },
        `${legacyUpper}CODE_HOME`,
      ],
      [`x.${legacyLower}-code`, { excludePatterns: ["dash"] }, `x.${legacyLower}-code`],
    ] as const) {
      const files = [{ path: "src/file.ts", contents }];
      expect(fixBrandFiles(files, [], filters).files[0]?.contents).toBe(expected);
    }
  });

  it("makes no changes on a second fix pass", () => {
    const files = [
      {
        path: "src/file.ts",
        contents: `T${3} Code at https://app.t${3}.codes uses ${scopedPackage}; myt${3}code stays`,
      },
    ];
    const first = fixBrandFiles(files, []);
    expect(first.changes).toBeGreaterThan(0);
    expect(fixBrandFiles(first.files, [])).toEqual({
      files: first.files,
      changes: 0,
      replacements: [],
    });
  });

  it("matches dot-named paths in path filters and allowlist entries", () => {
    const files = [
      { path: "apps/mobile/.swiftlint.yml", contents: `T${3}Code` },
      { path: ".github/workflows/check.yml", contents: `--filter t${3}` },
      { path: "infra/relay/.env.example", contents: `T${3} server` },
    ];
    expect(auditBrandFiles(files, [], { paths: ["**"] }).hits.map((hit) => hit.path)).toEqual([
      files[0]!.path,
      files[0]!.path,
      files[1]!.path,
      files[2]!.path,
    ]);
    expect(
      auditBrandFiles(files, [], { paths: ["apps/mobile/**"], patterns: ["name-pascal"] }).hits,
    ).toHaveLength(1);
    const allowlist = [{ path: "**", reason: "All fixture paths are protected." }];
    expect(auditBrandFiles(files, allowlist, { paths: ["**"] })).toEqual({
      hits: [],
      allowlistedTotal: 4,
    });
    expect(fixBrandFiles(files, allowlist, { paths: ["**"] }).changes).toBe(0);
    expect(
      auditBrandFiles(files, [{ path: "infra/relay/**", reason: "Relay fixture." }], {
        paths: ["infra/relay/**"],
      }).hits,
    ).toEqual([]);
    expect(fixBrandFiles(files, [], { paths: ["apps/mobile/**"] }).files[0]?.contents).toBe(
      "ChatAndCode",
    );
  });

  it("rewrites dash slugs beside underscores and retains other suffixes", () => {
    const legacy = `t${3}`;
    const files = [
      { path: "src/file.ts", contents: `${legacy}-code mcp__${legacy}-code__x ${legacy}-mobile` },
    ];
    expect(auditBrandFiles(files, [], { patterns: ["dash"] }).hits.map((hit) => hit.match)).toEqual(
      [`${legacy}-code`, `${legacy}-code`, `${legacy}-mobile`],
    );
    expect(fixBrandFiles(files, [], { patterns: ["dash"] }).files[0]?.contents).toBe(
      "chatandcode mcp__chatandcode__x chatandcode-mobile",
    );
  });

  it("rewrites app ids whole and preserves protected identifiers and hostnames", () => {
    const legacy = `t${3}`;
    const appId = `com.${legacy}tools.${legacy}code.dev`;
    const rdns = `com.${legacy}tools.T${3}Code.desktop`;
    const objectPath = `/com/${legacy}tools/T${3}Code/desktop`;
    const host = `pocket-pi.${legacy}.sh`;
    const bundleId = `codes.${legacy}.mobile`;
    const property = `${legacy}CodeVersion`;
    const contents = [appId, rdns, objectPath, host, bundleId, property].join("\n");
    const fixed = fixBrandFiles([{ path: "src/file.ts", contents }], []);
    expect(fixed.files[0]?.contents).toBe(
      ["ca.chatcode.chatandcode.dev", rdns, objectPath, host, bundleId, property].join("\n"),
    );
    expect(fixed.changes).toBe(1);
    const hits = auditBrandFiles(fixed.files, []).hits;
    expect(hits.filter((hit) => hit.pattern === "rdns").map((hit) => hit.match)).toEqual([
      rdns,
      objectPath.slice(1),
    ]);
    expect(hits).toContainEqual({
      path: "src/file.ts",
      line: 4,
      pattern: "domain-sh",
      match: `${legacy}.sh`,
    });
    expect(hits).toContainEqual({
      path: "src/file.ts",
      line: 6,
      pattern: "name-lower",
      match: `${legacy}Code`,
    });
    expect(hits.some((hit) => hit.pattern === "dotdir")).toBe(false);
    expect(
      auditBrandFiles([{ path: "src/file.ts", contents: appId }], [], { patterns: ["rdns"] }).hits,
    ).toEqual([]);
    const repositoryUrls = [
      `https://github.com/${legacy}tools/other/pull/7`,
      `https://gitlab.com/${legacy}tools/platform/T${3}Code.git`,
    ];
    const repositoryFiles = [{ path: "src/file.ts", contents: repositoryUrls.join("\n") }];
    expect(auditBrandFiles(repositoryFiles, [], { patterns: ["rdns"] }).hits).toEqual([]);
    expect(fixBrandFiles(repositoryFiles, []).files[0]?.contents).toBe(
      [repositoryUrls[0], `https://gitlab.com/${legacy}tools/platform/ChatAndCode.git`].join("\n"),
    );
  });

  it("reports bare organizations separately from scoped imports and rewrites repository fixtures", () => {
    const org = `t${3}tools`;
    const repository = `${org}/t${3}code`;
    const files = [{ path: "src/file.ts", contents: `@${org}/shared\n${org}\n${repository}` }];
    expect(
      auditBrandFiles(files, [], { patterns: ["scope-bare"] }).hits.map((hit) => hit.line),
    ).toEqual([2, 3]);
    expect(
      auditBrandFiles(files, [], { excludePatterns: ["scope-at"] }).hits.some(
        (hit) => hit.line === 1,
      ),
    ).toBe(false);
    expect(fixBrandFiles(files, []).files[0]?.contents).toBe(
      `@cctools/shared\n${org}\nkaryashaala/chatandcode`,
    );
  });

  it("rewrites bare product prose while leaving excluded phrases to their own rules", () => {
    const legacy = `T${3}`;
    const excluded = [`${legacy} Code`, `${legacy} Connect`, `${legacy} Tools`, `${legacy} Chat`];
    const files = [{ path: "src/file.ts", contents: [`${legacy} server`, ...excluded].join("\n") }];
    expect(auditBrandFiles(files, [], { patterns: ["name-bare"] }).hits).toEqual([
      { path: "src/file.ts", line: 1, pattern: "name-bare", match: `${legacy} ` },
    ]);
    expect(fixBrandFiles(files, [], { patterns: ["name-bare"] }).files[0]?.contents).toBe(
      ["ChatAndCode server", ...excluded].join("\n"),
    );
    expect(fixBrandFiles(files, []).files[0]?.contents).toBe(
      ["ChatAndCode server", "ChatAndCode", "ChatAndCode Connect", excluded[2], excluded[3]].join(
        "\n",
      ),
    );
  });

  it("returns replacement records with source lines and successive before and after text", () => {
    const legacy = `t${3}`;
    const before = `mcp_servers.${legacy}-code uses com.${legacy}tools.${legacy}code.dev`;
    const intermediate = `mcp_servers.chatandcode uses com.${legacy}tools.${legacy}code.dev`;
    const after = "mcp_servers.chatandcode uses ca.chatcode.chatandcode.dev";
    expect(
      fixBrandFiles([{ path: "src/file.ts", contents: `unchanged\r\n${before}\r\n` }], []),
    ).toEqual({
      files: [{ path: "src/file.ts", contents: `unchanged\r\n${after}\r\n` }],
      changes: 2,
      replacements: [
        { path: "src/file.ts", line: 2, id: "dash", before, after: intermediate },
        { path: "src/file.ts", line: 2, id: "app-id", before: intermediate, after },
      ],
    });
  });
});
