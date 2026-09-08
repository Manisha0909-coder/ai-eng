import { useEffect } from "react";
import toast from "react-hot-toast";
import { AlarmClock, Bell, BellOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { subscribeUserEvents } from "@/services/chat/userEventsFeed";
import {
  ensurePushSubscription,
  getPushSupport,
  requestPushPermission,
} from "@/services/push/pushClient";
import notify from "@/utils/notify";
import { useStore } from "@/store/useStore";

const toastCardStyle: React.CSSProperties = {
  backgroundColor: "rgb(var(--color-surface))",
  color: "rgb(var(--color-text))",
  border: "1px solid rgb(var(--color-border))",
  borderRadius: "0.75rem",
  boxShadow: "var(--shadow-md)",
  maxWidth: "22rem",
  padding: "12px 16px",
};

/** Only ever auto-ask once per page load; task events may re-surface it. */
let openPromptShownThisLoad = false;

/* Durable prompt state. Two iOS-PWA realities make per-load flags useless:
   iPadOS cold-restarts the installed app on almost every return (so "once
   per page load" means "every visit"), and standalone WebKit can report
   Notification.permission as "default" after a cold start even though the
   user already granted — which made every task_created event from the SSE
   feed re-show the enable prompt WHILE the app was in use.
   - Once this device has successfully subscribed, never auto-prompt again;
     the silent ensurePushSubscription() keeps the subscription fresh.
   - Otherwise the open-time prompt is limited to once a week, and the
     task-created nag to once per 6 hours. */
const SUBSCRIBED_KEY = "newton:push-subscribed";
const OPEN_PROMPT_AT_KEY = "newton:notif-open-prompt-at";
const TASK_WARN_AT_KEY = "newton:notif-task-warn-at";
const OPEN_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const TASK_WARN_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / quota — degrade to per-load behavior.
  }
}

export function markPushSubscribed() {
  writeLocal(SUBSCRIBED_KEY, "1");
}

function isDeviceSubscribed(): boolean {
  return readLocal(SUBSCRIBED_KEY) === "1";
}

function onCooldown(key: string, ms: number): boolean {
  return Date.now() - Number(readLocal(key) ?? 0) < ms;
}

function notificationPermission(): NotificationPermission | null {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : null;
}

/**
 * Soft permission prompt: an in-app toast whose button triggers the real
 * browser prompt. The native prompt needs a user gesture on Safari/iOS —
 * calling requestPermission() on page load there resolves "denied" without
 * ever showing UI, so we never auto-call it.
 */
function showEnableNotificationsToast(message: string, toastId: string) {
  toast(
    (t) => (
      <div className="flex items-start gap-2.5 text-left">
        <Bell
          size={18}
          className="shrink-0 mt-0.5"
          style={{ color: "rgb(var(--color-primary))" }}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">Turn on notifications?</span>
          <span className="block text-sm opacity-90">{message}</span>
          <span className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: "rgb(var(--color-primary))",
                color: "rgb(var(--color-primary-foreground))",
              }}
              onClick={async () => {
                toast.dismiss(t.id);
                const result = await requestPushPermission();
                if (result.subscribed) {
                  markPushSubscribed();
                  notify.success("Notifications enabled");
                } else if (result.permission === "denied") {
                  notify.error(
                    "Notifications are blocked. Enable them for this site in your browser settings.",
                  );
                }
                // Dismissed / quiet-UI: stay silent, we'll offer again later.
              }}
            >
              Enable
            </button>
            <button
              type="button"
              className="rounded-lg px-2.5 py-1 text-xs font-medium opacity-70 hover:opacity-100"
              onClick={() => toast.dismiss(t.id)}
            >
              Not now
            </button>
          </span>
        </span>
      </div>
    ),
    { id: toastId, duration: 12_000, style: toastCardStyle },
  );
}

/** Warn that a freshly scheduled task won't be able to alert this browser. */
function warnTaskNotificationsOff() {
  // Device already subscribed: any "default"/"denied" reading here is the
  // standalone-WebKit cold-start misreport, not a real gap — stay silent.
  if (isDeviceSubscribed()) return;
  // SSE events arrive in bursts (and replay on reconnect); without a
  // throttle this re-toasted the prompt every few seconds during use.
  if (onCooldown(TASK_WARN_AT_KEY, TASK_WARN_COOLDOWN_MS)) return;
  writeLocal(TASK_WARN_AT_KEY, String(Date.now()));

  const support = getPushSupport();

  if (support.status === "ios-needs-install") {
    toast(
      "To get alerts when this task fires, add Newton to your Home Screen (Share → Add to Home Screen).",
      { id: "notif-ios-install", duration: 9_000, icon: <BellOff size={18} aria-hidden />, style: toastCardStyle },
    );
    return;
  }
  if (support.status !== "ok") return;

  const permission = notificationPermission();
  if (permission === "default") {
    showEnableNotificationsToast(
      "This task is scheduled, but you won't be alerted when it fires unless notifications are on.",
      "notif-perm-task",
    );
  } else if (permission === "denied") {
    toast(
      "Heads up: notifications are blocked in your browser, so you won't be alerted when this task fires. You can enable them in your browser's site settings.",
      { id: "notif-denied-task", duration: 9_000, icon: <BellOff size={18} aria-hidden />, style: toastCardStyle },
    );
  }
}

/**
 * App-wide reminder delivery for open tabs.
 *
 * - `reminder_fired` events from the per-user SSE feed become a clickable
 *   toast that jumps to the reminder's chat.
 * - On sign-in, silently refresh this browser's Web Push subscription when
 *   Notification permission was already granted (closed-tab delivery is the
 *   push service worker's job, not this hook's).
 * - On sign-in with permission still undecided, offer to enable notifications.
 * - When a reminder/scheduled task is created without notification access,
 *   re-offer the prompt (undecided) or warn that alerts won't show (blocked).
 */
export function useReminderNotifications() {
  const { isAuthenticated } = useStore();
  const navigate = useNavigate();

  // Offer notifications shortly after opening the app, once per page load.
  // Undecided → the Enable prompt; blocked → a heads-up that alerts are off
  // (a deny made in the browser carries into the installed PWA, so this is
  // common right after installing).
  //
  // Isolated effect on purpose: the SSE effect below re-runs on navigation,
  // and its cleanup used to cancel this timer while the once-per-load flag
  // was already set — any route change in the first seconds silently killed
  // the prompt. The flag is now set only when the toast actually fires, so a
  // re-armed timer stays harmless.
  useEffect(() => {
    if (!isAuthenticated || openPromptShownThisLoad) return;
    if (getPushSupport().status !== "ok") return;
    const timer = setTimeout(() => {
      if (openPromptShownThisLoad) return;
      if (isDeviceSubscribed()) return;
      if (onCooldown(OPEN_PROMPT_AT_KEY, OPEN_PROMPT_COOLDOWN_MS)) return;
      const permission = notificationPermission();
      if (permission === "default") {
        openPromptShownThisLoad = true;
        writeLocal(OPEN_PROMPT_AT_KEY, String(Date.now()));
        showEnableNotificationsToast(
          "Get alerts for reminders and scheduled tasks even when Newton is closed.",
          "notif-perm-open",
        );
      } else if (permission === "denied") {
        openPromptShownThisLoad = true;
        writeLocal(OPEN_PROMPT_AT_KEY, String(Date.now()));
        toast(
          "Notifications are blocked for Newton, so reminders and scheduled tasks can't alert you. Enable them in your browser/site settings.",
          {
            id: "notif-denied-open",
            duration: 9_000,
            icon: <BellOff size={18} aria-hidden />,
            style: toastCardStyle,
          },
        );
      }
    }, 2_500);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Flags devices granted before the subscribed-flag existed (this user's
    // iPad/iPhone) on their first launch of this build — no tap needed.
    ensurePushSubscription().then((result) => {
      if (result.subscribed) markPushSubscribed();
    });

    const unsubscribe = subscribeUserEvents((event) => {
      if (event.type === "task_created") {
        warnTaskNotificationsOff();
        return;
      }
      if (event.type !== "reminder_fired") return;
      const message: string = event.data?.message ?? "You have a reminder.";
      const sessionId: string | undefined = event.data?.session_id;
      const toastId = `reminder-${event.data?.task_id ?? message}`;

      toast(
        (t) => (
          <button
            type="button"
            className="flex items-start gap-2.5 text-left"
            onClick={() => {
              if (sessionId) navigate(`/chat/${sessionId}`);
              toast.dismiss(t.id);
            }}
          >
            <AlarmClock
              size={18}
              className="shrink-0 mt-0.5"
              style={{ color: "rgb(var(--color-primary))" }}
              aria-hidden
            />
            <span>
              <span className="block text-sm font-medium">Reminder</span>
              <span className="block text-sm opacity-90">{message}</span>
            </span>
          </button>
        ),
        {
          id: toastId,
          duration: 10_000,
          style: {
            ...toastCardStyle,
            cursor: sessionId ? "pointer" : "default",
          },
        },
      );
    });
    return unsubscribe;
  }, [isAuthenticated, navigate]);
}
