import { Check, LayoutDashboard, MessageSquare, Pencil, X } from 'lucide-react';
import { PersonaTypeAvatar } from '../../PersonaTypeAvatar';
import { personaTypeDisplayLabel } from '../../../utils/dashboardHelper';
import {
  STEP_META,
  STEP_ORDER,
  type PersonaFormState,
  type StepKey,
  type StepValidation,
} from '../personaWizardTypes';
import { truncate } from '../personaWizardUtils';
import { cn } from '@/lib/utils';

interface ReviewStepProps {
  formData: PersonaFormState;
  selectedModelDisplay: string;
  selectedToolTagNames: string[];
  selectedDocumentTagNames: string[];
  selectedDataSourceNames: string[];
  validation: StepValidation;
  goToStep: (i: number) => void;
  isVersionMode: boolean;
}

export function ReviewStep({
  formData,
  selectedModelDisplay,
  selectedToolTagNames,
  selectedDocumentTagNames,
  selectedDataSourceNames,
  validation,
  goToStep,
  isVersionMode,
}: ReviewStepProps) {
  const displayName = formData.persona_name || 'Untitled persona';
  const TypeIcon = formData.type === 'dashboard' ? LayoutDashboard : MessageSquare;

  const sections: Array<{
    key: StepKey;
    title: string;
    rows: Array<{ label: string; value: React.ReactNode }>;
  }> = [
    {
      key: 'basics',
      title: 'Basics',
      rows: [
        { label: 'Name', value: formData.persona_name || '—' },
        { label: 'Type', value: personaTypeDisplayLabel(formData.type) },
        { label: 'Greeting', value: formData.greeting_message || '—' },
      ],
    },
    {
      key: 'identity',
      title: 'Identity',
      rows: [
        {
          label: 'Persona prompt',
          value: formData.persona ? truncate(formData.persona, 140) : '—',
        },
      ],
    },
    {
      key: 'intelligence',
      title: 'Intelligence',
      rows: [
        { label: 'Model', value: selectedModelDisplay || '—' },
        { label: 'Temperature', value: formData.temperature || '—' },
        { label: 'Context window', value: formData.context_window_limit || '—' },
        {
          label: 'System prompt',
          value: formData.system_prompt
            ? truncate(formData.system_prompt, 90)
            : 'Inherits global default',
        },
      ],
    },
    {
      key: 'capabilities',
      title: 'Capabilities',
      rows: [
        ...(formData.type === 'dashboard'
          ? [
              {
                label: 'Data sources',
                value: selectedDataSourceNames.length
                  ? selectedDataSourceNames.join(', ')
                  : '—',
              },
            ]
          : []),
        {
          label: 'Tool tags',
          value: selectedToolTagNames.length ? selectedToolTagNames.join(', ') : '—',
        },
        {
          label: 'Document tags',
          value: selectedDocumentTagNames.length
            ? selectedDocumentTagNames.join(', ')
            : '—',
        },
        {
          label: 'Supports documents',
          value: formData.supports_documents ? 'Yes' : 'No',
        },
        {
          label: 'Tool rules',
          value:
            formData.toolRules.length > 0
              ? `${formData.toolRules.length} rule${formData.toolRules.length === 1 ? '' : 's'}`
              : isVersionMode
                ? 'Inherit from previous version'
                : 'None',
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-text-main mb-2">Validation</p>
        <div className="space-y-1.5">
          {STEP_ORDER.filter((k) => k !== 'review').map((k) => {
            const ok = validation[k].valid;
            const stepIdx = STEP_ORDER.indexOf(k);
            return (
              <div key={k} className="flex items-center gap-2.5">
                {ok ? (
                  <Check className="h-3.5 w-3.5 text-status-success shrink-0" strokeWidth={2.5} />
                ) : (
                  <X className="h-3.5 w-3.5 text-status-warning shrink-0" strokeWidth={2.5} />
                )}
                <span className="text-sm text-text-muted flex-1">
                  {STEP_META[k].label}
                  {!ok && validation[k].reason ? ` — ${validation[k].reason}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => goToStep(stepIdx)}
                  className="text-2xs text-primary hover:underline"
                >
                  Edit
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl border-2 border-primary/30 bg-surface p-4 flex flex-col gap-3 shadow-lift md:hidden'
        )}
      >
        <div className="flex items-center gap-3">
          <PersonaTypeAvatar name={displayName} type={formData.type} size="lg" />
          <div>
            <p className="font-display font-semibold text-sm text-text-main">{displayName}</p>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-2xs font-medium">
              <TypeIcon className="h-2.5 w-2.5" />
              {personaTypeDisplayLabel(formData.type)}
            </span>
          </div>
        </div>
        {formData.greeting_message && (
          <p className="text-2xs text-text-muted leading-relaxed border-t border-border-main pt-2.5">
            {formData.greeting_message}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const stepIdx = STEP_ORDER.indexOf(section.key);
          return (
            <div
              key={section.key}
              className="rounded-xl border border-border-main px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                  {section.title}
                </p>
                <button
                  type="button"
                  onClick={() => goToStep(stepIdx)}
                  className="inline-flex items-center gap-1 text-2xs text-primary hover:underline"
                >
                  <Pencil className="h-2.5 w-2.5" /> Edit
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {section.rows.map((row) => (
                  <div
                    key={row.label}
                    className={row.label === 'Greeting' || row.label === 'Persona prompt' ? 'sm:col-span-2' : ''}
                  >
                    <span className="text-2xs text-text-muted">{row.label}</span>
                    <p className="text-sm text-text-main break-words">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
