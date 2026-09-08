import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STEP_META,
  STEP_ORDER,
  type StepKey,
  type StepValidation,
} from './personaWizardTypes';

interface WizardStepperProps {
  current: number;
  onStepClick: (index: number) => void;
  validation: StepValidation;
  touched: Set<StepKey>;
}

export function WizardStepper({
  current,
  onStepClick,
  validation,
  touched,
}: WizardStepperProps) {
  return (
    <div className="flex items-center">
      {STEP_ORDER.map((key, i) => {
        const isCurrent = i === current;
        const isPast = i < current;
        const isCompleted = isPast && validation[key].valid;
        const lineDone = isPast;

        return (
          <div key={key} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => onStepClick(i)}
              className="group flex flex-col items-center gap-1"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-2xs font-semibold font-mono transition-colors',
                  isCurrent && 'bg-primary text-white shadow-[0_0_0_3px_rgb(var(--color-primary)/0.2)]',
                  isCompleted && !isCurrent && 'bg-primary text-white',
                  !isCurrent && !isCompleted && 'border border-border-main bg-surface-2 text-text-muted'
                )}
              >
                {isCompleted && !isCurrent ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  'text-2xs whitespace-nowrap transition-colors',
                  isCurrent
                    ? 'font-medium text-primary'
                    : touched.has(key)
                      ? 'text-text-muted'
                      : 'text-text-muted/70'
                )}
              >
                {STEP_META[key].label}
              </span>
            </button>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 flex-1 min-w-2',
                  lineDone ? 'bg-primary' : 'bg-border-main'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
