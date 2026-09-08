import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { FieldGroup } from '../FieldGroup';
import type { PersonaFormState } from '../personaWizardTypes';

interface IntelligenceStepProps {
  formData: PersonaFormState;
  setFormData: React.Dispatch<React.SetStateAction<PersonaFormState>>;
  loadingModels: boolean;
  modelOptions: string[];
  selectedModelDisplay: string;
  selectedModelMaxContextWindow: number | null;
  handleModelSelect: (value: string | string[]) => void;
}

export function IntelligenceStep({
  formData,
  setFormData,
  loadingModels,
  modelOptions,
  selectedModelDisplay,
  selectedModelMaxContextWindow,
  handleModelSelect,
}: IntelligenceStepProps) {
  return (
    <div className="space-y-5">
      <FieldGroup label="Model" required hint="Select the LLM that will power this persona.">
        {loadingModels ? (
          <div className="flex items-center gap-2 rounded-lg border border-border-main bg-surface-2/40 px-3 py-2 text-sm text-text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary" />
            Loading models…
          </div>
        ) : (
          <Combobox
            items={modelOptions}
            placeholder="Search and select a model..."
            onSelect={handleModelSelect}
            defaultValue={selectedModelDisplay ? [selectedModelDisplay] : []}
            multiple={false}
            className="text-text-main border-border-main"
            required
          />
        )}
      </FieldGroup>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldGroup
          label="Temperature"
          required
          hint="Controls creativity. Use lower values for more deterministic responses."
        >
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={2}
            step={0.1}
            value={formData.temperature}
            onChange={(e) =>
              setFormData((p) => ({ ...p, temperature: e.target.value }))
            }
            placeholder="0.7" 
            required
            className="bg-background border-border-main text-text-main placeholder:text-text-muted rounded-lg"
          />
        </FieldGroup>

        <FieldGroup
          label="Context window limit"
          required
          hint={
            selectedModelMaxContextWindow != null
              ? `Max for selected model: ${selectedModelMaxContextWindow.toLocaleString()} tokens.`
              : 'Higher values give the persona more memory but may increase latency and cost.'
          }
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={selectedModelMaxContextWindow ?? undefined}
            step={1}
            value={formData.context_window_limit}
            onChange={(e) =>
              setFormData((p) => ({ ...p, context_window_limit: e.target.value }))
            }
            placeholder="30000"
            required
            className="bg-background border-border-main text-text-main placeholder:text-text-muted rounded-lg"
          />
        </FieldGroup>
      </div>

      <FieldGroup
        label="System prompt"
        hint="Leave empty to inherit the global default. When provided, overrides the platform default for this version."
      >
        <div className="relative">
          <Textarea
            value={formData.system_prompt}
            onChange={(e) =>
              setFormData((p) => ({ ...p, system_prompt: e.target.value }))
            }
            rows={7}
            maxLength={10000}
            placeholder="Leave empty to use the global default agent system prompt."
            className="bg-background border-border-main text-text-main resize-y rounded-lg font-mono text-sm"
          />
          <div className="pointer-events-none absolute bottom-2 right-3 text-2xs text-text-muted">
            {formData.system_prompt.length.toLocaleString()} / 10,000
          </div>
        </div>
      </FieldGroup>
    </div>
  );
}
