# ChatAndCode

ChatAndCode is an "agent harness control surface". It enables control of the agents on your machine with a mobile app, [web app](https://app.chatcode.ca) and [Electron-based desktop app](https://github.com/karyashaala/chatandcode/releases). App Store and Google Play releases are coming.

Works with your subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, and Google Antigravity. If they're set up on your computer, ChatAndCode can control them.

## "Wait, what are you selling me?"

ChatAndCode is built on T3 Code.

We wanted something performant, remote-ready, and truly open. If we ever go the wrong direction, we want you to have everything you need to fork and build the editor that you want.

## Credits

ChatAndCode is a fork of T3 Code by T3 Tools Inc., used under the MIT license (see LICENSE).

Thank you to Theo and the [T3 Code contributors](https://github.com/pingdotgg/t3code) for building the foundation.

## Installation

> [!WARNING]
> ChatAndCode currently supports Codex, Claude, Cursor, Grok Build, OpenCode, and Antigravity. Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `agent login`
> - Grok Build: install [Grok Build CLI](https://x.ai/cli) and run `grok login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`
> - Antigravity: enable it in Settings, then use **Install Antigravity** and **Sign in with Google**. No CLI is required.

### Command line

```bash
curl -fsSL https://chatcode.ca/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://chatcode.ca/install.ps1 | iex
```

Then run `chatandcode` to start the server and open the local web app. `chatandcode service install` keeps it running in the background, `chatandcode update` moves to a newer release, and `chatandcode --help` has the full reference.

To try it once without installing, run `npx chatandcode@latest` instead.

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/karyashaala/chatandcode/releases).

Winget, Homebrew, and AUR packages are coming. Nightly builds are available from [GitHub Releases](https://github.com/karyashaala/chatandcode/releases).

#### Debian, Ubuntu (`.deb`)

Download the `.deb` from [GitHub Releases](https://github.com/karyashaala/chatandcode/releases), then:

```bash
sudo apt install ./ChatAndCode-*.deb
```

## Some notes

We are very very early in this project. Expect bugs.

Pull requests are closed for now. Bugs and ideas go to [Issues](https://github.com/karyashaala/chatandcode/issues); questions go to [Discord](https://discord.gg/4DfrnRHSmh).

## Documentation

Full docs live in [docs/](./docs). There's no docs site yet.

- [FAQ](./docs/user/faq.md)
- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Appearance preferences](./docs/user/appearance.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Connect Claude Code, Codex, ChatGPT and other agents over MCP](./docs/user/outside-agents.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [Run ChatAndCode as a background service](./docs/user/background-service.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

## Build from source

### Install `vp`

ChatAndCode uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before reporting a bug.

Have a feature request? Start an [issue](https://github.com/karyashaala/chatandcode/issues).

Need support? Join the [Discord](https://discord.gg/4DfrnRHSmh).
