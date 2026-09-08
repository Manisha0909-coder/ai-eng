import { useMemo } from 'react';
import { ChevronDown, ChevronUp, Loader2, SquarePen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  AUTH_MODE_LABEL,
  type ProviderDetail,
  type ProviderSummary,
} from '@/services/connections/types';
import {
  logoOnWhiteBackground,
  providerLogo,
} from '@/features/user-panel/tabs/connections/connectionUi';
import { cn } from '@/lib/utils';
import { getDisplayInitials } from '../utils/dashboardHelper';
import {
  personaDetailPanelClass,
  personaDetailSectionLabelClass,
} from '../utils/dashboardHelper';
import { DashboardPill } from './DashboardPill';
import { StatusBadge } from './StatusBadge';

const detailShellClass = 'bg-background';

const detailOutlineButtonClass =
  'gap-2 border-border-main bg-surface text-text-main hover:bg-surface/80';

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className={personaDetailSectionLabelClass}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function IdentityRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-baseline gap-x-4 py-2.5 border-b border-border-main/40 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <div className="text-sm text-text-main min-w-0 break-words text-left">{children}</div>
    </div>
  );
}

export function ProviderAvatar({
  providerKey,
  displayName,
  size = 'md',
}: {
  providerKey: string;
  displayName: string;
  size?: 'sm' | 'md';
}) {
  const hasBrandLogo =
    providerKey === 'google' ||
    providerKey === 'microsoft' ||
    providerKey === 'noah' ||
    providerKey === 'connectsecure' ||
    providerKey === 'ibm_loyalty';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-display font-semibold',
        size === 'sm' ? 'h-7 w-7 text-2xs' : 'h-10 w-10 text-xs',
        logoOnWhiteBackground(providerKey)
          ? 'border border-border-main bg-white'
          : hasBrandLogo
            ? 'border border-border-main bg-surface-2'
            : 'text-primary [background:linear-gradient(135deg,rgb(var(--color-primary)/0.15),rgb(var(--color-primary)/0.08))] [box-shadow:inset_0_0_0_1px_rgb(var(--color-primary)/0.18)]',
      )}
      aria-label={displayName}
    >
      {hasBrandLogo ? providerLogo(providerKey) : getDisplayInitials(displayName)}
    </span>
  );
}

export interface ProviderSidebarProps {
  provider: ProviderDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  providers?: ProviderSummary[];
  onNavigate?: (provider: ProviderSummary) => void;
  onConfigure?: (provider: ProviderDetail) => void;
  canConfigure?: boolean;
}

export function ProviderSidebar({
  provider,
  open,
  onOpenChange,
  loading = false,
  providers = [],
  onNavigate,
  onConfigure,
  canConfigure = true,
}: ProviderSidebarProps) {
  const currentIndex = useMemo(
    () =>
      provider
        ? providers.findIndex((p) => p.key === provider.key)
        : -1,
    [provider, providers],
  );

  const navigatePrev = () => {
    if (currentIndex > 0) onNavigate?.(providers[currentIndex - 1]);
  };

  const navigateNext = () => {
    if (currentIndex >= 0 && currentIndex < providers.length - 1) {
      onNavigate?.(providers[currentIndex + 1]);
    }
  };

  const headerName = provider?.display_name ?? 'Provider details';
  const headerKey = provider?.key;
  // Orphaned providers stay editable on purpose: a `PUT` of the spec is how an
  // admin re-establishes one whose YAML was removed from the catalog.
  const configureDisabled = !canConfigure || !provider || loading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex w-full flex-col gap-0 border-border-main p-0 sm:max-w-xl md:max-w-2xl',
          detailShellClass,
          '[&>button]:hidden',
        )}
      >
        <div className="shrink-0 bg-background px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {headerKey ? (
                <ProviderAvatar
                  providerKey={headerKey}
                  displayName={headerName}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold leading-tight text-text-main">
                  {headerName}
                </h2>
                {headerKey && (
                  <p className="mt-0.5 font-mono text-xs text-text-muted">
                    {headerKey}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border-main/60 bg-surface p-1 text-text-muted">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-1 hover:bg-surface"
                disabled={currentIndex <= 0 || loading}
                onClick={navigatePrev}
                title="Previous provider"
              >
                <ChevronUp size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-1 hover:bg-surface"
                disabled={
                  currentIndex < 0 ||
                  currentIndex >= providers.length - 1 ||
                  loading
                }
                onClick={navigateNext}
                title="Next provider"
              >
                <ChevronDown size={18} />
              </Button>
              <span className="hidden border-l border-border-main/60 px-2 text-xs sm:inline">
                navigate
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-1 hover:bg-surface"
                onClick={() => onOpenChange(false)}
                title="Close"
              >
                <X size={18} />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'scrollbar-themed min-h-0 flex-1 overflow-y-auto border-t border-border-main/40 px-5 py-5',
            detailShellClass,
          )}
        >
          {loading && !provider ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
              <Loader2 size={18} className="animate-spin" />
              Loading provider…
            </div>
          ) : provider ? (
            <div className={cn('space-y-6', loading && 'opacity-60')}>
              <DetailSection title="Identity">
                <div className={cn(personaDetailPanelClass, 'px-3')}>
                  <IdentityRow label="display_name">
                    {provider.display_name}
                  </IdentityRow>
                  <IdentityRow label="key">
                    <DashboardPill
                      intent="entity"
                      label={provider.key}
                      mono
                      className="max-w-full"
                    />
                  </IdentityRow>
                  <IdentityRow label="auth_mode">
                    <DashboardPill
                      intent="entity"
                      label={AUTH_MODE_LABEL[provider.auth_mode]}
                      mono
                    />
                  </IdentityRow>
                  <IdentityRow label="status">
                    <StatusBadge
                      status={provider.is_enabled ? 'success' : 'neutral'}
                      label={provider.is_enabled ? 'Enabled' : 'Disabled'}
                    />
                  </IdentityRow>
                  <IdentityRow label="has_credentials">
                    {provider.has_credentials ? 'true' : 'false'}
                  </IdentityRow>
                  {provider.redirect_uri && (
                    <IdentityRow label="redirect_uri">
                      <code className="font-mono text-2xs break-all">
                        {provider.redirect_uri}
                      </code>
                    </IdentityRow>
                  )}
                </div>
              </DetailSection>

              {provider.oauth2 && (
                <DetailSection title="OAuth2">
                  <div className={cn(personaDetailPanelClass, 'px-3')}>
                    <IdentityRow label="authorization_url">
                      <code className="font-mono text-2xs break-all">
                        {provider.oauth2.authorization_url}
                      </code>
                    </IdentityRow>
                    <IdentityRow label="token_url">
                      <code className="font-mono text-2xs break-all">
                        {provider.oauth2.token_url}
                      </code>
                    </IdentityRow>
                    <IdentityRow label="default_scopes">
                      {provider.oauth2.default_scopes.length > 0
                        ? provider.oauth2.default_scopes.join(', ')
                        : '—'}
                    </IdentityRow>
                    <IdentityRow label="scope_separator">
                      <code className="font-mono text-2xs">
                        {JSON.stringify(provider.oauth2.scope_separator)}
                      </code>
                    </IdentityRow>
                    <IdentityRow label="pkce">
                      {provider.oauth2.pkce ? 'true' : 'false'}
                    </IdentityRow>
                    <IdentityRow label="token_request_auth">
                      {provider.oauth2.token_request_auth}
                    </IdentityRow>
                    <IdentityRow label="token_response">
                      <code className="font-mono text-2xs break-all">
                        access: {provider.oauth2.token_response.access_token} · refresh:{' '}
                        {provider.oauth2.token_response.refresh_token} · expires_in:{' '}
                        {provider.oauth2.token_response.expires_in}
                      </code>
                    </IdentityRow>
                    {provider.oauth2.refresh_style && (
                      <IdentityRow label="refresh_style">
                        <code className="font-mono text-2xs">
                          {provider.oauth2.refresh_style}
                        </code>
                      </IdentityRow>
                    )}
                  </div>
                </DetailSection>
              )}
            </div>
          ) : null}
        </div>

        {provider && onConfigure && (
          <div className="shrink-0 border-t border-border-main/40 bg-background px-5 py-4">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className={detailOutlineButtonClass}
                disabled={configureDisabled}
                title={
                  !canConfigure ? 'Admin privileges required' : 'Edit provider'
                }
                onClick={() => onConfigure(provider)}
              >
                <SquarePen size={16} />
                Edit
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
