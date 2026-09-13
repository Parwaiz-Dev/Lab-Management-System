import { useCallback, useEffect, useState } from "react";
import {
  IndianRupee,
  CheckCircle2,
  Clock,
  Users,
  FileSpreadsheet,
  RefreshCw,
  Zap,
  Download,
  FolderOpen,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { ToastType } from "../../../types";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import {
  analyticsService,
  type AnalyticsSummary,
  type MonthlyRevenuePoint,
  type TopTestItem,
  type DoctorRevenueItem,
  type PatientGrowthPoint,
} from "../services/analyticsService";

type TimeFilter = "daily" | "weekly" | "monthly" | "yearly";

/* ── Helpers ── */

function formatRupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

function collectionRate(collected: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((collected / total) * 100)}%`;
}

/* ── Custom tooltip ── */

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="analytics-chart-tooltip">
      <p className="analytics-chart-tooltip__label">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="analytics-chart-tooltip__item" style={{ color: entry.color }}>
          {entry.name}: {formatRupees(entry.value)}
        </p>
      ))}
    </div>
  );
}

/* ── Page ── */

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("monthly");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Chart data states
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenuePoint[]>([]);
  const [topTests, setTopTests] = useState<TopTestItem[]>([]);
  const [doctorRevenue, setDoctorRevenue] = useState<DoctorRevenueItem[]>([]);
  const [patientGrowth, setPatientGrowth] = useState<PatientGrowthPoint[]>([]);

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Data loading ── */

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await analyticsService.getSummary());
    } catch {
      /* empty DB — OK */
    }
  }, []);

  const loadChartData = useCallback(async () => {
    const results = await Promise.allSettled([
      analyticsService.getMonthlyRevenue(),
      analyticsService.getTopTests(),
      analyticsService.getDoctorRevenue(),
      analyticsService.getPatientGrowth(),
    ]);

    if (results[0].status === "fulfilled") setMonthlyRevenue(results[0].value);
    if (results[1].status === "fulfilled") setTopTests(results[1].value);
    if (results[2].status === "fulfilled") setDoctorRevenue(results[2].value);
    if (results[3].status === "fulfilled") setPatientGrowth(results[3].value);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadSummary(), loadChartData()]);
    setLoading(false);
  }, [loadSummary, loadChartData]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── Actions ── */

  const handleGenerate = useCallback(
    async (action: "excel" | "charts" | "all", label: string) => {
      setGenerating(label);
      try {
        if (action === "excel") await analyticsService.runExcel();
        else if (action === "charts") await analyticsService.runCharts();
        else await analyticsService.runAll();
        showToast(`${label} completed.`, "success");
        await loadAll();
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : `${label} failed.`,
          "error",
        );
      } finally {
        setGenerating(null);
      }
    },
    [loadAll],
  );

  const handleOpenFolder = useCallback(async () => {
    try {
      await analyticsService.openOutputFolder();
      showToast("Output folder opened.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to open folder.",
        "error",
      );
    }
  }, []);

  const hasAnyData = summary !== null && summary.total_orders > 0;
  const hasChartData =
    monthlyRevenue.length > 0 ||
    topTests.length > 0 ||
    doctorRevenue.length > 0 ||
    patientGrowth.length > 0;

  /* ── Empty State ── */

  if (!loading && !hasAnyData && !hasChartData) {
    return (
      <div className="analytics-page">
        <div className="analytics-empty">
          <div className="analytics-empty__icon">📊</div>
          <h2 className="analytics-empty__title">No analytics generated yet</h2>
          <p className="analytics-empty__desc">
            Generate analytics to visualize your business performance.
          </p>
          <Button
            variant="primary"
            onClick={() => handleGenerate("all", "Generate Analytics")}
            loading={generating === "Generate Analytics"}
          >
            <Zap size={16} />
            Generate Analytics
          </Button>
        </div>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  /* ── Main Dashboard ── */

  return (
    <div className="analytics-page">
      {/* ════════════════ KPI CARDS ════════════════ */}
      <div className="analytics-kpi-grid">
        {/* Total Revenue */}
        <div className="analytics-kpi-card analytics-kpi-card--revenue">
          <div className="analytics-kpi-card__icon">
            <IndianRupee size={18} strokeWidth={2} />
          </div>
          <div className="analytics-kpi-card__body">
            <span className="analytics-kpi-card__label">Total Revenue</span>
            <span className="analytics-kpi-card__value">
              {summary ? formatRupees(summary.total_revenue) : "—"}
            </span>
            <span className="analytics-kpi-card__trend analytics-kpi-card__trend--up">
              All-time total
            </span>
          </div>
        </div>

        {/* Collected */}
        <div className="analytics-kpi-card analytics-kpi-card--collected">
          <div className="analytics-kpi-card__icon">
            <CheckCircle2 size={18} strokeWidth={2} />
          </div>
          <div className="analytics-kpi-card__body">
            <span className="analytics-kpi-card__label">Collected</span>
            <span className="analytics-kpi-card__value">
              {summary ? formatRupees(summary.collected_amount) : "—"}
            </span>
            <span className="analytics-kpi-card__trend analytics-kpi-card__trend--up">
              {summary
                ? `${collectionRate(summary.collected_amount, summary.total_revenue)} collection rate`
                : "—"}
            </span>
          </div>
        </div>

        {/* Pending */}
        <div className="analytics-kpi-card analytics-kpi-card--pending">
          <div className="analytics-kpi-card__icon">
            <Clock size={18} strokeWidth={2} />
          </div>
          <div className="analytics-kpi-card__body">
            <span className="analytics-kpi-card__label">Pending</span>
            <span className="analytics-kpi-card__value">
              {summary ? formatRupees(summary.pending_amount) : "—"}
            </span>
            <span className="analytics-kpi-card__trend analytics-kpi-card__trend--warn">
              {summary && summary.pending_amount > 0
                ? "Outstanding"
                : "Fully collected"}
            </span>
          </div>
        </div>

        {/* Patients */}
        <div className="analytics-kpi-card analytics-kpi-card--patients">
          <div className="analytics-kpi-card__icon">
            <Users size={18} strokeWidth={2} />
          </div>
          <div className="analytics-kpi-card__body">
            <span className="analytics-kpi-card__label">Total Patients</span>
            <span className="analytics-kpi-card__value">
              {summary ? formatCompact(summary.total_patients) : "—"}
            </span>
            <span className="analytics-kpi-card__trend analytics-kpi-card__trend--up">
              {summary
                ? `${summary.total_orders} orders · ${summary.total_tests_ordered} tests`
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════ TIME FILTER + TOOLBAR ════════════════ */}
      <div className="analytics-toolbar">
        <div className="analytics-time-filter">
          {(["daily", "weekly", "monthly", "yearly"] as TimeFilter[]).map(
            (filter) => (
              <button
                key={filter}
                type="button"
                className={`analytics-time-filter__pill${
                  timeFilter === filter
                    ? " analytics-time-filter__pill--active"
                    : ""
                }`}
                onClick={() => setTimeFilter(filter)}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ),
          )}
        </div>

        <div className="analytics-toolbar__actions">
          <Button
            variant="ghost"
            onClick={() => handleGenerate("excel", "Export Excel")}
            loading={generating === "Export Excel"}
            icon={<FileSpreadsheet size={14} />}
          >
            Export Excel
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleGenerate("charts", "Generate Charts")}
            loading={generating === "Generate Charts"}
            icon={<RefreshCw size={14} />}
          >
            Charts
          </Button>
          <Button
            variant="primary"
            onClick={() => handleGenerate("all", "Generate All")}
            loading={generating === "Generate All"}
            icon={<Zap size={14} />}
          >
            Generate All
          </Button>
        </div>
      </div>

      {/* ════════════════ CHARTS GRID ════════════════ */}
      <div className="analytics-charts-grid">
        {/* ── Monthly Revenue (Bar Chart) ── */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-card__header">
            <div>
              <h4 className="analytics-chart-card__title">Monthly Revenue</h4>
              <p className="analytics-chart-card__subtitle">
                Revenue trend over time
              </p>
            </div>
          </div>
          <div className="analytics-chart-card__chart">
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyRevenue}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `₹${formatCompact(v)}`}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#F8FAFC" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  <Bar
                    dataKey="collected"
                    name="Collected"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analytics-chart-card__empty">
                <span>No revenue data yet</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Top Tests (Horizontal Bar) ── */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-card__header">
            <div>
              <h4 className="analytics-chart-card__title">Most Performed Tests</h4>
              <p className="analytics-chart-card__subtitle">
                Frequently ordered tests
              </p>
            </div>
          </div>
          <div className="analytics-chart-card__chart">
            {topTests.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topTests}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCompact(v)}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="test_name"
                    tick={{ fontSize: 11, fill: "#334155" }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#F8FAFC" }}
                  />
                  <Bar
                    dataKey="order_count"
                    name="Orders"
                    fill="#6366F1"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analytics-chart-card__empty">
                <span>No test data yet</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Doctor Revenue (Horizontal Bar) ── */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-card__header">
            <div>
              <h4 className="analytics-chart-card__title">Doctor Revenue</h4>
              <p className="analytics-chart-card__subtitle">
                Revenue by referring doctor
              </p>
            </div>
          </div>
          <div className="analytics-chart-card__chart">
            {doctorRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={doctorRevenue}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `₹${formatCompact(v)}`}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="doctor_name"
                    tick={{ fontSize: 11, fill: "#334155" }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#F8FAFC" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  <Bar
                    dataKey="collected"
                    name="Collected"
                    fill="#10B981"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                    stackId="a"
                  />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    fill="#F59E0B"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                    stackId="a"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="analytics-chart-card__empty">
                <span>No doctor revenue data yet</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Patient Growth (Line Chart) ── */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-card__header">
            <div>
              <h4 className="analytics-chart-card__title">Patient Growth</h4>
              <p className="analytics-chart-card__subtitle">
                New registrations over time
              </p>
            </div>
          </div>
          <div className="analytics-chart-card__chart">
            {patientGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={patientGrowth}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: "#CBD5E1", strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="new_patients"
                    name="New Patients"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#6366F1", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#6366F1", strokeWidth: 2, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="analytics-chart-card__empty">
                <span>No patient growth data yet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ BOTTOM TOOLBAR ════════════════ */}
      <div className="analytics-bottom-bar">
        <Button
          variant="primary"
          onClick={() => handleGenerate("all", "Generate All")}
          loading={generating === "Generate All"}
          icon={<Zap size={14} />}
        >
          Generate All
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleGenerate("excel", "Export Excel")}
          loading={generating === "Export Excel"}
          icon={<Download size={14} />}
        >
          Export Excel
        </Button>
        <Button
          variant="ghost"
          onClick={loadAll}
          icon={<RefreshCw size={14} />}
        >
          Refresh
        </Button>
        <Button
          variant="ghost"
          onClick={handleOpenFolder}
          icon={<FolderOpen size={14} />}
        >
          Open Folder
        </Button>
      </div>

      {/* ════════════════ TOAST ════════════════ */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}