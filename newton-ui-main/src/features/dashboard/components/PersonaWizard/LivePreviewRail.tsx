import { LayoutDashboard, MessageSquare } from 'lucide-react';
import { PersonaTypeAvatar } from '../PersonaTypeAvatar';
import {
  personaTypeDisplayLabel,
} from '../../utils/dashboardHelper';
import { STEP_TIPS } from './personaWizardUtils';
import type { StepKey } from './personaWizardTypes';
import { cn } from '@/lib/utils';

interface LivePreviewRailProps {
  currentStep: StepKey;
  name: string;
  type: 'chat' | 'dashboard';
  greeting: string;
  personaSnippet?: string;
  tagCount: number;
  dataCount: number;
  supportsDocuments: boolean;
  modelDisplay?: string;
}

export function LivePreviewRail({
  currentStep,
  name,
  type,
  greeting,
  personaSnippet,
  tagCount,
  dataCount,
  supportsDocuments,
  modelDisplay,
}: LivePreviewRailProps) {
  const TypeIcon = type === 'dashboard' ? LayoutDashboard : MessageSquare;
  const displayName = name.trim() || 'Untitled persona';
  const tips = STEP_TIPS[currentStep];

  return (
    <aside className="hidden md:flex w-56 shrink-0 min-h-0 flex-col gap-4 overflow-y-auto border-l border-border-main bg-surface-2/40 px-4 py-5">
      <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
        Live preview
      </p>

      <div className="rounded-xl border border-border-main bg-surface p-3 flex flex-col gap-2 shadow-lift">
        <PersonaTypeAvatar name={displayName} type={type} size="sm" />
        <p className="text-sm font-semibold font-display leading-tight text-text-main">
          {displayName}
        </p>
        <span className="inline-flex w-fit px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-2xs font-medium">
          {personaTypeDisplayLabel(type)}
        </span>
        {(greeting || personaSnippet) && (
          <p className="text-2xs text-text-muted leading-relaxed line-clamp-3">
            {greeting || personaSnippet}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {modelDisplay && (
            <span className="px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted text-2xs font-mono">
              {modelDisplay}
            </span>
          )}
          {supportsDocuments && (
            <span className="px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted text-2xs">
              Docs
            </span>
          )}
          {tagCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted text-2xs">
              {tagCount} tag{tagCount === 1 ? '' : 's'}
            </span>
          )}
          {dataCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted text-2xs">
              {dataCount} source{dataCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border-main bg-surface p-3">
        <p className="text-2xs font-semibold mb-1.5 text-text-main">Tips</p>
        <ul className="space-y-1">
          {tips.map((tip) => (
            <li
              key={tip}
              className="text-2xs text-text-muted flex gap-1.5 leading-relaxed"
            >
              <span className="text-primary shrink-0">·</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
