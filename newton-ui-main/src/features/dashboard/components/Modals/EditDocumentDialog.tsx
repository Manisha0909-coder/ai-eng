import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, FileEdit } from "lucide-react";
import { rbacApi, type DocumentFile, UpdateDocumentRequest } from "@/services/rbac/rbacApi";
import { Combobox } from "@/components/ui/combobox";
import notify from "@/utils/notify";
import { AdminFormDialog, FormDialogFooter } from "../Forms/AdminFormDialog";
import { FormField } from "../Forms/FormField";

interface EditDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentFile | null;
  isPrivate?: boolean; // true for private documents, false for public/admin documents
  onUpdateSuccess?: () => void;
}

export function EditDocumentDialog({
  isOpen,
  onClose,
  document,
  isPrivate = true,
  onUpdateSuccess,
}: EditDocumentDialogProps) {
  const [documentName, setDocumentName] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [availableTags, setAvailableTags] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch available tags based on document type
  const fetchTags = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      if (isPrivate) {
        // Fetch personal doc tags
        const tags = await rbacApi.personalDocTags.list({ limit: 100 });
        setAvailableTags(tags.map(tag => ({ id: tag.id, name: tag.name })));
      } else {
        // Fetch document tags (admin/public)
        const response = await rbacApi.documentTags.list({ limit: 100 });
        const tags = response.data || [];
        setAvailableTags(tags.map(tag => ({ id: tag.id, name: tag.name })));
      }
    } catch (error: any) {
      console.error("Error fetching tags:", error);
      notify.error("Failed to load tags");
    } finally {
      setIsLoadingTags(false);
    }
  }, [isPrivate]);

  // Helper function to extract tag names from document
  const extractTagNamesFromDocument = (doc: any): string[] => {
    const tagNames: string[] = [];
    
    // Check doc_tags field (array of objects with name property)
    if (doc.doc_tags && Array.isArray(doc.doc_tags)) {
      doc.doc_tags.forEach((tag: any) => {
        if (typeof tag === 'object' && tag.name) {
          tagNames.push(tag.name);
        } else if (typeof tag === 'string') {
          tagNames.push(tag);
        }
      });
    }
    
    // Check document_tags field (string[] or string)
    if (doc.document_tags && tagNames.length === 0) {
      let parsedTags: string[] = [];
      if (typeof doc.document_tags === 'string') {
        try {
          const parsed = JSON.parse(doc.document_tags);
          if (Array.isArray(parsed)) {
            parsedTags = parsed.filter((t: any) => typeof t === 'string');
          }
        } catch {
          parsedTags = [doc.document_tags];
        }
      } else if (Array.isArray(doc.document_tags)) {
        parsedTags = doc.document_tags.filter((t: any) => typeof t === 'string');
      }
      tagNames.push(...parsedTags);
    }
    
    // Check tags field (string[])
    if (doc.tags && Array.isArray(doc.tags) && tagNames.length === 0) {
      tagNames.push(...doc.tags.filter((t: any) => typeof t === 'string'));
    }
    
    return tagNames;
  };

  // Initialize form when document changes or dialog opens
  useEffect(() => {
    if (isOpen && document) {
      setDocumentName(document.name || (document as any).title || (document as any).file_name || "");
      setDocumentDescription((document as any).doc_desc || document.description || "");
      
      // Set selected tags from document
      if (isPrivate) {
        const tags = document.personal_doc_tags || (document.personal_doc_tag ? [document.personal_doc_tag] : []);
        setSelectedTagIds(tags.map(tag => tag.id));
      }
      // For public documents, tags will be matched after availableTags are loaded
      
      fetchTags();
    } else {
      setDocumentName("");
      setDocumentDescription("");
      setSelectedTagIds([]);
    }
  }, [isOpen, document, isPrivate]);

  // Update selected tags when availableTags change (for matching tag names to IDs)
  useEffect(() => {
    if (!isOpen || !document || isPrivate || availableTags.length === 0) return;
    
    // Extract tag names from document
    const tagNames = extractTagNamesFromDocument(document);
    
    if (tagNames.length > 0) {
      // Match tag names with available tags to get IDs
      const matchedIds = tagNames
        .map((name: string) => availableTags.find(tag => tag.name === name)?.id)
        .filter((id): id is number => id !== undefined);
      
      // Update selected tag IDs if we found matches
      if (matchedIds.length > 0) {
        setSelectedTagIds(matchedIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTags.length, document, isOpen, isPrivate]);

  const handleTagSelect = (selectedTagNames: string[]) => {
    // Convert tag names to IDs
    const tagIds = selectedTagNames
      .map(name => availableTags.find(tag => tag.name === name)?.id)
      .filter((id): id is number => id !== undefined);
    setSelectedTagIds(tagIds);
  };

  const handleRemoveTag = (tagId: number) => {
    setSelectedTagIds(prev => prev.filter(id => id !== tagId));
  };

  const handleSubmit = async () => {
    if (!document) return;

    setIsUpdating(true);
    try {
      const updateData: UpdateDocumentRequest = {
        name: documentName.trim() || undefined,
        doc_desc: documentDescription.trim() || undefined,
      };

      if (isPrivate) {
        updateData.personal_doc_tag_ids = selectedTagIds;
        await rbacApi.documents.updatePrivate(document.id || document.document_id!, updateData);
      } else {
        updateData.doc_tag_ids = selectedTagIds;
        await rbacApi.documents.updatePublic(document.id || document.document_id!, updateData);
      }

      onUpdateSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error updating document:", error);
      notify.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const selectedTagNames = selectedTagIds
    .map(id => availableTags.find(tag => tag.id === id)?.name)
    .filter((name): name is string => name !== undefined);

  const tagItems = availableTags.map(tag => tag.name);

  const selectedTags = selectedTagIds
    .map(id => availableTags.find(tag => tag.id === id))
    .filter((tag): tag is { id: number; name: string } => tag !== undefined);

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Document"
      icon={<FileEdit size={15} />}
      size="md"
      footer={
        <FormDialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isUpdating}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isUpdating ? "Updating..." : "Update Document"}
          </Button>
        </FormDialogFooter>
      }
    >
      <div className="space-y-4">
        <FormField label="Document Name">
          <Input
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="Enter document name"
            className="bg-background text-text-main border-border-main"
          />
        </FormField>

        <FormField label="Description">
          <Textarea
            value={documentDescription}
            onChange={(e) => setDocumentDescription(e.target.value)}
            placeholder="Enter document description"
            rows={4}
            className="min-h-[5.5rem] resize-y bg-background text-text-main border-border-main placeholder:text-text-muted"
          />
        </FormField>

        <FormField label={isPrivate ? "Personal Tags" : "Document Tags"}>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTags.length > 0 ? (
              selectedTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="flex items-center gap-1 bg-background text-text-main border-border-main"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className="ml-1 hover:bg-surface rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-xs text-text-muted">No document tags selected</span>
            )}
          </div>
          <Combobox
            items={tagItems}
            defaultValue={selectedTagNames}
            onSelect={handleTagSelect}
            multiple={true}
            isLoading={isLoadingTags}
            placeholder={`Search and select ${isPrivate ? "personal" : "document"} tags...`}
            className="w-full"
          />
        </FormField>
      </div>
    </AdminFormDialog>
  );
}

