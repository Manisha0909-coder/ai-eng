import { useCallback, useEffect, useState } from "react";
import {
  AlarmClock,
  AlarmClockOff,
  CalendarClock,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import notify from "@/utils/notify";
import { subscribeUserEvents } from "@/services/chat/userEventsFeed";
import { markPushSubscribed } from "@/hooks/useReminderNotifications";
import {
  getPushSupport,
  requestPushPermission,
  sendTestNotification,
  showLocalTestNotification,
} from "@/services/push/pushClient";
import {
  cancelTask,
  fetchTasks,
  type ScheduledTask,
} from "@/services/tasks/tasksApi";

/**
 * Tasks & Reminders tab — every reminder the assistant has scheduled for the
 * user, across all chats. Reminders are created in conversation ("remind me
 * in 5 minutes to..."); here they can only be reviewed and cancelled.
 */

const STATUS_META: Record<
  ScheduledTask["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Scheduled",
    className: "text-primary bg-primary/10 border-primary/30",
    icon: <AlarmClock size={11} aria-hidden />,
  },
  delivering: {
    label: "Delivering",
    className: "text-primary bg-primary/10 border-primary/30",
    icon: <Loader2 size={11} className="animate-spin" aria-hidden />,
  },
  delivered: {
    label: "Delivered",
    className: "text-status-success bg-status-success/10 border-status-success/30",
    icon: <CheckCircle2 size={11} aria-hidden />,
  },
  failed: {
    label: "Failed",
    className: "text-status-error bg-status-error/10 border-status-error/30",
    icon: <XCircle size={11} aria-hidden />,
  },
  cancelled: {
    label: "Cancelled",
    className: "text-text-muted bg-surface-2 border-border-main",
    icon: <AlarmClockOff size={11} aria-hidden />,
  },
};

function formatDueAt(iso: string): string {
  try {
    const due = new Date(iso);
    const formatted = due.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    const deltaMs = due.getTime() - Date.now();
    if (deltaMs <= 0) return formatted;
    const minutes = Math.round(deltaMs / 60_000);
    const relative =
      minutes < 60
        ? `in ${minutes} min`
        : minutes < 60 * 24
          ? `in ${Math.round(minutes / 60)} h`
          : `in ${Math.round(minutes / (60 * 24))} d`;
    return `${formatted} · ${relative}`;
  } catch {
    return iso;
  }
}

export function TasksTab({ isActive }: { isActive: boolean }) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const pushSupport = getPushSupport();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(
    () => (pushSupport.status === "ok" ? Notification.permission : null),
  );
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const navigate = useNavigate();

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    try {
      const result = await requestPushPermission();
      if (result.permission !== "unsupported") {
        setNotifPermission(result.permission);
      }
      if (result.subscribed) {
        markPushSubscribed();
        notify.success("Notifications enabled for this device.");
      } else if (result.reason === "permission-denied") {
        notify.error(
          "Notifications are blocked for this site. Click the icon next to the address bar to allow them, then try again. On macOS, also check System Settings → Notifications → your browser.",
          { duration: 10_000 },
        );
      } else if (result.reason === "permission-dismissed") {
        notify.error(
          "The permission prompt was dismissed or suppressed. Chrome may only show a small bell icon in the address bar — click it to allow notifications.",
          { duration: 10_000 },
        );
      } else if (result.reason === "no-server-key") {
        notify.error("Web push is not configured on this deployment.");
      } else {
        notify.error("Could not register this device for notifications. Please try again.");
      }
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleTestPush = async () => {
    setIsTestingPush(true);
    try {
      // Local first: same display path as a push, zero network. It isolates
      // "OS is hiding Chrome notifications" from "push pipeline is broken".
      const localShown = await showLocalTestNotification();
      const { delivered, subscriptions } = await sendTestNotification();
      if (!localShown) {
        notify.error("Could not display a notification from this page — try re-enabling notifications.");
      } else if (delivered) {
        notify.success(
          "Two test notifications attempted: “Local test” (from this page) and “Test notification” (via server). If you see NEITHER, the OS is hiding your browser's notifications — on macOS check System Settings → Notifications → Google Chrome, and turn off Focus/Do Not Disturb (screen sharing also mutes them). If you only see “Local test”, the server push pipeline is failing — tell your admin.",
          { duration: 20_000 },
        );
      } else if (subscriptions === 0) {
        notify.error("This device isn't subscribed yet — click Enable first.");
      } else {
        notify.error("The push service rejected the notification. Re-enable notifications on this device.");
      }
    } catch {
      notify.error("Failed to send the test notification.");
    } finally {
      setIsTestingPush(false);
    }
  };

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { tasks: fetched } = await fetchTasks({ activeOnly, limit: 100 });
      setTasks(fetched);
    } catch {
      // Errors already toast via the shared client conventions; keep last list.
    } finally {
      setIsLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    if (!isActive) return;
    refresh();
    const unsubscribe = subscribeUserEvents((event) => {
      if (
        event.type === "task_created" ||
        event.type === "task_cancelled" ||
        event.type === "reminder_fired"
      ) {
        refresh();
      }
    });
    return unsubscribe;
  }, [isActive, refresh]);

  const handleCancel = async (task: ScheduledTask) => {
    setCancellingId(task.task_id);
    try {
      const ok = await cancelTask(task.task_id);
      if (ok) await refresh();
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
        <p className="text-xs text-text-muted">
          Ask the assistant to remind you of something — it will notify you
          here, on Telegram, and by notification.
        </p>
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full border border-border-main shrink-0 ml-3">
          {([true, false] as const).map((flag) => (
            <button
              key={String(flag)}
              type="button"
              onClick={() => setActiveOnly(flag)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full transition-colors",
                activeOnly === flag
                  ? "bg-surface-2 text-text-main font-medium"
                  : "text-text-muted hover:text-text-main",
              )}
              aria-pressed={activeOnly === flag}
            >
              {flag ? "Active" : "All"}
            </button>
          ))}
        </div>
      </div>

      {notifPermission === "default" && (
        <div className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 shrink-0">
          <p className="text-xs text-text-main">
            Enable notifications to get reminders even when this tab is closed.
          </p>
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs shrink-0"
            disabled={isEnablingPush}
            onClick={handleEnablePush}
          >
            {isEnablingPush ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : (
              "Enable"
            )}
          </Button>
        </div>
      )}
      {notifPermission === "denied" && (
        <div className="mx-5 mb-2 rounded-lg border border-status-error/30 bg-status-error/5 px-3 py-2 shrink-0">
          <p className="text-xs text-text-main">
            Notifications are blocked for this site. Click the icon next to the
            address bar (or the bell icon) to allow them, then reopen this tab.
            On macOS, also make sure your browser is allowed under System
            Settings → Notifications.
          </p>
        </div>
      )}
      {notifPermission === "granted" && (
        <div className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-lg border border-status-success/30 bg-status-success/5 px-3 py-2 shrink-0">
          <p className="text-xs text-text-main">
            Notifications are enabled on this device.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs shrink-0"
            disabled={isTestingPush}
            onClick={handleTestPush}
          >
            {isTestingPush ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : (
              "Send test"
            )}
          </Button>
        </div>
      )}
      {pushSupport.status === "ios-needs-install" && (
        <div className="mx-5 mb-2 rounded-lg border border-border-main bg-surface-2 px-3 py-2 shrink-0">
          <p className="text-xs text-text-main">
            On iPhone/iPad, notifications require installing the app first:
            tap Share → “Add to Home Screen”, then enable notifications from
            the installed app.
          </p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-muted">
            <Loader2 className="animate-spin mr-2" size={16} />
            <span className="text-sm">Loading tasks…</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center text-text-muted">
            <AlarmClock size={24} className="mb-2 opacity-50" aria-hidden />
            <p className="text-sm">
              {activeOnly ? "No active reminders." : "No reminders yet."}
            </p>
            <p className="text-xs mt-1 opacity-80">
              Try: “remind me in 10 minutes to stretch”.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => {
              const meta = STATUS_META[task.status] ?? STATUS_META.pending;
              return (
                <li
                  key={task.task_id}
                  className="rounded-xl border border-border-main bg-surface px-3.5 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-text-main break-words">
                        {task.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-2xs font-medium",
                            meta.className,
                          )}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                        {task.kind === "agent_task" && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border-main bg-surface-2 text-2xs font-medium text-text-muted"
                            title="The assistant runs this task automatically at the scheduled time"
                          >
                            <CalendarClock size={11} aria-hidden />
                            Agent task
                          </span>
                        )}
                        <span className="text-2xs text-text-muted">
                          {formatDueAt(task.due_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`/chat/${task.session_id}`)}
                          className="text-2xs text-primary hover:underline"
                        >
                          Open chat
                        </button>
                      </div>
                    </div>
                    {task.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cancellingId === task.task_id}
                        onClick={() => handleCancel(task)}
                        className="h-7 px-2.5 text-xs shrink-0 text-text-muted hover:text-status-error hover:border-status-error/50"
                      >
                        {cancellingId === task.task_id ? (
                          <Loader2 size={12} className="animate-spin" aria-hidden />
                        ) : (
                          "Cancel"
                        )}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
