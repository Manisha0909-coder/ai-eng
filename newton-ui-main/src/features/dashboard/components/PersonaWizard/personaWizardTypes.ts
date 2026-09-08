import type { ToolRuleItem } from '@/services/rbac/rbacApi';

export type PersonaWizardMode = 'create' | 'version' | 'edit';

export type StepKey =
  | 'basics'
  | 'identity'
  | 'intelligence'
  | 'capabilities'
  | 'review';

export const STEP_ORDER: StepKey[] = [
  'basics',
  'identity',
  'intelligence',
  'capabilities',
  'review',
];

export const STEP_META: Record<
  StepKey,
  { label: string; subtitle: string }
> = {
  basics: {
    label: 'Basics',
    subtitle: 'Give the persona an identity and decide how it will be used.',
  },
  identity: {
    label: 'Identity',
    subtitle: 'Define how it thinks, speaks, and behaves with users.',
  },
  intelligence: {
    label: 'Intelligence',
    subtitle: 'Pick a model and optionally override the system prompt.',
  },
  capabilities: {
    label: 'Capabilities',
    subtitle: 'Choose data, tools, and documents this persona can access.',
  },
  review: {
    label: 'Review',
    subtitle: 'Confirm everything looks right, then create the persona.',
  },
};

export type PersonaFormState = {
  persona_name: string;
  persona: string;
  greeting_message: string;
  model_id?: string | null;
  temperature: string;
  context_window_limit: string;
  system_prompt: string;
  type: 'chat' | 'dashboard';
  supports_documents: boolean;
  toolRules: ToolRuleItem[];
};

export const EMPTY_FORM_STATE: PersonaFormState = {
  persona_name: '',
  persona: '',
  model_id: null,
  temperature: '',
  context_window_limit: '',
  greeting_message: '',
  system_prompt: '',
  type: 'chat',
  supports_documents: false,
  toolRules: [],
};

export type StepValidation = Record<
  StepKey,
  { valid: boolean; reason?: string }
>;
