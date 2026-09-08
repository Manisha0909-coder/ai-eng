import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Brain } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  PersonaMemoryBlock,
  CreatePersonaMemoryBlockRequest,
  UpdatePersonaMemoryBlockRequest,
  rbacApi,
} from "@/services/rbac/rbacApi";
import { AdminFormDialog, FormDialogFooter } from "./AdminFormDialog";
import { FormField } from "./FormField";

interface PersonaMemoryBlockFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePersonaMemoryBlockRequest | UpdatePersonaMemoryBlockRequest) => Promise<void>;
  block?: PersonaMemoryBlock;
  isLoading?: boolean;
}

interface PersonaOption {
  id: number;
  name: string;
}

export function PersonaMemoryBlockForm({ isOpen, onClose, onSubmit, block, isLoading = false }: PersonaMemoryBlockFormProps) {
  const [formData, setFormData] = useState<{
    persona_id: number | "";
    label: string;
    description: string;
    value: string;
  }>({ persona_id: "", label: "", description: "", value: "" });

  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) fetchPersonas();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        persona_id: block?.persona_id || "",
        label: block?.label || "",
        description: block?.description || "",
        value: block?.current_value || "",
      });
      setErrors({});
    } else {
      setFormData({ persona_id: "", label: "", description: "", value: "" });
      setErrors({});
    }
  }, [isOpen, block]);

  const fetchPersonas = async () => {
    try {
      const response = await rbacApi.personas.list({ limit: 1000, offset: 0, roots_only: true });
      if (response.success) {
        setPersonas(
          response.data.map((p: any) => ({
            id: p.id || p.persona_id,
            name: p.persona_name || p.name || `Persona ${p.id || p.persona_id}`,
          })),
        );
      }
    } catch (error) {
      console.error("Error fetching personas:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.label.trim()) newErrors.label = "Label is required";
    if (!formData.persona_id) newErrors.persona_id = "Persona is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    try {
      if (block) {
        const updateData: UpdatePersonaMemoryBlockRequest = {};
        if (formData.label !== block.label) updateData.label = formData.label;
        if (formData.description !== (block.description || "")) updateData.description = formData.description;
        if (formData.value !== (block.current_value || "")) updateData.value = formData.value;
        await onSubmit(updateData);
      } else {
        await onSubmit({
          persona_id: Number(formData.persona_id),
          label: formData.label.trim(),
          ...(formData.description.trim() && { description: formData.description.trim() }),
          ...(formData.value.trim() && { value: formData.value.trim() }),
        });
      }
      onClose();
    } catch (error) {
      console.error("Error submitting persona memory block:", error);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const personaOptions = useMemo(
    () => personas.map(p => p.name).filter((n): n is string => Boolean(n)),
    [personas],
  );

  const personaNameToIdMap = useMemo(() => {
    const map: Record<string, number> = {};
    personas.forEach(p => { map[p.name] = p.id; });
    return map;
  }, [personas]);

  const selectedPersonaName = useMemo(
    () => (formData.persona_id ? personas.find(p => p.id === formData.persona_id)?.name || "" : ""),
    [formData.persona_id, personas],
  );

  const readOnlyPersonaName = useMemo(() => {
    if (!block) return selectedPersonaName;
    return (block as any).persona?.persona_name || (block as any).persona_name || "";
  }, [block, selectedPersonaName]);

  const handlePersonaSelect = (value: string | string[]) => {
    const name = Array.isArray(value) ? value[0] : value;
    handleChange("persona_id", name ? personaNameToIdMap[name] || "" : "");
  };

  const isEdit = Boolean(block);

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Memory Block" : "Create Memory Block"}
      icon={<Brain size={15} />}
      size="lg"
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
            form="memory-block-form"
            disabled={isLoading || !formData.label.trim() || !formData.persona_id}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isLoading ? "Saving…" : isEdit ? "Update block" : "Create block"}
          </Button>
        </FormDialogFooter>
      }
    >
      <form id="memory-block-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Persona" required error={errors.persona_id}>
          {isEdit ? (
            <Input
              value={readOnlyPersonaName}
              disabled
              readOnly
              className={cn(
                "h-[2.2rem] rounded-lg border-border-main bg-background text-[0.85rem] text-text-main opacity-60 cursor-not-allowed",
              )}
            />
          ) : (
            <Combobox
              items={personaOptions}
              placeholder="Search and select a persona…"
              onSelect={handlePersonaSelect}
              defaultValue={selectedPersonaName ? [selectedPersonaName] : []}
              multiple={false}
              className="text-text-main border-border-main"
            />
          )}
        </FormField>

        <FormField label="Label" required error={errors.label}>
          <Input
            value={formData.label}
            onChange={e => handleChange("label", e.target.value)}
            placeholder="Enter block label"
            className="h-[2.2rem] rounded-lg border-border-main bg-background text-[0.85rem] text-text-main"
          />
        </FormField>

        <FormField label="Description">
          <Textarea
            value={formData.description}
            onChange={e => handleChange("description", e.target.value)}
            placeholder="Enter block description"
            rows={3}
            className="rounded-lg border-border-main bg-background text-[0.85rem] text-text-main resize-none"
          />
        </FormField>

        <FormField label="Current value">
          <Textarea
            value={formData.value}
            onChange={e => handleChange("value", e.target.value)}
            placeholder="Enter initial value"
            rows={4}
            maxLength={10000}
            className="rounded-lg border-border-main bg-background text-[0.85rem] text-text-main resize-none"
            style={{ minHeight: "100px", maxHeight: "200px", overflowY: "auto" }}
          />
          <p className="text-xs text-text-muted">{formData.value.length}/10000 characters</p>
        </FormField>
      </form>
    </AdminFormDialog>
  );
}
