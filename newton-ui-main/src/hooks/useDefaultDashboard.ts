import { useEffect, useState } from "react";

import { fetchDefaultDashboard, getCachedDefaultDashboard } from "@/services/visualization/defaultDashboardApi";

const DEFAULT_DASHBOARD_NOT_FOUND = "DEFAULT_DASHBOARD_NOT_FOUND";

function pickHtmlFromResponse(json: unknown): string | null {
  const obj = json as { html?: unknown; plotly_json_config?: unknown } | null;
  // Prefer HTML for the sidebar. Plotly defaults are handled by DefaultDashboardLandscape.
  if (obj && obj.plotly_json_config != null) return null;
  if (obj && typeof obj.html === "string") {
    const t = obj.html.trim();
    return t ? t : null;
  }
  return null;
}

export function useDefaultDashboard({
  selectedPersonaId,
  suppressDefaultDashboard,
  // Keep the param for compatibility, but do not re-fetch on it.
  hasVisualization: _hasVisualization,
}: {
  selectedPersonaId: number | null;
  suppressDefaultDashboard: boolean;
  hasVisualization: boolean;
}) {
  const [defaultDashboardHtml, setDefaultDashboardHtml] = useState<string | null>(() => {
    if (suppressDefaultDashboard) return null;
    const cached = getCachedDefaultDashboard(selectedPersonaId);
    return pickHtmlFromResponse(cached);
  });
  const [isLoadingDefault, setIsLoadingDefault] = useState(false);
  const [defaultDashboardError, setDefaultDashboardError] = useState<string | null>(null);

  // Fetch the default dashboard when there is nothing to render (skip in chat/analytical mode)
  useEffect(() => {
    if (suppressDefaultDashboard) {
      setDefaultDashboardHtml(null);
      setIsLoadingDefault(false);
      setDefaultDashboardError(null);
      return;
    }

    // Wait for a resolved persona (Zustand persist may hydrate after first paint).
    // Avoids fetching /default/json without persona_id and flashing the wrong dashboard.
    if (selectedPersonaId == null || selectedPersonaId <= 0) {
      setDefaultDashboardHtml(null);
      setIsLoadingDefault(false);
      setDefaultDashboardError(null);
      return;
    }

    const cached = getCachedDefaultDashboard(selectedPersonaId);
    if (cached) {
      setDefaultDashboardHtml(pickHtmlFromResponse(cached));
      setIsLoadingDefault(false);
      setDefaultDashboardError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingDefault(true);
    setDefaultDashboardError(null);

    fetchDefaultDashboard({ personaId: selectedPersonaId })
      .then((json) => {
        if (cancelled) return;
        setDefaultDashboardHtml(pickHtmlFromResponse(json));
        setDefaultDashboardError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setDefaultDashboardHtml(null);
        const errorMessage = String(err?.message ?? "");
        const isNotFound =
          errorMessage.includes("HTTP 404") || errorMessage.includes("status code 404");
        setDefaultDashboardError(
          isNotFound
            ? DEFAULT_DASHBOARD_NOT_FOUND
            : err?.message ?? "Failed to load default dashboard."
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDefault(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPersonaId, suppressDefaultDashboard]);

  return {
    defaultDashboardHtml,
    isLoadingDefault,
    defaultDashboardError,
    DEFAULT_DASHBOARD_NOT_FOUND,
  };
}

