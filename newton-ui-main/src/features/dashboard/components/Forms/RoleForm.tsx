import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, ShieldCheck } from "lucide-react";
import {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  documentTagsApi,
  personasApi,
  type DocumentTag,
  type Persona,
} from "@/services/rbac/rbacApi";
import { Combobox } from "@/components/ui/combobox";
import { AdminFormDialog, FormDialogFooter } from "./AdminFormDialog";
import { FormField } from "./FormField";

interface RoleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRoleRequest | UpdateRoleRequest) => Promise<void>;
  role?: Role;
  isLoading?: boolean;
}

export function RoleForm({ isOpen, onClose, onSubmit, role, isLoading = false }: RoleFormProps) {
  const [formData, setFormData] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableDocumentTags, setAvailableDocumentTags] = useState<DocumentTag[]>([]);
  const [availablePersonas, setAvailablePersonas] = useState<Persona[]>([]);
  const [selectedDocumentTagIds, setSelectedDocumentTagIds] = useState<number[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: role?.name || "", description: role?.description || "" });
      setSelectedDocumentTagIds(extractIds(role?.document_tags));
      setSelectedPersonaIds(extractIds(role?.personas));
      setErrors({});
    } else {
      setFormData({ name: "", description: "" });
      setSelectedDocumentTagIds([]);
      setSelectedPersonaIds([]);
      setErrors({});
    }
  }, [isOpen, role]);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        const [tagsRes, personasRes] = await Promise.all([
          documentTagsApi.list({ limit: 1000, offset: 0 }),
          personasApi.list({ limit: 1000, offset: 0, roots_only: true }),
        ]);
        if (tagsRes.success) setAvailableDocumentTags(tagsRes.data);
        if (personasRes.success) setAvailablePersonas(personasRes.data);
      } catch (error) {
        console.error("Error loading role metadata:", error);
      }
    };
    load();
  }, [isOpen]);

  const documentTagNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    availableDocumentTags.forEach(t => { if (t?.id && t?.name) map[t.id] = t.name; });
    return map;
  }, [availableDocumentTags]);

  const personaNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    availablePersonas.forEach(p => { if (p?.id && p?.persona_name) map[p.id] = p.persona_name; });
    return map;
  }, [availablePersonas]);

  const documentTagOptions = useMemo(
    () => availableDocumentTags.map(t => t.name).filter((n): n is string => Boolean(n)),
    [availableDocumentTags],
  );

  const personaOptions = useMemo(
    () => availablePersonas.map(p => p.persona_name).filter((n): n is string => Boolean(n)),
    [availablePersonas],
  );

  const selectedDocumentTagNames = useMemo(
    () => selectedDocumentTagIds.map(id => documentTagNameMap[id] || `Tag #${id}`),
    [selectedDocumentTagIds, documentTagNameMap],
  );

  const selectedPersonaNames = useMemo(
    () => selectedPersonaIds.map(id => personaNameMap[id] || `Persona #${id}`),
    [selectedPersonaIds, personaNameMap],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    try {
      await onSubmit({
        name: formData.name,
        description: formData.description.trim() || "",
        document_tag_ids: selectedDocumentTagIds,
        persona_ids: selectedPersonaIds,
      });
      onClose();
    } catch (error) {
      console.error("Error submitting role:", error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const handleDocumentTagSelect = (value: string | string[]) => {
    const names = Array.isArray(value) ? value : [value];
    const ids = names
      .map(n => availableDocumentTags.find(t => t.name === n)?.id)
      .filter((id): id is number => typeof id === "number");
    setSelectedDocumentTagIds(ids);
  };

  const handlePersonaSelect = (value: string | string[]) => {
    const names = Array.isArray(value) ? value : [value];
    const ids = names
      .map(n => availablePersonas.find(p => p.persona_name === n)?.id)
      .filter((id): id is number => typeof id === "number");
    setSelectedPersonaIds(ids);
  };

  const isEdit = Boolean(role);

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Role" : "Create Role"}
      icon={<ShieldCheck size={15} />}
      size="lg"
      footer={
        <FormDialogFooter>
          {errors.general && <p className="text-xs text-status-error mr-auto">{errors.general}</p>}
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
            form="role-form"
            disabled={isLoading || !formData.name.trim()}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isLoading ? "Saving…" : isEdit ? "Update role" : "Create role"}
          </Button>
        </FormDialogFooter>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Role name" required error={errors.name}>
          <Input
            value={formData.name}
            onChange={e => handleChange("name", e.target.value)}
            placeholder="e.g. hr_manager"
            className="h-[2.2rem] rounded-lg border-border-main bg-background text-[0.85rem] text-text-main"
          />
        </FormField>

        <FormField label="Description" error={errors.description}>
          <Textarea
            value={formData.description}
            onChange={e => handleChange("description", e.target.value)}
            placeholder="What can this role do?"
            rows={2}
            className="rounded-lg border-border-main bg-background text-[0.85rem] text-text-main resize-none"
          />
        </FormField>

        <FormField label="Personas" error={errors.personas}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedPersonaIds.map(id => (
              <Badge
                key={id}
                variant="secondary"
                className="flex items-center gap-1 h-6 px-2 rounded-full bg-primary/10 border border-primary/25 text-2xs text-primary"
              >
                {personaNameMap[id] || `Persona #${id}`}
                <button
                  type="button"
                  onClick={() => setSelectedPersonaIds(prev => prev.filter(pid => pid !== id))}
                  className="ml-0.5 text-primary/70 hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedPersonaIds.length === 0 && (
              <span className="text-xs text-text-muted">No personas selected</span>
            )}
          </div>
          <Combobox
            items={personaOptions}
            placeholder="Search and select personas…"
            onSelect={handlePersonaSelect}
            defaultValue={selectedPersonaNames}
            className="text-text-main border-border-main"
          />
        </FormField>

        <FormField label="Document tags" error={errors.document_tags}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedDocumentTagIds.map(id => (
              <Badge
                key={id}
                variant="secondary"
                className="flex items-center gap-1 h-6 px-2 rounded-full bg-primary/10 border border-primary/25 text-2xs text-primary"
              >
                {documentTagNameMap[id] || `Tag #${id}`}
                <button
                  type="button"
                  onClick={() => setSelectedDocumentTagIds(prev => prev.filter(tid => tid !== id))}
                  className="ml-0.5 text-primary/70 hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedDocumentTagIds.length === 0 && (
              <span className="text-xs text-text-muted">No document tags selected</span>
            )}
          </div>
          <Combobox
            items={documentTagOptions}
            placeholder="Search and select document tags…"
            onSelect={handleDocumentTagSelect}
            defaultValue={selectedDocumentTagNames}
            className="text-text-main border-border-main"
          />
        </FormField>
      </form>
    </AdminFormDialog>
  );
}

function extractIds(items?: Array<string | number | { id?: number }>): number[] {
  if (!items) return [];
  return items
    .map(item => {
      if (typeof item === "number") return item;
      if (typeof item === "string") {
        const parsed = Number(item);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      if (typeof item === "object" && item !== null && "id" in item && typeof item.id === "number") {
        return item.id;
      }
      return undefined;
    })
    .filter((id): id is number => typeof id === "number");
}
