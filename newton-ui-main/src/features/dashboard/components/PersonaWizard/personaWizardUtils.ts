import type { Persona } from '@/services/rbac/rbacApi';
import type { StepKey } from './personaWizardTypes';

export const PERSONA_PROMPT_MAX = 10_000;

export const formatModelSettingValue = (
  value: number | null | undefined
): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

export function truncate(s: string, n: number): string {
  const trimmed = s.trim();
  return trimmed.length > n ? `${trimmed.slice(0, n).trimEnd()}…` : trimmed;
}

export function extractTagIds(
  tags?: Array<{ id?: number } | number | string>
): number[] {
  if (!tags) return [];
  return tags
    .map((tag) => {
      if (typeof tag === 'number') return tag;
      if (
        typeof tag === 'object' &&
        tag !== null &&
        'id' in tag &&
        typeof tag.id === 'number'
      ) {
        return tag.id;
      }
      return undefined;
    })
    .filter((id): id is number => typeof id === 'number');
}

export function extractDataSourceIds(persona?: Persona | null): string[] {
  if (!persona) return [];
  if (Array.isArray(persona.datasource_ids)) {
    return persona.datasource_ids
      .map((id) => String(id))
      .filter((id) => id.length > 0);
  }
  if (Array.isArray(persona.data_sources)) {
    return persona.data_sources
      .map((source) => {
        if (typeof source === 'string') return source;
        if (source && typeof source === 'object') {
          const sourceId = source.source_id ?? source.id;
          return sourceId ? String(sourceId) : '';
        }
        return '';
      })
      .filter((id) => id.length > 0);
  }
  return [];
}

export function getPersonaRootId(persona: Persona): number {
  return persona.parent_persona_id ?? persona.id;
}

export function getPersonaVersionId(persona: Persona): number {
  return persona.current_version_id ?? persona.id;
}

export const STEP_TIPS: Record<StepKey, string[]> = {
  basics: [
    'Choose Chat for open-ended Q&A.',
    'Pick Dashboard when your persona returns structured data, charts, or tool results.',
    'Type cannot be changed after the persona is created.',
  ],
  identity: [
    'Be explicit about format — "respond in bullet points" is more reliable than "be concise."',
    "Avoid writing the persona's name inside the prompt; it's prepended automatically.",
    "Limit to ~2,000 chars for best results. Leave room for the system prompt.",
  ],
  intelligence: [
    'Lower temperature (0.1–0.3) for factual, deterministic responses.',
    'Higher temperature (0.7–1.0) for creative brainstorming.',
    'Leave system prompt empty to inherit the global default.',
  ],
  capabilities: [
    'Leave tool/doc tags empty to give access to everything.',
    'Data sources only appear for Dashboard personas.',
    'Tool rules are optional — leave empty to inherit from the previous version.',
  ],
  review: [
    'Use Edit shortcuts to jump back and fix any section.',
    'Double-check the model and temperature before submitting.',
  ],
};
