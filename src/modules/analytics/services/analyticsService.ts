import { invoke } from "@tauri-apps/api/core";

export interface AnalyticsSummary {
  total_revenue: number;
  collected_amount: number;
  pending_amount: number;
  total_patients: number;
  total_orders: number;
  total_tests_ordered: number;
}

export interface ChartImage {
  name: string;
  base64: string;
}

// ── Recharts chart data types ──

export interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
  collected: number;
  pending: number;
}

export interface TopTestItem {
  test_name: string;
  order_count: number;
  total_revenue: number;
}

export interface DoctorRevenueItem {
  doctor_name: string;
  patient_count: number;
  order_count: number;
  total_revenue: number;
  collected: number;
  pending: number;
}

export interface PatientGrowthPoint {
  month: string;
  new_patients: number;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
}

export const analyticsService = {
  async getSummary(): Promise<AnalyticsSummary> {
    try {
      return await invoke<AnalyticsSummary>("get_analytics_summary");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to load analytics summary"));
    }
  },

  async runExcel(): Promise<string> {
    try {
      return await invoke<string>("run_analytics_excel");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to generate Excel report"));
    }
  },

  async runCharts(): Promise<string> {
    try {
      return await invoke<string>("run_analytics_charts");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to generate charts"));
    }
  },

  async runAll(): Promise<string> {
    try {
      return await invoke<string>("run_analytics_all");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to generate all reports"));
    }
  },

  async readChartImage(name: string): Promise<ChartImage> {
    try {
      return await invoke<ChartImage>("read_chart_image", { name });
    } catch (err) {
      throw new Error(toErrorMessage(err, `Failed to read chart: ${name}`));
    }
  },

  async openOutputFolder(): Promise<string> {
    try {
      return await invoke<string>("open_analytics_folder");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to open output folder"));
    }
  },

  // ── Recharts data commands ──

  async getMonthlyRevenue(): Promise<MonthlyRevenuePoint[]> {
    try {
      return await invoke<MonthlyRevenuePoint[]>("get_monthly_revenue");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to load monthly revenue data"));
    }
  },

  async getTopTests(): Promise<TopTestItem[]> {
    try {
      return await invoke<TopTestItem[]>("get_top_tests");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to load top tests data"));
    }
  },

  async getDoctorRevenue(): Promise<DoctorRevenueItem[]> {
    try {
      return await invoke<DoctorRevenueItem[]>("get_doctor_revenue_chart");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to load doctor revenue data"));
    }
  },

  async getPatientGrowth(): Promise<PatientGrowthPoint[]> {
    try {
      return await invoke<PatientGrowthPoint[]>("get_patient_growth");
    } catch (err) {
      throw new Error(toErrorMessage(err, "Failed to load patient growth data"));
    }
  },
};