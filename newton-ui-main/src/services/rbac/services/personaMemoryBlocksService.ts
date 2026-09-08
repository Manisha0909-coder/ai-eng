import { rbacRequest } from "../rbacClient";
import type {
  CreatePersonaMemoryBlockRequest,
  ListPersonaMemoryBlocksRequest,
  PaginatedResponse,
  PersonaMemoryBlock,
  UpdatePersonaMemoryBlockRequest,
} from "../types";

/** API nests persona under `persona.id` on list responses; flatten to `persona_id`. */
const withPersonaId = (block: PersonaMemoryBlock): PersonaMemoryBlock => {
  const nestedId = block.persona?.id;
  const pid =
    block.persona_id ?? (typeof nestedId === "number" ? nestedId : undefined);
  return pid !== undefined ? { ...block, persona_id: pid } : block;
};

export const personaMemoryBlocksApi = {
  list: async (
    params: ListPersonaMemoryBlocksRequest
  ): Promise<PaginatedResponse<PersonaMemoryBlock>> => {
    const body: Record<string, unknown> = {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    };
    if (params.persona_id != null) body.persona_id = params.persona_id;
    if (params.search?.trim()) body.search = params.search.trim();

    const data = await rbacRequest<any>("/shared-memory/list", {
      method: "POST",
      body,
    });
    const blocks = (data.blocks ?? data.data ?? []) as PersonaMemoryBlock[];
    return {
      success: data.success !== undefined ? data.success : true,
      data: blocks.map(withPersonaId),
      total: data.total ?? 0,
      limit: data.limit,
      offset: data.offset,
    };
  },

  create: async (
    blockData: CreatePersonaMemoryBlockRequest
  ): Promise<PersonaMemoryBlock> => {
    const data = await rbacRequest<{ block: PersonaMemoryBlock }>(
      "/shared-memory/create",
      { method: "POST", body: blockData }
    );
    return data.block;
  },

  update: async (
    personaId: number,
    blockId: string,
    updateData: UpdatePersonaMemoryBlockRequest
  ): Promise<PersonaMemoryBlock> => {
    const data = await rbacRequest<{ block: PersonaMemoryBlock }>(
      `/shared-memory/${personaId}/${blockId}`,
      { method: "PATCH", body: updateData }
    );
    return data.block;
  },

  delete: async (personaId: number, blockId: string): Promise<void> => {
    await rbacRequest(`/shared-memory/${personaId}/${blockId}`, {
      method: "DELETE",
    });
  },
};
