/**
 * RBAC / Admin Dashboard service barrel.
 *
 * The implementation lives in `./services/*Service.ts`, the shared fetch
 * wrapper in `./rbacClient.ts`, and all DTOs/entities in `./types.ts`.
 * This file re-exports the full public API under its historical names so
 * callers can keep importing from `@/services/rbac/rbacApi` unchanged.
 */

export * from "./types";

export { toolNamesApi } from "./services/toolsService";
export { tagsApi } from "./services/tagsService";
export { rolesApi } from "./services/rolesService";
export { usersApi } from "./services/usersService";
export { personasApi } from "./services/personasService";
export { documentTagsApi } from "./services/documentTagsService";
export { toolServersApi } from "./services/toolServersService";
export { personalDocTagsApi } from "./services/personalDocTagsService";
export { documentsApi } from "./services/documentsService";
export { personaMemoryBlocksApi } from "./services/personaMemoryBlocksService";
export { adminUsersApi } from "./services/adminUsersService";
export { toolRulesApi } from "./services/toolRulesService";

import { toolNamesApi } from "./services/toolsService";
import { tagsApi } from "./services/tagsService";
import { rolesApi } from "./services/rolesService";
import { usersApi } from "./services/usersService";
import { personasApi } from "./services/personasService";
import { documentTagsApi } from "./services/documentTagsService";
import { toolServersApi } from "./services/toolServersService";
import { personalDocTagsApi } from "./services/personalDocTagsService";
import { documentsApi } from "./services/documentsService";
import { personaMemoryBlocksApi } from "./services/personaMemoryBlocksService";
import { adminUsersApi } from "./services/adminUsersService";
import { toolRulesApi } from "./services/toolRulesService";

export const rbacApi = {
  tools: toolNamesApi,
  tags: tagsApi,
  roles: rolesApi,
  users: usersApi,
  personas: personasApi,
  documentTags: documentTagsApi,
  toolServers: toolServersApi,
  personaMemoryBlocks: personaMemoryBlocksApi,
  personalDocTags: personalDocTagsApi,
  documents: documentsApi,
  adminUsers: adminUsersApi,
  toolRules: toolRulesApi,
};
