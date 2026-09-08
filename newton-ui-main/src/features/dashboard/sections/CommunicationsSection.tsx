import { useCallback, useEffect, useMemo, useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "../components/StatusBadge";
import { DashboardPill } from "../components/DashboardPill";
import { ErrorRetry } from "../components/ErrorRetry";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardAdminTableClassName,
  dashboardTabCardClassName,
  dashboardTableLoadingProps,
} from "../components/DashboardTabLayout";
import { DataTable, type ColumnConfig } from "@/components/DataTable";
import {
  telegramApi,
  telegramDeepLink,
  type TelegramAdminConfig,
  type TelegramAdminMessage,
  type TelegramAdminStats,
  type TelegramAdminTestResult,
  type TelegramAdminUser,
} from "@/services/communications/telegramApi";
import notify from "@/utils/notify";
import { cn } from "@/lib/utils";
import { chartColors, toRgba } from "@/utils/chartColors";
import { COLOR_SCHEME_CHANGED } from "@/utils/theme";
import {
  Ban,
  Clock,
  ExternalLink,
  Loader2,
  MessagesSquare,
  RefreshCw,
  RotateCcw,
  Trash2,
  Unlink,
} from "lucide-react";
import { FaTelegramPlane } from "react-icons/fa";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend as ChartLegend,
  LinearScale,
  Tooltip as ChartTooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

const TIMEOUT_CHOICES = [
  { label: "15 minutes", minutes: 15 },
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "24 hours", minutes: 1440 },
  { label: "7 days", minutes: 10080 },
] as const;

type ModerationAction =
  | { type: "revoke"; user: TelegramAdminUser }
  | { type: "ban"; user: TelegramAdminUser }
  | { type: "timeout"; user: TelegramAdminUser }
  | { type: "unban"; user: TelegramAdminUser };

export interface CommunicationsSectionProps {
  isAdmin: boolean;
  activeTab?: string;
}

/**
 * Admin configuration for messaging channels. Telegram only for now: each
 * Newton deployment/domain configures its own bot (token + handle). The
 * token is write-only — the backend returns at most a masked suffix.
 */
export const CommunicationsSection = ({
  isAdmin,
  activeTab,
}: Readonly<CommunicationsSectionProps>) => {
  const [config, setConfig] = useState<TelegramAdminConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tokenInput, setTokenInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TelegramAdminTestResult | null>(null);
  const [toggling, setToggling] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Traffic + moderation state
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<TelegramAdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [users, setUsers] = useState<TelegramAdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [themeKey, setThemeKey] = useState(0);

  const [modAction, setModAction] = useState<ModerationAction | null>(null);
  const [modBusy, setModBusy] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(60);

  const [historyUser, setHistoryUser] = useState<TelegramAdminUser | null>(null);
  const [historyRows, setHistoryRows] = useState<TelegramAdminMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const handler = () => setThemeKey((k) => k + 1);
    window.addEventListener(COLOR_SCHEME_CHANGED, handler);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED, handler);
  }, []);

  const fetchConfig = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await telegramApi.adminGet();
      setConfig(data);
      setUsernameInput(data.bot_username ? `@${data.bot_username}` : "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load Telegram configuration");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (windowDays: number, silent = false) => {
    try {
      if (!silent) setStatsLoading(true);
      setStats(await telegramApi.adminStats(windowDays));
    } catch {
      // Non-fatal: the config card is still useful without stats.
    } finally {
      if (!silent) setStatsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (windowDays: number, silent = false) => {
    try {
      if (!silent) setUsersLoading(true);
      setUsers(await telegramApi.adminUsers(windowDays));
    } catch {
      // Non-fatal, same as stats.
    } finally {
      if (!silent) setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "communications") return;
    fetchConfig();
    fetchStats(days);
    fetchUsers(days);
  }, [activeTab, days, fetchConfig, fetchStats, fetchUsers]);

  const refreshAll = useCallback(() => {
    fetchConfig();
    fetchStats(days);
    fetchUsers(days);
  }, [days, fetchConfig, fetchStats, fetchUsers]);

  const handleSave = async () => {
    const token = tokenInput.trim();
    const username = usernameInput.trim();
    if (!token && !username) {
      notify.error("Enter a bot token and/or a bot username to save.");
      return;
    }
    setSaving(true);
    setTestResult(null);
    try {
      const data = await telegramApi.adminSave({
        ...(token ? { bot_token: token } : {}),
        ...(username ? { bot_username: username } : {}),
      });
      setConfig(data);
      setTokenInput("");
      setUsernameInput(data.bot_username ? `@${data.bot_username}` : username);
      notify.success(
        token
          ? "Bot token validated and saved — webhook registered"
          : "Telegram settings saved",
      );
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await telegramApi.adminTest();
      setTestResult(result);
      notify.success("Telegram bot connection is working");
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    setToggling(true);
    try {
      const data = await telegramApi.adminSave({ is_enabled: next });
      setConfig(data);
      notify.success(next ? "Telegram enabled" : "Telegram disabled");
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setToggling(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await telegramApi.adminDelete();
      setTestResult(null);
      setTokenInput("");
      notify.success("Telegram configuration removed");
      setRemoveOpen(false);
      await fetchConfig(true);
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setRemoving(false);
    }
  };

  const openHistory = async (user: TelegramAdminUser) => {
    if (!user.user_id) return;
    setHistoryUser(user);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      setHistoryRows(await telegramApi.adminUserMessages(user.user_id));
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openModeration = (action: ModerationAction) => {
    setBanReason("");
    setTimeoutMinutes(60);
    setModAction(action);
  };

  const handleModeration = async () => {
    if (!modAction) return;
    const { type, user } = modAction;
    setModBusy(true);
    try {
      if (type === "revoke") {
        if (!user.user_id) throw new Error("This entry has no linked Newton user.");
        await telegramApi.adminRevokeLink(user.user_id);
        notify.success("Telegram link revoked");
      } else if (type === "ban") {
        await telegramApi.adminSetBan(user.telegram_user_id, {
          ...(banReason.trim() ? { reason: banReason.trim() } : {}),
        });
        notify.success("Telegram account banned");
      } else if (type === "timeout") {
        await telegramApi.adminSetBan(user.telegram_user_id, {
          ...(banReason.trim() ? { reason: banReason.trim() } : {}),
          minutes: timeoutMinutes,
        });
        notify.success("Timeout applied");
      } else {
        await telegramApi.adminLiftBan(user.telegram_user_id);
        notify.success("Moderation lifted");
      }
      setModAction(null);
      await Promise.all([fetchUsers(days, true), fetchStats(days, true)]);
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setModBusy(false);
    }
  };

  const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

  const trafficChartData = useMemo(() => {
    const c = chartColors();
    const series = stats?.series ?? [];
    const labels = series.map((d) =>
      new Date(`${d.day}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    );
    const dataset = (
      label: string,
      data: number[],
      color: string,
    ) => ({
      label,
      data,
      backgroundColor: toRgba(color, 0.85),
      borderColor: color,
      borderWidth: 0,
      stack: "telegram",
      borderRadius: 3,
      maxBarThickness: 28,
      borderSkipped: false,
    });
    return {
      labels,
      datasets: [
        dataset("Messages", series.map((d) => d.messages), c.success),
        dataset("Rejected", series.map((d) => d.rejected), c.warning),
        dataset("Blocked", series.map((d) => d.blocked), c.error),
        dataset("Errors", series.map((d) => d.errors), c.info),
      ],
    };
  }, [stats, themeKey]);

  const trafficChartOptions = useMemo(() => {
    const c = chartColors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: { color: c.textMuted, boxWidth: 10, font: { size: 10 } },
        },
        tooltip: { mode: "index" as const, intersect: false },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: c.textMuted, font: { size: 10 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: toRgba(c.text, 0.05) },
          ticks: { color: c.textMuted, font: { size: 10 }, precision: 0 },
        },
      },
    };
  }, [themeKey]);

  const rowActions = (row: TelegramAdminUser) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title={row.user_id ? "View recent Telegram messages" : "No linked user"}
        disabled={!isAdmin || !row.user_id}
        onClick={() => openHistory(row)}
      >
        <MessagesSquare className="h-3.5 w-3.5" />
      </Button>
      {row.status === "active" ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-status-warning hover:text-status-warning"
            title="Timeout (temporary mute)"
            disabled={!isAdmin}
            onClick={() => openModeration({ type: "timeout", user: row })}
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-status-error hover:text-status-error"
            title="Ban permanently"
            disabled={!isAdmin}
            onClick={() => openModeration({ type: "ban", user: row })}
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-status-success hover:text-status-success"
          title={row.status === "banned" ? "Lift ban" : "Lift timeout"}
          disabled={!isAdmin}
          onClick={() => openModeration({ type: "unban", user: row })}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-text-muted"
        title={row.user_id ? "Revoke Telegram link" : "No link to revoke"}
        disabled={!isAdmin || !row.user_id || row.connected_at === null}
        onClick={() => openModeration({ type: "revoke", user: row })}
      >
        <Unlink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const statusPill = (row: TelegramAdminUser, compact = false) => (
    <span title={row.ban?.reason ?? undefined}>
      <DashboardPill
        intent="status"
        status={
          row.status === "active"
            ? "success"
            : row.status === "timeout"
              ? "warning"
              : "error"
        }
        label={
          row.status === "active"
            ? "Active"
            : row.status === "timeout"
              ? compact
                ? "Timed out"
                : `Timed out until ${fmtWhen(row.ban?.expires_at ?? null)}`
              : "Banned"
        }
      />
    </span>
  );

  const userColumns: ColumnConfig<TelegramAdminUser>[] = useMemo(
    () => [
      {
        key: "user_id",
        header: "User",
        type: "text",
        sortable: true,
        className: "min-w-0 overflow-hidden",
        render: (_, row) => (
          <span className="text-xs font-medium text-text-main truncate block max-w-full" title={row.user_id ?? undefined}>
            {row.user_id ?? <span className="text-text-muted italic">unlinked</span>}
          </span>
        ),
      },
      {
        key: "telegram_user_id",
        header: "Telegram ID",
        type: "text",
        render: (_, row) => (
          <span className="font-mono text-xs text-text-muted">{row.telegram_user_id}</span>
        ),
      },
      {
        key: "message_count",
        header: "Messages",
        type: "custom",
        sortable: true,
        align: "right" as const,
        accessor: (row: TelegramAdminUser) => row.message_count,
        render: (_, row) => (
          <span className="font-mono text-xs tabular-nums">{row.message_count}</span>
        ),
      },
      {
        key: "last_event_at",
        header: "Last active",
        type: "custom",
        sortable: true,
        accessor: (row: TelegramAdminUser) => row.last_event_at ?? "",
        render: (_, row) => (
          <span className="text-xs text-text-muted">{fmtWhen(row.last_event_at)}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        type: "custom",
        render: (_, row) => statusPill(row),
      },
      {
        key: "actions",
        header: "",
        type: "custom",
        align: "right" as const,
        render: (_, row) => rowActions(row),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, days],
  );

  const hasToken = Boolean(config?.has_token);
  const previewLink = usernameInput.trim()
    ? telegramDeepLink(usernameInput)
    : config?.deep_link ?? null;

  return (
    <TabsContent
      value="communications"
      className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Communications"
          description="Connect messaging channels to this Newton deployment. Each deployment uses its own Telegram bot."
          titleColumnClassName="text-left pb-2 sm:pb-0"
          descriptionClassName="mb-0"
          actions={
            <DashboardTabToolbar
              primary={null}
              refresh={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0"
                  onClick={refreshAll}
                  disabled={loading}
                  title="Refresh"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
              }
            />
          }
        />

        <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          {error ? (
            <ErrorRetry error={error} onRetry={() => fetchConfig()} />
          ) : (
            <div className="space-y-8">
            <div className="max-w-2xl space-y-6">
              {/* Header row: bot identity + enable switch */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg border border-border-main bg-surface-2 flex items-center justify-center shrink-0">
                  <FaTelegramPlane size={18} className="text-[#229ED9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text-main">Telegram Bot</div>
                  <div className="text-xs text-text-muted">
                    {hasToken ? (
                      <span className="inline-flex items-center gap-2">
                        <StatusBadge status="success" label="Token configured" />
                        {config?.validated_at && (
                          <span>
                            validated {new Date(config.validated_at).toLocaleString()}
                          </span>
                        )}
                      </span>
                    ) : (
                      <StatusBadge status="neutral" label="Not configured" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Label htmlFor="telegram-enabled" className="text-xs text-text-muted">
                    Enabled
                  </Label>
                  <Switch
                    id="telegram-enabled"
                    checked={Boolean(config?.is_enabled)}
                    disabled={!isAdmin || toggling || !hasToken}
                    onCheckedChange={handleToggle}
                  />
                </div>
              </div>

              {/* Token */}
              <div className="space-y-1.5">
                <Label htmlFor="telegram-token" className="text-xs">
                  Bot token
                </Label>
                <Input
                  id="telegram-token"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    hasToken && config?.token_masked
                      ? `Saved (${config.token_masked}) — paste a new token to rotate`
                      : "e.g. 123456789:AA...  (from @BotFather)"
                  }
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  disabled={!isAdmin || saving}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-text-muted">
                  Validated against Telegram before it is stored, then kept encrypted.
                  It is never shown again and never sent to users&apos; browsers. Saving
                  a token also registers this deployment&apos;s webhook.
                </p>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="telegram-username" className="text-xs">
                  Bot username
                </Label>
                <Input
                  id="telegram-username"
                  type="text"
                  placeholder="e.g. @NewtonAssistantBot"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  disabled={!isAdmin || saving}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-text-muted">
                  Shown to users in the Communications tab (with or without the leading
                  @). When you save a token, the username reported by Telegram takes
                  precedence.
                  {previewLink && (
                    <>
                      {" "}
                      Users will be sent to{" "}
                      <a
                        href={previewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        {previewLink}
                        <ExternalLink size={11} />
                      </a>
                      .
                    </>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!isAdmin || saving || (!tokenInput.trim() && !usernameInput.trim())}
                  onClick={handleSave}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isAdmin || testing || !hasToken}
                  onClick={handleTest}
                  title="Checks the saved token against getMe and verifies the webhook"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test connection"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isAdmin || !hasToken || removing}
                  onClick={() => setRemoveOpen(true)}
                  className="text-status-error border-status-error/40 hover:bg-status-error/5"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              </div>

              {/* Test result */}
              {testResult && (
                <div className="rounded-lg border border-border-main bg-surface-2 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="success" label="Bot reachable" />
                    {testResult.bot_username && (
                      <span className="text-xs font-mono text-text-main">
                        @{testResult.bot_username}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    Webhook:{" "}
                    <span className="font-mono">{testResult.webhook_url || "not set"}</span>{" "}
                    {testResult.webhook_matches ? "(matches)" : "(mismatch — re-save the token)"}
                  </p>
                  <p className="text-xs text-text-muted">
                    Pending updates: {testResult.pending_update_count}
                    {testResult.last_error_message && (
                      <span className="text-status-error">
                        {" "}
                        · last webhook error: {testResult.last_error_message}
                      </span>
                    )}
                  </p>
                </div>
              )}

              <p className="text-xs text-text-muted">
                Users connect from Settings → Communications by saving their numeric
                Telegram user ID. Only connected (allowlisted) accounts get responses,
                and every Telegram conversation is kept in sync with that user&apos;s
                GoTalk history.
              </p>
            </div>

            {/* Bot traffic */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-text-main">Bot traffic</h3>
                  <p className="text-xs text-text-muted">
                    Inbound Telegram activity, including rejected and blocked senders.
                  </p>
                </div>
                <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                  <SelectTrigger className="h-9 w-[140px] border-border-main bg-background/40 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4 flex-wrap text-xs">
                <span className="text-text-muted">In window:</span>
                <span className="font-mono tabular-nums text-status-success">
                  Messages {stats?.totals.messages ?? 0}
                </span>
                <span className="font-mono tabular-nums text-text-main">
                  Active users {stats?.totals.active_users ?? 0}
                </span>
                <span className="font-mono tabular-nums text-status-warning">
                  Rejected {stats?.totals.rejected ?? 0}
                </span>
                <span className="font-mono tabular-nums text-status-error">
                  Blocked {stats?.totals.blocked ?? 0}
                </span>
                <span className="font-mono tabular-nums text-text-muted">
                  Errors {stats?.totals.errors ?? 0}
                </span>
              </div>

              {statsLoading ? (
                <div className="flex h-48 items-center justify-center rounded-lg border border-border-main bg-background">
                  <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                </div>
              ) : (
                <div className="h-48 rounded-lg border border-border-main bg-background p-4">
                  <Bar
                    key={`telegram-traffic-${themeKey}-${days}`}
                    data={trafficChartData}
                    options={trafficChartOptions}
                  />
                </div>
              )}
            </div>

            {/* Connected users */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-text-main">Connected users</h3>
                <p className="text-xs text-text-muted">
                  Accounts allowed to talk to the bot, plus moderated Telegram IDs.
                  Message counts use the selected time window.
                </p>
              </div>
              {/* Mobile: compact cards so status + actions stay on-screen */}
              <div className="space-y-2 sm:hidden">
                {usersLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading Telegram users…
                  </div>
                ) : users.length === 0 ? (
                  <p className="py-6 text-center text-xs text-text-muted">
                    No connected Telegram users yet.
                  </p>
                ) : (
                  users.map((row) => (
                    <div
                      key={row.telegram_user_id}
                      className="space-y-2 rounded-lg border border-border-main bg-surface-2/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className="truncate text-xs font-medium text-text-main"
                            title={row.user_id ?? undefined}
                          >
                            {row.user_id ?? (
                              <span className="italic text-text-muted">unlinked</span>
                            )}
                          </div>
                          <div className="font-mono text-2xs text-text-muted">
                            {row.telegram_user_id}
                          </div>
                        </div>
                        <div className="shrink-0">{statusPill(row, true)}</div>
                      </div>
                      {row.status === "timeout" && row.ban?.expires_at && (
                        <p className="text-2xs text-text-muted">
                          Until {fmtWhen(row.ban.expires_at)}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-2xs text-text-muted">
                          {row.message_count} msgs · last {fmtWhen(row.last_event_at)}
                        </span>
                        {rowActions(row)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop/tablet: full table */}
              <div className="hidden sm:block">
                <DataTable
                  columns={userColumns}
                  data={users}
                  isLoading={usersLoading}
                  {...dashboardTableLoadingProps}
                  disablePagination
                  enableFilters={false}
                  enableGlobalSearch={false}
                  emptyMessage="No connected Telegram users yet."
                  loadingMessage="Loading Telegram users..."
                  getRowId={(row) => row.telegram_user_id}
                  className={dashboardAdminTableClassName}
                />
              </div>
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Telegram configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the stored bot token, deregisters the webhook, and disables
              Telegram for every user in this deployment. User ID links are kept, so
              reconfiguring a bot restores service without users re-connecting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRemove();
              }}
              disabled={removing}
              className="bg-status-error text-white hover:bg-status-error/90"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Moderation confirmation */}
      <AlertDialog
        open={modAction !== null}
        onOpenChange={(open) => {
          if (!open) setModAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {modAction?.type === "revoke" && "Revoke Telegram link?"}
              {modAction?.type === "ban" && "Ban this Telegram account?"}
              {modAction?.type === "timeout" && "Timeout this Telegram account?"}
              {modAction?.type === "unban" &&
                (modAction.user.status === "banned" ? "Lift this ban?" : "Lift this timeout?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {modAction?.type === "revoke" && (
                <>
                  Disconnects <span className="font-mono">{modAction.user.user_id}</span> from
                  Telegram ID <span className="font-mono">{modAction.user.telegram_user_id}</span>.
                  They can reconnect themselves from Settings → Communications unless you also
                  ban the ID.
                </>
              )}
              {modAction?.type === "ban" && (
                <>
                  Telegram ID <span className="font-mono">{modAction.user.telegram_user_id}</span>{" "}
                  will be silently ignored by the bot and cannot be reconnected to any account
                  until the ban is lifted. The existing link is kept.
                </>
              )}
              {modAction?.type === "timeout" && (
                <>
                  Telegram ID <span className="font-mono">{modAction.user.telegram_user_id}</span>{" "}
                  will be muted for the selected duration. They&apos;ll be told when they can
                  message again.
                </>
              )}
              {modAction?.type === "unban" && (
                <>
                  Telegram ID <span className="font-mono">{modAction.user.telegram_user_id}</span>{" "}
                  will be able to message the bot again
                  {modAction.user.connected_at === null
                    ? " once reconnected to an account"
                    : ""}
                  .
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(modAction?.type === "ban" || modAction?.type === "timeout") && (
            <div className="space-y-3">
              {modAction.type === "timeout" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Duration</Label>
                  <Select
                    value={String(timeoutMinutes)}
                    onValueChange={(v) => setTimeoutMinutes(Number(v))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEOUT_CHOICES.map((choice) => (
                        <SelectItem key={choice.minutes} value={String(choice.minutes)}>
                          {choice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="telegram-mod-reason" className="text-xs">
                  Reason (optional, shown only to admins)
                </Label>
                <Input
                  id="telegram-mod-reason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="e.g. spam / usage abuse"
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={modBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleModeration();
              }}
              disabled={modBusy}
              className={cn(
                modAction?.type === "ban" &&
                  "bg-status-error text-white hover:bg-status-error/90",
                modAction?.type === "timeout" &&
                  "bg-status-warning text-white hover:bg-status-warning/90",
              )}
            >
              {modBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : modAction?.type === "revoke" ? (
                "Revoke link"
              ) : modAction?.type === "ban" ? (
                "Ban"
              ) : modAction?.type === "timeout" ? (
                "Apply timeout"
              ) : (
                "Lift"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message history (abuse review) */}
      <Dialog
        open={historyUser !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryUser(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recent Telegram messages</DialogTitle>
            <DialogDescription>
              Latest Telegram turns for{" "}
              <span className="font-mono">{historyUser?.user_id}</span>, newest first.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
              </div>
            ) : historyRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                No Telegram messages recorded for this user.
              </p>
            ) : (
              historyRows.map((row) => (
                <div
                  key={row.message_id}
                  className="rounded-lg border border-border-main bg-surface-2 px-3 py-2 space-y-1"
                >
                  <div className="text-2xs font-mono uppercase tracking-wide text-text-muted">
                    {fmtWhen(row.created_at)}
                  </div>
                  <p className="text-sm text-text-main whitespace-pre-wrap break-words">
                    {row.query || <span className="italic text-text-muted">(empty)</span>}
                  </p>
                  {row.reply && (
                    <p className="border-l-2 border-border-main pl-2 text-xs text-text-muted whitespace-pre-wrap break-words">
                      {row.reply}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
};
