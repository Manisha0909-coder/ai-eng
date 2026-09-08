import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tag } from "lucide-react";
import { DocumentTag, CreateDocumentTagRequest, UpdateDocumentTagRequest } from "@/services/rbac/rbacApi";
import { AdminFormDialog, FormDialogFooter } from "./AdminFormDialog";
import { FormField } from "./FormField";

interface DocumentTagFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDocumentTagRequest | UpdateDocumentTagRequest) => Promise<void>;
  tag?: DocumentTag;
  isLoading?: boolean;
}

export function DocumentTagForm({ isOpen, onClose, onSubmit, tag, isLoading = false }: DocumentTagFormProps) {
  const [formData, setFormData] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: tag?.name || "", description: tag?.description || "" });
      setErrors({});
    } else {
      setFormData({ name: "", description: "" });
      setErrors({});
    }
  }, [isOpen, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    try {
      await onSubmit({ name: formData.name, description: formData.description || undefined });
      onClose();
    } catch (error) {
      console.error("Error submitting document tag:", error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const isEdit = Boolean(tag);

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Document Tag" : "Create Document Tag"}
      icon={<Tag size={15} />}
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
            form="doc-tag-form"
            disabled={isLoading || !formData.name.trim()}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isLoading ? "Saving…" : isEdit ? "Update tag" : "Create tag"}
          </Button>
        </FormDialogFooter>
      }
    >
      <form id="doc-tag-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Tag name" required error={errors.name}>
          <Input
            value={formData.name}
            onChange={e => handleChange("name", e.target.value)}
            placeholder="e.g. HR Documents"
            className="h-[2.2rem] rounded-lg border-border-main bg-background text-[0.85rem] text-text-main"
          />
        </FormField>

        <FormField label="Description" error={errors.description}>
          <Textarea
            value={formData.description}
            onChange={e => handleChange("description", e.target.value)}
            placeholder="Enter tag description"
            rows={3}
            className="rounded-lg border-border-main bg-background text-[0.85rem] text-text-main resize-none"
          />
        </FormField>
      </form>
    </AdminFormDialog>
  );
}
