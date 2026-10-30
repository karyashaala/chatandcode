import { parseSemver } from "@cctools/shared/semver";
import { useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { SmartphoneIcon } from "lucide-react";
import { useEffect } from "react";

import { APP_VERSION, HOSTED_APP_CHANNEL } from "../branding";
import { getLocalStorageItem, setLocalStorageItem } from "../hooks/useLocalStorage";
import { SettingsRow } from "./settings/settingsLayout";
import { toastManager } from "./ui/toast";

// Mobile store and beta distribution channels are coming.

/** True on Nightly desktop, `npx chatandcode@nightly`, and the hosted Nightly app. */
export const IS_NIGHTLY_BUILD =
  parseSemver(APP_VERSION)?.prerelease[0] === "nightly" || HOSTED_APP_CHANNEL === "nightly";

const ROW_ID = "nightly-mobile-beta";
const NOTICE_DISMISSED_STORAGE_KEY = "chatandcode:nightly-mobile-beta-notice-dismissed:v1";

// Guards against a second toast from a remount or a Strict Mode effect replay.
let noticeShown = false;

function isNoticeDismissed(): boolean {
  try {
    return getLocalStorageItem(NOTICE_DISMISSED_STORAGE_KEY, Schema.Boolean) === true;
  } catch {
    return false;
  }
}

function dismissNotice() {
  try {
    setLocalStorageItem(NOTICE_DISMISSED_STORAGE_KEY, true, Schema.Boolean);
  } catch {
    // Storage is unavailable. The notice shows again on the next launch.
  }
}

/**
 * One-time Nightly toast with mobile app availability. Any close (the
 * corner button, swipe, Dismiss, or the action) hides it for good on this client.
 */
export function NightlyMobileBetaNotice() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!IS_NIGHTLY_BUILD || noticeShown || isNoticeDismissed()) return;
    noticeShown = true;
    const toastId = toastManager.add({
      title: "Mobile app releases are coming",
      description: "App Store, Google Play, and mobile beta releases for ChatAndCode are coming.",
      timeout: 0,
      onClose: dismissNotice,
      actionProps: {
        children: "Mobile app details",
        onClick: () => {
          toastManager.close(toastId);
          void navigate({ to: "/settings/general", hash: ROW_ID });
        },
      },
      data: {
        leadingIcon: <SmartphoneIcon className="size-4" />,
        actionLayout: "stacked-end",
        secondaryActionProps: {
          children: "Dismiss",
          onClick: () => toastManager.close(toastId),
        },
        secondaryActionVariant: "ghost",
      },
    });
  }, [navigate]);

  return null;
}

/** Settings → General → About row with mobile app availability. Render only for Nightly. */
export function NightlyMobileBetaRow() {
  return (
    <SettingsRow
      id={ROW_ID}
      title="Mobile app"
      description="App Store, Google Play, and mobile beta releases are coming."
    />
  );
}
