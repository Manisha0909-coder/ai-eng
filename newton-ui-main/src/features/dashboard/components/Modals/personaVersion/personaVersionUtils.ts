import type { Persona } from '@/services/rbac/rbacApi';

export function formatTagLabels(
  tags: Persona['tool_tags'] | Persona['document_tags'],
  fallbackPrefix: string
): string[] {
  if (!tags) return [];
  return tags
    .map((tag) => {
      if (typeof tag === 'number') return `${fallbackPrefix} #${tag}`;
      if (typeof tag === 'string') return tag;
      if (typeof tag === 'object' && tag !== null) {
        if ('name' in tag && tag.name) return tag.name;
        if ('id' in tag && typeof tag.id === 'number') return `${fallbackPrefix} #${tag.id}`;
      }
      return '';
    })
    .filter((label): label is string => Boolean(label));
}

export function extractToolNames(toolTags: Persona['tool_tags']): string[] {
  if (!toolTags) return [];
  const names: string[] = [];
  for (const tag of toolTags) {
    if (
      typeof tag === 'object' &&
      tag !== null &&
      'tool_names' in tag &&
      Array.isArray((tag as { tool_names?: string[] }).tool_names)
    ) {
      names.push(...(tag as { tool_names: string[] }).tool_names);
    }
  }
  return [...new Set(names)].filter(Boolean);
}

export function getPersonaPromptText(version: Persona): string {
  return version.persona_prompt || version.persona || '';
}
