import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminFormDialog, FormDialogFooter } from "./Forms/AdminFormDialog";
import { FormField } from "./Forms/FormField";
import { RedirectUriField } from "./RedirectUriField";
import { providersApi, providerRuleOf } from "@/services/connections/providersApi";
import {
  AUTH_MODE_LABEL,
  isOAuthMode,
  type ProviderAuthMode,
  type ProviderDetail,
  type ProviderOAuth2Write,
  type ProviderWriteRequest,
} from "@/services/connections/types";
import notify from "@/utils/notify";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronRight,
  Plug,
  Plus,
  ShieldAlert,
} from "lucide-react";

/** Mirrors the server's `ProviderSpec.key` pattern; `key` is immutable after create. */
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/** Shared field chrome — use theme tokens so placeholders read as hints, not filled values. */
const fieldClassName =
  "border-border-main bg-background text-text-main placeholder:text-text-muted";

interface FormState {
  key: string;
  displayName: string;
  authMode: ProviderAuthMode;
  authorizationUrl: string;
  tokenUrl: string;
  defaultScopesText: string;
  // Environment columns, not part of the spec document.
  isEnabled: boolean;
  clientId: string;
  clientSecret: string;
  /** Write-only, system-level credential for `api_key` providers. */
  apiKey: string;
  // Advanced oauth2 fields.
  scopeSeparator: string;
  pkce: boolean;
  tokenRequestAuth: "body" | "basic";
  tokenResponseAccess: string;
  tokenResponseRefresh: string;
  tokenResponseExpires: string;
  /** `key=value`, one per line. */
  extraAuthorizeParamsText: string;
}

const EMPTY_STATE: FormState = {
  key: "",
  displayName: "",
  authMode: "oauth2",
  authorizationUrl: "",
  tokenUrl: "",
  defaultScopesText: "",
  isEnabled: true,
  clientId: "",
  clientSecret: "",
  apiKey: "",
  scopeSeparator: " ",
  pkce: false,
  tokenRequestAuth: "body",
  tokenResponseAccess: "$.access_token",
  tokenResponseRefresh: "$.refresh_token",
  tokenResponseExpires: "$.expires_in",
  extraAuthorizeParamsText: "",
};

const parseList = (text: string): string[] =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Parses the `key=value`-per-line textarea into `extra_authorize_params`. */
function parseKeyValueText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

const serializeKeyValueText = (record: Record<string, string> | undefined): string =>
  record
    ? Object.entries(record)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n")
    : "";

/** Client-side mirror of the server's SSRF-adjacent write-time checks. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Hostname an OAuth endpoint points a browser at, for the confirmation copy. */
function hostOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname || null;
  } catch {
    return null;
  }
}

/** Populates the form from a loaded provider (edit mode). */
function stateFromProvider(provider: ProviderDetail): FormState {
  const oauth2 = provider.oauth2;

  return {
    ...EMPTY_STATE,
    key: provider.key,
    displayName: provider.display_name,
    authMode: provider.auth_mode,
    authorizationUrl: oauth2?.authorization_url ?? "",
    tokenUrl: oauth2?.token_url ?? "",
    defaultScopesText: oauth2?.default_scopes?.join("\n") ?? "",
    isEnabled: provider.is_enabled,
    clientId: "",
    clientSecret: "",
    apiKey: "",
    scopeSeparator: oauth2?.scope_separator ?? EMPTY_STATE.scopeSeparator,
    pkce: oauth2?.pkce ?? false,
    tokenRequestAuth: oauth2?.token_request_auth ?? "body",
    tokenResponseAccess: oauth2?.token_response?.access_token ?? EMPTY_STATE.tokenResponseAccess,
    tokenResponseRefresh: oauth2?.token_response?.refresh_token ?? EMPTY_STATE.tokenResponseRefresh,
    tokenResponseExpires: oauth2?.token_response?.expires_in ?? EMPTY_STATE.tokenResponseExpires,
    extraAuthorizeParamsText: serializeKeyValueText(oauth2?.extra_authorize_params),
  };
}

function buildOAuth2Write(state: FormState): ProviderOAuth2Write {
  return {
    authorization_url: state.authorizationUrl.trim(),
    token_url: state.tokenUrl.trim(),
    default_scopes: parseList(state.defaultScopesText),
    scope_separator: state.scopeSeparator || " ",
    pkce: state.pkce,
    token_request_auth: state.tokenRequestAuth,
    extra_authorize_params: parseKeyValueText(state.extraAuthorizeParamsText),
    token_response: {
      access_token: state.tokenResponseAccess.trim() || "$.access_token",
      refresh_token: state.tokenResponseRefresh.trim() || "$.refresh_token",
      expires_in: state.tokenResponseExpires.trim() || "$.expires_in",
    },
  };
}

/**
 * Builds the single write body sent to `create`/`replace`.
 *
 * Credentials are write-only: blank means "keep the currently stored value",
 * so an untouched field is simply omitted rather than sent empty.
 */
function buildWriteRequest(
  state: FormState,
  isEdit: boolean,
  confirmEndpoints: boolean,
): ProviderWriteRequest {
  const oauth = isOAuthMode(state.authMode);

  const request: ProviderWriteRequest = {
    ...(isEdit ? {} : { key: state.key.trim() }),
    display_name: state.displayName.trim(),
    auth_mode: state.authMode,
    is_enabled: state.isEnabled,
    confirm_oauth_endpoints: confirmEndpoints,
  };

  if (oauth) {
    if (state.clientId.trim()) request.client_id = state.clientId.trim();
    if (state.clientSecret.trim()) request.client_secret = state.clientSecret.trim();
    request.oauth2 = buildOAuth2Write(state);
  } else if (state.apiKey.trim()) {
    request.api_key = state.apiKey.trim();
  }

  return request;
}

export interface ProviderFormProps {
  open: boolean;
  /** `null` creates; a provider key loads that provider for editing. */
  editingKey: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}

export function ProviderForm({
  open,
  editingKey,
  onOpenChange,
  onSaved,
}: Readonly<ProviderFormProps>) {
  const isEdit = editingKey !== null;

  const [state, setState] = useState<FormState>(EMPTY_STATE);
  const [original, setOriginal] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmEndpoints, setConfirmEndpoints] = useState(false);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  // The redirect URI is one value per environment, so it is knowable before the
  // first provider exists — that is what lets credentials be collected here
  // rather than in a second dialog after the write lands.
  useEffect(() => {
    if (!open || redirectUri) return;
    providersApi
      .meta()
      .then((data) => setRedirectUri(data.redirect_uri))
      .catch(() => setRedirectUri(null));
  }, [open, redirectUri]);

  const reset = useCallback(() => {
    setState(EMPTY_STATE);
    setOriginal(null);
    setErrors({});
    setFormError(null);
    setConfirmEndpoints(false);
    setAdvancedOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    if (!editingKey) return;

    let cancelled = false;
    setLoading(true);
    providersApi
      .get(editingKey)
      .then((data) => {
        if (cancelled) return;
        setOriginal(data.provider);
        setState(stateFromProvider(data.provider));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        notify.error(e);
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, editingKey, reset, onOpenChange]);

  /**
   * Whether this write sets or changes an OAuth endpoint — the server's
   * confirmation gate. Always true on create; on edit only when a URL moved.
   */
  const endpointsChanged = useMemo(() => {
    if (!isOAuthMode(state.authMode)) return false;
    const nextAuth = state.authorizationUrl.trim();
    const nextToken = state.tokenUrl.trim();
    if (!original) return Boolean(nextAuth || nextToken);

    const prevAuth = original.oauth2?.authorization_url ?? "";
    const prevToken = original.oauth2?.token_url ?? "";
    return (
      (Boolean(nextAuth) && nextAuth !== prevAuth) ||
      (Boolean(nextToken) && nextToken !== prevToken)
    );
  }, [state.authMode, state.authorizationUrl, state.tokenUrl, original]);

  const destinationHosts = useMemo(() => {
    const hosts = [hostOf(state.authorizationUrl), hostOf(state.tokenUrl)].filter(
      (h): h is string => Boolean(h),
    );
    return Array.from(new Set(hosts));
  }, [state.authorizationUrl, state.tokenUrl]);

  /** Validates every section at once — a fix for one field must not hide the next. */
  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!isEdit && !PROVIDER_KEY_PATTERN.test(state.key.trim())) {
      next.key =
        "Lowercase letters, numbers, and underscores only; must start with a letter";
    }
    if (!state.displayName.trim()) next.displayName = "Required";

    if (isOAuthMode(state.authMode)) {
      const auth = state.authorizationUrl.trim();
      const token = state.tokenUrl.trim();

      if (!auth) {
        next.authorizationUrl = "Required for OAuth2";
      } else if (auth.includes("${")) {
        next.authorizationUrl =
          "Interpolation was removed — enter the complete literal URL";
      } else if (!isHttpsUrl(auth)) {
        next.authorizationUrl = "Must be a complete https:// URL";
      }

      if (!token) {
        next.tokenUrl = "Required";
      } else if (token.includes("${")) {
        next.tokenUrl = "Interpolation was removed — enter the complete literal URL";
      } else if (!isHttpsUrl(token)) {
        next.tokenUrl = "Must be a complete https:// URL";
      }
    }

    if (endpointsChanged && !confirmEndpoints) {
      next.confirmEndpoints =
        "Confirm where sign-in traffic will be sent before saving";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const request = buildWriteRequest(state, isEdit, confirmEndpoints);
      const data = isEdit
        ? await providersApi.replace(state.key, request)
        : await providersApi.create(request);
      const hosts = data.destination_hosts ?? [];

      const suffix = hosts.length > 0 ? ` — sign-in traffic goes to ${hosts.join(", ")}` : "";
      if (isEdit) {
        notify.success(`${state.displayName.trim()} updated${suffix}`);
      } else if (isOAuthMode(state.authMode) && !state.clientId.trim()) {
        notify.success(
          `${state.displayName.trim()} created${suffix}. Add client credentials to finish setup.`,
        );
      } else if (!isOAuthMode(state.authMode) && !state.apiKey.trim()) {
        notify.success(
          `${state.displayName.trim()} created${suffix}. Add an API key to finish setup.`,
        );
      } else {
        notify.success(`${state.displayName.trim()} created${suffix}`);
      }

      await onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save provider";
      const rule = providerRuleOf(e);

      // The server is the authority on these gates — if it rejects, surface
      // the relevant field even when the client-side checks thought the write
      // was clean.
      if (rule === "confirm_oauth_endpoints") {
        setConfirmEndpoints(false);
        setErrors((prev) => ({ ...prev, confirmEndpoints: message }));
      } else if (rule === "placeholder_unsupported") {
        setErrors((prev) => ({
          ...prev,
          authorizationUrl: message,
          tokenUrl: message,
        }));
      } else if (rule === "schema") {
        setAdvancedOpen(true);
      }
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const oauth = isOAuthMode(state.authMode);
  const refreshStyle = original?.oauth2?.refresh_style ?? null;

  return (
    <AdminFormDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={
        isEdit
          ? `Edit ${original?.display_name ?? "provider"}`
          : "Add provider"
      }
      icon={
        isEdit ? (
          <Plug className="h-5 w-5 text-primary" />
        ) : (
          <Plus className="h-5 w-5 text-primary" />
        )
      }
      size="lg"
      bodyClassName="max-h-[70vh] overflow-y-auto"
      footer={
        <FormDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || loading}
            className="h-9 rounded-[0.6rem]"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create provider"}
          </Button>
        </FormDialogFooter>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted">Loading provider…</p>
      ) : (
        <div className="space-y-6">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-status-error/30 bg-status-error/8 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-error" />
              <p className="text-sm text-text-main">{formError}</p>
            </div>
          )}

          {/* ── Identity ─────────────────────────────────────────── */}
          <Section title="Identity">
            {isEdit ? (
              <ReadOnlyRow label="Provider key" value={state.key} hint="immutable after create" />
            ) : (
              <FormField label="Provider key" required error={errors.key}>
                <Input
                  value={state.key}
                  onChange={(e) => set("key", e.target.value.trim().toLowerCase())}
                  placeholder="e.g. example_api"
                  className={cn(fieldClassName, "font-mono text-sm")}
                  autoComplete="off"
                />
              </FormField>
            )}

            <FormField label="Display name" required error={errors.displayName}>
              <Input
                value={state.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="e.g. Example API"
                className={fieldClassName}
              />
            </FormField>
          </Section>

          {/* ── Authentication ───────────────────────────────────── */}
          <Section title="Authentication">
            <FormField label="Auth mode" required>
              <Select
                value={state.authMode}
                onValueChange={(value: ProviderAuthMode) => set("authMode", value)}
              >
                <SelectTrigger className="border-border-main bg-background text-text-main">
                  <SelectValue placeholder="Select auth mode" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUTH_MODE_LABEL) as ProviderAuthMode[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {AUTH_MODE_LABEL[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {oauth && (
              <FormField
                label="Authorization URL"
                required
                error={errors.authorizationUrl}
              >
                <Input
                  value={state.authorizationUrl}
                  onChange={(e) => set("authorizationUrl", e.target.value)}
                  placeholder="e.g. https://provider.example.com/oauth2/authorize"
                  className={cn(fieldClassName, "font-mono text-sm")}
                />
              </FormField>
            )}

            {oauth && (
              <FormField label="Token URL" required error={errors.tokenUrl}>
                <Input
                  value={state.tokenUrl}
                  onChange={(e) => set("tokenUrl", e.target.value)}
                  placeholder="e.g. https://provider.example.com/oauth2/token"
                  className={cn(fieldClassName, "font-mono text-sm")}
                />
              </FormField>
            )}

            {oauth && (
              <FormField
                label="Scopes"
                hint="requested at sign-in — one per line or comma-separated"
              >
                <Textarea
                  value={state.defaultScopesText}
                  onChange={(e) => set("defaultScopesText", e.target.value)}
                  placeholder={"e.g.\nopenid\nprofile\nemail"}
                  rows={3}
                  className={cn(fieldClassName, "font-mono text-xs")}
                />
              </FormField>
            )}

            {!oauth && (
              <p className="text-2xs text-text-muted">
                Nothing else to declare here — the API key is a single, system-level
                credential shared by every connection to this provider (see
                Credentials below), used exactly as pasted. If this API expects a
                prefix such as <code className="font-mono">{"Bearer "}</code>, enter it
                as part of the key.
              </p>
            )}

            {/* The confirmation gate, made visible. Never auto-checked: it is the
                one control standing between an admin and redirecting users to an
                attacker-controlled host. */}
            {endpointsChanged && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  errors.confirmEndpoints
                    ? "border-status-error/40 bg-status-error/8"
                    : "border-status-warning/30 bg-status-warning/8",
                )}
              >
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={confirmEndpoints}
                    onCheckedChange={(v) => {
                      setConfirmEndpoints(v === true);
                      setErrors((prev) => ({ ...prev, confirmEndpoints: "" }));
                    }}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-text-main">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ShieldAlert className="h-4 w-4 text-status-warning" />
                      Confirm sign-in destination
                    </span>
                    <span className="mt-1 block text-text-muted">
                      {destinationHosts.length > 0 ? (
                        <>
                          Users will be sent to{" "}
                          {destinationHosts.map((h, i) => (
                            <span key={h}>
                              {i > 0 && ", "}
                              <code className="font-mono text-xs text-text-main">{h}</code>
                            </span>
                          ))}{" "}
                          to sign in.
                        </>
                      ) : (
                        "These endpoints will receive your users' sign-in traffic."
                      )}
                    </span>
                  </span>
                </label>
                {errors.confirmEndpoints && (
                  <p className="mt-1.5 pl-6 text-xs text-status-error">
                    {errors.confirmEndpoints}
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* ── Credentials ──────────────────────────────────────── */}
          <Section title="Credentials">
            {oauth ? (
              <>
                {redirectUri ? (
                  <RedirectUriField redirectUri={redirectUri} />
                ) : (
                  <p className="text-2xs text-text-muted">
                    Redirect URI unavailable — it will appear once the provider is saved.
                  </p>
                )}

                <p className="text-2xs text-text-muted">
                  Register that URL with {state.displayName.trim() || "the provider"}, then
                  paste what its console gives you. You can leave these blank and finish
                  later — the provider list flags anything still missing credentials.
                </p>

                <FormField
                  label="Client ID"
                  hint={
                    original?.has_credentials ? "set — leave blank to keep" : undefined
                  }
                >
                  <Input
                    value={state.clientId}
                    onChange={(e) => set("clientId", e.target.value)}
                    placeholder={
                      original?.has_credentials
                        ? "Leave blank to keep the current value"
                        : "Enter client ID"
                    }
                    className={fieldClassName}
                    autoComplete="off"
                  />
                </FormField>

                <FormField
                  label="Client secret"
                  hint={
                    original?.has_credentials ? "set — leave blank to keep" : undefined
                  }
                >
                  <Input
                    type="password"
                    value={state.clientSecret}
                    onChange={(e) => set("clientSecret", e.target.value)}
                    placeholder={
                      original?.has_credentials
                        ? "Leave blank to keep the current value"
                        : "Enter client secret"
                    }
                    className={fieldClassName}
                    autoComplete="new-password"
                  />
                </FormField>
              </>
            ) : (
              <>
                <p className="text-2xs text-text-muted">
                  This is a single, system-level key shared by every connection to this
                  provider — it is not collected from individual users.
                </p>
                <FormField
                  label="API key"
                  hint={
                    original?.has_credentials ? "set — leave blank to keep" : undefined
                  }
                >
                  <Input
                    type="password"
                    value={state.apiKey}
                    onChange={(e) => set("apiKey", e.target.value)}
                    placeholder={
                      original?.has_credentials
                        ? "Leave blank to keep the current value"
                        : "Enter API key"
                    }
                    className={fieldClassName}
                    autoComplete="new-password"
                  />
                </FormField>
              </>
            )}
          </Section>

          {/* ── Advanced ─────────────────────────────────────────── */}
          {oauth && (
            <div className="rounded-lg border border-border-main">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-text-muted transition-transform",
                    advancedOpen && "rotate-90",
                  )}
                />
                <span className="text-[0.8rem] font-medium text-text-main">
                  Advanced
                </span>
                <span className="text-2xs text-text-muted">
                  PKCE, token request auth, token response mapping
                </span>
              </button>

              {advancedOpen && (
                <div className="space-y-3.5 border-t border-border-main px-3 py-3">
                  {refreshStyle === "json_body" && (
                    <ReadOnlyRow
                      label="Refresh style"
                      value="json_body"
                      hint="set by migration; preserved automatically"
                    />
                  )}

                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={state.pkce}
                      onCheckedChange={(v) => set("pkce", v === true)}
                    />
                    <span className="text-sm text-text-main">Use PKCE</span>
                  </label>

                  <FormField label="Token request auth">
                    <Select
                      value={state.tokenRequestAuth}
                      onValueChange={(value: "body" | "basic") =>
                        set("tokenRequestAuth", value)
                      }
                    >
                      <SelectTrigger className="border-border-main bg-background text-text-main">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="body">Body</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="Scope separator" hint='defaults to a space (" ")'>
                    <Input
                      value={state.scopeSeparator}
                      onChange={(e) => set("scopeSeparator", e.target.value)}
                      placeholder=" "
                      className={cn(fieldClassName, "font-mono text-sm")}
                    />
                  </FormField>

                  <FormField label="Access token path" hint="JSONPath into the token response">
                    <Input
                      value={state.tokenResponseAccess}
                      onChange={(e) => set("tokenResponseAccess", e.target.value)}
                      placeholder="e.g. $.access_token"
                      className={cn(fieldClassName, "font-mono text-sm")}
                    />
                  </FormField>

                  <FormField label="Refresh token path" hint="JSONPath into the token response">
                    <Input
                      value={state.tokenResponseRefresh}
                      onChange={(e) => set("tokenResponseRefresh", e.target.value)}
                      placeholder="e.g. $.refresh_token"
                      className={cn(fieldClassName, "font-mono text-sm")}
                    />
                  </FormField>

                  <FormField label="Expires-in path" hint="JSONPath into the token response">
                    <Input
                      value={state.tokenResponseExpires}
                      onChange={(e) => set("tokenResponseExpires", e.target.value)}
                      placeholder="e.g. $.expires_in"
                      className={cn(fieldClassName, "font-mono text-sm")}
                    />
                  </FormField>

                  <FormField
                    label="Extra authorize params"
                    hint="one key=value per line"
                  >
                    <Textarea
                      value={state.extraAuthorizeParamsText}
                      onChange={(e) => set("extraAuthorizeParamsText", e.target.value)}
                      placeholder="e.g. prompt=consent"
                      rows={3}
                      className={cn(fieldClassName, "font-mono text-xs")}
                    />
                  </FormField>
                </div>
              )}
            </div>
          )}

          {/* ── Status ───────────────────────────────────────────── */}
          <Section title="Status">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={state.isEnabled}
                onCheckedChange={(v) => set("isEnabled", v === true)}
              />
              <span className="text-sm text-text-main">Enabled</span>
            </label>
          </Section>
        </div>
      )}
    </AdminFormDialog>
  );
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="space-y-3.5">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Immutable values read as text, not as a greyed-out input the admin may try to click. */
function ReadOnlyRow({
  label,
  value,
  hint,
}: Readonly<{ label: string; value: string; hint?: string }>) {
  return (
    <FormField label={label} hint={hint}>
      <p className="rounded-lg border border-border-main bg-surface-2 px-3 py-2 font-mono text-sm text-text-main">
        {value}
      </p>
    </FormField>
  );
}
