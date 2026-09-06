export type Role = "admin" | "lector";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: Role;
}

export interface Period {
  year: number;
  month: string;
  month_index: number;
  report_date: string;
  label: string;
  positions: number;
}

export interface FilterOptions {
  years: number[];
  months: string[];
  types: string[];
  classifications: string[];
  sectors: string[];
  rating_grades: string[];
}

export interface Kpis {
  costo_total: number;
  valor_mercado: number;
  gp_no_realizada: number;
  rentab_sobre_costo: number;
  ingreso_anual_est: number;
  interes_acumulado: number;
  yield_prom_ponderado: number;
  n_posiciones: number;
  valor_informe: number;
}

export interface BreakdownRow {
  label: string;
  costo: number;
  valor_mercado: number;
  gp_no_realizada: number;
  pct_participacion: number;
  ingreso_anual_est: number;
  posiciones: number;
}

export interface DashboardPayload {
  kpis: Kpis;
  por_clasificacion: BreakdownRow[];
  por_tipo: BreakdownRow[];
  por_sector: BreakdownRow[];
  calidad_moodys: BreakdownRow[];
  calidad_sp: BreakdownRow[];
  stop_loss: BreakdownRow[];
  alerta_tiempo: BreakdownRow[];
  period: { year: number; month: string };
  applied_filters: Record<string, string | null>;
}

export interface EvolutionPoint {
  year: number;
  month: string;
  month_index: number;
  label: string;
  valor_informe: number;
  costo: number;
  valor_mercado: number;
  gp_no_realizada: number;
  ingreso_anual_est: number;
  rentab_sobre_costo: number;
}

export interface PositionRow {
  identifier: string;
  description: string;
  classification: string | null;
  type: string | null;
  sector: string | null;
  market_value: number;
  cost_basis: number;
  unrealized_gain_loss: number;
  return_on_cost: number;
  valor_informe: number;
  accrued_interest: number;
  annual_income: number;
  weighted_yield: number;
  moodys_grade: string;
  sp_grade: string;
  stop_loss: string;
  initial_term_years: number | null;
  term_to_maturity_years: number | null;
  time_alert: string;
  issuer_alert: string;
  cash_limit_alert: string;
  sell_indicator: string;
}

export interface PositionsResponse {
  period: { year: number; month: string };
  total: number;
  page: number;
  page_size: number;
  items: PositionRow[];
}

export interface ScenarioResult {
  pct_sale: number;
  shares_sold: number;
  unit_market_price: number;
  gross_sale_value: number;
  broker_commission: number;
  transaction_fee: number;
  net_sale_value: number;
  profit: number;
  profit_per_share: number;
  holding_years: number;
  irr: number | null;
  roi: number;
}

export interface ScenarioResponse {
  asset: {
    identifier: string;
    description: string;
    type: string | null;
    quantity: number;
    purchase_value: number;
    market_value: number;
  };
  period: { year: number; month: string };
  scenarios: ScenarioResult[];
}

export interface FxResult {
  gross_sale_cop: number;
  sale_commission_cop: number;
  net_bank_value_cop: number;
  historical_cost_cop: number;
  trm_delta: number;
  accumulated_fx_difference: number;
  trading_profit_cop: number;
  gross_total_profit_cop: number;
  net_sale_profit_cop: number;
  control_check: number;
}

export type IngestionStatus =
  | "success"
  | "partial"
  | "conflict"
  | "error"
  | "dry_run";

export interface IngestionLogRow {
  id: number;
  uploaded_at: string;
  filename: string;
  uploaded_by: string | null;
  status: IngestionStatus;
  dry_run: boolean;
  replace_mode: boolean;
  total_rows: number;
  valid_rows: number;
  error_count: number;
  instruments_upserted: number;
  snapshots_inserted: number;
  snapshots_updated: number;
  snapshots_deleted: number;
  periods: string[];
  message: string | null;
  content_sha256: string | null;
}

export interface IngestionHistory {
  total: number;
  limit: number;
  offset: number;
  items: IngestionLogRow[];
}

export interface UploadSummary {
  filename: string;
  content_sha256: string;
  total_rows: number;
  valid_rows: number;
  error_count: number;
  errors: { row: number | null; error: string; identifier?: string }[];
  detected_columns: Record<string, string>;
  ignored_columns: string[];
  periods: string[];
  existing_periods: { year: number; month: string; rows: number }[];
  identical_file_loaded_at: string | null;
  dry_run: boolean;
  replace: boolean;
  status?: string;
  instruments?: number;
  snapshots_inserted?: number;
  snapshots_updated?: number;
  snapshots_deleted?: number;
}

export interface TwrRow {
  year: number;
  month: number;
  month_name: string;
  portfolio_return: number | null;
  benchmark_return: number | null;
  factor: number | null;
  cumulative_twr: number | null;
  cumulative_benchmark: number | null;
}
