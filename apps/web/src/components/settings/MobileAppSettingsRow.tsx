import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

/** Settings → About row for the mobile app. ChatAndCode has no store listings yet. */
export function MobileAppSettingsRow() {
  return (
    <SettingsRow
      {...searchableSetting("mobile-app")}
      description="App Store, Google Play, and mobile beta releases are coming."
    />
  );
}
