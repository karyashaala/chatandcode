import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as HostProcess from "@cctools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

import * as DesktopCliCommand from "./DesktopCliCommand.ts";
import * as DesktopCliShim from "./DesktopCliShim.ts";
import * as DesktopEnvironment from "./DesktopEnvironment.ts";

const environmentFor = (
  path: Path.Path,
  input: { home: string; baseDir: string; platform?: NodeJS.Platform; isPackaged?: boolean },
) =>
  DesktopEnvironment.DesktopEnvironment.of({
    path,
    platform: input.platform ?? "linux",
    isPackaged: input.isPackaged ?? true,
    homeDirectory: input.home,
    baseDir: input.baseDir,
    stateDir: path.join(input.baseDir, "userdata"),
    desktopSettingsPath: path.join(input.baseDir, "userdata", "desktop-settings.json"),
    serverRoot: "/opt/ChatAndCode/resources/app.asar",
    appImagePath: Option.none(),
  } as unknown as DesktopEnvironment.DesktopEnvironment["Service"]);

const commandIn = (
  input: {
    home: string;
    baseDir?: string;
    platform?: NodeJS.Platform;
    isPackaged?: boolean;
    env?: NodeJS.ProcessEnv;
  },
  spawner?: ChildProcessSpawner.ChildProcessSpawner["Service"],
) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const baseDir = input.baseDir ?? path.join(input.home, ".chatandcode");
    yield* fs.makeDirectory(path.join(baseDir, "userdata"), { recursive: true });
    const make = DesktopCliCommand.make.pipe(
      Effect.provideService(
        DesktopEnvironment.DesktopEnvironment,
        environmentFor(path, { ...input, baseDir }),
      ),
      Effect.provideService(HostProcess.Environment, input.env ?? { PATH: "", SHELL: "/bin/zsh" }),
    );
    return yield* spawner
      ? make.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))
      : make;
  });

/** `inherited` stands in for the app's own environment, which `extendEnv` passes on. */
const fakePowerShell = (initial: string, inherited: Record<string, string> = {}) => {
  const registry = { path: initial, failReads: false, writes: 0 };
  const spawner = ChildProcessSpawner.make((command) =>
    Effect.sync(() => {
      const { options } = command as unknown as {
        readonly options: { readonly env?: Record<string, string>; readonly extendEnv?: boolean };
      };
      const env = { ...(options.extendEnv ? inherited : {}), ...options.env };
      let exitCode = 0;
      let stdout = "";
      if (env.CHATANDCODE_SET === "1") {
        registry.path = env.CHATANDCODE_PATH ?? "";
        registry.writes += 1;
      } else if (registry.failReads) {
        exitCode = 1;
      } else {
        stdout = Buffer.from(registry.path, "utf8").toString("base64");
      }
      return ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(1),
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        unref: Effect.succeed(Effect.void),
        stdin: Sink.drain,
        stdout: Stream.make(new TextEncoder().encode(stdout)),
        stderr: Stream.empty,
        all: Stream.empty,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
      });
    }),
  );
  return { registry, spawner };
};

it.layer(NodeServices.layer)("DesktopCliCommand", (it) => {
  it.effect("links the launcher onto PATH and removes only that link", () =>
    Effect.gen(function* () {
      const env: NodeJS.ProcessEnv = { PATH: "", SHELL: "/bin/zsh" };
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped();
      const command = yield* commandIn({ home, env });
      const link = path.join(home, ".local", "bin", "chatandcode");

      expect(yield* command.state).toEqual({
        supported: true,
        installedPath: null,
        onPath: false,
        launcherPath: null,
      });
      yield* command.installOnFirstLaunch;
      expect((yield* command.state).installedPath).toBe(link);
      const installed = yield* command.install;
      expect(installed.installedPath).toBe(link);
      expect(installed.launcherPath).toBe(path.join(home, ".chatandcode", "bin", "chatandcode"));
      expect(installed.pathSetup).toEqual({ file: "~/.zshrc", added: false });
      expect(yield* fs.readLink(link)).toBe(path.join(home, ".chatandcode", "bin", "chatandcode"));
      expect((yield* command.install).installedPath).toBe(link);

      // Add to PATH appends one line, once, and keeps a final line with no newline intact.
      const zshrc = path.join(home, ".zshrc");
      yield* fs.writeFileString(zshrc, "# mine");
      // A folder already on PATH needs nothing.
      env.PATH = path.join(home, ".local", "bin");
      yield* command.addToPath;
      expect(yield* fs.readFileString(zshrc)).toBe("# mine");
      env.PATH = "";
      yield* Effect.all([command.addToPath, command.addToPath], { concurrency: "unbounded" });
      expect((yield* command.addToPath).pathSetup).toEqual({ file: "~/.zshrc", added: true });
      expect(yield* fs.readFileString(zshrc)).toBe(
        '# mine\n# Added by ChatAndCode\nexport PATH="$PATH:$HOME/.local/bin"\n',
      );

      expect((yield* command.uninstall).installedPath).toBeNull();
      expect(yield* fs.exists(link)).toBe(false);
      expect(yield* fs.exists(path.join(home, ".chatandcode", "bin", "chatandcode"))).toBe(true);
      // Removed stays removed: first launch never installs again.
      yield* command.installOnFirstLaunch;
      expect(yield* fs.exists(link)).toBe(false);

      // Also when first launch was put off (no shell PATH yet) and the user removed it meanwhile.
      const laterHome = yield* fs.makeTempDirectoryScoped();
      const later = yield* commandIn({ home: laterHome, env });
      yield* later.install;
      yield* later.uninstall;
      yield* later.installOnFirstLaunch;
      expect(yield* fs.exists(path.join(laterHome, ".local", "bin", "chatandcode"))).toBe(false);

      // An app that ran before left its settings or launcher. Its user may have removed chatandcode or
      // chosen another, so first launch leaves it to Settings, where Install still works.
      for (const left of ["userdata/desktop-settings.json", "bin/chatandcode"]) {
        const upgradedHome = yield* fs.makeTempDirectoryScoped();
        const leftFile = path.join(upgradedHome, ".chatandcode", left);
        yield* fs.makeDirectory(path.dirname(leftFile), { recursive: true });
        yield* fs.writeFileString(leftFile, `#!/bin/sh\n# ${DesktopCliShim.MARKER}\n`);
        const upgraded = yield* commandIn({ home: upgradedHome, env });
        yield* upgraded.installOnFirstLaunch;
        const upgradedLink = path.join(upgradedHome, ".local", "bin", "chatandcode");
        expect(yield* fs.exists(upgradedLink)).toBe(false);
        expect((yield* upgraded.install).installedPath).toBe(upgradedLink);
      }
    }).pipe(Effect.scoped),
  );

  it.effect("never replaces or removes a chatandcode it did not create", () =>
    Effect.gen(function* () {
      const env: NodeJS.ProcessEnv = { PATH: "", SHELL: "/bin/zsh" };
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped();
      const command = yield* commandIn({ home, env });
      const theirs = path.join(home, ".local", "bin", "chatandcode");
      yield* fs.makeDirectory(path.dirname(theirs), { recursive: true });
      yield* fs.writeFileString(theirs, "npm's chatandcode\n");
      yield* fs.makeDirectory(path.join(home, "bin"), { recursive: true });
      yield* fs.symlink(path.join(home, "gone"), path.join(home, "bin", "chatandcode"));

      const error = yield* Effect.flip(command.install);
      expect(error.message).toContain("Another chatandcode command is already in");
      yield* command.uninstall;
      expect(yield* fs.readFileString(theirs)).toBe("npm's chatandcode\n");
      expect(yield* fs.readLink(path.join(home, "bin", "chatandcode"))).toBe(
        path.join(home, "gone"),
      );

      // A fresh install beside someone else's chatandcode (even off PATH or a dangling link) adds no second
      // chatandcode in ~/bin.
      for (const dangling of [false, true]) {
        const besideHome = yield* fs.makeTempDirectoryScoped();
        const other = path.join(besideHome, ".local", "bin", "chatandcode");
        yield* fs.makeDirectory(path.dirname(other), { recursive: true });
        yield* dangling
          ? fs.symlink(path.join(besideHome, "gone"), other)
          : fs.writeFileString(other, "npm's chatandcode\n");
        yield* (yield* commandIn({ home: besideHome })).installOnFirstLaunch;
        expect(yield* fs.exists(path.join(besideHome, "bin", "chatandcode"))).toBe(false);
      }

      const launcher = path.join(home, ".chatandcode", "bin", "chatandcode");
      yield* fs.writeFileString(launcher, "npm's chatandcode\n");
      env.PATH = path.dirname(launcher);
      expect(yield* command.state).toMatchObject({ onPath: false, shadowedBy: launcher });
      expect((yield* Effect.flip(command.install)).message).toContain("Could not set up");
      yield* command.uninstall;
      expect(yield* fs.readFileString(launcher)).toBe("npm's chatandcode\n");
    }).pipe(Effect.scoped),
  );

  it.effect("finds and removes a link left by a previous ChatAndCode home", () =>
    Effect.gen(function* () {
      const env: NodeJS.ProcessEnv = { PATH: "", SHELL: "/bin/zsh" };
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped();
      const before = yield* commandIn({ home, baseDir: path.join(home, "old-chatandcode"), env });
      const link = (yield* before.install).installedPath;

      const after = yield* commandIn({ home, baseDir: path.join(home, "new-chatandcode"), env });
      // A first launch leaves another home's command alone; only Install takes it over.
      yield* after.installOnFirstLaunch;
      expect(yield* fs.readLink(link!)).toBe(
        path.join(home, "old-chatandcode", "bin", "chatandcode"),
      );
      // On PATH, it runs the other home's launcher. Settings offers Install (not Remove, and not
      // "another chatandcode runs first"), which updates that link in place.
      env.PATH = path.dirname(link!);
      expect(yield* after.state).toMatchObject({ installedPath: null, onPath: false });
      expect((yield* after.state).shadowedBy).toBeUndefined();
      env.PATH = "";
      // Off PATH, Add to PATH would expose the other home's command, not this one.
      expect((yield* after.state).pathSetup).toBeUndefined();
      yield* Effect.flip(after.addToPath);
      expect(yield* fs.exists(path.join(home, ".zshrc"))).toBe(false);
      // Behind another chatandcode the install fails, and the old link still works.
      const shadow = path.join(home, "shadow");
      yield* fs.makeDirectory(shadow);
      yield* fs.writeFileString(path.join(shadow, "chatandcode"), "#!/bin/sh\n", { mode: 0o755 });
      env.PATH = shadow;
      yield* Effect.flip(after.install);
      expect(yield* fs.readLink(link!)).toBe(
        path.join(home, "old-chatandcode", "bin", "chatandcode"),
      );
      // Install takes it over, also with its folder first on PATH.
      env.PATH = path.dirname(link!);
      expect((yield* after.install).installedPath).toBe(link);
      expect(yield* fs.readLink(link!)).toBe(
        path.join(home, "new-chatandcode", "bin", "chatandcode"),
      );
      env.PATH = "";
      yield* after.uninstall;
      expect(yield* fs.exists(path.join(home, ".local", "bin", "chatandcode"))).toBe(false);
      expect(yield* fs.exists(path.join(home, "bin", "chatandcode"))).toBe(false);

      // A folder already on PATH wins, even written with a trailing slash.
      env.PATH = `${path.join(home, "bin")}/`;
      expect((yield* after.install).installedPath).toBe(path.join(home, "bin", "chatandcode"));

      // An old link of ours is updated where it is, not moved to a folder that may be off PATH.
      yield* fs.writeFileString(path.join(home, "bin", "chatandcode.staging"), "mine");
      yield* fs.remove(path.join(home, "bin", "chatandcode"));
      yield* fs.symlink(
        path.join(home, "old-chatandcode", "bin", "chatandcode"),
        path.join(home, "bin", "chatandcode"),
      );
      env.PATH = "";
      expect((yield* after.install).installedPath).toBe(path.join(home, "bin", "chatandcode"));
      expect(yield* fs.readLink(path.join(home, "bin", "chatandcode"))).toBe(
        path.join(home, "new-chatandcode", "bin", "chatandcode"),
      );
      expect(yield* fs.exists(path.join(home, ".local", "bin", "chatandcode"))).toBe(false);
      expect(yield* fs.readFileString(path.join(home, "bin", "chatandcode.staging"))).toBe("mine");
    }).pipe(Effect.scoped),
  );

  it.effect("refuses to install behind another chatandcode that runs first", () =>
    Effect.gen(function* () {
      const env: NodeJS.ProcessEnv = { PATH: "", SHELL: "/bin/zsh" };
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped();
      const shadow = path.join(home, "shadow");
      yield* fs.makeDirectory(shadow);
      yield* fs.writeFileString(path.join(shadow, "chatandcode"), "#!/bin/sh\n", { mode: 0o755 });
      env.PATH = [shadow, `${path.join(home, ".local", "bin")}/`].join(":");

      const command = yield* commandIn({ home, env });
      const theirs = path.join(shadow, "chatandcode");
      expect((yield* command.state).shadowedBy).toBe(theirs);
      const error = yield* Effect.flip(command.install);
      expect(error.message).toContain(theirs);
      yield* command.installOnFirstLaunch;
      expect(yield* fs.exists(path.join(home, ".local", "bin", "chatandcode"))).toBe(false);
      expect(yield* fs.readFileString(theirs)).toBe("#!/bin/sh\n");

      // Its folder is already on PATH behind theirs; adding it again would change which chatandcode runs.
      yield* fs.makeDirectory(path.join(home, ".local", "bin"), { recursive: true });
      yield* fs.symlink(
        path.join(home, ".chatandcode", "bin", "chatandcode"),
        path.join(home, ".local", "bin", "chatandcode"),
      );
      const behind = yield* command.state;
      expect(behind.installedPath).toBe(path.join(home, ".local", "bin", "chatandcode"));
      expect(behind.pathSetup).toBeUndefined();
      // Off PATH behind theirs, adding the folder would still put ours first.
      env.PATH = shadow;
      expect((yield* command.state).pathSetup).toBeUndefined();
      yield* Effect.flip(command.addToPath);
      expect(yield* fs.exists(path.join(home, ".zshrc"))).toBe(false);
      env.PATH = [shadow, `${path.join(home, ".local", "bin")}/`].join(":");
      yield* fs.remove(path.join(home, ".local", "bin", "chatandcode"));

      // A first-launch install that failed is not retried behind the user's back.
      yield* fs.remove(theirs);
      yield* command.installOnFirstLaunch;
      expect(yield* fs.exists(path.join(home, ".local", "bin", "chatandcode"))).toBe(false);
      const installed = yield* command.install;
      expect(installed).toMatchObject({
        onPath: true,
        installedPath: path.join(home, ".local", "bin", "chatandcode"),
      });
      expect(installed.shadowedBy).toBeUndefined();
    }).pipe(Effect.scoped),
  );

  it.effect.skipIf(HostProcess.Platform.defaultValue() === "win32")(
    "skips a chatandcode directory or a file this user cannot execute",
    () =>
      Effect.gen(function* () {
        const env: NodeJS.ProcessEnv = { PATH: "", SHELL: "/bin/zsh" };
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* fs.makeTempDirectoryScoped();
        const folder = path.join(home, "folder");
        const plain = path.join(home, "plain");
        const shadow = path.join(home, "shadow");
        yield* fs.makeDirectory(path.join(folder, "chatandcode"), { recursive: true });
        yield* fs.makeDirectory(plain);
        yield* fs.writeFileString(path.join(plain, "chatandcode"), "notes\n");
        // Root can execute mode 0o601; other users must honor the owner permissions.
        yield* fs.chmod(path.join(plain, "chatandcode"), process.getuid?.() === 0 ? 0o600 : 0o601);
        yield* fs.makeDirectory(shadow);
        yield* fs.writeFileString(path.join(shadow, "chatandcode"), "#!/bin/sh\n", { mode: 0o755 });
        env.PATH = [folder, plain, shadow, path.join(home, ".local", "bin")].join(":");

        const command = yield* commandIn({ home, env });
        expect((yield* command.state).shadowedBy).toBe(path.join(shadow, "chatandcode"));

        const error = yield* Effect.flip(command.install);
        expect(error.message).toContain(path.join(shadow, "chatandcode"));

        yield* fs.remove(shadow, { recursive: true });
        expect(yield* command.install).toMatchObject({
          onPath: true,
          installedPath: path.join(home, ".local", "bin", "chatandcode"),
        });
      }).pipe(Effect.scoped),
  );

  it.effect(
    "does not treat its own launcher as another chatandcode when its folder is first on PATH",
    () =>
      Effect.gen(function* () {
        const env: NodeJS.ProcessEnv = { PATH: "", SHELL: "/bin/zsh" };
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* fs.makeTempDirectoryScoped();
        const launcher = path.join(home, ".chatandcode", "bin", "chatandcode");
        env.PATH = [path.dirname(launcher), path.join(home, ".local", "bin")].join(":");

        const command = yield* commandIn({ home, env });
        const installed = yield* command.install;

        expect(yield* fs.exists(launcher)).toBe(true);
        expect(installed).toMatchObject({
          onPath: true,
          installedPath: path.join(home, ".local", "bin", "chatandcode"),
        });
        expect(installed.shadowedBy).toBeUndefined();
        expect(yield* command.state).toEqual(installed);

        const removed = yield* command.uninstall;
        expect(removed.installedPath).toBeNull();
        expect(removed.onPath).toBe(true);
        expect(yield* command.state).toEqual(removed);
        expect(yield* fs.exists(installed.installedPath!)).toBe(false);
        expect(yield* fs.exists(launcher)).toBe(true);
      }).pipe(Effect.scoped),
  );

  it.effect("leaves the Windows PATH alone when it cannot be read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const home = yield* fs.makeTempDirectoryScoped();
      const userPath = "C:\\Users\\Me\\npm;%USERPROFILE%\\tools";
      const { registry, spawner } = fakePowerShell(userPath);
      const command = yield* commandIn({ home, platform: "win32" }, spawner);

      registry.failReads = true;
      const error = yield* Effect.flip(command.install);
      expect(error.message).toContain("left unchanged");
      expect(registry).toMatchObject({ path: userPath, writes: 0 });

      registry.failReads = false;
      const launcherDir = DesktopCliShim.launcherPath(
        environmentFor(yield* Path.Path, {
          home,
          baseDir: `${home}/.chatandcode`,
          platform: "win32",
        }),
      ).replace(/[\\/]chatandcode\.cmd$/, "");
      yield* command.install;
      expect(registry.path).toBe(`${userPath};${launcherDir}`);
      yield* command.uninstall;
      expect(registry.path).toBe(userPath);

      // A `;` in the folder would split it into two PATH entries, so nothing is written.
      const split = fakePowerShell(userPath);
      const semicolon = yield* commandIn(
        { home, baseDir: `${home}\\T3;Home`, platform: "win32" },
        split.spawner,
      );
      expect((yield* Effect.flip(semicolon.install)).message).toContain('has a ";"');
      expect(split.registry).toMatchObject({ path: userPath, writes: 0 });

      // An inherited CHATANDCODE_SET=1 never turns a read into a write of the whole PATH.
      const inherited = fakePowerShell(userPath, {
        CHATANDCODE_SET: "1",
        CHATANDCODE_PATH: "C:\\other",
      });
      const reader = yield* commandIn({ home, platform: "win32" }, inherited.spawner);
      yield* reader.install;
      expect(inherited.registry).toMatchObject({ path: `${userPath};${launcherDir}`, writes: 1 });
    }).pipe(Effect.scoped),
  );

  it.effect("does not claim or remove a Windows PATH entry the user added", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped();
      const launcherDir = path.dirname(
        DesktopCliShim.launcherPath(
          environmentFor(path, {
            home,
            baseDir: path.join(home, ".chatandcode"),
            platform: "win32",
          }),
        ),
      );
      const userPath = `C:\\Tools;${launcherDir}`;
      const { registry, spawner } = fakePowerShell(userPath);
      const command = yield* commandIn({ home, platform: "win32" }, spawner);

      expect((yield* command.state).installedPath).toBeNull();
      yield* command.uninstall;
      expect(registry.path).toBe(userPath);

      // A fresh install beside a standalone chatandcode.cmd (from `chatandcode install`), even off PATH, leaves
      // PATH alone.
      const besideHome = yield* fs.makeTempDirectoryScoped();
      yield* fs.makeDirectory(path.join(besideHome, ".local", "bin"), { recursive: true });
      yield* fs.writeFileString(
        path.join(besideHome, ".local", "bin", "chatandcode.cmd"),
        "@echo off\r\n",
      );
      const beside = fakePowerShell("C:\\Tools");
      yield* (yield* commandIn({ home: besideHome, platform: "win32" }, beside.spawner))
        .installOnFirstLaunch;
      expect(beside.registry).toMatchObject({ path: "C:\\Tools", writes: 0 });
    }).pipe(Effect.scoped),
  );
});
