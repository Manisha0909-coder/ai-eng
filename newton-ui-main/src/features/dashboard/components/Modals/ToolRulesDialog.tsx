import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import notify from "@/utils/notify";
import { RefreshCw, Trash2, Save, ListChecks } from "lucide-react";
import { rbacApi, type ToolRuleItem, type ToolRuleTool } from "@/services/rbac/rbacApi";
import { ErrorRetry } from "../ErrorRetry";
import { ToolRuleEditor } from "../ToolRuleEditor";
import { DeleteConfirmationModal } from "../DeleteConfirmationModal";

interface ToolRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId: number;
  personaName: string;
}

export function ToolRulesDialog({
  open,
  onOpenChange,
  personaId,
  personaName,
}: ToolRulesDialogProps) {
  const [ruleTypes, setRuleTypes] = useState<string[]>([]);
  const [personaTools, setPersonaTools] = useState<ToolRuleTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [rules, setRules] = useState<ToolRuleItem[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const loadData = useCallback(async () => {
    setToolsLoading(true);
    setRulesLoading(true);
    setRulesError(null);
    setPersonaTools([]);
    setRules([]);
    setHasUnsavedChanges(false);

    try {
      const [types, tools, existingRules] = await Promise.all([
        rbacApi.toolRules.getTypes(),
        rbacApi.toolRules.getToolsForPersona(personaId),
        rbacApi.toolRules.getRulesForPersona(personaId),
      ]);
      setRuleTypes(types);
      setPersonaTools(tools);
      setRules(existingRules);
    } catch (err: any) {
      setRulesError(err.message || "Failed to load tool rules");
    } finally {
      setToolsLoading(false);
      setRulesLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleRulesChange = (updated: ToolRuleItem[]) => {
    setRules(updated);
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const result = await rbacApi.toolRules.updateRulesForPersona(personaId, rules);
      setRules(result.tool_rules);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      notify.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await rbacApi.toolRules.deleteAllRulesForPersona(personaId);
      setRules([]);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      notify.error(err);
    } finally {
      setIsDeleting(false);
      setIsDeleteAllOpen(false);
    }
  };

  const isLoading = rulesLoading || toolsLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-surface border-border-main text-text-main max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Tool Rules
            </DialogTitle>
            <DialogDescription>
              Manage tool execution rules for <strong>{personaName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
            {/* Toolbar */}
            {!isLoading && !rulesError && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-text-main border-border-main">
                    {personaTools.length} tool{personaTools.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="secondary" className="text-text-main">
                    {rules.length} rule{rules.length !== 1 ? "s" : ""}
                  </Badge>
                  {hasUnsavedChanges && (
                    <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                      Unsaved
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={loadData}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  </Button>
                  {hasUnsavedChanges && (
                    <Button size="sm" className="h-8" onClick={handleSaveAll} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1" />
                      )}
                      Save
                    </Button>
                  )}
                  {rules.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => setIsDeleteAllOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete All
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
              </div>
            )}

            {!isLoading && rulesError && (
              <ErrorRetry error={rulesError} onRetry={loadData} />
            )}

            {!isLoading && !rulesError && (
              <ToolRuleEditor
                rules={rules}
                availableTools={personaTools}
                ruleTypes={ruleTypes}
                onChange={handleRulesChange}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationModal
        isOpen={isDeleteAllOpen}
        onClose={() => setIsDeleteAllOpen(false)}
        onConfirm={handleDeleteAll}
        title="Delete All Tool Rules?"
        description="This action cannot be undone."
        itemName={personaName}
        usageNote={`${rules.length} rule${rules.length !== 1 ? "s" : ""} will be permanently removed.`}
        confirmLabel="Delete All"
        isLoading={isDeleting}
      />
    </>
  );
}
