import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Tag } from "lucide-react";
import { Tag as TagType, CreateTagRequest, UpdateTagRequest, toolNamesApi } from "@/services/rbac/rbacApi";
import { Combobox } from "@/components/ui/combobox";
import { AdminFormDialog, FormDialogFooter } from "./AdminFormDialog";
import { FormField } from "./FormField";

interface TagFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTagRequest | UpdateTagRequest) => Promise<void>;
  tag?: TagType;
  isLoading?: boolean;
  isUserAdmin?: boolean;
}

export function TagForm({ isOpen, onClose, onSubmit, tag, isLoading = false, isUserAdmin = false }: TagFormProps) {
  const [formData, setFormData] = useState<{ name: string; description: string; tool_names: string[] }>({
    name: "",
    description: "",
    tool_names: [],
  });

  const [originalToolNames, setOriginalToolNames] = useState<string[]>([]);
  const [originalDescription, setOriginalDescription] = useState<string>("");
  const [originalName, setOriginalName] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toolsCache, setToolsCache] = useState<string[]>([]);
  const [toolsCacheLoaded, setToolsCacheLoaded] = useState(false);
  const toolNamesRef = useRef<string[]>([]);

  useEffect(() => {
    toolNamesRef.current = formData.tool_names;
  }, [formData.tool_names]);

  useEffect(() => {
    if (isOpen) {
      const initialToolNames = tag?.tool_names || [];
      const initialDescription = tag?.description || "";
      const initialName = tag?.name || "";
      setFormData({ name: initialName, description: initialDescription, tool_names: initialToolNames });
      setOriginalToolNames(initialToolNames);
      setOriginalDescription(initialDescription);
      setOriginalName(initialName);
      setErrors({});
      setToolsCacheLoaded(false);
      setToolsCache([]);
    } else {
      setFormData({ name: "", description: "", tool_names: [] });
      setOriginalToolNames([]);
      setOriginalDescription("");
      setOriginalName("");
      setErrors({});
      setToolsCacheLoaded(false);
      setToolsCache([]);
    }
  }, [isOpen, tag]);

  const fetchAvailableTools = async (searchQuery?: string): Promise<string[]> => {
    try {
      if (isUserAdmin) return [];
      let allTools = toolsCache;
      if (!toolsCacheLoaded) {
        const response = await toolNamesApi.list({ limit: 1000, offset: 0, isUserAdmin });
        if (response.success) {
          allTools = response.data.map(tool => tool.name);
          setToolsCache(allTools);
          setToolsCacheLoaded(true);
        } else {
          return [];
        }
      }
      let available = allTools.filter(n => !toolNamesRef.current.includes(n));
      if (searchQuery?.trim()) {
        const q = searchQuery.toLowerCase().trim();
        available = available.filter(n => n.toLowerCase().includes(q));
      }
      return available;
    } catch {
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (tag) {
      const nameChanged = formData.name.trim() !== originalName.trim();
      const toolsChanged =
        formData.tool_names.length !== originalToolNames.length ||
        formData.tool_names.some(t => !originalToolNames.includes(t)) ||
        originalToolNames.some(t => !formData.tool_names.includes(t));
      const descChanged = formData.description.trim() !== originalDescription.trim();
      if (formData.tool_names.length === 0) {
        newErrors.tool_names = "At least one tool must be selected";
      } else if (!nameChanged && !toolsChanged && !descChanged) {
        newErrors.tool_names = "You must modify the tag name, associated tools, or description to update";
      }
    } else {
      if (formData.tool_names.length === 0) newErrors.tool_names = "At least one tool must be selected";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    try {
      await onSubmit({ name: formData.name, description: formData.description, tool_names: formData.tool_names });
      onClose();
    } catch (error) {
      console.error("Error submitting tag:", error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const addTool = (toolNames: string[]) => {
    setFormData(prev => ({ ...prev, tool_names: toolNames }));
    if (errors.tool_names) setErrors(prev => ({ ...prev, tool_names: "" }));
  };

  const removeTool = (toolName: string) => {
    setFormData(prev => ({ ...prev, tool_names: prev.tool_names.filter(n => n !== toolName) }));
    if (errors.tool_names) setErrors(prev => ({ ...prev, tool_names: "" }));
  };

  const isEdit = Boolean(tag);
  const isSubmitDisabled = (() => {
    if (isLoading || !formData.name.trim()) return true;
    if (isEdit) {
      const nameChanged = formData.name.trim() !== originalName.trim();
      const toolsChanged =
        formData.tool_names.length !== originalToolNames.length ||
        formData.tool_names.some(t => !originalToolNames.includes(t)) ||
        originalToolNames.some(t => !formData.tool_names.includes(t));
      const descChanged = formData.description.trim() !== originalDescription.trim();
      return !nameChanged && !toolsChanged && !descChanged;
    }
    return formData.tool_names.length === 0;
  })();

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Tag" : "Create Tag"}
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
            form="tag-form"
            disabled={isSubmitDisabled}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isLoading ? "Saving…" : isEdit ? "Update tag" : "Create tag"}
          </Button>
        </FormDialogFooter>
      }
    >
      <form id="tag-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Tag name" required error={errors.name}>
          <Input
            value={formData.name}
            onChange={e => handleChange("name", e.target.value)}
            placeholder="e.g. EmailManagement"
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

        <FormField label="Associated tools" required error={errors.tool_names}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {formData.tool_names.map(toolName => (
              <Badge
                key={toolName}
                variant="secondary"
                className="flex items-center gap-1 h-6 px-2 rounded-full bg-primary/10 border border-primary/25 text-2xs text-primary"
              >
                {toolName}
                <button
                  type="button"
                  onClick={() => removeTool(toolName)}
                  className="ml-0.5 text-primary/70 hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Combobox
            placeholder="Search and select tools…"
            onOpen={fetchAvailableTools}
            onSelect={addTool}
            defaultValue={formData.tool_names}
            className="text-text-main border-border-main"
          />
        </FormField>
      </form>
    </AdminFormDialog>
  );
}
