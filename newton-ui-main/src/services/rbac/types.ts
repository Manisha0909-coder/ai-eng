// ---------- Core entities ----------

export interface Tool {
  name: string;
  type: string;
  description: string;
  python_code?: string;
  created_at: string;
  updated_at: string;
  display_name?: string;
  envs?: Record<string, string>;
  reasoning_message?: string | null;
  server_name?: string;
  tool_icon?: string;
  tool_call_message?: string;
}

export interface Tag {
  id: number;
  name: string;
  tool_names: string[];
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  name: string;
  tag_names?: string[];
  description: string;
  document_tags?: Array<DocumentTag | number | string>;
  personas?: Array<Persona | number | string>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  user_id: string;
  roles: string[];
  unique_tags?: string[];
  unique_tools?: string[];
  created_at: string;
  updated_at: string;
  unique_doc_tags: string[];
}

export interface DocumentTag {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: number;
  persona_name: string;
  persona: string; // Legacy field, use persona_prompt if available
  persona_prompt?: string; // New field from API
  /** Per-version agent system instructions; null/omit → backend global default */
  system_prompt?: string | null;
  model_id?: string | null; // Model ID from Letta client
  temperature?: number;
  context_window_limit?: number;
  tool_tags?: Array<Tag | number | string>;
  document_tags?: Array<DocumentTag | number | string>;
  created_at: string;
  updated_at: string;
  greeting_message: string;
  type?: "chat" | "dashboard";
  supports_documents?: boolean;
  is_default?: boolean;
  version?: number;
  parent_persona_id?: number | null;
  current_version_id?: number | null;
  datasource_ids?: string[];
  data_sources?: Array<{ source_id?: string; id?: string } | string>;
  datasources?: Array<{ id: string; name: string }>;
  tool_rules?: ToolRuleItem[];
}

// ---------- Tools ----------

export interface CreateToolRequest {
  name: string;
  type: string;
  python_code: string;
  description: string;
}

export interface UpdateToolRequest {
  display_name?: string;
  tool_icon?: string;
  reasoning_message?: string | null;
  description?: string;
  envs?: Record<string, string>;
}

// ---------- Tags ----------

export interface CreateTagRequest {
  name: string;
  tool_names: string[];
  description: string;
}

export interface UpdateTagRequest {
  name?: string;
  description?: string;
  tool_names?: string[];
}

// ---------- Roles ----------

export interface CreateRoleRequest {
  name: string;
  description: string;
  document_tags: number[];
  persona_ids: number[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  document_tags?: number[];
  persona_ids?: number[];
}

// ---------- Users ----------

export interface CreateUserRequest {
  user_ids: string[];
  roles: string[];
}

export interface BulkCreateUsersResponse {
  success: boolean;
  message: string;
  total_processed: number;
  total_created: number;
  total_failed: number;
  results: Array<{
    user_id: string;
    success: boolean;
    message: string;
    user: User | null;
  }>;
}

export interface UpdateUserRequest {
  roles?: string[];
}

// ---------- Document tags ----------

export interface CreateDocumentTagRequest {
  name: string;
  description?: string;
}

export interface UpdateDocumentTagRequest {
  name?: string;
  description?: string;
}

// ---------- Persona memory blocks ----------

export interface PersonaMemoryBlock {
  persona_id?: number;
  block_id: string;
  label: string;
  description?: string;
  current_value?: string; // Read-only field from Letta API
  created_at: string;
  updated_at: string;
  /** Present on list responses when API returns nested persona */
  persona?: {
    id: number;
    persona_name: string;
  };
}

export interface CreatePersonaMemoryBlockRequest {
  persona_id: number;
  label: string;
  description?: string;
  value?: string; // Updates Letta only
  block_id?: string; // Auto-generated if not provided
}

export interface UpdatePersonaMemoryBlockRequest {
  label?: string;
  description?: string;
  value?: string;
}

export interface ListPersonaMemoryBlocksRequest {
  limit?: number;
  offset?: number;
  persona_id?: number;
  search?: string;
}

// ---------- Personas ----------

export interface CreatePersonaRequest {
  persona_name: string;
  persona: string; // Stored as persona_prompt in database
  model_id: string;
  temperature: number;
  context_window_limit: number;
  tool_tag_ids?: number[];
  document_tag_ids?: number[];
  datasource_ids?: string[];
  greeting_message?: string | null;
  supports_documents?: boolean;
  /** Omit or null → global default system prompt on agent */
  system_prompt?: string | null;
  type?: "chat" | "dashboard";
  /** Optional inline tool rules applied atomically on creation */
  tool_rules?: ToolRuleItem[];
}

export interface UpdatePersonaRequest {
  persona_name?: string;
  persona?: string;
  model_id?: string | null;
  temperature?: number;
  context_window_limit?: number;
  tool_tag_ids?: number[];
  document_tag_ids?: number[];
  datasource_ids?: string[];
  greeting_message?: string | null;
  supports_documents?: boolean;
  /** Send only when changing; null may clear depending on backend */
  system_prompt?: string | null;
  create_version?: boolean; // Default true.
  set_as_current?: boolean; // Default true.
  /** If provided, replaces all tool rules on the current version */
  tool_rules?: ToolRuleItem[];
}

/** Body for POST /personas/<id>/versions */
export interface CreatePersonaVersionRequest {
  persona?: string;
  model_id?: string | null;
  temperature?: number;
  context_window_limit?: number;
  greeting_message?: string;
  tool_tag_ids?: number[];
  document_tag_ids?: number[];
  datasource_ids?: string[];
  set_as_current?: boolean;
  supports_documents?: boolean;
  /** Omit to inherit from current version */
  system_prompt?: string | null;
  /** If provided, replaces the auto-copied rules from the previous version */
  tool_rules?: ToolRuleItem[];
}

export interface PersonaModel {
  id: string;
  name?: string;
  display_name: string;
  provider_type: string;
  provider_name?: string;
  max_context_window?: number | null;
  model_type?: string;
}

// ---------- Pagination ----------

export interface PaginatedRequest {
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  limit?: number;
  offset?: number;
}

/** POST /v1/tool_names/list */
export interface ListToolNamesRequest extends PaginatedRequest {
  search?: string;
  type?: string;
  tool_server?: string;
  created_from?: string;
  created_to?: string;
  /** Client hint; omitted from wire if backend ignores */
  isUserAdmin?: boolean;
}

/** POST /v1/tool-tags/list */
export interface ListToolTagsRequest extends PaginatedRequest {
  search?: string;
  tool_names?: string[];
  created_from?: string;
  created_to?: string;
}

/** POST /v1/roles/list */
export interface ListRolesRequest extends PaginatedRequest {
  search?: string;
  document_tag_ids?: number[];
  /** Filter roles linked to any of these persona IDs */
  persona_ids?: number[];
  created_from?: string;
  created_to?: string;
}

/** POST /v1/personas/list */
export interface ListPersonasParams extends PaginatedRequest {
  search?: string;
  /** Exact filter, e.g. `chat`, `api`, `dashboard` */
  type?: string;
  /** Default true — excludes version rows when true */
  roots_only?: boolean;
  created_from?: string;
  created_to?: string;
}

// ---------- Tool servers ----------

export interface ToolServer {
  id: number;
  name: string;
  url: string;
  type?: "custom" | "mcp-sse" | "mcp-http" | "mcp-stdio";
  envs?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface AttachToolServerRequest {
  name: string;
  url: string;
  type?: "custom" | "mcp-sse" | "mcp-http" | "mcp-stdio";
  envs?: Record<string, string>;
}

export interface AttachToolServerResponse {
  status: string;
  message: string;
  server: ToolServer;
  tools_synced: {
    total_successful: number;
    total_failed: number;
    successful: string[];
    failed: string[];
  };
}

export interface DetachToolServerRequest {
  name: string;
}

export interface UpdateToolServerRequest {
  current_name: string;
  new_name?: string;
  url?: string;
  type?: "custom" | "mcp-sse" | "mcp-http" | "mcp-stdio";
  envs?: Record<string, string>;
}

export interface UpdateToolServerResponse {
  status: string;
  message: string;
  server: ToolServer;
}

export interface DetachToolServerResponse {
  status: string;
  message: string;
  tools_deleted: {
    status: string;
    message: string;
    total_deleted: number;
    deleted_tools: string[];
    failed_deletions: string[];
    tags_updated: number;
    users_updated: number;
    automatic_tag_deleted: boolean;
  };
}

export interface SyncToolServerRequest {
  name: string;
}

export interface SyncToolServerResponse {
  status: string;
  message: string;
  sync_result: {
    total_successful: number;
    total_failed: number;
    successful: string[];
    failed: string[];
  };
}

export interface HealthCheckToolServerRequest {
  server_name: string;
}

export interface HealthCheckToolServerResponse {
  status: "success" | "error";
  message: string;
  error: string | null;
  server_name: string;
  server_url: string;
  health_status: number;
  health_response: Record<string, any>;
}

// ---------- Admin users ----------

/** Admin user row shown on card list from GET /admin/users/list; directory detail from /users/list. */
export interface AdminUser {
  id: string;
  user_name: string;
  email: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  state: string | null;
  roles: string[];
  added_at: string;
  updated_at: string | null;
}

/** Raw row from GET /v1/admin/users/list. Mapped to `AdminUser` in the service. */
export interface AdminUsersListApiRow {
  id: number | string;
  user_id?: string;
  user_name: string;
  email: string;
  display_name?: string;
  added_at: string;
  updated_at: string | null;
  is_super_admin: boolean;
  is_user_admin: boolean;
  is_system_admin: boolean;
}

export interface BulkAssignAdminRoleRequest {
  emails: string[];
  role: string | null;
}

export interface BulkAssignAdminRoleResponse {
  success: boolean;
  message: string;
  total_processed: number;
  total_updated: number;
  total_failed: number;
  results: Array<{
    id: string;
    success: boolean;
    message: string;
    action: string;
  }>;
}

export interface ListAdminUsersRequest {
  limit?: number;
  offset?: number;
  /** Server-side search (display name; API may match other fields too). */
  search?: string;
  /** Optional single-role filter, e.g. user_admin (sent as `role` query if set). */
  role?: string;
}

// ---------- Personal doc tags ----------

export interface PersonalDocTag {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePersonalDocTagRequest {
  name: string;
  description?: string;
}

export interface UpdatePersonalDocTagRequest {
  name?: string;
  description?: string;
}

// ---------- Documents ----------

export interface DocumentFile {
  id?: number;
  document_id?: number;
  name?: string;
  file_format?: string;
  is_private?: boolean;
  user_id?: string;
  status?: number;
  has_failed?: boolean;
  created_at?: string;
  updated_at?: string;
  chunks_count?: number;
  file_size?: number | null;
  title?: string;
  description?: string;
  personal_doc_tag?: PersonalDocTag | null;
  personal_doc_tags?: PersonalDocTag[];
}

export interface ListDocumentsParams {
  limit?: number;
  offset?: number;
  search?: string;
  file_format?: string;
  has_failed?: boolean;
  status?: number;
  /** Server may filter documents with status strictly less than this value. */
  status_lt?: number;
  sort_by?: "created_at" | "updated_at" | "name" | "file_size" | "status" | "file_format";
  sort_order?: "asc" | "desc";
}

export interface ListDocumentsResponse {
  documents: DocumentFile[];
  /** Back-compat: some callers still read `count`. Prefer `total`. */
  count?: number;
  total: number;
  limit?: number;
  offset?: number;
}

export interface UploadDocumentRequest {
  file: File;
  title?: string;
  description?: string;
  doc_tag_ids?: number[]; // For admin/public documents
  personal_doc_tag_ids?: number[]; // For private documents
}

export interface FileMetadata {
  doc_desc: string;
  tag_ids: number[];
}

export interface BatchUploadDocumentRequest {
  files: File[]; // Multiple files (max 5)
  doc_tag_ids?: number[];
  personal_doc_tag_ids?: number[];
  metadata: FileMetadata[];
}

export interface UpdateDocumentRequest {
  name?: string;
  doc_desc?: string;
  doc_tag_ids?: number[];
  personal_doc_tag_ids?: number[];
}

export interface UploadDocumentResponse {
  document_id?: number;
  id?: number;
  status?: number;
  name?: string;
}

// ---------- Tool rules ----------

export interface ToolRuleItem {
  tool_name: string;
  type: string;
  children?: string[];
  child_output_mapping?: Record<string, string>;
  default_child?: string;
  require_output_mapping?: boolean;
  max_count_limit?: number;
  args?: Record<string, any>;
}

export interface ToolRuleTool {
  id: string;
  name: string;
  display_name: string;
  tool_icon?: string;
}
