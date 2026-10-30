# Brand icons

The three Icon Composer projects are the source of truth for full application icons:

- `dev/app-icon.icon`
- `nightly/app-icon.icon`
- `prod/app-icon.icon`

Each project uses `text.svg` for the ChatAndCode mark and `background.svg` when the background is a vector layer. Additional layers use semantic names that describe their role and placement.

Run `vp run icons:export` from the repository root to regenerate the tracked iOS, Linux, Windows, and web assets. The development web exports are also copied to `apps/web/public` for the browser favicon and splash screen. Run `vp run icons:check` to verify that the generated assets and public copies match their sources without changing files.

Exporting requires Icon Composer 2 or newer on macOS. The script selects the newest compatible exporter from Xcode or a standalone Icon Composer installation and pins design generation 26. Set `ICON_COMPOSER_TOOL` to the full path of `Icon Composer.app/Contents/Executables/ictool` to override automatic discovery.

## macOS exports

Icon Composer's command-line exporter does not expose the `macOS pre-Tahoe` preset, and since
Xcode 27 the GUI preset no longer applies the classic safe area either: both produce a full-bleed
1024×1024 rounded square. The desktop app needs the classic shape, so the export script leaves the
tracked macOS PNGs unchanged and prints a reminder after every run.

After changing an Icon Composer project, rebuild the three macOS PNGs from a plain `macOS` export
(Appearance `Default`, 1024pt, 1×, design generation 26, from `ictool` or the GUI) by composing it
into the classic frame. This is the one place a generated PNG is post-processed, because no
shipping tool produces the frame any more:

- Body: the export scaled to 824×824 (Lanczos) and placed at (100, 100) on a transparent
  1024×1024 canvas.
- Shadow, under the body: the body's own silhouette in black, dropped 10 px, Gaussian blur
  sigma 18, alpha multiplied by 0.24. This matches the shadow Icon Composer 26 produced.

Save the results to:

- `dev/app-icon.icon` -> `dev/blueprint-macos-1024.png`
- `nightly/app-icon.icon` -> `nightly/nightly-macos-1024.png`
- `prod/app-icon.icon` -> `prod/black-macos-1024.png`

The result must be a 1024×1024 PNG with the classic macOS safe area: the opaque icon body is
824×824, inset 100 pixels on every side, with only the shadow extending into the surrounding
transparent canvas.

Do not edit the generated PNG or ICO files directly.

## Android launcher and splash artwork

Android masks the central 72dp of a 108dp adaptive canvas, and the Android 12+ splash screen masks
the central two thirds of a 288dp canvas, so the Icon Composer exports cannot be used directly:
their rounded-square silhouette gets framed again and the wordmark is cropped. The Android artwork
is instead rendered from the same Icon Composer SVG sources by `vp run icons:export:android`:

- `apps/mobile/assets/android-icon-foreground.png`: the shared transparent wordmark, sized to stay
  inside the safe zone
- `apps/mobile/assets/android-icon-background-dev.png` and `-nightly.png`: full-bleed variant
  artwork (blueprint grid and annotations; night sky and clouds). Production uses a solid color.
- `apps/mobile/assets/android-splash-icon-*.png`: the two layers composed into one 288dp image, so
  the splash mask reproduces the launcher icon's framing.

Rerun the export after changing a layer SVG. `android-icon-mark.png` remains a flat silhouette for
Android's monochrome themed icon.
