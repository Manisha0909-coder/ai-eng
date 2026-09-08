import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminFormDialog, FormDialogFooter } from "./Forms/AdminFormDialog";
import { FormField } from "./Forms/FormField";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import notify from "@/utils/notify";
import {
  Plus,
  Trash2,
  AlertCircle,
  Edit2,
  X,
  ListChecks,
  Search,
  Settings,
} from "lucide-react";
import type { ToolRuleItem, ToolRuleTool } from "@/services/rbac/rbacApi";
import { DashboardLoader } from "@/components/ContentLoader";

export const RULE_TYPE_LABELS: Record<string, string> = {
  run_first: "Run First",
  exit_loop: "Exit Loop",
  constrain_child_tools: "Constrain Child Tools",
  continue_loop: "Continue Loop",
  max_count_per_step: "Max Count Per Step",
  requires_approval: "Requires Approval",
  required_before_exit: "Required Before Exit",
  conditional: "Conditional",
  parent_last_tool: "Parent Last Tool",
};

export const RULE_TYPE_DESCRIPTIONS: Record<string, string> = {
  run_first: "Tool runs first before other tools in each step",
  exit_loop: "Tool execution exits the agent loop",
  constrain_child_tools: "Limits which child tools can follow this tool",
  continue_loop: "Tool execution continues the agent loop",
  max_count_per_step: "Limits how many times a tool can be called per step",
  requires_approval: "Tool requires user approval before execution",
  required_before_exit: "Tool must be called before agent can exit",
  conditional: "Routes to child tools based on output",
  parent_last_tool: "Specifies which tool must be the last in a parent chain",
};

export const TYPES_WITH_CHILDREN = ["constrain_child_tools", "parent_last_tool"];
export const TYPES_WITH_CONDITIONAL = ["conditional"];
export const TYPES_WITH_MAX_COUNT = ["max_count_per_step"];
export const TYPES_WITH_ARGS = ["run_first"];

export interface RuleFormState {
  tool_name: string;
  type: string;
  children: string[];
  child_output_mapping: Record<string, string>;
  default_child: string;
  require_output_mapping: boolean;
  max_count_limit: number;
  args: Record<string, string>;
}

export const EMPTY_RULE: RuleFormState = {
  tool_name: "",
  type: "",
  children: [],
  child_output_mapping: {},
  default_child: "",
  require_output_mapping: false,
  max_count_limit: 1,
  args: {},
};

interface ToolRuleEditorProps {
  rules: ToolRuleItem[];
  availableTools: ToolRuleTool[];
  ruleTypes: string[];
  onChange: (rules: ToolRuleItem[]) => void;
  isLoading?: boolean;
}

export function ToolRuleEditor({
  rules: rulesProp,
  availableTools: availableToolsProp,
  ruleTypes: ruleTypesProp,
  onChange,
  isLoading,
}: ToolRuleEditorProps) {
  const rules = rulesProp ?? [];
  const availableTools = availableToolsProp ?? [];
  const ruleTypes = ruleTypesProp ?? [];
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formState, setFormState] = useState<RuleFormState>({ ...EMPTY_RULE });
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [newChildName, setNewChildName] = useState("");
  const [newMappingKey, setNewMappingKey] = useState("");
  const [newMappingValue, setNewMappingValue] = useState("");
  const [newArgKey, setNewArgKey] = useState("");
  const [newArgValue, setNewArgValue] = useState("");

  const toolDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableTools.forEach((t) => {
      map[t.name] = t.display_name || t.name;
    });
    return map;
  }, [availableTools]);

  const filteredRules = useMemo(() => {
    if (!searchTerm.trim()) return rules;
    const lower = searchTerm.toLowerCase();
    return rules.filter(
      (r) =>
        r.tool_name.toLowerCase().includes(lower) ||
        r.type.toLowerCase().includes(lower) ||
        (toolDisplayMap[r.tool_name] || "").toLowerCase().includes(lower),
    );
  }, [rules, searchTerm, toolDisplayMap]);

  const openAddForm = () => {
    setFormState({ ...EMPTY_RULE });
    setEditingIndex(null);
    setNewChildName("");
    setNewMappingKey("");
    setNewMappingValue("");
    setNewArgKey("");
    setNewArgValue("");
    setIsRuleFormOpen(true);
  };

  const openEditForm = (index: number) => {
    const rule = rules[index];
    setFormState({
      tool_name: rule.tool_name,
      type: rule.type,
      children: rule.children ?? [],
      child_output_mapping: rule.child_output_mapping ?? {},
      default_child: rule.default_child ?? "",
      require_output_mapping: rule.require_output_mapping ?? false,
      max_count_limit: rule.max_count_limit ?? 1,
      args: (rule.args as Record<string, string>) ?? {},
    });
    setEditingIndex(index);
    setNewChildName("");
    setNewMappingKey("");
    setNewMappingValue("");
    setNewArgKey("");
    setNewArgValue("");
    setIsRuleFormOpen(true);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const handleFormSubmit = () => {
    if (!formState.tool_name || !formState.type) {
      notify.error("Tool and rule type are required");
      return;
    }

    const newRule: ToolRuleItem = {
      tool_name: formState.tool_name,
      type: formState.type,
    };

    if (TYPES_WITH_CHILDREN.includes(formState.type) && formState.children.length > 0) {
      newRule.children = formState.children;
    }
    if (TYPES_WITH_CONDITIONAL.includes(formState.type)) {
      if (Object.keys(formState.child_output_mapping).length > 0) {
        newRule.child_output_mapping = formState.child_output_mapping;
      }
      if (formState.default_child) newRule.default_child = formState.default_child;
      newRule.require_output_mapping = formState.require_output_mapping;
    }
    if (TYPES_WITH_MAX_COUNT.includes(formState.type)) {
      newRule.max_count_limit = formState.max_count_limit;
    }
    if (TYPES_WITH_ARGS.includes(formState.type) && Object.keys(formState.args).length > 0) {
      newRule.args = formState.args;
    }

    const updated = [...rules];
    if (editingIndex !== null) {
      updated[editingIndex] = newRule;
    } else {
      updated.push(newRule);
    }
    onChange(updated);
    setIsRuleFormOpen(false);
  };

  if (isLoading) return <DashboardLoader />;

  return (
    <>
      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
        {rules.length > 0 && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-2 text-text-muted h-4 w-4" />
            <Input
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm bg-background border-border-main text-text-main"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={openAddForm}
            disabled={availableTools.length === 0}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Rule
          </Button>
          {rules.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={() => setIsDeleteAllOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Empty states */}
      {availableTools.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-text-main/60 gap-2">
          <AlertCircle className="h-8 w-8 opacity-30" />
          <p className="text-sm text-center">
            No tools available.
            <br />
            Assign tool tags first.
          </p>
        </div>
      )}

      {availableTools.length > 0 && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-text-main/60 gap-2">
          <ListChecks className="h-8 w-8 opacity-30" />
          <p className="text-sm">No tool rules configured</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={openAddForm}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add First Rule
          </Button>
        </div>
      )}

      {/* Rule cards */}
      <AnimatePresence>
        {filteredRules.map((rule) => {
          const realIndex = rules.indexOf(rule);
          return (
            <motion.div
              key={`${rule.tool_name}-${rule.type}-${realIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="border border-border-main rounded-lg p-3 bg-background transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-main text-sm">
                      {toolDisplayMap[rule.tool_name] || rule.tool_name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {RULE_TYPE_LABELS[rule.type] || rule.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-main/60">
                    {RULE_TYPE_DESCRIPTIONS[rule.type] || ""}
                  </p>
                  {rule.max_count_limit !== undefined && TYPES_WITH_MAX_COUNT.includes(rule.type) && (
                    <p className="text-xs text-text-main/70">
                      Max count: <span className="font-semibold">{rule.max_count_limit}</span>
                    </p>
                  )}
                  {rule.children && rule.children.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-text-main/70">Children:</span>
                      {rule.children.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs">
                          {toolDisplayMap[c] || c}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {rule.default_child && (
                    <p className="text-xs text-text-main/70">
                      Default child:{" "}
                      <span className="font-semibold">
                        {toolDisplayMap[rule.default_child] || rule.default_child}
                      </span>
                    </p>
                  )}
                  {rule.child_output_mapping && Object.keys(rule.child_output_mapping).length > 0 && (
                    <div className="text-xs text-text-main/70">
                      <span>Output mapping:</span>
                      <div className="ml-2 mt-0.5 space-y-0.5">
                        {Object.entries(rule.child_output_mapping).map(([k, v]) => (
                          <div key={k}>
                            <code className="bg-surface px-1 rounded text-2xs">{k}</code>
                            {" → "}
                            <code className="bg-surface px-1 rounded text-2xs">
                              {toolDisplayMap[v] || v}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {rule.args && Object.keys(rule.args).length > 0 && (
                    <div className="text-xs text-text-main/70">
                      <span>Args:</span>
                      <div className="ml-2 mt-0.5 space-y-0.5">
                        {Object.entries(rule.args).map(([k, v]) => (
                          <div key={k}>
                            <code className="bg-surface px-1 rounded text-2xs">{k}</code>
                            {": "}
                            <code className="bg-surface px-1 rounded text-2xs">{String(v)}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-text-main/60 hover:text-text-main"
                    onClick={() => openEditForm(realIndex)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500/60 hover:text-red-500"
                    onClick={() => removeRule(realIndex)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {searchTerm && filteredRules.length === 0 && rules.length > 0 && (
        <p className="text-sm text-center py-4 text-text-main/50">
          No rules match &ldquo;{searchTerm}&rdquo;
        </p>
      )}

      {/* Add / Edit Rule form */}
      <AdminFormDialog
        isOpen={isRuleFormOpen}
        onClose={() => setIsRuleFormOpen(false)}
        title={editingIndex !== null ? "Edit Rule" : "Add Rule"}
        icon={<Settings size={15} />}
        size="md"
        contentClassName="z-[60]"
        footer={
          <FormDialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRuleFormOpen(false)}
              className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFormSubmit}
              disabled={!formState.tool_name || !formState.type}
              className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
            >
              {editingIndex !== null ? "Update" : "Add"} Rule
            </Button>
          </FormDialogFooter>
        }
      >
        <div className="space-y-4">
          <FormField label="Tool" required>
            <Select
              value={formState.tool_name}
              onValueChange={(val) => setFormState((prev) => ({ ...prev, tool_name: val }))}
            >
              <SelectTrigger className="bg-background border-border-main">
                <SelectValue placeholder="Select a tool..." />
              </SelectTrigger>
              <SelectContent className={`bg-background border-border-main max-h-60 z-[70]`}>
                {availableTools.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.display_name || t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Rule Type" required>
            <Select
              value={formState.type}
              onValueChange={(val) =>
                setFormState((prev) => ({
                  ...prev,
                  type: val,
                  children: [],
                  child_output_mapping: {},
                  default_child: "",
                  require_output_mapping: false,
                  max_count_limit: 1,
                  args: {},
                }))
              }
            >
              <SelectTrigger className="bg-background border-border-main">
                <SelectValue placeholder="Select rule type..." />
              </SelectTrigger>
              <SelectContent className={`bg-background border-border-main max-h-60 z-[70]`}>
                {ruleTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RULE_TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {TYPES_WITH_MAX_COUNT.includes(formState.type) && (
            <FormField label="Max Count Limit">
              <Input
                type="number"
                min={1}
                value={formState.max_count_limit}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    max_count_limit: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                className="bg-background border-border-main"
              />
            </FormField>
          )}

          {TYPES_WITH_CHILDREN.includes(formState.type) && (
            <FormField label="Child Tools">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {formState.children.map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="cursor-pointer hover:bg-red-500/20 transition-colors"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          children: prev.children.filter((ch) => ch !== c),
                        }))
                      }
                    >
                      {toolDisplayMap[c] || c}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={newChildName} onValueChange={setNewChildName}>
                    <SelectTrigger className="bg-background border-border-main flex-1">
                      <SelectValue placeholder="Select child tool..." />
                    </SelectTrigger>
                    <SelectContent className={`bg-background border-border-main max-h-60 z-[70]`}>
                      {availableTools
                        .filter((t) => !formState.children.includes(t.name) && t.name !== formState.tool_name)
                        .map((t) => (
                          <SelectItem key={t.name} value={t.name}>
                            {t.display_name || t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newChildName) {
                        setFormState((prev) => ({ ...prev, children: [...prev.children, newChildName] }));
                        setNewChildName("");
                      }
                    }}
                    disabled={!newChildName}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </FormField>
          )}

          {TYPES_WITH_CONDITIONAL.includes(formState.type) && (
            <>
              <FormField label="Default Child">
                <Select
                  value={formState.default_child}
                  onValueChange={(val) => setFormState((prev) => ({ ...prev, default_child: val }))}
                >
                  <SelectTrigger className="bg-background border-border-main">
                    <SelectValue placeholder="Select default child..." />
                  </SelectTrigger>
                  <SelectContent className={`bg-background border-border-main max-h-60 z-[70]`}>
                    {availableTools
                      .filter((t) => t.name !== formState.tool_name)
                      .map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.display_name || t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormField>

              <div className="flex items-center gap-2">
                <p className="text-[0.8rem] font-medium text-text-main leading-none">
                  Require Output Mapping
                </p>
                <Checkbox
                  checked={formState.require_output_mapping}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({ ...prev, require_output_mapping: checked === true }))
                  }
                  className="rounded border-border-main"
                />
              </div>

              <FormField label="Output Mapping">
                <div className="space-y-2">
                  {Object.entries(formState.child_output_mapping).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <code className="bg-background px-2 py-1 rounded text-xs flex-1">{key}</code>
                      <span className="text-text-main/50">→</span>
                      <code className="bg-background px-2 py-1 rounded text-xs flex-1">
                        {toolDisplayMap[value] || value}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500/60 hover:text-red-500"
                        onClick={() =>
                          setFormState((prev) => {
                            const updated = { ...prev.child_output_mapping };
                            delete updated[key];
                            return { ...prev, child_output_mapping: updated };
                          })
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <span className="text-xs text-text-main/60">Output Key</span>
                      <Input
                        value={newMappingKey}
                        onChange={(e) => setNewMappingKey(e.target.value)}
                        placeholder="output_key"
                        className="bg-background border-border-main h-8 text-sm"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-xs text-text-main/60">Target Tool</span>
                      <Select value={newMappingValue} onValueChange={setNewMappingValue}>
                        <SelectTrigger className="bg-background border-border-main h-8 text-sm">
                          <SelectValue placeholder="Tool..." />
                        </SelectTrigger>
                        <SelectContent className={`bg-background border-border-main max-h-60 z-[70]`}>
                          {availableTools
                            .filter((t) => t.name !== formState.tool_name)
                            .map((t) => (
                              <SelectItem key={t.name} value={t.name}>
                                {t.display_name || t.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        if (newMappingKey && newMappingValue) {
                          setFormState((prev) => ({
                            ...prev,
                            child_output_mapping: { ...prev.child_output_mapping, [newMappingKey]: newMappingValue },
                          }));
                          setNewMappingKey("");
                          setNewMappingValue("");
                        }
                      }}
                      disabled={!newMappingKey || !newMappingValue}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </FormField>
            </>
          )}

          {TYPES_WITH_ARGS.includes(formState.type) && (
            <FormField label="Arguments">
              <div className="space-y-2">
                {Object.entries(formState.args).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <code className="bg-background px-2 py-1 rounded text-xs flex-1">{key}</code>
                    <span className="text-text-main/50">=</span>
                    <code className="bg-background px-2 py-1 rounded text-xs flex-1">{value}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500/60 hover:text-red-500"
                      onClick={() =>
                        setFormState((prev) => {
                          const updated = { ...prev.args };
                          delete updated[key];
                          return { ...prev, args: updated };
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <span className="text-xs text-text-main/60">Key</span>
                    <Input
                      value={newArgKey}
                      onChange={(e) => setNewArgKey(e.target.value)}
                      placeholder="arg_key"
                      className="bg-background border-border-main h-8 text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className="text-xs text-text-main/60">Value</span>
                    <Input
                      value={newArgValue}
                      onChange={(e) => setNewArgValue(e.target.value)}
                      placeholder="arg_value"
                      className="bg-background border-border-main h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (newArgKey && newArgValue) {
                        setFormState((prev) => ({
                          ...prev,
                          args: { ...prev.args, [newArgKey]: newArgValue },
                        }));
                        setNewArgKey("");
                        setNewArgValue("");
                      }
                    }}
                    disabled={!newArgKey || !newArgValue}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </FormField>
          )}
        </div>
      </AdminFormDialog>

      {/* Clear All confirmation */}
      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent className="bg-surface border-border-main z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-main">Clear All Tool Rules</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {rules.length} configured rule{rules.length !== 1 ? "s" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-text-main">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange([]);
                setIsDeleteAllOpen(false);
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
