import { LayoutDashboard, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import type { Persona } from '@/services/rbac/rbacApi';
import { FieldGroup } from '../FieldGroup';
import type { PersonaFormState } from '../personaWizardTypes';

interface BasicsStepProps {
  formData: PersonaFormState;
  setFormData: React.Dispatch<React.SetStateAction<PersonaFormState>>;
  isVersionMode: boolean;
  isEditMode?: boolean;
  nextVersionNumber: number | null;
  showBasePersonaPicker: boolean;
  basePersonaLocked: boolean;
  availablePersonas: Persona[];
  effectiveBasePersona: Persona | null;
  loadingBasePersona: boolean;
  onBasePersonaSelect: (value: string | string[]) => void;
}

function TypeCard({
  icon: Icon,
  label,
  description,
  active,
  disabled = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border text-left transition-colors',
        active
          ? 'border-2 border-primary bg-primary/5'
          : 'border border-border-main hover:border-primary/40',
        disabled && 'opacity-60 cursor-not-allowed hover:border-border-main'
      )}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center',
            active ? 'bg-primary/15' : 'bg-surface-2'
          )}
        >
          <Icon
            className={cn('h-[18px] w-[18px]', active ? 'text-primary' : 'text-text-muted')}
          />
        </div>
        <div
          className={cn(
            'w-4 h-4 rounded-full border-2 flex items-center justify-center',
            active ? 'border-primary' : 'border-border-main'
          )}
        >
          {active && <div className="w-2 h-2 rounded-full bg-primary" />}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-text-main">{label}</p>
        <p className="text-2xs text-text-muted mt-0.5">{description}</p>
      </div>
    </button>
  );
}

export function BasicsStep({
  formData,
  setFormData,
  isVersionMode,
  isEditMode = false,
  nextVersionNumber,
  showBasePersonaPicker,
  basePersonaLocked,
  availablePersonas,
  effectiveBasePersona,
  loadingBasePersona,
  onBasePersonaSelect,
}: BasicsStepProps) {
  const locksIdentity = isVersionMode || isEditMode;
  const fieldsLocked = locksIdentity && !!effectiveBasePersona;

  return (
    <div className="space-y-5">
      {showBasePersonaPicker && (
        <FieldGroup label="Base persona" required hint="Select the persona to create a new version from.">
          <Combobox
            items={availablePersonas.map((p) => p.persona_name ?? `Persona #${p.id}`)}
            placeholder="Select persona to create version from..."
            onSelect={onBasePersonaSelect}
            defaultValue={
              effectiveBasePersona
                ? [effectiveBasePersona.persona_name ?? `Persona #${effectiveBasePersona.id}`]
                : []
            }
            multiple={false}
            className="text-text-main border-border-main"
            disabled={basePersonaLocked}
          />
          {loadingBasePersona && (
            <p className="text-xs text-text-muted">Loading persona data…</p>
          )}
        </FieldGroup>
      )}

      {(!locksIdentity || effectiveBasePersona) && (
        <>
          <FieldGroup
            label="Persona type"
            required
            hint={
              fieldsLocked
                ? 'Cannot be changed after creation.'
                : 'Dashboard personas build & update dashboards; Chat personas hold conversations.'
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <TypeCard
                icon={MessageSquare}
                label="Chat"
                description="Conversational AI assistant. Users interact via message threads."
                active={formData.type === 'chat'}
                disabled={fieldsLocked}
                onClick={() => setFormData((p) => ({ ...p, type: 'chat' }))}
              />
              <TypeCard
                icon={LayoutDashboard}
                label="Dashboard"
                description="Data-analysis mode. Returns structured tool outputs and charts."
                active={formData.type === 'dashboard'}
                disabled={fieldsLocked}
                onClick={() => setFormData((p) => ({ ...p, type: 'dashboard' }))}
              />
            </div>
          </FieldGroup>

          <FieldGroup
            label="Name"
            required
            hint={fieldsLocked ? 'Name is set at creation and cannot be changed.' : undefined}
          >
            <div className="relative">
              <Input
                value={formData.persona_name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, persona_name: e.target.value }))
                }
                placeholder="e.g. Research Scout"
                disabled={fieldsLocked}
                required={!fieldsLocked}
                className="bg-background border-border-main text-text-main disabled:opacity-60 rounded-lg pr-14"
              />
              {isVersionMode && nextVersionNumber != null && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Badge variant="outline" className="text-xs">
                    v{nextVersionNumber}
                  </Badge>
                </span>
              )}
            </div>
          </FieldGroup>

          <FieldGroup
            label="Greeting message"
            hint="Shown to users when they open a new conversation with this persona."
          >
            <Textarea
              value={formData.greeting_message}
              onChange={(e) =>
                setFormData((p) => ({ ...p, greeting_message: e.target.value }))
              }
              rows={3}
              placeholder="Hi! I'm here to help you research and summarise information…"
              className="bg-background border-border-main text-text-main resize-y rounded-lg"
            />
          </FieldGroup>
        </>
      )}
    </div>
  );
}
