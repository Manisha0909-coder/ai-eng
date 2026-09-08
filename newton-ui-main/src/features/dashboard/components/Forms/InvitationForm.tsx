import { Fragment, useEffect, useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { MailPlus } from "lucide-react";
import notify from "@/utils/notify";
import { cn } from "@/lib/utils";
import { AdminFormDialog, FormDialogFooter } from "./AdminFormDialog";
import { FormField } from "./FormField";

export interface InvitationFormValues {
  email: string;
  kind: "invite" | "password_reset";
  ttl_hours?: number;
}

interface InvitationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: InvitationFormValues) => Promise<void>;
  isLoading?: boolean;
}

const KIND_OPTIONS = [
  {
    value: "invite" as const,
    label: "Invite",
    description: "Creates a new account and signs the recipient in once redeemed.",
  },
  {
    value: "password_reset" as const,
    label: "Password reset",
    description: "Lets an existing user set a new password. Does not sign them in.",
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InvitationForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: InvitationFormProps) {
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<"invite" | "password_reset">("invite");
  const [ttlHours, setTtlHours] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setKind("invite");
      setTtlHours("");
      setErrors({});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) newErrors.email = "Email is required";
    else if (!EMAIL_RE.test(trimmedEmail)) newErrors.email = "Enter a valid email address";

    let ttl: number | undefined;
    const trimmedTtl = ttlHours.trim();
    if (trimmedTtl) {
      const parsed = Number(trimmedTtl);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        newErrors.ttl = "Enter a positive number of hours";
      } else {
        ttl = parsed;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      if (firstError) notify.error(firstError);
      return;
    }

    try {
      await onSubmit({ email: trimmedEmail, kind, ttl_hours: ttl });
    } catch (error) {
      console.error("Error submitting invitation form:", error);
    }
  };

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="New invitation"
      icon={<MailPlus size={15} />}
      size="md"
      footer={
        <FormDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="invitation-form"
            disabled={isLoading}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isLoading ? "Sending…" : "Create invitation"}
          </Button>
        </FormDialogFooter>
      }
    >
      <form id="invitation-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Email" required error={errors.email}>
          <Input
            type="email"
            autoComplete="off"
            placeholder="person@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="h-10 bg-background border-border-main"
          />
        </FormField>

        <FormField label="Type" required>
          <RadioGroup
            value={kind}
            onValueChange={(v) => setKind(v as "invite" | "password_reset")}
            disabled={isLoading}
            className="flex w-full flex-col gap-0 rounded-xl border border-border-main bg-background/40 p-1"
          >
            {KIND_OPTIONS.map((option, index) => {
              const isSelected = kind === option.value;
              const inputId = `invitation-kind-${option.value}`;
              return (
                <Fragment key={option.value}>
                  <div className="px-1 py-0.5">
                    <label
                      htmlFor={inputId}
                      className={cn(
                        "flex cursor-pointer gap-4 rounded-lg p-3.5 transition-colors",
                        isSelected
                          ? "border border-primary bg-surface shadow-[0_0_0_1px_var(--color-primary)]/10"
                          : "border border-transparent",
                      )}
                    >
                      <RadioGroupPrimitive.Item
                        value={option.value}
                        id={inputId}
                        aria-label={`${option.label}: ${option.description}`}
                        disabled={isLoading}
                        className={cn(
                          "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2 outline-none transition-all",
                          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
                          "data-[state=unchecked]:border-text-muted data-[state=unchecked]:bg-background",
                        )}
                      >
                        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                          <span className="size-1.5 rounded-full bg-white shadow-sm" aria-hidden />
                        </RadioGroupPrimitive.Indicator>
                      </RadioGroupPrimitive.Item>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] font-bold text-text-main leading-tight">
                          {option.label}
                        </span>
                        <span className="text-xs leading-snug text-text-muted">
                          {option.description}
                        </span>
                      </div>
                    </label>
                  </div>
                  {index < KIND_OPTIONS.length - 1 && (
                    <div
                      className={cn("mx-3 h-px shrink-0 bg-border-main/70", isSelected && "opacity-60")}
                      aria-hidden
                    />
                  )}
                </Fragment>
              );
            })}
          </RadioGroup>
        </FormField>

        <FormField label="Expires in" hint="optional, hours" error={errors.ttl}>
          <Input
            type="number"
            min={1}
            placeholder={kind === "invite" ? "Default: 168 (7 days)" : "Default: 24"}
            value={ttlHours}
            onChange={(e) => setTtlHours(e.target.value)}
            disabled={isLoading}
            className="h-10 bg-background border-border-main"
          />
        </FormField>
      </form>
    </AdminFormDialog>
  );
}
