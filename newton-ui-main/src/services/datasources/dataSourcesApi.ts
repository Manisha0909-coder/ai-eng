import { API_CONFIG } from "../../config/api";
import { unwrapEnvelope, throwEnvelopeErrorFromResponse } from "../api/envelope";

const BASE = API_CONFIG.DASHBOARD_API_BASE_URL;

export interface DataSourceColumn {
  name: string;
  type: string;
}

export type DataSourceKind = "csv" | "api" | "postgresql";

export interface DataSourceDefinition {
  source_id?: string;
  id?: string;
  datasource_name?: string;
  kind?: DataSourceKind | string;
  description?: string;
  persona_id?: number;

  // Kind-specific fields (may be missing from list endpoint)
  path?: string; // csv
  url?: string; // api
  db_user?: string;
  db_password?: string;
  db_host?: string;
  db_port?: string;
  db_name?: string;

  // Column schema (normalized to a flat array for the UI)
  schema?: DataSourceColumn[];
}

export type DataSourcesResponse = Record<string, DataSourceDefinition>;

export interface DataSourcePreviewResponse {
  source_id?: string;
  total_rows: number;
  preview_rows: number;
  data: Record<string, unknown>[];
  table_name?: string;
  columns?: string[];
  /** Column name → type string (e.g. `"integer"`, `"string"`) */
  schema?: Record<string, string>;
  datasource_name?: string;
  kind?: string;
}

export type ExplorePostgreSQLResponse = {
  kind: "postgresql";
  datasource_name?: string;
  tables: string[];
};

export type ExploreCSVResponse = {
  kind: "csv";
  datasource_name?: string;
  schema: Record<string, string>;
};

export type ExploreDataSourceResponse = ExplorePostgreSQLResponse | ExploreCSVResponse;

/**
 * Fetch tables (postgresql) or column schema (csv) for a data source.
 * Call when the user selects a source — see Data Source UI integration guide.
 */
export async function exploreDataSource(sourceId: string): Promise<ExploreDataSourceResponse> {
  const url = `${BASE}/api/data-sources/${encodeURIComponent(sourceId)}/explore`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Data source "${sourceId}" not found.`);
    }
    if (res.status === 500) {
      const body = await res.json().catch(() => ({}));
      const detail = (body as { detail?: string })?.detail;
      throw new Error(detail || "Server error exploring data source.");
    }
    throw new Error(`Failed to explore data source: ${res.status}`);
  }
  const json = unwrapEnvelope<Record<string, unknown>>(await res.json());
  const kind = json.kind;
  if (kind === "postgresql") {
    const tables = Array.isArray(json.tables) ? (json.tables as string[]) : [];
    return {
      kind: "postgresql",
      datasource_name: json.datasource_name as string | undefined,
      tables,
    };
  }
  if (kind === "csv") {
    const rawSchema = json.schema;
    const schema: Record<string, string> =
      rawSchema && typeof rawSchema === "object" && !Array.isArray(rawSchema)
        ? (rawSchema as Record<string, string>)
        : {};
    return {
      kind: "csv",
      datasource_name: json.datasource_name as string | undefined,
      schema,
    };
  }
  throw new Error("Unexpected explore response: missing or unknown kind.");
}

export interface ListDataSourcesResponse {
  sources: DataSourcesResponse;
  total: number;
  limit: number;
  offset: number;
}

type RawSchema =
  | Array<{
      name?: string;
      type?: string;
      column_name?: string;
      data_type?: string;
    }>
  | Record<string, unknown>
  | null
  | undefined;

function normalizeSchema(rawSchema: RawSchema): DataSourceColumn[] {
  if (!rawSchema) return [];

  // Backend might already return an array of columns.
  if (Array.isArray(rawSchema)) {
    return rawSchema
      .map((col) => ({
        name: col.name ?? col.column_name ?? "",
        type: col.type ?? (col as any).data_type ?? "",
      }))
      .filter((c) => c.name);
  }

  // Flat dict form: { "column_name": "type" }
  if (typeof rawSchema === "object") {
    const entries = Object.entries(rawSchema);
    if (entries.length === 0) return [];

    // Nested db schema form: { table_name: { column_name: "type" } }
    const isNested = entries.every(
      ([, v]) => v != null && typeof v === "object" && !Array.isArray(v)
    );
    if (isNested) {
      const cols: DataSourceColumn[] = [];
      for (const [tableName, tableColsRaw] of entries) {
        if (tableColsRaw == null || typeof tableColsRaw !== "object") continue;
        for (const [colName, typeRaw] of Object.entries(
          tableColsRaw as Record<string, unknown>
        )) {
          cols.push({
            name: `${tableName}.${colName}`,
            type: typeRaw == null ? "" : String(typeRaw),
          });
        }
      }
      return cols.filter((c) => c.name);
    }

    // Generic flat form (values are usually type strings)
    return entries
      .map(([colName, typeRaw]) => ({
        name: colName,
        type: typeRaw == null ? "" : String(typeRaw),
      }))
      .filter((c) => c.name);
  }

  return [];
}

function normalizeDataSourcesPayload(payload: any): DataSourcesResponse {
  // Expected: { "<source_id>": { ...schema, description } }
  // But be defensive: sometimes it can be an array or nested under `data`.
  const asArray: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.sources)
      ? payload.sources
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  if (asArray.length > 0) {
    const record: DataSourcesResponse = {};
    for (const item of asArray) {
      const id =
        item?.source_id ?? item?.id ?? item?.datasource_id ?? item?.uuid;
      if (!id) continue;
      record[String(id)] = {
        ...item,
        source_id: item?.source_id ?? item?.id ?? String(id),
        schema: normalizeSchema(item?.schema),
      };
    }
    return record;
  }

  if (
    payload &&
    typeof payload === "object" &&
    payload.sources != null &&
    typeof payload.sources === "object" &&
    !Array.isArray(payload.sources)
  ) {
    const record: DataSourcesResponse = {};
    for (const [key, value] of Object.entries(
      payload.sources as Record<string, any>
    )) {
      if (value == null || typeof value !== "object") continue;
      const maybeId = (value as any)?.source_id ?? (value as any)?.id ?? key;
      record[key] = {
        ...value,
        source_id:
          (value as any)?.source_id ?? (value as any)?.id ?? String(maybeId),
        schema: normalizeSchema((value as any)?.schema),
      };
    }
    return record;
  }

  const METADATA_KEYS = new Set([
    "sources",
    "data",
    "total",
    "limit",
    "offset",
    "detail",
    "message",
  ]);

  const record: DataSourcesResponse = {};
  if (payload && typeof payload === "object") {
    for (const [key, value] of Object.entries(payload as Record<string, any>)) {
      if (METADATA_KEYS.has(key)) continue;
      if (value == null || typeof value !== "object" || Array.isArray(value))
        continue;
      const maybeId = (value as any)?.source_id ?? (value as any)?.id ?? key;
      record[key] = {
        ...value,
        source_id:
          (value as any)?.source_id ?? (value as any)?.id ?? String(maybeId),
        schema: normalizeSchema((value as any)?.schema),
      };
    }
  }
  return record;
}

/**
 * List all data sources scoped to a persona.
 * Use include_schema=true to get column names and types.
 */
export async function listDataSourcesWithMeta(
  options?: {
    includeSchema?: boolean;
    personaId?: number;
    limit?: number;
    offset?: number;
    search?: string;
    kind?: "csv" | "postgresql";
    /** Server: `datasource_name` | `kind` | `created_at` */
    sort_by?: string;
    sort_order?: "asc" | "desc";
  }
): Promise<ListDataSourcesResponse> {
  const params = new URLSearchParams();
  params.set("include_schema", options?.includeSchema === true ? "true" : "false");
  if (options?.personaId != null) {
    params.set("persona_id", String(options.personaId));
  }
  if (options?.limit != null) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset != null) {
    params.set("offset", String(options.offset));
  }
  if (options?.search?.trim()) {
    params.set("search", options.search.trim());
  }
  if (options?.kind) {
    params.set("kind", options.kind);
  }
  if (options?.sort_by?.trim()) {
    params.set("sort_by", options.sort_by.trim());
  }
  if (options?.sort_order === "asc" || options?.sort_order === "desc") {
    params.set("sort_order", options.sort_order);
  }
  const query = params.toString() ? `?${params.toString()}` : "";

  // Persona-scoped reads: /me. Admin/global reads: /global.
  const urlMe = `${BASE}/api/data-sources/me${query}`;
  const urlGlobal = `${BASE}/api/data-sources/global${query}`;
  const urlDefault = `${BASE}/api/data-sources/default${query}`;
  const urlLegacy = `${BASE}/api/data-sources${query}`;

  const fetchJson = async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 404) throw new Error("not_found");
      if (res.status === 500) {
        const body = await res.json().catch(() => ({}));
        const detail = (body as { detail?: string })?.detail;
        throw new Error(detail || "Server error loading data sources.");
      }
      throw new Error(`Failed to load data sources: ${res.status}`);
    }
    return unwrapEnvelope<Record<string, unknown>>(await res.json());
  };

  let payload: any;
  if (options?.personaId != null) {
    try {
      payload = await fetchJson(urlMe);
    } catch (err: any) {
      if (err?.message === "not_found") {
        try {
          payload = await fetchJson(urlDefault);
        } catch (fallbackErr: any) {
          if (fallbackErr?.message === "not_found") {
            payload = await fetchJson(urlLegacy);
          } else {
            throw fallbackErr;
          }
        }
      } else {
        throw err;
      }
    }
  } else {
    try {
      payload = await fetchJson(urlGlobal);
    } catch (err: any) {
      if (err?.message === "not_found") {
        try {
          payload = await fetchJson(urlDefault);
        } catch (fallbackErr: any) {
          if (fallbackErr?.message === "not_found") {
            payload = await fetchJson(urlLegacy);
          } else {
            throw fallbackErr;
          }
        }
      } else {
        throw err;
      }
    }
  }

  const normalizedSources = normalizeDataSourcesPayload(payload);

  const fallbackLimit = options?.limit ?? 50;
  const fallbackOffset = options?.offset ?? 0;
  const total =
    typeof payload?.total === "number"
      ? payload.total
      : Object.keys(normalizedSources).length;
  const limit =
    typeof payload?.limit === "number"
      ? payload.limit
      : fallbackLimit;
  const offset =
    typeof payload?.offset === "number"
      ? payload.offset
      : fallbackOffset;

  return {
    sources: normalizedSources,
    total,
    limit,
    offset,
  };
}

export async function listDataSources(
  options?: {
    includeSchema?: boolean;
    personaId?: number;
    limit?: number;
    offset?: number;
    search?: string;
    kind?: "csv" | "postgresql";
    sort_by?: string;
    sort_order?: "asc" | "desc";
  }
): Promise<DataSourcesResponse> {
  const response = await listDataSourcesWithMeta(options);
  return response.sources;
}

export type CreateDataSourceRequest = {
  datasource_name: string;
  kind: DataSourceKind;
  persona_id?: number;
  description?: string;
  // kind-specific required fields
  file?: File; // csv
  db_user?: string; // postgresql
  db_password?: string; // postgresql
  db_host?: string; // postgresql
  db_port?: string; // postgresql
  db_name?: string; // postgresql
  url?: string; // api
};

export type UpdateDataSourceRequest = Partial<CreateDataSourceRequest>;

export async function createDataSource(
  data: CreateDataSourceRequest
): Promise<any> {
  const isCsvUpload = data.kind === "csv" && data.file instanceof File;
  const url = isCsvUpload
    ? `${BASE}/api/data-sources/csv`
    : `${BASE}/api/data-sources`;
  const requestInit: RequestInit = isCsvUpload
    ? {
        method: "POST",
        credentials: "include",
      }
    : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      };

  if (isCsvUpload) {
    const formData = new FormData();
    formData.append("file", data.file as File);
    formData.append("datasource_name", data.datasource_name);
    if (data.description) formData.append("description", data.description);
    requestInit.body = formData;
  }

  const res = await fetch(url, requestInit);

  if (!res.ok) {
    await throwEnvelopeErrorFromResponse(res, {
      silent: true,
      fallbackMessage: "Failed to create data source.",
    });
  }

  const body = await res.json().catch(() => ({}));
  return unwrapEnvelope(body, { method: "post" });
}

export async function updateDataSource(
  sourceId: string,
  data: UpdateDataSourceRequest
): Promise<any> {
  const res = await fetch(
    `${BASE}/api/data-sources/${encodeURIComponent(sourceId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    }
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Data source "${sourceId}" not found.`);
    if (res.status === 500) {
      const body = await res.json().catch(() => ({}));
      const detail = (body as { detail?: string })?.detail;
      throw new Error(detail || "Server error updating data source.");
    }
    throw new Error(`Failed to update data source: ${res.status}`);
  }

  const body = await res.json().catch(() => ({}));
  return unwrapEnvelope(body, { method: "put" });
}

export async function deleteDataSource(sourceId: string): Promise<void> {
  const res = await fetch(
    `${BASE}/api/data-sources/${encodeURIComponent(sourceId)}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Data source "${sourceId}" not found.`);
    if (res.status === 500) {
      const body = await res.json().catch(() => ({}));
      const detail = (body as { detail?: string })?.detail;
      throw new Error(detail || "Server error deleting data source.");
    }
    throw new Error(`Failed to delete data source: ${res.status}`);
  }

  const body = await res.json().catch(() => ({}));
  unwrapEnvelope(body, { method: "delete" });
}

/**
 * Fetch preview rows for a data source.
 * Supports server-side pagination via limit and offset.
 */
export async function getDataSourcePreview(
  sourceId: string,
  options: { tableName?: string; limit?: number; offset?: number } = {}
): Promise<DataSourcePreviewResponse> {
  const params = new URLSearchParams();
  if (options.limit != null) {
    params.set("limit", String(options.limit));
  }
  if (options.offset != null) {
    params.set("offset", String(options.offset));
  }
  const tableName = options.tableName?.trim();
  const postgresUrl = tableName
    ? `${BASE}/api/data-sources/${encodeURIComponent(sourceId)}/db/${encodeURIComponent(tableName)}/preview${
        params.toString() ? `?${params.toString()}` : ""
      }`
    : null;
  const legacyUrl = `${BASE}/api/data-sources/${encodeURIComponent(sourceId)}/preview${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const fetchPreview = async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 404) throw new Error("not_found");
      if (res.status === 500) {
        const body = await res.json().catch(() => ({}));
        const detail = (body as { detail?: string })?.detail;
        throw new Error(detail || "Server error loading preview.");
      }
      throw new Error(`Failed to load preview: ${res.status}`);
    }
    return unwrapEnvelope<DataSourcePreviewResponse>(await res.json());
  };

  try {
    if (postgresUrl) {
      return await fetchPreview(postgresUrl);
    }
    return await fetchPreview(legacyUrl);
  } catch (err: any) {
    // Backward compatibility: if one endpoint is unavailable, try the other.
    if (err?.message === "not_found" && postgresUrl) {
      return fetchPreview(legacyUrl);
    }
    if (err?.message === "not_found" && !postgresUrl) {
      throw new Error(`Data source "${sourceId}" not found.`);
    }
    throw err;
  }
}
