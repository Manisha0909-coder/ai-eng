import { API_CONFIG } from "@/config/api";

/**
 * Web Push client — pairs with the backend /push/* endpoints and the
 * `public/push-sw.js` service-worker layer.
 *
 * Platform notes this module encodes:
 * - Chrome can suppress the permission popup ("quieter messaging"): the
 *   request then resolves "default" and only a small bell icon shows in the
 *   address bar. Callers must surface that outcome, never fail silently.
 * - Legacy Safari (macOS < 16) implements callback-style
 *   `Notification.requestPermission(cb)`; the promise form returns undefined.
 * - iOS supports Web Push only from a Home-Screen-installed PWA (16.4+); in a
 *   plain Safari tab the Notification API is absent entirely.
 * - Everything requires a secure context (https or localhost).
 */

export type PushSupport =
  | { status: "ok" }
  | { status: "insecure-context" }
  | { status: "ios-needs-install" }
  | { status: "unsupported" };

export interface PushPermissionResult {
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  /** Machine-readable reason when subscribed=false. */
  reason?:
    | "not-supported"
    | "permission-denied"
    | "permission-dismissed"
    | "no-server-key"
    | "subscribe-failed"
    | "register-failed";
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Macintosh but is touch-capable.
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

function isStandalonePwa(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return { status: "unsupported" };
  if (!window.isSecureContext) return { status: "insecure-context" };
  const hasApis =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (hasApis) return { status: "ok" };
  // iOS exposes the push APIs only once the PWA is installed.
  if (isIos() && !isStandalonePwa()) return { status: "ios-needs-install" };
  return { status: "unsupported" };
}

export function isPushSupported(): boolean {
  return getPushSupport().status === "ok";
}

/** Promise-normalized permission request that also works on callback-style
 * (legacy Safari) implementations. Must be called from a user gesture. */
function requestNotificationPermission(): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    try {
      const maybePromise = Notification.requestPermission((legacyResult) => {
        resolve(legacyResult);
      });
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolve);
      }
    } catch {
      // Some engines throw on the callback form; retry promise-only.
      Notification.requestPermission().then(resolve);
    }
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const response = await fetch(`${API_CONFIG.LOCAL_API_BASE_URL}/push/public_key`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.data?.enabled ? (body?.data?.public_key ?? null) : null;
  } catch {
    return null;
  }
}

/** Subscribe this browser and register the subscription with the backend.
 * Assumes Notification permission is already "granted". */
export async function ensurePushSubscription(): Promise<PushPermissionResult> {
  if (!isPushSupported()) {
    return { permission: "unsupported", subscribed: false, reason: "not-supported" };
  }
  if (Notification.permission !== "granted") {
    return {
      permission: Notification.permission,
      subscribed: false,
      reason:
        Notification.permission === "denied"
          ? "permission-denied"
          : "permission-dismissed",
    };
  }
  try {
    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) {
      console.warn("[push] backend has no VAPID public key; web push disabled");
      return { permission: "granted", subscribed: false, reason: "no-server-key" };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { permission: "granted", subscribed: false, reason: "subscribe-failed" };
    }

    const response = await fetch(`${API_CONFIG.LOCAL_API_BASE_URL}/push/subscribe`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      }),
    });
    if (!response.ok) {
      console.warn("[push] backend rejected subscription:", response.status);
      return { permission: "granted", subscribed: false, reason: "register-failed" };
    }
    return { permission: "granted", subscribed: true };
  } catch (error) {
    console.warn("[push] subscription failed:", error);
    return { permission: "granted", subscribed: false, reason: "subscribe-failed" };
  }
}

/** Ask for Notification permission (call from a user gesture), then subscribe. */
export async function requestPushPermission(): Promise<PushPermissionResult> {
  if (!isPushSupported()) {
    return { permission: "unsupported", subscribed: false, reason: "not-supported" };
  }
  // Already granted (e.g. from a previous session): skip straight to subscribe.
  if (Notification.permission === "granted") {
    return ensurePushSubscription();
  }
  const permission = await requestNotificationPermission();
  console.debug("[push] permission request resolved:", permission);
  if (permission !== "granted") {
    return {
      permission,
      subscribed: false,
      reason: permission === "denied" ? "permission-denied" : "permission-dismissed",
    };
  }
  return ensurePushSubscription();
}

/** Show a notification directly from this page via the service worker — the
 * exact same display path a push uses, but with no network hop. If THIS is
 * invisible too, the OS (not the push pipeline) is suppressing Chrome
 * notifications: macOS System Settings → Notifications → browser, or an
 * active Focus / Do Not Disturb / screen-sharing session. */
export async function showLocalTestNotification(): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("🔔 Local test", {
      body: "Shown directly by this page — no server involved.",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-96.png",
    });
    return true;
  } catch (error) {
    console.warn("[push] local notification failed:", error);
    return false;
  }
}

/** Ask the backend to send a real push to this user's subscriptions, to verify
 * the whole pipeline (backend → push service → browser → SW notification). */
export async function sendTestNotification(): Promise<{
  delivered: boolean;
  subscriptions: number;
}> {
  const response = await fetch(`${API_CONFIG.LOCAL_API_BASE_URL}/push/test`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Test push failed (${response.status})`);
  const body = await response.json();
  return {
    delivered: Boolean(body?.data?.delivered),
    subscriptions: body?.data?.subscriptions ?? 0,
  };
}
