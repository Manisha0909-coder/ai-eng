import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Users } from "lucide-react";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import { apiFetch } from "@/services/api/sessionExpiry";
import { User, CreateUserRequest, UpdateUserRequest, rolesApi } from "@/services/rbac/rbacApi";
import { Combobox } from "@/components/ui/combobox";
import { AdminFormDialog, FormDialogFooter } from "./AdminFormDialog";
import { FormField } from "./FormField";

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => Promise<void>;
  user?: User;
  isLoading?: boolean;
  existingUserEmails?: string[];
}

export function UserForm({ isOpen, onClose, onSubmit, user, isLoading = false, existingUserEmails = [] }: UserFormProps) {
  const isEditMode = Boolean(user);

  const [formData, setFormData] = useState<{ user_id: string; user_ids: string[]; roles: string[] }>({
    user_id: "",
    user_ids: [],
    roles: [],
  });
  const [originalRoles, setOriginalRoles] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedEmailLabels, setSelectedEmailLabels] = useState<string[]>([]);
  const existingEmailsRef = useRef<Set<string>>(new Set());

  const rolesChanged = useMemo(
    () =>
      formData.roles.length !== originalRoles.length ||
      formData.roles.some(r => !originalRoles.includes(r)) ||
      originalRoles.some(r => !formData.roles.includes(r)),
    [formData.roles, originalRoles],
  );

  const isPrimaryDisabled =
    isLoading ||
    (isEditMode ? !rolesChanged : formData.user_ids.length === 0 || formData.roles.length === 0);

  const normalizeRoles = (roles: any[]): string[] => {
    if (!Array.isArray(roles)) return [];
    return roles.map(role => {
      if (typeof role === "string") return role;
      if (typeof role === "object" && role !== null && "name" in role) return role.name;
      return String(role);
    });
  };

  useEffect(() => {
    if (isOpen) {
      const initialRoles = normalizeRoles(user?.roles || []);
      setFormData({ user_id: user?.user_id || "", user_ids: [], roles: initialRoles });
      setOriginalRoles(initialRoles);
      setSelectedEmailLabels([]);
      setErrors({});
    } else {
      setFormData({ user_id: "", user_ids: [], roles: [] });
      setOriginalRoles([]);
      setSelectedEmailLabels([]);
      setErrors({});
      setAvailableRoles([]);
    }
  }, [isOpen, user]);

  useEffect(() => {
    existingEmailsRef.current = new Set(existingUserEmails.map(e => e.toLowerCase()));
  }, [existingUserEmails]);

  useEffect(() => {
    if (!isOpen) return;
    const loadRoles = async () => {
      try {
        const response = await rolesApi.list({ limit: 1000, offset: 0 });
        if (response.success) setAvailableRoles(response.data.map(r => r.name));
      } catch (error) {
        console.error("Error loading roles:", error);
      }
    };
    loadRoles();
  }, [isOpen]);

  const fetchEmailSuggestions = useCallback(async (searchQuery?: string): Promise<string[]> => {
    try {
      const base = (API_CONFIG.LOCAL_API_BASE_URL || "").replace(/\/$/, "");
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("offset", "0");
      params.set("include_admins", "true");
      if (searchQuery?.trim()) params.set("search", searchQuery.trim());
      const response = await apiFetch(`${base}/users/list?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) return [];
      const data = unwrapEnvelope<{ users?: Array<{ email?: string; user_name?: string }> }>(
        await response.json(),
      );
      const raw = Array.isArray(data.users) ? data.users : [];
      const emails = [...new Set(raw.map(u => (u.email || u.user_name || "").trim()).filter(s => s.length > 0))];
      return emails.filter(e => !existingEmailsRef.current.has(e.toLowerCase()));
    } catch {
      return [];
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (user) {
      if (formData.roles.length === 0) newErrors.roles = "At least one role must be selected";
      else if (!rolesChanged) newErrors.roles = "You must modify roles before saving";
    } else {
      if (formData.user_ids.length === 0) newErrors.user_ids = "At least one email is required";
      if (formData.roles.length === 0) newErrors.roles = "At least one role must be selected";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    try {
      const submitData = user ? { roles: formData.roles } : { user_ids: formData.user_ids, roles: formData.roles };
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error("Error submitting user:", error);
    }
  };

  const handleEmailSelect = (selected: string | string[]) => {
    const emails = Array.isArray(selected) ? selected : [selected];
    setSelectedEmailLabels(emails);
    setFormData(prev => ({ ...prev, user_ids: emails }));
    if (errors.user_ids) setErrors(prev => ({ ...prev, user_ids: "" }));
  };

  const removeEmail = (email: string) => {
    const next = selectedEmailLabels.filter(e => e !== email);
    setSelectedEmailLabels(next);
    setFormData(prev => ({ ...prev, user_ids: next }));
  };

  const addRole = (roleName: string | string[]) => {
    if (Array.isArray(roleName)) {
      setFormData(prev => ({ ...prev, roles: roleName }));
    } else if (!formData.roles.includes(roleName)) {
      setFormData(prev => ({ ...prev, roles: [...prev.roles, roleName] }));
    }
    if (errors.roles) setErrors(prev => ({ ...prev, roles: "" }));
  };

  const removeRole = (roleName: string) => {
    setFormData(prev => ({ ...prev, roles: prev.roles.filter(n => n !== roleName) }));
    if (errors.roles) setErrors(prev => ({ ...prev, roles: "" }));
  };

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit User Roles" : "Enable Users"}
      icon={<Users size={15} />}
      size="md"
      footer={
        <FormDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="user-form"
            disabled={isPrimaryDisabled}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isLoading ? "Saving…" : "Attach roles"}
          </Button>
        </FormDialogFooter>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label={isEditMode ? "Email address" : "Email addresses"}
          required
          error={errors.user_ids}
        >
          {isEditMode ? (
            <Input
              value={formData.user_id}
              readOnly
              disabled
              className="h-[2.2rem] rounded-lg border-border-main bg-background text-[0.85rem] text-text-main opacity-60 cursor-not-allowed"
            />
          ) : (
            <>
              <Combobox
                inputId="user_id"
                multiple={true}
                onOpen={fetchEmailSuggestions}
                placeholder="Search and select emails…"
                disabled={isLoading}
                defaultValue={selectedEmailLabels}
                className="w-full"
                inputClassName={`bg-background text-text-main border-border-main ${errors.user_ids ? "border-status-error" : ""}`}
                onSelect={handleEmailSelect}
              />
              {selectedEmailLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedEmailLabels.map(email => (
                    <Badge
                      key={email}
                      variant="outline"
                      className="inline-flex items-center gap-1.5 rounded-full border-border-main bg-background px-2.5 py-1 text-xs font-normal text-text-main"
                    >
                      <span className="truncate max-w-[200px]">{email}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="shrink-0 rounded-full p-0.5 hover:bg-destructive/15 hover:text-destructive transition-colors"
                        disabled={isLoading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </FormField>

        <FormField label="Assigned roles" required error={errors.roles}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {formData.roles.map(roleName => (
              <Badge
                key={roleName}
                variant="secondary"
                className="flex items-center gap-1 h-6 px-2 rounded-full bg-primary/10 border border-primary/25 text-2xs text-primary"
              >
                {roleName}
                <button
                  type="button"
                  onClick={() => removeRole(roleName)}
                  className="ml-0.5 text-primary/70 hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Combobox
            items={availableRoles}
            placeholder="Search and select roles…"
            onSelect={addRole}
            defaultValue={formData.roles}
            className="text-text-main border-border-main"
          />
        </FormField>
      </form>
    </AdminFormDialog>
  );
}
