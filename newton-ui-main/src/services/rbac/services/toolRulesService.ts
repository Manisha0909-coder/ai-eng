import { rbacRequest } from "../rbacClient";
import type { ToolRuleItem, ToolRuleTool } from "../types";

export const toolRulesApi = {
  getTypes: async (): Promise<string[]> => {
    const data = await rbacRequest<{ rule_types: string[] }>("/tool-rules/types");
    return data.rule_types;
  },

  getToolsForPersona: async (personaId: number): Promise<ToolRuleTool[]> => {
    const data = await rbacRequest<{ tools: ToolRuleTool[] }>(
      `/tool-rules/personas/${personaId}/tools`
    );
    return data.tools;
  },

  getRulesForPersona: async (personaId: number): Promise<ToolRuleItem[]> => {
    const data = await rbacRequest<{ tool_rules: ToolRuleItem[] }>(
      `/tool-rules/personas/${personaId}`
    );
    return data.tool_rules;
  },

  updateRulesForPersona: async (
    personaId: number,
    toolRules: ToolRuleItem[]
  ): Promise<{ tool_rules: ToolRuleItem[]; message: string }> => {
    return rbacRequest<{ tool_rules: ToolRuleItem[]; message: string }>(
      `/tool-rules/personas/${personaId}`,
      { method: "PUT", body: { tool_rules: toolRules } }
    );
  },

  deleteAllRulesForPersona: async (
    personaId: number
  ): Promise<{ message: string }> => {
    return rbacRequest<{ message: string }>(
      `/tool-rules/personas/${personaId}`,
      { method: "DELETE" }
    );
  },
};
