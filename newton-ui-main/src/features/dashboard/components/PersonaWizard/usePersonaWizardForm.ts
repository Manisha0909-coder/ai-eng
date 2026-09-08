import { useCallback, useEffect, useMemo, useState } from 'react';
import notify from '@/utils/notify';
import { listDataSources } from '@/services/datasources/dataSourcesApi';
import {
  personasApi,
  rbacApi,
  type CreatePersonaRequest,
  type DocumentTag,
  type Persona,
  type PersonaModel,
  type Tag,
  type ToolRuleTool,
} from '@/services/rbac/rbacApi';
import {
  EMPTY_FORM_STATE,
  STEP_ORDER,
  type PersonaFormState,
  type PersonaWizardMode,
  type StepKey,
  type StepValidation,
} from './personaWizardTypes';
import {
  extractDataSourceIds,
  extractTagIds,
  formatModelSettingValue,
  getPersonaRootId,
  getPersonaVersionId,
} from './personaWizardUtils';

interface UsePersonaWizardFormOptions {
  isOpen: boolean;
  mode: PersonaWizardMode;
  basePersona?: Persona | null;
  onSave: () => void;
  onClose: () => void;
  onCreated?: (personaId: number, personaName: string) => void;
}

export function usePersonaWizardForm({
  isOpen,
  mode,
  basePersona,
  onSave,
  onClose,
  onCreated,
}: UsePersonaWizardFormOptions) {
  const [loading, setLoading] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [formData, setFormData] = useState<PersonaFormState>(EMPTY_FORM_STATE);
  const [selectedBasePersona, setSelectedBasePersona] = useState<Persona | null>(null);
  const [inheritedSystemPrompt, setInheritedSystemPrompt] = useState('');
  const [nextVersionNumber, setNextVersionNumber] = useState<number | null>(null);
  const [setAsCurrentVersion, setSetAsCurrentVersion] = useState(true);
  const [loadingBasePersona, setLoadingBasePersona] = useState(false);

  const [availableModels, setAvailableModels] = useState<
    Array<PersonaModel & { is_default?: boolean }>
  >([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [ruleTypes, setRuleTypes] = useState<string[]>([]);
  const [availableToolTags, setAvailableToolTags] = useState<Tag[]>([]);
  const [availableDocumentTags, setAvailableDocumentTags] = useState<DocumentTag[]>([]);
  const [availableDataSources, setAvailableDataSources] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingDataSources, setLoadingDataSources] = useState(false);
  const [availablePersonas, setAvailablePersonas] = useState<Persona[]>([]);
  const [selectedToolTagIds, setSelectedToolTagIds] = useState<number[]>([]);
  const [selectedDocumentTagIds, setSelectedDocumentTagIds] = useState<number[]>([]);
  const [selectedDataSourceIds, setSelectedDataSourceIds] = useState<string[]>([]);

  const isVersionMode = mode === 'version';
  const isEditMode = mode === 'edit';
  const requiresBasePersona = isVersionMode || isEditMode;
  const effectiveBasePersona = basePersona ?? selectedBasePersona;

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM_STATE);
    setSelectedToolTagIds([]);
    setSelectedDocumentTagIds([]);
    setSelectedDataSourceIds([]);
    setInheritedSystemPrompt('');
    setNextVersionNumber(null);
    setSetAsCurrentVersion(true);
    setSelectedBasePersona(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setSuccessFlash(false);
    }
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (basePersona) {
      setSelectedBasePersona(basePersona);
    } else if (!isOpen) {
      setSelectedBasePersona(null);
    }
  }, [basePersona, isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== 'create') return;

    let cancelled = false;
    personasApi
      .getDefaultSystemPrompt(formData.type)
      .then((apiDefault) => {
        if (cancelled || !apiDefault) return;
        setFormData((prev) =>
          prev.system_prompt ? prev : { ...prev, system_prompt: apiDefault }
        );
      })
      .catch((error: unknown) => {
        console.error('Error fetching default system prompt:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, formData.type]);

  useEffect(() => {
    if (!isOpen || mode !== 'version') return;

    personasApi
      .list({ limit: 100, offset: 0, roots_only: true })
      .then((res) => setAvailablePersonas(res.data ?? []))
      .catch(() => setAvailablePersonas([]));
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen || !requiresBasePersona || !effectiveBasePersona) {
      if (
        !effectiveBasePersona &&
        isVersionMode &&
        isOpen &&
        !basePersona
      ) {
        setFormData(EMPTY_FORM_STATE);
        setSelectedToolTagIds([]);
        setSelectedDocumentTagIds([]);
        setSelectedDataSourceIds([]);
        setInheritedSystemPrompt('');
        setNextVersionNumber(null);
      }
      return;
    }

    const rootId = getPersonaRootId(effectiveBasePersona);
    const versionId = getPersonaVersionId(effectiveBasePersona);
    setLoadingBasePersona(true);

    personasApi
      .getVersion(rootId, versionId)
      .then(async (p) => {
        const defaultModel = availableModels.find((m) => m.is_default);
        let sp = p.system_prompt ?? '';
        if (!sp) {
          try {
            const personaType = (p.type as 'chat' | 'dashboard') ?? 'chat';
            const apiDefault = await personasApi.getDefaultSystemPrompt(personaType);
            if (apiDefault) sp = apiDefault;
          } catch (error) {
            console.error('Error fetching default system prompt:', error);
          }
        }

        setInheritedSystemPrompt(p.system_prompt ?? '');
        const existingRules = isEditMode
          ? await rbacApi.toolRules.getRulesForPersona(rootId).catch(() => [])
          : [];
        setFormData({
          persona_name: p.persona_name ?? '',
          persona: p.persona_prompt ?? p.persona ?? '',
          model_id: p.model_id ?? defaultModel?.id ?? null,
          temperature: formatModelSettingValue(p.temperature),
          context_window_limit: formatModelSettingValue(p.context_window_limit),
          greeting_message: p.greeting_message ?? '',
          system_prompt: sp,
          type: (p.type as 'chat' | 'dashboard') ?? 'chat',
          supports_documents: p.supports_documents ?? false,
          toolRules: existingRules,
        });
        setSelectedToolTagIds(extractTagIds(p.tool_tags));
        setSelectedDocumentTagIds(extractTagIds(p.document_tags));
        setSelectedDataSourceIds(extractDataSourceIds(p));
        setNextVersionNumber(
          isVersionMode ? (p.version ?? 0) + 1 : null
        );
      })
      .catch(() => {
        setFormData(EMPTY_FORM_STATE);
        setSelectedToolTagIds([]);
        setSelectedDocumentTagIds([]);
        setSelectedDataSourceIds([]);
        setInheritedSystemPrompt('');
        setNextVersionNumber(null);
      })
      .finally(() => setLoadingBasePersona(false));
  }, [
    effectiveBasePersona,
    mode,
    isOpen,
    basePersona,
    availableModels,
    requiresBasePersona,
    isVersionMode,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (formData.type !== 'dashboard') return;

    const loadDataSources = async () => {
      setLoadingDataSources(true);
      try {
        const dataSources = await listDataSources({ includeSchema: false });
        const options = Object.entries(dataSources).map(([key, value]) => {
          const sourceId = String(value.id ?? value.source_id ?? key);
          const sourceName = value.datasource_name?.trim() || sourceId;
          return { id: sourceId, name: sourceName };
        });
        setAvailableDataSources(options);
      } catch (error) {
        console.error('Error loading global data sources:', error);
        setAvailableDataSources([]);
      } finally {
        setLoadingDataSources(false);
      }
    };

    void loadDataSources();
  }, [isOpen, formData.type]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const [models, types] = await Promise.all([
          personasApi.getModels(),
          rbacApi.toolRules.getTypes(),
        ]);
        if (!cancelled) {
          setAvailableModels(models);
          setRuleTypes(types);
        }
      } catch (error) {
        console.error('Error loading models:', error);
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    };

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadMetadata = async () => {
      try {
        const [toolTagsResponse, documentTagsResponse] = await Promise.all([
          rbacApi.tags.list({ limit: 1000, offset: 0 }),
          rbacApi.documentTags.list({ limit: 1000, offset: 0 }),
        ]);
        if (cancelled) return;
        if (toolTagsResponse.success) setAvailableToolTags(toolTagsResponse.data);
        if (documentTagsResponse.success) {
          setAvailableDocumentTags(documentTagsResponse.data);
        }
      } catch (error) {
        console.error('Error loading persona metadata:', error);
      }
    };

    void loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const toolTagNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    availableToolTags.forEach((tag) => {
      if (tag?.name) map[tag.id] = tag.name;
    });
    return map;
  }, [availableToolTags]);

  const documentTagNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    availableDocumentTags.forEach((tag) => {
      if (tag?.name) map[tag.id] = tag.name;
    });
    return map;
  }, [availableDocumentTags]);

  const toolTagOptions = useMemo(
    () =>
      availableToolTags
        .map((tag) => tag.name)
        .filter((name): name is string => Boolean(name)),
    [availableToolTags]
  );

  const documentTagOptions = useMemo(
    () =>
      availableDocumentTags
        .map((tag) => tag.name)
        .filter((name): name is string => Boolean(name)),
    [availableDocumentTags]
  );

  const availableToolsForRules = useMemo((): ToolRuleTool[] => {
    const selectedTags = availableToolTags.filter((t) =>
      selectedToolTagIds.includes(t.id)
    );
    const uniqueNames = new Set(selectedTags.flatMap((t) => t.tool_names));
    return Array.from(uniqueNames).map((name) => ({
      id: name,
      name,
      display_name: name,
    }));
  }, [availableToolTags, selectedToolTagIds]);

  const selectedToolTagNames = useMemo(
    () => selectedToolTagIds.map((id) => toolTagNameMap[id] || `Tag #${id}`),
    [selectedToolTagIds, toolTagNameMap]
  );

  const selectedDocumentTagNames = useMemo(
    () =>
      selectedDocumentTagIds.map((id) => documentTagNameMap[id] || `Tag #${id}`),
    [selectedDocumentTagIds, documentTagNameMap]
  );

  const dataSourceNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableDataSources.forEach(({ id, name }) => {
      map[id] = name;
    });
    return map;
  }, [availableDataSources]);

  const dataSourceDisplayToIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableDataSources.forEach(({ id, name }) => {
      map[name] = id;
    });
    return map;
  }, [availableDataSources]);

  const dataSourceOptions = useMemo(
    () => availableDataSources.map((ds) => ds.name),
    [availableDataSources]
  );

  const selectedDataSourceNames = useMemo(
    () => selectedDataSourceIds.map((id) => dataSourceNameMap[id] || id),
    [selectedDataSourceIds, dataSourceNameMap]
  );

  const modelDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableModels.forEach((model) => {
      map[model.display_name] = model.id;
    });
    return map;
  }, [availableModels]);

  const modelIdToDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableModels.forEach((model) => {
      map[model.id] = model.display_name;
    });
    return map;
  }, [availableModels]);

  const modelOptions = useMemo(
    () =>
      availableModels
        .map((m) => m.display_name)
        .filter((name): name is string => Boolean(name)),
    [availableModels]
  );

  const selectedModelDisplay = useMemo(
    () => (formData.model_id ? modelIdToDisplayMap[formData.model_id] || '' : ''),
    [formData.model_id, modelIdToDisplayMap]
  );

  const selectedModel = useMemo(
    () => availableModels.find((model) => model.id === formData.model_id) ?? null,
    [availableModels, formData.model_id]
  );

  const selectedModelMaxContextWindow = useMemo(() => {
    const value = selectedModel?.max_context_window;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }, [selectedModel]);

  const intelligenceValidation = useMemo(() => {
    if (!formData.model_id) {
      return { valid: false, reason: 'Select a model for this persona.' };
    }

    const temperatureText = formData.temperature.trim();
    if (!temperatureText) {
      return { valid: false, reason: 'Add a temperature between 0 and 2.' };
    }
    const temperature = Number(temperatureText);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      return { valid: false, reason: 'Temperature must be between 0 and 2.' };
    }

    const contextText = formData.context_window_limit.trim();
    if (!contextText) {
      return { valid: false, reason: 'Add a context window limit.' };
    }
    const contextWindowLimit = Number(contextText);
    if (!Number.isInteger(contextWindowLimit) || contextWindowLimit <= 0) {
      return {
        valid: false,
        reason: 'Context window limit must be a positive whole number.',
      };
    }
    if (
      selectedModelMaxContextWindow != null &&
      contextWindowLimit > selectedModelMaxContextWindow
    ) {
      return {
        valid: false,
        reason: `Context window limit cannot exceed ${selectedModelMaxContextWindow.toLocaleString()} for this model.`,
      };
    }

    return { valid: true };
  }, [
    formData.context_window_limit,
    formData.model_id,
    formData.temperature,
    selectedModelMaxContextWindow,
  ]);

  const stepValidation = useMemo<StepValidation>(() => {
    const basicsValid =
      (requiresBasePersona ? !!effectiveBasePersona : true) &&
      formData.persona_name.trim().length > 0;

    return {
      basics: {
        valid: basicsValid,
        reason: requiresBasePersona && !effectiveBasePersona
          ? 'Select a base persona to continue.'
          : 'Add a persona name to continue.',
      },
      identity: {
        valid: formData.persona.trim().length > 0,
        reason: 'Describe the persona behavior in the prompt.',
      },
      intelligence: intelligenceValidation,
      capabilities: { valid: true },
      review: {
        valid:
          basicsValid &&
          formData.persona.trim().length > 0 &&
          intelligenceValidation.valid,
        reason: 'Some required details are still missing.',
      },
    };
  }, [
    effectiveBasePersona,
    formData.persona,
    formData.persona_name,
    intelligenceValidation,
    requiresBasePersona,
  ]);

  const handleToolTagSelect = (value: string | string[]) => {
    const names = Array.isArray(value) ? value : [value];
    const ids = names
      .map((name) => availableToolTags.find((tag) => tag.name === name)?.id)
      .filter((id): id is number => typeof id === 'number');
    setSelectedToolTagIds(ids);
  };

  const handleDocumentTagSelect = (value: string | string[]) => {
    const names = Array.isArray(value) ? value : [value];
    const ids = names
      .map((name) => availableDocumentTags.find((tag) => tag.name === name)?.id)
      .filter((id): id is number => typeof id === 'number');
    setSelectedDocumentTagIds(ids);
  };

  const removeToolTag = (id: number) => {
    setSelectedToolTagIds((prev) => prev.filter((tagId) => tagId !== id));
  };

  const removeDocumentTag = (id: number) => {
    setSelectedDocumentTagIds((prev) => prev.filter((tagId) => tagId !== id));
  };

  const handleModelSelect = (value: string | string[]) => {
    const displayText = Array.isArray(value) ? value[0] : value;
    if (displayText) {
      const modelId = modelDisplayMap[displayText];
      setFormData((prev) => ({ ...prev, model_id: modelId || null }));
    } else {
      setFormData((prev) => ({ ...prev, model_id: null }));
    }
  };

  const handleDataSourceSelect = (value: string | string[]) => {
    const names = Array.isArray(value) ? value : [value];
    const ids = names
      .map((name) => dataSourceDisplayToIdMap[name])
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    setSelectedDataSourceIds(ids);
  };

  const removeDataSource = (id: string) => {
    setSelectedDataSourceIds((prev) => prev.filter((sourceId) => sourceId !== id));
  };

  const handleBasePersonaSelect = (value: string | string[]) => {
    const name = Array.isArray(value) ? value[0] : value;
    if (!name) {
      setSelectedBasePersona(null);
      return;
    }
    const p = availablePersonas.find(
      (x) => (x.persona_name ?? `Persona #${x.id}`) === name
    );
    setSelectedBasePersona(p ?? null);
  };

  const submitForm = async () => {
    const trimmedSystemPrompt = formData.system_prompt.trim();
    if (!formData.model_id) {
      notify.error('Select a model for this persona.');
      return;
    }

    const temperature = Number(formData.temperature.trim());
    const contextWindowLimit = Number(formData.context_window_limit.trim());
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      notify.error('Temperature must be between 0 and 2.');
      return;
    }
    if (!Number.isInteger(contextWindowLimit) || contextWindowLimit <= 0) {
      notify.error('Context window limit must be a positive whole number.');
      return;
    }
    if (
      selectedModelMaxContextWindow != null &&
      contextWindowLimit > selectedModelMaxContextWindow
    ) {
      notify.error(
        `Context window limit cannot exceed ${selectedModelMaxContextWindow.toLocaleString()} for this model.`
      );
      return;
    }

    if (requiresBasePersona && !effectiveBasePersona) {
      notify.error(
        isEditMode
          ? 'No persona selected to edit.'
          : 'Please select a persona to create a version from.'
      );
      return;
    }

    setLoading(true);

    const basePayload = {
      persona: formData.persona,
      greeting_message: formData.greeting_message || '',
      model_id: formData.model_id,
      temperature,
      context_window_limit: contextWindowLimit,
      tool_tag_ids: selectedToolTagIds,
      document_tag_ids: selectedDocumentTagIds,
      datasource_ids:
        formData.type === 'dashboard' ? selectedDataSourceIds : [],
      supports_documents: formData.supports_documents,
    };

    const nextSp = trimmedSystemPrompt;
    const inheritedTrim = inheritedSystemPrompt.trim();
    const systemPromptPatch =
      nextSp !== inheritedTrim
        ? { system_prompt: nextSp.length > 0 ? nextSp : null }
        : {};

    try {
      if (isEditMode && effectiveBasePersona) {
        const rootId = getPersonaRootId(effectiveBasePersona);
        const versionId = getPersonaVersionId(effectiveBasePersona);

        await personasApi.updateVersion(rootId, versionId, {
          ...basePayload,
          create_version: false,
          ...systemPromptPatch,
        });

        await rbacApi.toolRules.updateRulesForPersona(
          rootId,
          formData.toolRules
        );

        setSuccessFlash(true);
        await new Promise((r) => setTimeout(r, 700));
        resetForm();
        onSave();
        onClose();
      } else if (isVersionMode && effectiveBasePersona) {
        const rootId = getPersonaRootId(effectiveBasePersona);

        await personasApi.createVersion(rootId, {
          ...basePayload,
          set_as_current: setAsCurrentVersion,
          ...systemPromptPatch,
          ...(formData.toolRules.length > 0
            ? { tool_rules: formData.toolRules }
            : {}),
        });

        setSuccessFlash(true);
        await new Promise((r) => setTimeout(r, 700));
        resetForm();
        onSave();
        onClose();
      } else {
        const createPayload: CreatePersonaRequest = {
          ...basePayload,
          persona_name: formData.persona_name,
          type: formData.type ?? 'chat',
          ...(trimmedSystemPrompt ? { system_prompt: trimmedSystemPrompt } : {}),
          ...(formData.toolRules.length > 0
            ? { tool_rules: formData.toolRules }
            : {}),
        };

        const createdPersona = await personasApi.create(createPayload);
        setSuccessFlash(true);
        await new Promise((r) => setTimeout(r, 700));
        resetForm();
        onSave();
        onClose();
        if (onCreated && createdPersona?.id) {
          onCreated(
            createdPersona.id,
            createdPersona.persona_name || formData.persona_name
          );
        }
      }
    } catch (error) {
      console.error('Error saving persona:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to save persona';
      notify.error(message);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    successFlash,
    formData,
    setFormData,
    isVersionMode,
    isEditMode,
    requiresBasePersona,
    effectiveBasePersona,
    inheritedSystemPrompt,
    nextVersionNumber,
    setAsCurrentVersion,
    setSetAsCurrentVersion,
    loadingBasePersona,
    availableModels,
    loadingModels,
    ruleTypes,
    availableToolTags,
    availableDocumentTags,
    availableDataSources,
    loadingDataSources,
    availablePersonas,
    selectedToolTagIds,
    selectedDocumentTagIds,
    selectedDataSourceIds,
    toolTagNameMap,
    documentTagNameMap,
    toolTagOptions,
    documentTagOptions,
    availableToolsForRules,
    selectedToolTagNames,
    selectedDocumentTagNames,
    dataSourceNameMap,
    dataSourceOptions,
    selectedDataSourceNames,
    modelOptions,
    selectedModelDisplay,
    selectedModelMaxContextWindow,
    stepValidation,
    handleToolTagSelect,
    handleDocumentTagSelect,
    removeToolTag,
    removeDocumentTag,
    handleModelSelect,
    handleDataSourceSelect,
    removeDataSource,
    handleBasePersonaSelect,
    submitForm,
    showBasePersonaPicker: isVersionMode && !basePersona,
    basePersonaLocked: requiresBasePersona && !!basePersona,
  };
}

export type PersonaWizardForm = ReturnType<typeof usePersonaWizardForm>;
