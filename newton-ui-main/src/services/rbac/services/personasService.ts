import { rbacRequest } from "../rbacClient";
import type {
  CreatePersonaRequest,
  CreatePersonaVersionRequest,
  ListPersonasParams,
  PaginatedResponse,
  Persona,
  PersonaModel,
  UpdatePersonaRequest,
} from "../types";

interface BulkAttachRolesResponse {
  total_processed: number;
  total_succeeded: number;
  total_failed: number;
  results: Array<{
    role_id: number;
    success: boolean;
    message: string;
  }>;
}

/** API may return the persona under any of these keys depending on endpoint. */
const extractPersona = (data: any): Persona =>
  (data.persona ?? data.version ?? data.data ?? data) as Persona;

export const personasApi = {
  create: async (personaData: CreatePersonaRequest): Promise<Persona> => {
    const data = await rbacRequest<any>("/personas/", {
      method: "POST",
      body: personaData,
    });
    return extractPersona(data);
  },

  /** persona_id = root identity; version_id = version row id from getVersions */
  getVersion: async (personaId: number, versionId: number): Promise<Persona> => {
    const data = await rbacRequest<any>(
      `/personas/${personaId}/versions/${versionId}`
    );
    return extractPersona(data);
  },

  list: async (params: ListPersonasParams): Promise<PaginatedResponse<Persona>> => {
    const body: Record<string, unknown> = {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      roots_only: params.roots_only ?? true,
    };
    if (params.search?.trim()) body.search = params.search.trim();
    if (params.type?.trim()) body.type = params.type.trim();
    if (params.created_from) body.created_from = params.created_from;
    if (params.created_to) body.created_to = params.created_to;

    const data = await rbacRequest<any>("/personas/list", {
      method: "POST",
      body,
    });
    const personas: Persona[] = data.personas ?? data.data ?? [];
    return {
      success: typeof data.success === "boolean" ? data.success : true,
      data: personas,
      total: data.total ?? data.count ?? 0,
      limit: data.limit,
      offset: data.offset,
    };
  },

  updateVersion: async (
    personaId: number,
    versionId: number,
    updateData: UpdatePersonaRequest
  ): Promise<Persona> => {
    const data = await rbacRequest<any>(
      `/personas/${personaId}/versions/${versionId}`,
      { method: "PATCH", body: updateData }
    );
    return extractPersona(data);
  },

  /** Create a new version by copying the current one (optional body overrides). */
  createVersion: async (
    personaId: number,
    body?: CreatePersonaVersionRequest
  ): Promise<Persona> => {
    const data = await rbacRequest<any>(`/personas/${personaId}/versions`, {
      method: "POST",
      body: body ?? {},
    });
    return extractPersona(data);
  },

  /** Get all versions of a persona (for admin version history UI). */
  getVersions: async (
    personaId: number
  ): Promise<{
    success: boolean;
    data: Persona[];
    total: number;
    current_version_id?: number;
  }> => {
    const data = await rbacRequest<any>(`/personas/${personaId}/versions`);
    const versions: Persona[] = data.versions ?? data.personas ?? data.data ?? [];
    return {
      success: true,
      data: versions,
      total: data.total ?? versions.length,
      current_version_id: data.current_version_id,
    };
  },

  /** Pass the version's persona_id to set that version as current. */
  setCurrent: async (personaId: number): Promise<void> => {
    await rbacRequest(`/personas/${personaId}/set_current`, { method: "POST" });
  },

  /**
   * Delete a specific version.
   * Not current → only that version deleted; current + others → 403;
   * current + only → whole persona deleted.
   */
  deleteVersion: async (
    personaId: number,
    versionId: number
  ): Promise<{ success: boolean; message?: string }> => {
    const data = await rbacRequest<any>(
      `/personas/${personaId}/versions/${versionId}`,
      { method: "DELETE" }
    );
    return {
      success: true,
      message: typeof data?.message === "string" ? data.message : undefined,
    };
  },

  /** DELETE /personas/{id} — removes the persona and all its versions. */
  deletePersona: async (
    personaId: number
  ): Promise<{ success: boolean; message?: string }> => {
    const data = await rbacRequest<any>(`/personas/${personaId}`, {
      method: "DELETE",
    });
    return {
      success: true,
      message: typeof data?.message === "string" ? data.message : undefined,
    };
  },

  /** PATCH /personas/{id}/rename — rename a persona root (Admin Only). */
  renamePersona: async (
    personaId: number,
    personaName: string
  ): Promise<{ success: boolean; persona?: Persona; message?: string }> => {
    const data = await rbacRequest<any>(`/personas/${personaId}/rename`, {
      method: "PATCH",
      body: { persona_name: personaName },
    });
    return {
      success: typeof data?.success === "boolean" ? data.success : true,
      persona: (data.persona ?? data.data) as Persona | undefined,
      message: typeof data?.message === "string" ? data.message : undefined,
    };
  },

  bulkAttachRoles: async (
    personaId: number,
    roleIds: number[]
  ): Promise<BulkAttachRolesResponse> => {
    return rbacRequest<BulkAttachRolesResponse>(
      `/personas/${personaId}/bulk_attach_roles`,
      { method: "POST", body: { role_ids: roleIds } }
    );
  },

  bulkDelete: async (personaIds: number[]): Promise<void> => {
    await rbacRequest("/personas/bulk_delete", {
      method: "POST",
      body: { persona_ids: personaIds },
    });
  },

  getModels: async (): Promise<PersonaModel[]> => {
    const data = await rbacRequest<{ models?: PersonaModel[] }>("/personas/models");
    return data.models || [];
  },

  /** Returns `null` on any failure — callers treat absence as "use whatever the backend default is". */
  getDefaultSystemPrompt: async (
    personaType: string = "chat"
  ): Promise<string | null> => {
    try {
      const data = await rbacRequest<{
        system_prompt?: string | null;
        dashboard_system_prompt?: string | null;
      }>("/prompts/");
      const isDashboard =
        typeof personaType === "string" &&
        personaType.trim().toLowerCase() === "dashboard";
      if (isDashboard) {
        return data.dashboard_system_prompt ?? null;
      }
      return data.system_prompt ?? null;
    } catch (error) {
      console.error("Error fetching default system prompt:", error);
      return null;
    }
  },
};
