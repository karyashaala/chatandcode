import { stageScheme } from "@cctools/shared/brand";
import { ORCHESTRATION_PROTOCOL_HEADER } from "@cctools/contracts";

export const browserApiCorsAllowedMethods = ["GET", "POST", "OPTIONS"] as const;
export const browserApiCorsAllowedHeaders = [
  "authorization",
  "b3",
  "traceparent",
  "content-type",
  "dpop",
  ORCHESTRATION_PROTOCOL_HEADER,
] as const;

export const DESKTOP_RENDERER_ORIGINS = [
  `${stageScheme("production")}://app`,
  `${stageScheme("development")}://app`,
] as const;
