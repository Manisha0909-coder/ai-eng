import { clearUserProfileCache } from "@/services/user/userApi";
import { clearAllCookies } from "@/utils/helper";
import {
  clearThemeOverrides,
  suspendThemeEditorLivePreview,
} from "@/features/dashboard/theme-editor/applyOverrides";

/**
 * Run before `window.location` redirects to the BFF `/auth/logout` endpoint.
 *
 * We deliberately do NOT call `useStore.getState().logout()` here. Doing so
 * flips `isAuthenticated` / `isAdmin` to false synchronously, which causes the
 * header to re-render without admin/auth-only buttons in the brief window
 * before the browser navigates away — the UI appears to flash/disappear. The
 * persisted slice (`partialize` in useStore) contains only UI prefs, not PII,
 * so there is nothing sensitive in localStorage to purge here.
 *
 * Theme Editor drafts stay in localStorage for resume, but live CSS overrides
 * are cleared and suspended so login / the rest of the app show the shipped
 * theme until the user edits again in Theme Editor.
 *
 * The next page load probes `/me`, gets 401, and the store is reset cleanly.
 */
export async function flushClientSessionBeforeBffLogout(): Promise<void> {
  clearUserProfileCache();
  clearAllCookies();
  // End Theme Editor live-preview session (draft may remain for later resume).
  clearThemeOverrides();
  suspendThemeEditorLivePreview();
}
