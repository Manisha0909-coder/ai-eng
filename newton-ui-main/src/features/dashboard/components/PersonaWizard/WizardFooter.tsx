import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { STEP_ORDER } from './personaWizardTypes';

interface WizardFooterProps {
  stepIndex: number;
  loading: boolean;
  canAdvance: boolean;
  isVersionMode: boolean;
  isEditMode?: boolean;
  setAsCurrentVersion?: boolean;
  onSetAsCurrentVersionChange?: (value: boolean) => void;
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
}

export function WizardFooter({
  stepIndex,
  loading,
  canAdvance,
  isVersionMode,
  isEditMode = false,
  setAsCurrentVersion,
  onSetAsCurrentVersionChange,
  onBack,
  onClose,
  onNext,
}: WizardFooterProps) {
  const isLastStep = stepIndex === STEP_ORDER.length - 1;
  const showSetAsCurrent = isVersionMode && isLastStep;

  let submitLabel = 'Continue';
  if (isLastStep) {
    if (isEditMode) submitLabel = 'Save changes';
    else if (isVersionMode) submitLabel = 'Create version';
    else submitLabel = 'Create persona';
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {showSetAsCurrent ? (
        <div className="flex items-center gap-2 min-w-0">
          <Checkbox
            id="set_as_current"
            checked={setAsCurrentVersion ?? true}
            onCheckedChange={(checked) =>
              onSetAsCurrentVersionChange?.(checked === true)
            }
            disabled={loading}
            className="border-border-main data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <Label
            htmlFor="set_as_current"
            className="text-sm text-text-main cursor-pointer font-normal truncate"
          >
            Set as current version
          </Label>
        </div>
      ) : (
        <span className="hidden sm:inline text-2xs text-text-muted shrink-0">
          <kbd className="rounded border border-border-main bg-surface px-1.5 py-0.5 text-2xs">
            Esc
          </kbd>{' '}
          to close
        </span>
      )}
      <div className="flex flex-1 sm:flex-none items-center gap-2 justify-end">
        {stepIndex > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={loading}
            className="border-border-main bg-transparent text-text-main hover:bg-surface-2 rounded-lg h-9"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="border-border-main bg-transparent text-text-main hover:bg-surface-2 rounded-lg h-9"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={onNext}
          disabled={loading || !canAdvance}
          className="rounded-lg h-10 px-5 bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-current border-r-current" />
              Saving…
            </span>
          ) : isLastStep ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {submitLabel}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
