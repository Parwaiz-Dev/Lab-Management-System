import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  CreditCard,
  Eye,
  FileText,
  FlaskConical,
  Package,
  Printer,
  ReceiptText,
  User,
  X,
} from "lucide-react";
import { patientService } from "../services/patientService";
import { patientHistoryService } from "../services/patientHistoryService";
import { testService } from "../../test/services/testService";
import type {
  Patient,
  PatientHistoryResponse,
  PatientHistoryOrder,
  PatientHistoryPayment,
  PatientHistoryResultGroup,
  PatientHistoryTimelineEntry,
  ReportRow,
  ReportPatientInfo,
  ReceiptData,
  ToastMessage,
} from "../../../types";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import EmptyState from "../../../components/ui/EmptyState";
import Toast from "../../../components/ui/Toast";

// ── Helpers ──────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "Z");
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "Z");
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function getAgeDisplay(ageValue: number | null, ageUnit: string | null): string {
  if (ageValue === null || ageValue === undefined) return "—";
  const unit = ageUnit || "Yrs";
  return `${ageValue} ${unit}`;
}

function getGenderDisplay(gender: string | null | undefined): string {
  if (!gender) return "—";
  const g = gender.toLowerCase();
  if (g === "male") return "M";
  if (g === "female") return "F";
  return gender;
}

function getStatusTone(status: string): "success" | "warning" | "neutral" | "info" {
  switch (status) {
    case "Completed":
      return "success";
    case "Pending":
      return "warning";
    case "Cancelled":
      return "neutral";
    case "In Progress":
      return "info";
    default:
      return "neutral";
  }
}

function getTimelineIcon(eventType: string): string {
  switch (eventType) {
    case "order_created":
      return "📋";
    case "payment_made":
      return "💰";
    case "results_entered":
      return "🧪";
    case "status_changed":
      return "🔄";
    case "patient_created":
      return "👤";
    default:
      return "📌";
  }
}

// ── Constants ────────────────────────────────────────

const INITIAL_DISPLAY = 10;

// ── Types ────────────────────────────────────────────

interface ReportEntry {
  order_id: number;
  invoice_no: string;
  created_at: string;
  test_names: string;
}

interface OrderDetailData {
  report: ReportRow[];
  patient: ReportPatientInfo | null;
  receipt: ReceiptData | null;
}

// ── Props ────────────────────────────────────────────

interface PatientHistoryPageProps {
  onViewReport?: (orderId: number) => void;
  onViewReceipt?: (orderId: number) => void;
}

// ── Component ────────────────────────────────────────

export default function PatientHistoryPage({
  onViewReport,
  onViewReceipt,
}: PatientHistoryPageProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Patient[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Selected patient
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Display limits
  const [ordersLimit, setOrdersLimit] = useState(INITIAL_DISPLAY);
  const [paymentsLimit, setPaymentsLimit] = useState(INITIAL_DISPLAY);
  const [reportsLimit, setReportsLimit] = useState(INITIAL_DISPLAY);
  const [resultsLimit, setResultsLimit] = useState(INITIAL_DISPLAY);
  const [timelineLimit, setTimelineLimit] = useState(INITIAL_DISPLAY);

  // Order detail panel
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<OrderDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // ── Patient Search ────────────────────────────────

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await patientService.searchPatients(searchQuery);
        setSuggestions(results);
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Search failed";
        setToast({ message: msg, type: "error" });
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // ── Select Patient & Load History ─────────────────

  const selectPatient = useCallback(async (patient: Patient) => {
    setSelectedPatient(patient);
    setSuggestions([]);
    setSearchQuery("");
    setHistory(null);
    setHistoryError(null);
    setHistoryLoading(true);
    setDetailOrderId(null);
    setDetailData(null);
    setDetailError(null);

    // Reset limits
    setOrdersLimit(INITIAL_DISPLAY);
    setPaymentsLimit(INITIAL_DISPLAY);
    setReportsLimit(INITIAL_DISPLAY);
    setResultsLimit(INITIAL_DISPLAY);
    setTimelineLimit(INITIAL_DISPLAY);

    try {
      const data = await patientHistoryService.getPatientHistory(patient.id);
      setHistory(data);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to load history";
      setHistoryError(msg);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPatient(null);
    setHistory(null);
    setHistoryError(null);
    setSearchQuery("");
    setSuggestions([]);
    setDetailOrderId(null);
    setDetailData(null);
    setDetailError(null);
  }, []);

  // ── Computed lists with limits ────────────────────

  const visibleOrders = useMemo(() => {
    if (!history) return [];
    return history.orders.slice(0, ordersLimit);
  }, [history, ordersLimit]);

  const visiblePayments = useMemo(() => {
    if (!history) return [];
    return history.payments.slice(0, paymentsLimit);
  }, [history, paymentsLimit]);

  // Report-level entries (grouped by order_id)
  const reportEntries = useMemo<ReportEntry[]>(() => {
    if (!history) return [];
    const map = new Map<number, ReportEntry>();
    history.reports.forEach((report) => {
      const existing = map.get(report.order_id);
      if (existing) {
        if (!existing.test_names.includes(report.test_name)) {
          existing.test_names += `, ${report.test_name}`;
        }
      } else {
        map.set(report.order_id, {
          order_id: report.order_id,
          invoice_no: report.invoice_no,
          created_at: report.created_at,
          test_names: report.test_name,
        });
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [history]);

  const visibleReports = useMemo(() => {
    return reportEntries.slice(0, reportsLimit);
  }, [reportEntries, reportsLimit]);

  const visibleResults = useMemo(() => {
    if (!history) return [];
    return history.previous_results.slice(0, resultsLimit);
  }, [history, resultsLimit]);

  const visibleTimeline = useMemo(() => {
    if (!history) return [];
    return history.timeline.slice(0, timelineLimit);
  }, [history, timelineLimit]);

  // ── Order detail panel ────────────────────────────

  const loadOrderDetail = useCallback(async (orderId: number) => {
    if (detailOrderId === orderId) {
      setDetailOrderId(null);
      setDetailData(null);
      setDetailError(null);
      return;
    }

    setDetailOrderId(orderId);
    setDetailData(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const [report, patient, receipt] = await Promise.all([
        testService.getReport(orderId),
        testService.getPatientByOrder(orderId),
        testService.getReceipt(orderId),
      ]);
      setDetailData({ report, patient, receipt });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load order details";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }, [detailOrderId]);

  // ── Render: Search state (no patient selected) ────

  return (
    <div className="patient-history">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Search Section */}
      <section
        className="patient-history__search"
        role="search"
        aria-label="Search patient history"
      >
        <div className="patient-history__search-row">
          <Input
            placeholder="Search by name, phone, or patient code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search patients"
          />
          {selectedPatient && (
            <Button
              variant="secondary"
              onClick={clearSelection}
              className="patient-history__search-row-btn"
              icon={<X size={16} />}
            >
              Clear
            </Button>
          )}
        </div>
        {searchLoading && (
          <div className="patient-history__search-status">
            Searching...
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="patient-history__suggestions" role="listbox">
            {suggestions.map((patient) => (
              <div
                key={patient.id}
                className="patient-history__suggestion-card"
                role="option"
                tabIndex={0}
                aria-selected={false}
                onClick={() => selectPatient(patient)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    selectPatient(patient);
                  }
                }}
              >
                <span className="patient-history__suggestion-name">
                  {patient.name}
                </span>
                <span className="patient-history__suggestion-meta">
                  <span className="patient-history__suggestion-phone">
                    {patient.patient_code}
                  </span>
                  <span className="patient-history__suggestion-gender">
                    {getGenderDisplay(patient.gender)} | {getAgeDisplay(patient.age_value, patient.age_unit)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Loading state */}
      {historyLoading && (
        <div className="patient-history__loading">
          <div className="ui-spinner" />
          <span>Loading patient history...</span>
        </div>
      )}

      {/* Error state */}
      {historyError && !historyLoading && (
        <Card>
          <div className="patient-history__error">
            <p>{historyError}</p>
            <Button
              variant="secondary"
              onClick={() => selectedPatient && selectPatient(selectedPatient)}
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Empty search state */}
      {!selectedPatient && !historyLoading && !historyError && (
        <EmptyState
          icon="&#x1F50D;"
          title="Patient History"
          subtitle="Search for a patient by name, phone number, or patient code to view their complete history including orders, payments, reports, and test results over time."
        />
      )}

      {/* History content */}
      {selectedPatient && history && (
        <div className="patient-history__content">
          {/* Step 1: Patient Profile */}
          <Card className="patient-history__profile-card" icon={<User size={18} />}>
            <div className="patient-history__profile">
              <div className="patient-history__profile-avatar">
                {history.patient.name.charAt(0).toUpperCase()}
              </div>
              <div className="patient-history__profile-info">
                <div className="patient-history__profile-name">
                  {history.patient.name}
                </div>
                <div className="patient-history__profile-meta">
                  <Badge tone="info">{history.patient.patient_code}</Badge>
                  <span>{getAgeDisplay(history.patient.age_value, history.patient.age_unit)}</span>
                  <span>{getGenderDisplay(history.patient.gender)}</span>
                  {history.patient.phone && <span>📞 {history.patient.phone}</span>}
                </div>
                {history.patient.referred_by && (
                  <div className="patient-history__profile-referred">
                    Referred by: {history.patient.referred_by}
                  </div>
                )}
                <div className="patient-history__profile-date">
                  Registered: {formatDate(history.patient.created_at)}
                </div>
              </div>
            </div>
          </Card>

          {/* Step 2: Orders Section */}
          <Card
            className="patient-history__section-card"
            icon={<Package size={18} />}
            title={`Orders (${history.orders.length})`}
          >
            {history.orders.length === 0 ? (
              <EmptyState
                compact
                icon="&#x1F4E6;"
                title="No orders found"
                subtitle="This patient has no orders yet."
              />
            ) : (
              <>
                <div className="patient-history__table-wrap">
                  <table className="patient-history__table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Tests</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Pending</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((order: PatientHistoryOrder) => (
                        <tr key={order.id}>
                          <td>{formatDate(order.created_at)}</td>
                          <td className="patient-history__col--mono">
                            {order.invoice_no}
                          </td>
                          <td className="patient-history__col--tests">
                            {order.test_names}
                          </td>
                          <td className="patient-history__col--right patient-history__col--mono">
                            {formatCurrency(order.total_amount)}
                          </td>
                          <td className="patient-history__col--right patient-history__col--mono">
                            {formatCurrency(order.paid_amount)}
                          </td>
                          <td className="patient-history__col--right patient-history__col--mono">
                            {formatCurrency(order.pending_amount)}
                          </td>
                          <td>
                            <Badge tone={getStatusTone(order.status)}>
                              {order.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {history.orders.length > ordersLimit && (
                  <div className="patient-history__show-more">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setOrdersLimit((prev) => prev + INITIAL_DISPLAY)
                      }
                    >
                      Show More Orders (
                      {history.orders.length - ordersLimit} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Step 3: Payments Section */}
          <Card
            className="patient-history__section-card"
            icon={<CreditCard size={18} />}
            title={`Payments (${history.payments.length} entries)`}
          >
            {history.payments.length === 0 ? (
              <EmptyState
                compact
                icon="&#x1F4B0;"
                title="No payment records"
                subtitle="No payment records found for this patient."
              />
            ) : (
              <>
                <div className="patient-history__table-wrap">
                  <table className="patient-history__table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Prev. Paid</th>
                        <th>New Paid</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePayments.map(
                        (payment: PatientHistoryPayment) => {
                          return (
                            <tr key={payment.id}>
                              <td>{formatDate(payment.created_at)}</td>
                              <td className="patient-history__col--mono">
                                {payment.invoice_no}
                              </td>
                              <td className="patient-history__col--right patient-history__col--mono">
                                {formatCurrency(payment.previous_paid)}
                              </td>
                              <td className="patient-history__col--right patient-history__col--mono">
                                {formatCurrency(payment.new_paid)}
                              </td>
                              <td className="patient-history__col--right patient-history__col--mono">
                                {formatCurrency(payment.total_amount)}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
                {history.payments.length > paymentsLimit && (
                  <div className="patient-history__show-more">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setPaymentsLimit((prev) => prev + INITIAL_DISPLAY)
                      }
                    >
                      Show More Payments (
                      {history.payments.length - paymentsLimit} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Step 4: Reports Section (report-level) */}
          <Card
            className="patient-history__section-card"
            icon={<FileText size={18} />}
            title={`Reports (${reportEntries.length} reports)`}
          >
            {reportEntries.length === 0 ? (
              <EmptyState
                compact
                icon="&#x1F4C4;"
                title="No reports found"
                subtitle="Results must be entered to generate reports."
              />
            ) : (
              <>
                <div className="patient-history__table-wrap">
                  <table className="patient-history__table patient-history__reports-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Test Name</th>
                        <th>Order #</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleReports.map((entry: ReportEntry) => (
                        <tr key={entry.order_id}>
                          <td>{formatDateOnly(entry.created_at)}</td>
                          <td>{entry.test_names}</td>
                          <td className="patient-history__col--mono">
                            <button
                              type="button"
                              className="patient-history__order-link"
                              onClick={() => loadOrderDetail(entry.order_id)}
                            >
                              {entry.invoice_no}
                            </button>
                          </td>
                          <td>
                            <div className="patient-history__report-actions">
                              <Button
                                variant="secondary"
                                onClick={() => onViewReport?.(entry.order_id)}
                                icon={<Eye size={16} />}
                              >
                                View Report
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => onViewReport?.(entry.order_id)}
                                icon={<Printer size={16} />}
                              >
                                Print Report Again
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {reportEntries.length > reportsLimit && (
                  <div className="patient-history__show-more">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setReportsLimit((prev) => prev + INITIAL_DISPLAY)
                      }
                    >
                      Show More Reports (
                      {reportEntries.length - reportsLimit} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Order Detail Panel */}
            {detailOrderId !== null && (
              <div className="patient-history__detail-panel">
                <div className="patient-history__detail-header">
                  <h3>
                    Order #{detailOrderId}
                    {detailData?.patient && (
                      <span className="patient-history__detail-invoice">
                        {" "}— {detailData.patient.invoice_no}
                      </span>
                    )}
                  </h3>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDetailOrderId(null);
                      setDetailData(null);
                      setDetailError(null);
                    }}
                    icon={<X size={16} />}
                  >
                    Close
                  </Button>
                </div>

                {detailLoading && (
                  <div className="patient-history__detail-loading">
                    <div className="ui-spinner" />
                    <span>Loading order details...</span>
                  </div>
                )}

                {detailError && (
                  <div className="patient-history__detail-error">
                    {detailError}
                  </div>
                )}

                {detailData && (
                  <>
                    {/* Order Info */}
                    {detailData.patient && (
                      <div className="patient-history__detail-info-grid">
                        <div className="patient-history__detail-info-item">
                          <span className="patient-history__detail-info-label">Patient</span>
                          <span>{detailData.patient.patient_name}</span>
                        </div>
                        <div className="patient-history__detail-info-item">
                          <span className="patient-history__detail-info-label">Date</span>
                          <span>{formatDate(detailData.patient.order_date)}</span>
                        </div>
                        <div className="patient-history__detail-info-item">
                          <span className="patient-history__detail-info-label">Age / Gender</span>
                          <span>
                            {detailData.patient.age_value || "—"}{" "}
                            {detailData.patient.age_unit || "Yrs"} |{" "}
                            {getGenderDisplay(detailData.patient.gender)}
                          </span>
                        </div>
                        {detailData.patient.referred_by && (
                          <div className="patient-history__detail-info-item">
                            <span className="patient-history__detail-info-label">Referred By</span>
                            <span>{detailData.patient.referred_by}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tests & Results */}
                    {detailData.report.length > 0 && (
                      <div className="patient-history__detail-section">
                        <h4 className="patient-history__detail-subtitle">Tests & Results</h4>
                        <div className="patient-history__table-wrap">
                          <table className="patient-history__table patient-history__detail-table">
                            <thead>
                              <tr>
                                <th>Test</th>
                                <th>Parameter</th>
                                <th>Value</th>
                                <th>Unit</th>
                                <th>Normal Range</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.report.map((row, idx) => (
                                <tr key={idx}>
                                  <td>{row.test_name}</td>
                                  <td>{row.parameter_name}</td>
                                  <td className="patient-history__col--mono">{row.value}</td>
                                  <td>{row.unit || "—"}</td>
                                  <td>{row.normal_range || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Receipt Summary */}
                    {detailData.receipt && (
                      <div className="patient-history__detail-section">
                        <h4 className="patient-history__detail-subtitle">Receipt Summary</h4>
                        <div className="patient-history__detail-receipt-summary">
                          <div className="patient-history__detail-info-item">
                            <span className="patient-history__detail-info-label">Total Amount</span>
                            <span className="patient-history__col--mono">
                              {formatCurrency(detailData.receipt.total)}
                            </span>
                          </div>
                          <div className="patient-history__detail-info-item">
                            <span className="patient-history__detail-info-label">Paid Amount</span>
                            <span className="patient-history__col--mono">
                              {formatCurrency(detailData.receipt.paid)}
                            </span>
                          </div>
                          <div className="patient-history__detail-info-item">
                            <span className="patient-history__detail-info-label">Status</span>
                            <Badge
                              tone={
                                detailData.receipt.paid >= detailData.receipt.total
                                  ? "success"
                                  : "warning"
                              }
                            >
                              {detailData.receipt.paid >= detailData.receipt.total
                                ? "Paid"
                                : "Pending"}
                            </Badge>
                          </div>
                        </div>
                        {detailData.receipt.tests.length > 0 && (
                          <div className="patient-history__table-wrap" style={{ marginTop: 12 }}>
                            <table className="patient-history__table patient-history__detail-table">
                              <thead>
                                <tr>
                                  <th>Test</th>
                                  <th>Parameters</th>
                                  <th>Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailData.receipt.tests.map((line, idx) => (
                                  <tr key={idx}>
                                    <td>{line.test_name}</td>
                                    <td>{line.parameter_names?.join(", ") || "—"}</td>
                                    <td className="patient-history__col--right patient-history__col--mono">
                                      {formatCurrency(line.price)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="patient-history__detail-actions">
                      <Button
                        onClick={() => onViewReport?.(detailOrderId)}
                        icon={<Eye size={16} />}
                      >
                        Preview Report
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => onViewReport?.(detailOrderId)}
                        icon={<Printer size={16} />}
                      >
                        Print Report
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => onViewReceipt?.(detailOrderId)}
                        icon={<ReceiptText size={16} />}
                      >
                        Print Receipt
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* Step 5: Previous Results (grouped by parameter) */}
          <Card
            className="patient-history__section-card"
            icon={<FlaskConical size={18} />}
            title={`Test Results Over Time (${history.previous_results.length} parameters)`}
          >
            {history.previous_results.length === 0 ? (
              <EmptyState
                compact
                icon="&#x1F9EA;"
                title="No test results"
                subtitle="No previous test results available for this patient."
              />
            ) : (
              <>
                <div className="patient-history__results-grid">
                  {visibleResults.map(
                    (group: PatientHistoryResultGroup, index: number) => (
                      <div
                        key={`${group.parameter_name}-${index}`}
                        className="patient-history__result-group"
                      >
                        <div className="patient-history__result-group-header">
                          <span className="patient-history__result-param-name">
                            {group.parameter_name}
                          </span>
                          <span className="patient-history__result-test-name">
                            {group.test_name}
                          </span>
                          <span className="patient-history__result-unit">
                            {group.unit}
                          </span>
                          {group.normal_range && (
                            <span className="patient-history__result-range">
                              Ref: {group.normal_range}
                            </span>
                          )}
                        </div>
                        <div className="patient-history__result-values">
                          {group.entries.map((entry) => (
                            <div
                              key={`${entry.order_id}-${entry.order_date}`}
                              className="patient-history__result-value-chip"
                              title={`Order: ${entry.invoice_no}`}
                            >
                              <span className="patient-history__result-value">
                                {entry.value}
                              </span>
                              <span className="patient-history__result-date">
                                {formatDateOnly(entry.order_date)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
                {history.previous_results.length > resultsLimit && (
                  <div className="patient-history__show-more">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setResultsLimit((prev) => prev + INITIAL_DISPLAY)
                      }
                    >
                      Show More Parameters (
                      {history.previous_results.length - resultsLimit} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Step 6: Timeline */}
          <Card
            className="patient-history__section-card"
            icon={<Clock size={18} />}
            title={`Activity Timeline (${history.timeline.length} events)`}
          >
            {history.timeline.length === 0 ? (
              <EmptyState
                compact
                icon="&#x1F4C5;"
                title="No activity yet"
                subtitle="No activity has been recorded for this patient."
              />
            ) : (
              <>
                <div className="patient-history__timeline">
                  {visibleTimeline.map(
                    (entry: PatientHistoryTimelineEntry, index: number) => (
                      <div
                        key={`${entry.event_type}-${entry.timestamp}-${index}`}
                        className="patient-history__timeline-item"
                      >
                        <div className="patient-history__timeline-marker">
                          <span className="patient-history__timeline-icon">
                            {getTimelineIcon(entry.event_type)}
                          </span>
                          <div className="patient-history__timeline-line" />
                        </div>
                        <div className="patient-history__timeline-content">
                          <span className="patient-history__timeline-desc">
                            {entry.description}
                          </span>
                          <span className="patient-history__timeline-time">
                            {formatDate(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
                {history.timeline.length > timelineLimit && (
                  <div className="patient-history__show-more">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setTimelineLimit((prev) => prev + INITIAL_DISPLAY)
                      }
                    >
                      Show More Events (
                      {history.timeline.length - timelineLimit} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}