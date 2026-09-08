import { useCallback, useEffect, useMemo, useState } from 'react';
import notify from '@/utils/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GitBranch,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { formatDashboardDate } from '@/utils/helper';
import {
  formatRelativeTime,
  personaTypeDisplayLabel,
  personaDetailPanelClass,
  personaDetailSectionLabelClass,
} from '../utils/dashboardHelper';
import { personasApi, type Persona } from '@/services/rbac/rbacApi';
import { usePersonaVersions } from './Modals/personaVersion/usePersonaVersions';
import { PersonaVersionTimeline } from './Modals/personaVersion/PersonaVersionTimeline';
import { RawPromptBlock } from './Modals/personaVersion/RawPromptBlock';
import { RULE_TYPE_LABELS } from './ToolRuleEditor';
import { cn } from '@/lib/utils';
import { PersonaTypeAvatar } from './PersonaTypeAvatar';
import { DashboardPill } from './DashboardPill';

const personaDetailTabTriggerClass =
  'rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm font-medium shadow-none ring-0 outline-none text-text-muted transition-colors hover:text-text-main focus-visible:ring-0 data-[state=active]:!border-primary data-[state=active]:!bg-transparent data-[state=active]:!text-text-main data-[state=active]:!shadow-none data-[state=active]:!ring-0';

const personaDetailShellClass = 'bg-background';

const personaDetailOutlineButtonClass =
  'gap-2 border-border-main bg-surface text-text-main hover:bg-surface/80';

function DetailSection({
  title,
  children,
  icon,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className={personaDetailSectionLabelClass}>{title}</h3>
      </div>
      {hint && <p className="mb-2 text-xs text-text-muted">{hint}</p>}
      {children}
    </section>
  );
}

export interface PersonaSidebarProps {
  persona: Persona | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
  onCreateVersion?: (basePersona: Persona) => void;
  onRefresh?: () => void;
  onPersonaUpdated?: (persona: Persona) => void;
  personas?: Persona[];
  onNavigate?: (persona: Persona) => void;
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

function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error('Failed to copy');
    }
  };
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span className="truncate">{value}</span>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg p-1 text-text-muted transition-colors hover:bg-surface hover:text-text-main"
        title="Copy"
      >
        <Copy size={18} />
      </button>
      {copied && <span className="text-xs text-primary">copied</span>}
    </span>
  );
}

export function PersonaSidebar({
  persona,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onCreateVersion,
  onRefresh,
  onPersonaUpdated,
  personas = [],
  onNavigate,
}: PersonaSidebarProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const rootPersonaId = useMemo(
    () => (persona ? persona.parent_persona_id ?? persona.id : null),
    [persona?.id, persona?.parent_persona_id]
  );

  const currentIndex = useMemo(
    () => (persona ? personas.findIndex((p) => p.id === persona.id) : -1),
    [persona, personas]
  );

  const { allVersions, loading: versionsLoading, effectiveCurrentId, fetchVersions } = usePersonaVersions({
    persona: persona ?? ({} as Persona),
    enabled: open && !!persona,
  });

  // Auto-select the live version when versions load
  useEffect(() => {
    if (versionsLoading || allVersions.length === 0) return;
    setSelectedVersionId((prev) => {
      if (prev != null && allVersions.some((v) => v.id === prev)) return prev;
      if (effectiveCurrentId != null && allVersions.some((v) => v.id === effectiveCurrentId)) {
        return effectiveCurrentId;
      }
      return allVersions[0]?.id;
    });
  }, [versionsLoading, allVersions, effectiveCurrentId]);

  // The version currently displayed across all tabs
  const selectedVersion = allVersions.find((v) => v.id === selectedVersionId) ?? persona;
  const isSelectedLive = selectedVersion?.id === effectiveCurrentId;

  const systemPromptLength = selectedVersion?.system_prompt?.length ?? 0;
  const personaPromptText = selectedVersion?.persona_prompt ?? selectedVersion?.persona ?? '';

  const handleSetCurrent = useCallback(
    async (versionPersona: Persona) => {
      try {
        await personasApi.setCurrent(versionPersona.id);
        const newCurrentId = await fetchVersions();
        setSelectedVersionId(newCurrentId ?? versionPersona.id);
        onRefresh?.();
      } catch (err) {
        notify.error(err);
      }
    },
    [fetchVersions, onRefresh]
  );

  useEffect(() => {
    if (open) {
      setActiveTab('overview');
      setSelectedVersionId(undefined);
    }
    setIsRenaming(false);
    setRenameValue('');
  }, [open, persona?.id]);

  useEffect(() => {
    if (!isRenaming || !persona) return;
    setRenameValue(persona.persona_name ?? '');
  }, [persona?.persona_name, isRenaming, persona]);

  const cancelRename = () => {
    if (renameLoading || !persona) return;
    setIsRenaming(false);
    setRenameValue(persona.persona_name ?? '');
  };

  const saveRename = async () => {
    if (renameLoading || !persona || rootPersonaId == null) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      notify.error("Persona name can't be empty");
      return;
    }
    if (nextName === (persona.persona_name ?? '').trim()) {
      setIsRenaming(false);
      return;
    }
    try {
      setRenameLoading(true);
      const result = await personasApi.renamePersona(rootPersonaId, nextName);
      setIsRenaming(false);
      onPersonaUpdated?.(
        result.persona
          ? { ...persona, ...result.persona, persona_name: nextName }
          : { ...persona, persona_name: nextName }
      );
      onRefresh?.();
    } catch (err) {
      console.error('Error renaming persona:', err);
      notify.error(err);
    } finally {
      setRenameLoading(false);
    }
  };

  const datasourceLabels = useMemo(
    () => (selectedVersion ? formatDatasourceLabels(selectedVersion) : []),
    [selectedVersion]
  );
  const toolTagLabels = useMemo(
    () => (selectedVersion ? formatTagLabels(selectedVersion.tool_tags, 'Tool Tag') : []),
    [selectedVersion]
  );
  const docTagLabels = useMemo(
    () => (selectedVersion ? formatTagLabels(selectedVersion.document_tags, 'Document Tag') : []),
    [selectedVersion]
  );

  if (!persona) return null;

  const navigatePrev = () => {
    if (currentIndex > 0) onNavigate?.(personas[currentIndex - 1]);
  };
  const navigateNext = () => {
    if (currentIndex >= 0 && currentIndex < personas.length - 1) {
      onNavigate?.(personas[currentIndex + 1]);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'flex w-full flex-col gap-0 border-border-main p-0 sm:max-w-xl md:max-w-2xl',
            personaDetailShellClass,
            '[&>button]:hidden'
          )}
        >
          {/* Header */}
          <div className="shrink-0 bg-background px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <PersonaTypeAvatar
                  name={persona.persona_name}
                  type={persona.type}
                  size="md"
                />
                <div className="min-w-0">
                  {isRenaming ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveRename();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        disabled={renameLoading}
                        autoFocus
                        className="h-8 min-w-0 flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="Persona name"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 shrink-0 p-1"
                        onClick={() => void saveRename()}
                        disabled={renameLoading}
                        title="Save name"
                      >
                        {renameLoading ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Check size={18} />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 shrink-0 p-1"
                        onClick={cancelRename}
                        disabled={renameLoading}
                        title="Cancel"
                      >
                        <X size={18} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <h2 className="truncate text-lg font-semibold text-text-main">
                        {persona.persona_name}
                      </h2>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 p-1 text-text-muted hover:bg-surface hover:text-text-main"
                        onClick={() => setIsRenaming(true)}
                        title="Rename persona"
                      >
                        <Pencil size={18} />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-text-muted mt-0.5">
                    id · {persona.id}
                    {persona.parent_persona_id != null && (
                      <> · parent · {persona.parent_persona_id}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border-main/60 bg-surface p-1 text-text-muted">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 p-1 hover:bg-surface"
                  disabled={currentIndex <= 0}
                  onClick={navigatePrev}
                  title="Previous persona"
                >
                  <ChevronUp size={18} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 p-1 hover:bg-surface"
                  disabled={currentIndex < 0 || currentIndex >= personas.length - 1}
                  onClick={navigateNext}
                  title="Next persona"
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

          {/* Version strip — always visible when versions exist */}
          {(versionsLoading || allVersions.length > 0) && (
            <div className="shrink-0 border-b border-border-main/40 px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex shrink-0 items-center gap-2 text-text-muted">
                  <GitBranch size={18} />
                  <span className="text-xs font-medium uppercase tracking-wide">Version</span>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <PersonaVersionTimeline
                    versions={allVersions}
                    selectedId={selectedVersionId}
                    effectiveCurrentId={effectiveCurrentId ?? undefined}
                    loading={versionsLoading}
                    onSelect={(v) => setSelectedVersionId(v.id)}
                  />
                  {onCreateVersion && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(personaDetailOutlineButtonClass, 'h-7 shrink-0')}
                      onClick={() => onCreateVersion(persona)}
                    >
                      <GitBranch size={16} />
                      Create version
                    </Button>
                  )}
                </div>
                {!versionsLoading && selectedVersion != null && (
                  <div className="flex shrink-0 items-center gap-2">
                    {!isSelectedLive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => void handleSetCurrent(selectedVersion)}
                      >
                        Set as live
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 p-1 text-text-muted hover:bg-surface hover:text-text-main"
                      onClick={() => onEdit(selectedVersion)}
                      title="Edit version"
                    >
                      <Pencil size={18} />
                    </Button>
                    {!selectedVersion.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 p-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(selectedVersion)}
                        title="Delete version"
                      >
                        <Trash2 size={18} />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={cn('flex min-h-0 flex-1 flex-col', personaDetailShellClass)}
          >
            <div className={cn('shrink-0 border-border-main px-5', personaDetailShellClass)}>
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0 scrollbar-none">
                <TabsTrigger value="overview" className={personaDetailTabTriggerClass}>
                  Overview
                </TabsTrigger>
                {selectedVersion?.system_prompt != null && (
                  <TabsTrigger value="system" className={personaDetailTabTriggerClass}>
                    System prompt
                    {systemPromptLength > 0 && (
                      <span className="ml-1 text-xs font-normal opacity-70">
                        ({systemPromptLength >= 1000
                          ? `${(systemPromptLength / 1000).toFixed(1)}k`
                          : systemPromptLength})
                      </span>
                    )}
                  </TabsTrigger>
                )}
                <TabsTrigger value="persona-prompt" className={personaDetailTabTriggerClass}>
                  Persona prompt
                </TabsTrigger>
                <TabsTrigger value="configuration" className={personaDetailTabTriggerClass}>
                  Configuration
                </TabsTrigger>
              </TabsList>
            </div>

            <div className={cn('scrollbar-themed min-h-0 flex-1 overflow-y-auto px-5 py-5', personaDetailShellClass)}>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <DetailSection title="Identity">
                    <div className={cn(personaDetailPanelClass, 'px-3')}>
                      <IdentityRow label="persona_name">{selectedVersion?.persona_name ?? persona.persona_name}</IdentityRow>
                      <IdentityRow label="type">
                        <span className="inline-flex items-center gap-2">
                          <PersonaTypeAvatar
                            name={selectedVersion?.persona_name ?? persona.persona_name}
                            type={selectedVersion?.type ?? persona.type}
                            size="sm"
                          />
                          {personaTypeDisplayLabel(selectedVersion?.type ?? persona.type)}
                        </span>
                      </IdentityRow>
                      <IdentityRow label="id">{selectedVersion?.id ?? persona.id}</IdentityRow>
                      {(selectedVersion?.parent_persona_id ?? persona.parent_persona_id) != null && (
                        <IdentityRow label="parent_persona_id">
                          {selectedVersion?.parent_persona_id ?? persona.parent_persona_id}
                        </IdentityRow>
                      )}
                      <IdentityRow label="is_valid">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-status-success" />
                          true
                        </span>
                      </IdentityRow>
                      <IdentityRow label="supports_documents">
                        {(selectedVersion?.supports_documents ?? persona.supports_documents) ? 'true' : 'false'}
                      </IdentityRow>
                      {(selectedVersion?.is_default ?? persona.is_default) && (
                        <IdentityRow label="is_default">true</IdentityRow>
                      )}
                      <IdentityRow label="created_at">
                        <span>
                          {formatRelativeTime(selectedVersion?.created_at ?? persona.created_at)}
                          <span className="text-text-muted ml-2 text-xs">
                            {formatDashboardDate(selectedVersion?.created_at ?? persona.created_at)}
                          </span>
                        </span>
                      </IdentityRow>
                      <IdentityRow label="updated_at">
                        <span>
                          {formatRelativeTime(selectedVersion?.updated_at ?? persona.updated_at)}
                          <span className="text-text-muted ml-2 text-xs">
                            {formatDashboardDate(selectedVersion?.updated_at ?? persona.updated_at)}
                          </span>
                        </span>
                      </IdentityRow>
                      {(selectedVersion?.model_id ?? persona.model_id) && (
                        <IdentityRow label="model_id">
                          <CopyableId value={(selectedVersion?.model_id ?? persona.model_id)!} />
                        </IdentityRow>
                      )}
                      {(selectedVersion?.temperature ?? persona.temperature) != null && (
                        <IdentityRow label="temperature">
                          {selectedVersion?.temperature ?? persona.temperature}
                        </IdentityRow>
                      )}
                      {(selectedVersion?.context_window_limit ?? persona.context_window_limit) != null && (
                        <IdentityRow label="context_window_limit">
                          {(selectedVersion?.context_window_limit ?? persona.context_window_limit)?.toLocaleString()}
                        </IdentityRow>
                      )}
                    </div>
                  </DetailSection>

                  <DetailSection
                    title="Greeting message"
                    icon={<MessageSquare size={18} className="text-text-muted" />}
                  >
                    <div className={cn(personaDetailPanelClass, 'min-h-[72px] px-3 py-3')}>
                      {(selectedVersion?.greeting_message ?? persona.greeting_message)?.trim() ? (
                        <p className="text-sm text-text-main whitespace-pre-wrap">
                          {selectedVersion?.greeting_message ?? persona.greeting_message}
                        </p>
                      ) : (
                        <p className="text-sm italic text-text-muted">
                          greeting_message is empty — users see the empty chat.
                        </p>
                      )}
                    </div>
                  </DetailSection>
                </div>
              )}

              {activeTab === 'system' && selectedVersion?.system_prompt != null && (
                <RawPromptBlock content={selectedVersion.system_prompt} />
              )}

              {activeTab === 'persona-prompt' && (
                <RawPromptBlock content={personaPromptText} />
              )}

              {activeTab === 'configuration' && (
                <div className="space-y-5">
                  {(selectedVersion?.model_id ?? persona.model_id) && (
                    <DetailSection title="Model settings">
                      <div className={cn(personaDetailPanelClass, 'space-y-2 px-3 py-2.5')}>
                        <code className="block text-xs font-mono text-text-main break-all">
                          {selectedVersion?.model_id ?? persona.model_id}
                        </code>
                        <div className="grid gap-2 text-xs text-text-muted sm:grid-cols-2">
                          <span>Temperature: {selectedVersion?.temperature ?? persona.temperature ?? '—'}</span>
                          <span>
                            Context window:{' '}
                            {(selectedVersion?.context_window_limit ?? persona.context_window_limit) != null
                              ? (selectedVersion?.context_window_limit ?? persona.context_window_limit)?.toLocaleString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </DetailSection>
                  )}

                  {datasourceLabels.length > 0 && (
                    <DetailSection title="Data sources">
                      <div className={cn(personaDetailPanelClass, 'flex flex-wrap gap-2 p-3')}>
                        {datasourceLabels.map((ds) => (
                          <DashboardPill
                            key={ds.key}
                            intent="entity"
                            entity="datasource"
                            label={ds.label}
                          />
                        ))}
                      </div>
                    </DetailSection>
                  )}

                  {toolTagLabels.length > 0 && (
                    <DetailSection title="Tool tags">
                      <div className={cn(personaDetailPanelClass, 'flex flex-wrap gap-2 p-3')}>
                        {toolTagLabels.map((label) => (
                          <DashboardPill
                            key={label}
                            intent="entity"
                            entity="tool-tag"
                            label={label}
                          />
                        ))}
                      </div>
                    </DetailSection>
                  )}

                  {docTagLabels.length > 0 && (
                    <DetailSection title="Document tags">
                      <div className={cn(personaDetailPanelClass, 'flex flex-wrap gap-2 p-3')}>
                        {docTagLabels.map((label) => (
                          <DashboardPill
                            key={label}
                            intent="entity"
                            entity="doc-tag"
                            label={label}
                          />
                        ))}
                      </div>
                    </DetailSection>
                  )}

                  {(() => {
                    const rules = selectedVersion?.tool_rules ?? persona.tool_rules ?? [];
                    return (
                      <DetailSection title="Tool rules">
                        {rules.length === 0 ? (
                          <p className="text-xs text-text-muted italic">No tool rules configured.</p>
                        ) : (
                          <div className="space-y-2">
                            {rules.map((rule, i) => (
                              <div
                                key={`${rule.tool_name}-${i}`}
                                className={cn(personaDetailPanelClass, 'px-3 py-2.5 space-y-1')}
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-text-main">{rule.tool_name}</span>
                                  <span className="inline-flex items-center rounded-md border border-border-main px-1.5 py-0.5 text-xs text-text-muted">
                                    {RULE_TYPE_LABELS[rule.type] ?? rule.type}
                                  </span>
                                </div>
                                {rule.max_count_limit !== undefined && (
                                  <p className="text-xs text-text-muted">Max count: {rule.max_count_limit}</p>
                                )}
                                {rule.children && rule.children.length > 0 && (
                                  <p className="text-xs text-text-muted">Children: {rule.children.join(', ')}</p>
                                )}
                                {rule.default_child && (
                                  <p className="text-xs text-text-muted">Default child: {rule.default_child}</p>
                                )}
                                {rule.require_output_mapping && (
                                  <p className="text-xs text-text-muted">Requires output mapping</p>
                                )}
                                {rule.child_output_mapping && Object.keys(rule.child_output_mapping).length > 0 && (
                                  <div className="text-xs text-text-muted">
                                    Output mapping:{' '}
                                    {Object.entries(rule.child_output_mapping).map(([k, v]) => (
                                      <span key={k} className="ml-2 font-mono">{k} → {v}</span>
                                    ))}
                                  </div>
                                )}
                                {rule.args && Object.keys(rule.args).length > 0 && (
                                  <div className="text-xs text-text-muted">
                                    Args:{' '}
                                    {Object.entries(rule.args).map(([k, v]) => (
                                      <span key={k} className="ml-2 font-mono">{k}: {String(v)}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </DetailSection>
                    );
                  })()}
                </div>
              )}
            </div>

          </Tabs>
        </SheetContent>
      </Sheet>


</>
  );
}

function formatTagLabels(
  tags: Persona['tool_tags'] | Persona['document_tags'],
  fallbackPrefix: string
): string[] {
  if (!tags) return [];
  return tags
    .map((tag) => {
      if (typeof tag === 'number') return `${fallbackPrefix} #${tag}`;
      if (typeof tag === 'string') return tag;
      if (typeof tag === 'object' && tag !== null) {
        if ('name' in tag && tag.name) return tag.name;
        if ('id' in tag && typeof tag.id === 'number') return `${fallbackPrefix} #${tag.id}`;
      }
      return '';
    })
    .filter((label): label is string => Boolean(label));
}

function formatDatasourceLabels(persona: Persona): Array<{ key: string; label: string }> {
  const labels = new Map<string, string>();

  if (Array.isArray(persona.datasources)) {
    persona.datasources.forEach((source) => {
      if (!source?.id) return;
      const label = source.name?.trim() || source.id;
      labels.set(source.id, label);
    });
  }

  if (Array.isArray(persona.datasource_ids)) {
    persona.datasource_ids.forEach((id) => {
      if (!id) return;
      if (!labels.has(id)) labels.set(id, id);
    });
  }

  if (Array.isArray(persona.data_sources)) {
    persona.data_sources.forEach((source) => {
      if (typeof source === 'string') {
        if (!labels.has(source)) labels.set(source, source);
        return;
      }
      const id = source.source_id || source.id;
      if (!id) return;
      if (!labels.has(id)) labels.set(id, id);
    });
  }

  return Array.from(labels.entries()).map(([key, label]) => ({ key, label }));
}
