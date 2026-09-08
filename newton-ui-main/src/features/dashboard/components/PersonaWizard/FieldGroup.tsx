import { Label } from '@/components/ui/label';

interface FieldGroupProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FieldGroup({ label, hint, required, children }: FieldGroupProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-text-main">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}
