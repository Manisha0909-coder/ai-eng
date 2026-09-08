import { useCallback, useEffect, useRef, useState } from 'react';
import { personasApi, type Persona } from '@/services/rbac/rbacApi';

interface UsePersonaVersionsOptions {
  persona: Persona;
  enabled?: boolean;
}

export function usePersonaVersions({ persona, enabled = true }: UsePersonaVersionsOptions) {
  const [versions, setVersions] = useState<Persona[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const fetchGenerationRef = useRef(0);

  const rootId = persona.parent_persona_id ?? persona.id;
  const effectiveCurrentId =
    currentVersionId ??
    (persona.parent_persona_id != null ? persona.id : undefined) ??
    persona.current_version_id ??
    undefined;

  const fetchVersions = useCallback(async () => {
    const generation = ++fetchGenerationRef.current;
    setLoading(true);
    try {
      const { data, current_version_id } = await personasApi.getVersions(rootId);
      if (generation !== fetchGenerationRef.current) return;
      setVersions(data);
      const resolvedCurrentId = current_version_id ?? undefined;
      setCurrentVersionId(resolvedCurrentId);
      return resolvedCurrentId;
    } catch (err) {
      if (generation !== fetchGenerationRef.current) return;
      console.error('Failed to fetch persona versions:', err);
      setVersions([]);
      return undefined;
    } finally {
      if (generation === fetchGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [rootId]);

  useEffect(() => {
    if (!enabled) {
      fetchGenerationRef.current += 1;
      return;
    }
    void fetchVersions();
    return () => {
      fetchGenerationRef.current += 1;
    };
  }, [enabled, fetchVersions]);

  const versionsWithCurrent =
    persona.parent_persona_id != null && !versions.some((v) => v.id === persona.id)
      ? [persona, ...versions]
      : versions;
  const allVersions = [...versionsWithCurrent].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

  return {
    allVersions,
    loading,
    effectiveCurrentId,
    fetchVersions,
  };
}
