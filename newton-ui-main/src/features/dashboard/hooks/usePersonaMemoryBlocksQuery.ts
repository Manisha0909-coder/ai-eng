import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rbacApi,
  type PersonaMemoryBlock,
  type CreatePersonaMemoryBlockRequest,
  type UpdatePersonaMemoryBlockRequest,
  type PaginatedResponse,
} from "@/services/rbac/rbacApi";
import notify from "@/utils/notify";

interface UsePersonaMemoryBlocksQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  personaId?: number | null;
  enabled?: boolean;
}

export const PERSONA_MEMORY_BLOCKS_QUERY_KEY = "dashboard-persona-memory-blocks";

export function usePersonaMemoryBlocksQuery({
  page,
  pageSize,
  search,
  personaId,
  enabled = true,
}: UsePersonaMemoryBlocksQueryParams) {
  return useQuery({
    queryKey: [PERSONA_MEMORY_BLOCKS_QUERY_KEY, page, pageSize, search, personaId],
    queryFn: async (): Promise<PaginatedResponse<PersonaMemoryBlock>> => {
      const offset = (page - 1) * pageSize;
      const params: any = {
        limit: pageSize,
        offset,
        ...(personaId != null && { persona_id: personaId }),
      };
      if (search && search.trim().length > 0) {
        params.search = search.trim();
      }
      return rbacApi.personaMemoryBlocks.list(params);
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreatePersonaMemoryBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePersonaMemoryBlockRequest) =>
      rbacApi.personaMemoryBlocks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PERSONA_MEMORY_BLOCKS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useUpdatePersonaMemoryBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      personaId,
      blockId,
      data,
    }: {
      personaId: number;
      blockId: string;
      data: UpdatePersonaMemoryBlockRequest;
    }) => rbacApi.personaMemoryBlocks.update(personaId, blockId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PERSONA_MEMORY_BLOCKS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useDeletePersonaMemoryBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ personaId, blockId }: { personaId: number; blockId: string }) =>
      rbacApi.personaMemoryBlocks.delete(personaId, blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PERSONA_MEMORY_BLOCKS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}
