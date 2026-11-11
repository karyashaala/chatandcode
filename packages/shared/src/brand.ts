export const BRAND = Object.freeze({
  productName: "ChatAndCode",
  shortName: "C&C", // Display only; never use this as a machine name.
  slug: "chatandcode",
  cliCommand: "chatandcode",
  npmPackage: "chatandcode",
  envPrefix: "CHATANDCODE_",
  stateDirName: ".chatandcode",
  urlScheme: "chatandcode",
  appIdBase: "ca.chatcode.chatandcode",
  connectName: "ChatAndCode Connect",
  gitIdentity: Object.freeze({
    name: "ChatAndCode",
    email: "chatandcode@users.noreply.github.com",
  } as const),
  urls: Object.freeze({
    marketing: "https://chatcode.ca",
    hostedApp: "https://app.chatcode.ca",
    repository: "https://github.com/karyashaala/chatandcode",
    projectFileSchema: "https://chatcode.ca/schema/chatandcode.json",
  } as const),
} as const);

export type BrandStage = "production" | "development" | "preview";

export const stageScheme = (stage: BrandStage) =>
  stage === "production"
    ? BRAND.urlScheme
    : `${BRAND.urlScheme}-${stage === "development" ? "dev" : "preview"}`;

export const stageAppId = (stage: BrandStage) =>
  stage === "production"
    ? BRAND.appIdBase
    : `${BRAND.appIdBase}.${stage === "development" ? "dev" : "preview"}`;

export function desktopIdentity(stage: "dev" | "nightly" | "latest") {
  const brandStage = stage === "dev" ? "development" : "production";
  const appId = stageAppId(brandStage);
  const scheme = stageScheme(brandStage);
  return {
    baseName: BRAND.productName,
    stageLabel: stage === "dev" ? "Dev" : stage === "nightly" ? "Nightly" : "Beta",
    appId,
    appUserModelId: appId,
    scheme,
    userDataDirName: stage === "dev" ? `${BRAND.slug}-dev` : BRAND.slug,
    stateDirName: BRAND.stateDirName,
    linuxExecutableName: BRAND.slug,
    linuxDesktopEntryName: `${appId}.desktop`,
    linuxWmClass: scheme,
    artifactBaseName: BRAND.productName,
    sessionPartitionPrefix: `${BRAND.slug}-preview-`,
  } as const;
}
