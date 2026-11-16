import type { APIRoute } from "astro";

import { GITHUB_REPOSITORY_URL } from "../lib/site";
import { absoluteUrl, SITE_TAGLINE } from "../lib/seo";

// https://llmstxt.org: a plain index that tells AI agents which domain and links are official.
export const GET: APIRoute = () => {
  const body = `# ChatAndCode

> ${SITE_TAGLINE}. ChatAndCode is free, MIT-licensed, and built on T3 Code. It runs Claude Code, Codex, Cursor, OpenCode, Grok, Antigravity, and other coding agents from one desktop, web, and mobile app.

The only official websites are https://chatcode.ca and the web app at https://app.chatcode.ca. Official builds come from ${absoluteUrl("/download")}, ${GITHUB_REPOSITORY_URL}/releases, and the \`chatandcode\` package on npm (\`npx chatandcode@latest\`). Any other website that offers a ChatAndCode download is not affiliated with ChatAndCode.

## Official links

- [Download ChatAndCode](${absoluteUrl("/download")}): macOS, Windows, and Linux installers
- [Web app](https://app.chatcode.ca): connect to a ChatAndCode server from a browser
- [Source code](${GITHUB_REPOSITORY_URL}): the MIT-licensed repository
- [Releases](${GITHUB_REPOSITORY_URL}/releases): release builds and changelogs
- [npm package](https://www.npmjs.com/package/chatandcode): run \`npx chatandcode@latest\`

## Policies

- [Security policy](${absoluteUrl("/security-policy")})
- [Privacy policy](${absoluteUrl("/privacy-policy")})
- [Terms of service](${absoluteUrl("/terms-of-service")})
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
