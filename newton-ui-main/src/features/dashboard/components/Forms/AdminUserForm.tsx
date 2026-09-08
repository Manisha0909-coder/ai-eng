import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { RadioGroup } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Users, Pencil } from "lucide-react";
import notify from "@/utils/notify";
import { AdminUser } from "@/services/rbac/rbacApi";
import { cn } from "@/lib/utils";
import { AdminFormDialog, FormDialogFooter } from "./AdminFormDialog";
import { FormField } from "./FormField";

/** Row from GET `/v1/users/list` (directory listing). */
export interface DirectoryUserRow {
  id: string;
  user_name: string;
  email: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  state?: string | null;
  roles?: string[];
  added_at?: string;
  updated_at?: string | null;
}

export interface AdminUserFormDirectoryPickerProps {
  users: DirectoryUserRow[];
  loading: boolean;
}

interface AdminUserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (emails: string[], role: string) => Promise<void>;
  adminUser?: AdminUser;
  isLoading?: boolean;
  directoryPicker?: AdminUserFormDirectoryPickerProps | null;
}

const ADMIN_ROLES = [
  { value: "super_admin", label: "Super Admin", description: "Full access to all features" },
  { value: "user_admin", label: "User Admin", description: "Access to users, roles, persona, shared Memory" },
  { value: "system_admin", label: "System Admin", description: "Access to tools, tool tags, tool servers, documents, doc tags, logs, feedback, overview, data sources" },
] as const;

function getAdminRole(roles: string[]): string {
  for (const r of ADMIN_ROLES) {
    if (roles.includes(r.value)) return r.value;
  }
  return "";
}

function formatDirectoryUserLabel(u: DirectoryUserRow): string {
  const dn = (u.display_name || "").trim();
  const em = (u.email || u.user_name || "").trim();
  if (!dn) return em || u.id;
  if (!em) return dn;
  if (dn.toLowerCase() === em.toLowerCase()) return em;
  return `${dn} (${em})`;
}

export function AdminUserForm({
  isOpen,
  onClose,
  onSubmit,
  adminUser,
  isLoading = false,
  directoryPicker = null,
}: AdminUserFormProps) {
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [role, setRole] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const directoryLabelToUser = useMemo(() => {
    const m = new Map<string, DirectoryUserRow>();
    for (const u of directoryPicker?.users ?? []) m.set(formatDirectoryUserLabel(u), u);
    return m;
  }, [directoryPicker?.users]);

  const directoryDropdownItems = useMemo(
    () => (directoryPicker?.users ?? []).map(formatDirectoryUserLabel),
    [directoryPicker?.users],
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedUserEmails([]);
      setSelectedLabels([]);
      setErrors({});
      setRole(adminUser ? getAdminRole(adminUser.roles) : "");
    } else {
      setSelectedUserEmails([]);
      setSelectedLabels([]);
      setRole("");
      setErrors({});
    }
  }, [isOpen, adminUser]);

  const handleDropdownSelect = useCallback(
    (selected: string | string[]) => {
      const labels = Array.isArray(selected) ? selected : [selected];
      setSelectedLabels(labels);
      const emails: string[] = [];
      for (const label of labels) {
        const u = directoryLabelToUser.get(label);
        if (u?.email) emails.push(u.email);
      }
      setSelectedUserEmails(emails);
    },
    [directoryLabelToUser],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};
    if (!adminUser && selectedUserEmails.length === 0) newErrors.users = "Please select at least one user";
    if (!role) newErrors.role = "Please select an admin role";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      if (firstError) notify.error(firstError);
      return;
    }
    try {
      const emails = adminUser ? [adminUser.email] : selectedUserEmails;
      await onSubmit(emails, role);
    } catch (error: any) {
      console.error("Error submitting admin user form:", error);
    }
  };

  const isEdit = Boolean(adminUser);

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Update Admin Role" : "Assign Admin Role"}
      icon={isEdit ? <Pencil size={15} /> : <Users size={15} />}
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
            form="admin-user-form"
            disabled={isLoading}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isLoading ? "Saving…" : isEdit ? "Update admin role" : "Assign admin role"}
          </Button>
        </FormDialogFooter>
      }
    >
      <form id="admin-user-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Edit mode: read-only user info */}
        {adminUser && (
          <FormField label="User">
            <div className="rounded-lg border border-border-main bg-background px-3 py-2.5">
              <div className="text-sm font-medium text-text-main">{adminUser.display_name || adminUser.email}</div>
              {adminUser.display_name && (
                <div className="text-xs text-text-muted mt-0.5">{adminUser.email}</div>
              )}
              {adminUser.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {adminUser.roles.map(r => (
                    <Badge key={r} variant="secondary" className="text-2xs">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </FormField>
        )}

        {/* Create mode: multi-select user picker */}
        {!adminUser && directoryPicker && (
          <FormField label="Users" required error={errors.users}>
            <Combobox
              key={`${isOpen}-${directoryDropdownItems.length}`}
              inputId="directory_user_dropdown"
              multiple={true}
              items={directoryDropdownItems}
              placeholder={directoryPicker.loading ? "Loading users…" : "Search and select users…"}
              disabled={isLoading || directoryPicker.loading}
              defaultValue={selectedLabels}
              className="w-full"
              inputClassName="bg-background border-border-main"
              onSelect={handleDropdownSelect}
            />
            {selectedLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {selectedLabels.map(label => {
                  const u = directoryLabelToUser.get(label);
                  const email = u?.email || u?.user_name || label;
                  const name = (u?.display_name || "").trim();
                  const showName = name && name.toLowerCase() !== email.toLowerCase();
                  return (
                    <Badge
                      key={label}
                      variant="outline"
                      className="inline-flex items-center gap-1.5 rounded-full border-border-main bg-background px-2.5 py-1 text-xs font-normal text-text-main"
                    >
                      <span className="inline-flex items-center gap-1 min-w-0">
                        {showName && <span className="font-medium truncate max-w-[120px]">{name}</span>}
                        <span className="truncate max-w-[160px] text-text-muted">
                          {showName ? `(${email})` : email}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = selectedLabels.filter(l => l !== label);
                          setSelectedLabels(next);
                          const ids: string[] = [];
                          for (const l of next) {
                            const u2 = directoryLabelToUser.get(l);
                            if (u2) ids.push(u2.id);
                          }
                          setSelectedUserEmails(ids);
                        }}
                        className="shrink-0 rounded-full p-0.5 hover:bg-destructive/15 hover:text-destructive transition-colors"
                        aria-label={`Remove ${label}`}
                        disabled={isLoading}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-current">
                          <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </FormField>
        )}

        {/* Admin Role selection — card-style radios */}
        <FormField label="Admin role" required error={errors.role}>
          <RadioGroup
            value={role}
            onValueChange={setRole}
            disabled={isLoading}
            className="flex w-full flex-col gap-0 rounded-xl border border-border-main bg-background/40 p-1"
          >
            {ADMIN_ROLES.map((r, index) => {
              const isSelected = role === r.value;
              const inputId = `admin-role-${r.value}`;
              return (
                <Fragment key={r.value}>
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
                        value={r.value}
                        id={inputId}
                        aria-label={`${r.label}: ${r.description}`}
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
                        <span className="text-[15px] font-bold text-text-main leading-tight">{r.label}</span>
                        <span className="text-xs leading-snug text-text-muted">{r.description}</span>
                      </div>
                    </label>
                  </div>
                  {index < ADMIN_ROLES.length - 1 && (
                    <div className={cn("mx-3 h-px shrink-0 bg-border-main/70", isSelected && "opacity-60")} aria-hidden />
                  )}
                </Fragment>
              );
            })}
          </RadioGroup>
        </FormField>
      </form>
    </AdminFormDialog>
  );
}
