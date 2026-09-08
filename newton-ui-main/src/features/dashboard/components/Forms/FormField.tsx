import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, required, hint, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[0.8rem] font-medium text-text-main leading-none">
        {label}
        {required && <span className="text-status-error ml-0.5">*</span>}
        {hint && <span className="ml-1.5 text-2xs text-text-muted font-normal">({hint})</span>}
      </p>
      {children}
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  );
}
