export interface PlotlyDataConfig {
  data: Plotly.Data[];
  layout: Partial<Plotly.Layout>;
  config?: Partial<Plotly.Config>;
}

export interface DraggableDashboardChartConfig {
  id: number | string;
  name: string;
  /** When set, the chart failed server-side; show this instead of an empty Plotly figure. */
  error?: string;
  row?: number | null;
  col?: number | null;
  rowspan?: number | null;
  colspan?: number | null;
  plotly_data_config?: PlotlyDataConfig;
  plotly_data?: PlotlyDataConfig;
}

export interface DraggableDashboardProps {
  charts: DraggableDashboardChartConfig[];
  storageKey?: string;
  showResetButton?: boolean;
  className?: string;
}

