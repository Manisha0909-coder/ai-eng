import { motion, AnimatePresence } from 'framer-motion';
import { SquarePen, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Persona } from '@/services/rbac/rbacApi';
import { formatDashboardDate } from '@/utils/helper';
import {
  formatRelativeTime,
  personaDetailPanelClass,
  personaDetailSectionLabelClass,
} from '@/features/dashboard/utils/dashboardHelper';
import { DashboardPill } from '@/features/dashboard/components/DashboardPill';
import { cn } from '@/lib/utils';
import {
  dashboardRowEditIconButtonClass,
  dashboardRowDeleteIconButtonClass,
} from '../../../utils/dashboardRowActionStyles';
import { formatTagLabels, extractToolNames, getPersonaPromptText } from './personaVersionUtils';
import { RawPromptBlock } from './RawPromptBlock';

interface PersonaVersionInspectorProps {
  version: Persona;
  isCurrent: boolean;
  onSetCurrent: (version: Persona) => void;
  onEdit: (version: Persona) => void;
  onDelete: (version: Persona) => void;
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className={cn(personaDetailSectionLabelClass, 'mb-2')}>{title}</h4>
      {children}
    </section>
  );
}

export function PersonaVersionInspector({
  version,
  isCurrent,
  onSetCurrent,
  onEdit,
  onDelete,
}: PersonaVersionInspectorProps) {
  const toolTagLabels = formatTagLabels(version.tool_tags, 'Tool Tag');
  const docTagLabels = formatTagLabels(version.document_tags, 'Document Tag');
  const toolNames = extractToolNames(version.tool_tags);
  const hasTags = toolTagLabels.length > 0 || docTagLabels.length > 0 || toolNames.length > 0;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={version.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex min-h-0 flex-col gap-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-main/40 pb-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text-main">
              {version.version != null ? `Version ${version.version}` : `Version #${version.id}`}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Updated {formatRelativeTime(version.updated_at)}
              <span className="mx-1.5 text-border-main">·</span>
              Created {formatDashboardDate(version.created_at)}
            </p>
            {version.is_default && (
              <Badge variant="secondary" className="mt-2 border-0 text-2xs">
                Default
              </Badge>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {!isCurrent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetCurrent(version)}
                className="h-8 px-2.5 text-xs"
              >
                Set current
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className={dashboardRowEditIconButtonClass}
              onClick={() => onEdit(version)}
              title="Edit version"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            {!version.is_default && (
              <Button
                variant="outline"
                size="icon"
                className={dashboardRowDeleteIconButtonClass}
                onClick={() => onDelete(version)}
                title="Delete version"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {version.model_id && (
          <InspectorSection title="Model settings">
            <div className={cn(personaDetailPanelClass, 'space-y-2 px-3 py-2.5')}>
              <code className="block text-xs font-mono text-text-main break-all">
                {version.model_id}
              </code>
              <div className="grid gap-2 text-xs text-text-muted sm:grid-cols-2">
                <span>Temperature: {version.temperature ?? '—'}</span>
                <span>
                  Context window: {version.context_window_limit != null ? version.context_window_limit.toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </InspectorSection>
        )}

        {hasTags && (
          <InspectorSection title="Tags">
            <div className={cn(personaDetailPanelClass, 'flex flex-wrap gap-2 p-3')}>
              {toolTagLabels.map((label) => (
                <DashboardPill key={label} intent="entity" entity="tool-tag" label={label} />
              ))}
              {toolNames.map((name) => (
                <DashboardPill key={name} intent="neutral" label={name} />
              ))}
              {docTagLabels.map((label) => (
                <DashboardPill key={label} intent="entity" entity="doc-tag" label={label} />
              ))}
            </div>
          </InspectorSection>
        )}

        <InspectorSection title="Persona prompt">
          <RawPromptBlock content={getPersonaPromptText(version)} />
        </InspectorSection>

        {version.system_prompt != null && (
          <InspectorSection title="System prompt">
            <RawPromptBlock content={version.system_prompt} />
          </InspectorSection>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
