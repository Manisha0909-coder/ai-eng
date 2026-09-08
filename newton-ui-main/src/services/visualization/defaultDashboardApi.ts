import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";

export interface DefaultDashboardChart {
  id?: number | string;
  name?: string;
  row?: number | null;
  col?: number | null;
  rowspan?: number;
  colspan?: number;
  width?: number | null;
  height?: number | null;
  plotly_data_config?: {
    data?: unknown[];
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
  };
}

export interface DefaultDashboardResponse {
  plotly_config_json?: DefaultDashboardChart[];
  graphs?: DefaultDashboardChart[];
  html?: string;
  plotly_json_config?: unknown;
}

// Simple in-memory cache keyed by persona_id so multiple components
// can share the same in-flight/resolved request.
const cachedDefaultDashboardPromises = new Map<
  string,
  Promise<DefaultDashboardResponse>
>();

// Synchronously-readable resolved values, populated after each successful fetch.
// This avoids loader flicker when components remount.
const cachedDefaultDashboardResults = new Map<string, DefaultDashboardResponse>();

export function getCachedDefaultDashboard(
  personaId: number | null | undefined
): DefaultDashboardResponse | null {
  if (personaId == null || personaId <= 0) return null;
  return cachedDefaultDashboardResults.get(`persona:${personaId}`) ?? null;
}

/**
 * Fetches the default dashboard for the current user.
 * GET /dashboard/api/dashboards/default/json
 * Response may contain plotly_config_json / graphs / plotly_json_config or html.
 *
 * Subsequent calls reuse the same in-flight / resolved promise so that
 * DefaultDashboardLandscape and VisualizationSidebar don't trigger
 * duplicate requests while the app is open.
 */
export async function fetchDefaultDashboard(options?: {
  personaId?: number | null;
}): Promise<DefaultDashboardResponse> {
  const personaId =
    options?.personaId != null && options.personaId > 0
      ? options.personaId
      : null;

  // Do not call the backend without persona_id. A null persona during hydration or
  // when switching dashboard → chat would fetch the global default, cache it, and
  // cause a visible flicker before the persona-scoped dashboard loads.
  if (personaId == null) {
    return Promise.resolve({});
  }

  const cacheKey = `persona:${personaId}`;

  if (!cachedDefaultDashboardPromises.has(cacheKey)) {
    const url = new URL(
      `${API_CONFIG.DASHBOARD_API_BASE_URL}/api/dashboards/default/json`
    );
    url.searchParams.set("persona_id", String(personaId));

    const request = (async () => {
      const res = await fetch(url.toString(), {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Default dashboard: HTTP ${res.status}`);
      const value = unwrapEnvelope<DefaultDashboardResponse>(await res.json());
      cachedDefaultDashboardResults.set(cacheKey, value);
      return value;
    })().catch((err) => {
      // On failure, clear this cache key so a later call can retry.
      cachedDefaultDashboardPromises.delete(cacheKey);
      cachedDefaultDashboardResults.delete(cacheKey);
      throw err;
    });

    cachedDefaultDashboardPromises.set(cacheKey, request);
  }
  return cachedDefaultDashboardPromises.get(cacheKey)!;
}
