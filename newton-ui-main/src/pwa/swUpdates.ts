import { registerSW } from "virtual:pwa-register";
import { APP_VERSION } from "@/env";
import notify from "@/utils/notify";

/**
 * Keeps installed PWAs live-updated.
 *
 * The SW strategy is `autoUpdate` (see `pwaOptions.ts`): a new worker
 * skipWaiting + clientsClaims and open tabs reload once it takes control.
 * What autoUpdate does NOT do is *look* for new versions aggressively —
 * browsers only check on navigation or at most every 24h, so an installed
 * PWA that stays open (or resumes from the background) can run a stale
 * bundle for a long time.
 *
 * This module closes that gap:
 *  1. Polls for a new SW every few minutes and whenever the app regains
 *     focus/visibility (the moment a phone user re-opens the PWA).
 *  2. After the post-update reload, shows a one-time "updated" toast by
 *     comparing the running build id against the last one seen.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const VERSION_STORAGE_KEY = "newton-app-version";

export function setupServiceWorkerUpdates(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        registration.update().catch(() => {
          // Offline or transient network failure — next tick will retry.
        });
      };
      setInterval(check, CHECK_INTERVAL_MS);
      window.addEventListener("focus", check);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });
}

export function announceVersionChange(): void {
  try {
    const previous = localStorage.getItem(VERSION_STORAGE_KEY);
    if (previous && previous !== APP_VERSION) {
      notify.success(`Newton updated to the latest version (v.${APP_VERSION})`);
    }
    localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
  } catch {
    // Storage unavailable (private mode) — skip the announcement.
  }
}
