import { Textarea } from '@/components/ui/textarea';
import { FieldGroup } from '../FieldGroup';
import { PERSONA_PROMPT_MAX } from '../personaWizardUtils';
import type { PersonaFormState } from '../personaWizardTypes';

const TONE_STARTERS = [
  'Concise & direct',
  'Friendly & casual',
  'Formal & precise',
  'Curious & exploratory',
  'Step-by-step',
];

interface IdentityStepProps {
  formData: PersonaFormState;
  setFormData: React.Dispatch<React.SetStateAction<PersonaFormState>>;
}

export function IdentityStep({ formData, setFormData }: IdentityStepProps) {
  const len = formData.persona.length;
  const progressPct = Math.min(100, (len / PERSONA_PROMPT_MAX) * 100);

  return (
    <div className="space-y-5">
      <FieldGroup
        label="Tone starter"
        hint="Click to insert into prompt."
      >
        <div className="flex flex-wrap gap-2">
          {TONE_STARTERS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  persona: `Tone: ${sample}. Always lead with the recommendation, then provide supporting details.`,
                }))
              }
              className="h-7 px-3 rounded-full border border-border-main hover:border-primary/40 text-text-muted text-xs transition-colors hover:text-text-main"
            >
              {sample}
            </button>
          ))}
        </div>
      </FieldGroup>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs font-medium text-text-main">
            Persona prompt <span className="text-destructive">*</span>
          </span>
          <span className="text-2xs text-text-muted font-mono">
            {len.toLocaleString()} / {PERSONA_PROMPT_MAX.toLocaleString()}
          </span>
        </div>
        <Textarea
          value={formData.persona}
          onChange={(e) => setFormData((p) => ({ ...p, persona: e.target.value }))}
          rows={9}
          maxLength={PERSONA_PROMPT_MAX}
          required
          placeholder="You are a senior product strategist. Speak concisely, lead with the recommendation, and back it up with data when available…"
          className="bg-background border-border-main text-text-main resize-y rounded-lg"
        />
        <div className="mt-1.5 h-1 rounded-full bg-border-main overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-2xs text-text-muted mt-1">
          This prompt defines the persona&apos;s core behaviour. It is prepended to every
          conversation.
        </p>
      </div>
    </div>
  );
}
