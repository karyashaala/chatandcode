import { desktopIdentity } from "@cctools/shared/brand";
// Pure scheme helpers (no Electron import) so DesktopEnvironment and tests can
// resolve the renderer origin without loading the Electron runtime.

export const DESKTOP_HOST = "app";

function getDesktopOrigin(scheme: string): string {
  return `${scheme}://${DESKTOP_HOST}`;
}

export function getDesktopUrl(scheme: string): string {
  return `${getDesktopOrigin(scheme)}/`;
}

export function getDesktopScheme(isDevelopment: boolean): string {
  return desktopIdentity(isDevelopment ? "dev" : "latest").scheme;
}
