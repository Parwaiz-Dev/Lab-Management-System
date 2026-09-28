import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  FlaskConical,
  Phone,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { patientService } from "../services/patientService";
import type { AgeUnit, Gender } from "../services/patientService";
import { patientHistoryService } from "../services/patientHistoryService";
import type {
  Patient,
  PatientHistoryResponse,
  ToastMessage,
} from "../../../types";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import SearchInput from "../../../components/ui/SearchInput";
import Modal from "../../../components/ui/Modal";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import EmptyState from "../../../components/ui/EmptyState";
import Toast from "../../../components/ui/Toast";

// ── Helpers ──────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return iso;
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
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatCurrency(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getAgeDisplay(
  ageValue: number | null | undefined,
  ageUnit: string | null | undefined
): string {
  if (ageValue === null || ageValue === undefined) return "—";
  const unit = ageUnit || "Yrs";
  return `${ageValue} ${unit}`;
}

function getFlagStatus(
  value: string,
  range: string
): "High" | "Low" | "Normal" | "" {
  const num = Number.parseFloat(String(value || "").replace(/,/g, ""));
  if (Number.isNaN(num) || !range) return "";
  const cleanRange = String(range || "").trim().toLowerCase();
  if (!cleanRange) return "";
  if (cleanRange.startsWith("<=")) {
    const max = Number.parseFloat(cleanRange.replace("<=", ""));
    if (Number.isNaN(max)) return "";
    return num > max ? "High" : "Normal";
  }
  if (cleanRange.startsWith("<")) {
    const max = Number.parseFloat(cleanRange.replace("<", ""));
    if (Number.isNaN(max)) return "";
    return num >= max ? "High" : "Normal";
  }
  if (cleanRange.startsWith(">=")) {
    const min = Number.parseFloat(cleanRange.replace(">=", ""));
    if (Number.isNaN(min)) return "";
    return num < min ? "Low" : "Normal";
  }
  if (cleanRange.startsWith(">")) {
    const min = Number.parseFloat(cleanRange.replace(">", ""));
    if (Number.isNaN(min)) return "";
    return num <= min ? "Low" : "Normal";
  }
  const match = cleanRange.match(
    /(-?\d+(\.\d+)?)\s*(?:-|to)\s*(-?\d+(\.\d+)?)/
  );
  if (!match) return "";
  const min = Number.parseFloat(match[1]);
  const max = Number.parseFloat(match[3]);
  if (Number.isNaN(min) || Number.isNaN(max)) return "";
  if (num < min) return "Low";
  if (num > max) return "High";
  return "Normal";
}

type TabType = "orders" | "payments" | "results" | "timeline";

interface PatientHistoryPageProps {
  onViewReport?: (orderId: number) => void;
  onViewReceipt?: (orderId: number) => void;
}

export default function PatientHistoryPage({
  onViewReport,
  onViewReceipt,
}: PatientHistoryPageProps) {
  // Directory state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingPatients, setLoadingPatients] = useState(true);

  // Selected Patient & History Modal
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("orders");

  // Edit Patient State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editName, setEditName] = useState("");
  const [editAgeValue, setEditAgeValue] = useState<number | "">("");
  const [editAgeUnit, setEditAgeUnit] = useState<AgeUnit>("Years");
  const [editGender, setEditGender] = useState<Gender>("Male");
  const [editPhone, setEditPhone] = useState("");
  const [editReferredBy, setEditReferredBy] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Patient State
  const [deleteConfirmPatient, setDeleteConfirmPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState(false);

  // Doctors list for referral dropdown
  const [doctorsList, setDoctorsList] = useState<string[]>([]);
  useEffect(() => {
    void patientService.getDoctors().then(setDoctorsList).catch(() => {});
  }, []);

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Load patients list
  const loadPatients = useCallback(async (query = "") => {
    try {
      setLoadingPatients(true);
      const data = await patientService.searchPatients(query);
      setPatients(data || []);
    } catch (err) {
      console.error(err);
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to load patient records",
        type: "error",
      });
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadPatients("");
  }, [loadPatients]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPatients(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, loadPatients]);

  // Select patient & open history modal
  const handleOpenHistory = useCallback(async (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab("orders");
    setHistory(null);
    setHistoryLoading(true);

    try {
      const data = await patientHistoryService.getPatientHistory(patient.id);
      setHistory(data);
    } catch (err) {
      console.error(err);
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to load patient history",
        type: "error",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleCloseHistory = useCallback(() => {
    setSelectedPatient(null);
    setHistory(null);
  }, []);

  // Start Edit Patient
  const handleStartEdit = useCallback((patient: Patient) => {
    setEditingPatient(patient);
    setEditName(patient.name || "");
    setEditAgeValue(patient.age_value ?? "");
    setEditAgeUnit((patient.age_unit as AgeUnit) || "Years");
    setEditGender((patient.gender as Gender) || "Male");
    setEditPhone(patient.phone || "");
    setEditReferredBy(patient.referred_by || "Self");
    setEditModalOpen(true);
  }, []);

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPatient) return;
    if (!editName.trim()) {
      setToast({ message: "Patient name is required", type: "warning" });
      return;
    }
    const ageVal = editAgeValue === "" ? 0 : Number(editAgeValue);
    if (ageVal < 0 || ageVal > 150) {
      setToast({ message: "Age must be between 0 and 150", type: "warning" });
      return;
    }

    try {
      setSavingEdit(true);
      await patientService.updatePatient(editingPatient.id, {
        name: editName.trim(),
        ageValue: ageVal,
        ageUnit: editAgeUnit,
        gender: editGender,
        phone: editPhone.trim() || null,
        referredBy: editReferredBy.trim() || null,
      });

      setToast({ message: `Patient "${editName.trim()}" updated successfully`, type: "success" });
      setEditModalOpen(false);
      setEditingPatient(null);
      await loadPatients(searchQuery);

      if (selectedPatient?.id === editingPatient.id) {
        setSelectedPatient((prev) =>
          prev
            ? {
                ...prev,
                name: editName.trim(),
                age_value: ageVal,
                age_unit: editAgeUnit,
                gender: editGender,
                phone: editPhone.trim() || null,
                referred_by: editReferredBy.trim() || null,
              }
            : null
        );
      }
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to update patient",
        type: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Handlers
  const handleStartDelete = useCallback((patient: Patient) => {
    setDeleteConfirmPatient(patient);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteConfirmPatient) return;
    try {
      setDeletingPatient(true);
      await patientService.deletePatient(deleteConfirmPatient.id);
      setToast({ message: `Patient "${deleteConfirmPatient.name}" deleted successfully`, type: "success" });
      if (selectedPatient?.id === deleteConfirmPatient.id) {
        handleCloseHistory();
      }
      setDeleteConfirmPatient(null);
      await loadPatients(searchQuery);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to delete patient",
        type: "error",
      });
    } finally {
      setDeletingPatient(false);
    }
  };

  // Filtered patients for real-time safety
  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.patient_code.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.referred_by && p.referred_by.toLowerCase().includes(q))
    );
  }, [patients, searchQuery]);

  // History KPIs
  const historyKpis = useMemo(() => {
    if (!history) {
      return { totalOrders: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 };
    }
    const totalOrders = history.orders?.length || 0;
    const totalBilled = (history.orders || []).reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    );
    const totalPaid = (history.orders || []).reduce(
      (sum, o) => sum + (o.paid_amount || 0),
      0
    );
    const totalDue = Math.max(totalBilled - totalPaid, 0);
    return { totalOrders, totalBilled, totalPaid, totalDue };
  }, [history]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Filter and Search Bar (Chavan Saree Center style) */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "10px 14px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          boxShadow: "var(--shadow-xs)",
        }}
      >
        {/* Search */}
        <div style={{ flex: "1 1 320px", maxWidth: 460 }}>
          <SearchInput
            value={searchQuery}
            onChangeValue={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder="Search by patient name, phone, PID code, or doctor..."
            sizeVariant="sm"
          />
        </div>

        {/* Status Count & Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge tone="neutral">
            {filteredPatients.length} {filteredPatients.length === 1 ? "Patient" : "Patients"}
          </Badge>

          <Button
            type="button"
            onClick={() => loadPatients(searchQuery)}
            variant="secondary"
            size="sm"
            disabled={loadingPatients}
            icon={<RefreshCw size={12} className={loadingPatients ? "animate-spin" : ""} />}
          >
            {loadingPatients ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Patients Directory Table */}
      <Card
        compact
        title="Registered Patients Directory"
        eyebrow="MEDICAL RECORDS & HISTORY"
        badge={
          <Badge tone="neutral">
            {filteredPatients.length} records
          </Badge>
        }
      >
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Patient Code</th>
                <th>Patient Details</th>
                <th style={{ width: 140 }}>Age / Gender</th>
                <th style={{ width: 150 }}>Phone Number</th>
                <th>Referred By</th>
                <th style={{ width: 130 }}>Registered Date</th>
                <th style={{ width: 130, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingPatients ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--color-muted)" }}>
                    <span className="ui-spinner" style={{ marginRight: 8 }} /> Loading registered patients...
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center" }}>
                    <EmptyState
                      compact
                      icon={<Users size={32} style={{ color: "var(--color-muted)" }} />}
                      title={searchQuery ? "No matching patients found" : "No patients registered"}
                      subtitle={
                        searchQuery
                          ? `No patient records match "${searchQuery}". Try a different name, code, or phone.`
                          : "Patients registered through Patient Intake will automatically appear here."
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          fontSize: 11,
                          color: "var(--color-primary)",
                          background: "rgba(79, 70, 229, 0.08)",
                          padding: "2px 6px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid rgba(79, 70, 229, 0.2)",
                        }}
                      >
                        {patient.patient_code || `PID-${patient.id}`}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 12.5 }}>
                        {patient.name}
                      </div>
                    </td>

                    <td style={{ fontSize: 11.5, color: "var(--color-text)" }}>
                      {getAgeDisplay(patient.age_value, patient.age_unit)}
                      {patient.gender ? ` • ${patient.gender}` : ""}
                    </td>

                    <td>
                      {patient.phone ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>
                          <Phone size={11} style={{ color: "var(--color-muted)" }} />
                          {patient.phone}
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: 12, color: "var(--color-text)" }}>
                        {patient.referred_by || "Self / Walk-in"}
                      </div>
                    </td>

                    <td style={{ fontSize: 11, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                      {patient.created_at ? formatDateOnly(patient.created_at) : "—"}
                    </td>

                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Button
                          type="button"
                          onClick={() => handleOpenHistory(patient)}
                          variant="outline"
                          size="sm"
                          icon={<Eye size={12} />}
                          title="View complete clinical and billing history"
                        >
                          History
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleStartEdit(patient)}
                          variant="secondary"
                          size="sm"
                          icon={<Edit3 size={12} />}
                          title="Edit patient demographics"
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleStartDelete(patient)}
                          variant="danger"
                          size="sm"
                          icon={<Trash2 size={12} />}
                          title="Delete patient record"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Patient Detailed History Modal */}
      {selectedPatient && (
        <Modal
          isOpen={Boolean(selectedPatient)}
          onClose={handleCloseHistory}
          title={selectedPatient.name}
          subtitle={`Patient Code: ${selectedPatient.patient_code || `PID-${selectedPatient.id}`} • ${getAgeDisplay(selectedPatient.age_value, selectedPatient.age_unit)}${selectedPatient.gender ? ` (${selectedPatient.gender})` : ""}${selectedPatient.phone ? ` • Phone: ${selectedPatient.phone}` : ""}`}
          maxWidth="4xl"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Top KPI Summary Bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 8,
                padding: "8px 12px",
                background: "var(--color-surface-soft)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div>
                <span style={{ fontSize: 10, textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700, display: "block" }}>
                  Lifetime Orders
                </span>
                <strong style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                  {historyKpis.totalOrders}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: 10, textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700, display: "block" }}>
                  Total Billed
                </span>
                <strong style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                  {formatCurrency(historyKpis.totalBilled)}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: 10, textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700, display: "block" }}>
                  Total Paid
                </span>
                <strong style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: "var(--color-emerald-700)" }}>
                  {formatCurrency(historyKpis.totalPaid)}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: 10, textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700, display: "block" }}>
                  Due Balance
                </span>
                <strong style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: historyKpis.totalDue > 0 ? "var(--color-rose-700)" : "inherit" }}>
                  {formatCurrency(historyKpis.totalDue)}
                </strong>
              </div>
            </div>

            {/* Segmented Tab Controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderBottom: "1px solid var(--color-border)",
                paddingBottom: 6,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: activeTab === "orders" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  background: activeTab === "orders" ? "rgba(79, 70, 229, 0.08)" : "var(--color-surface)",
                  color: activeTab === "orders" ? "var(--color-primary)" : "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                Orders ({history?.orders?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: activeTab === "payments" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  background: activeTab === "payments" ? "rgba(79, 70, 229, 0.08)" : "var(--color-surface)",
                  color: activeTab === "payments" ? "var(--color-primary)" : "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                Payments ({history?.payments?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("results")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: activeTab === "results" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  background: activeTab === "results" ? "rgba(79, 70, 229, 0.08)" : "var(--color-surface)",
                  color: activeTab === "results" ? "var(--color-primary)" : "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                Diagnostic Results ({history?.reports?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("timeline")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: activeTab === "timeline" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  background: activeTab === "timeline" ? "rgba(79, 70, 229, 0.08)" : "var(--color-surface)",
                  color: activeTab === "timeline" ? "var(--color-primary)" : "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                Timeline ({history?.timeline?.length || 0})
              </button>
            </div>

            {/* Tab Body Content */}
            {historyLoading ? (
              <div style={{ padding: 36, textAlign: "center", color: "var(--color-muted)" }}>
                <span className="ui-spinner" style={{ marginRight: 8 }} /> Loading complete patient medical records...
              </div>
            ) : !history ? (
              <EmptyState
                compact
                title="No history records"
                subtitle="Could not retrieve clinical history for this patient."
              />
            ) : (
              <div>
                {/* TAB 1: Orders */}
                {activeTab === "orders" && (
                  <div className="data-table-wrap" style={{ maxHeight: 380, overflow: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 90 }}>Order #</th>
                          <th>Tests Included</th>
                          <th style={{ width: 130 }}>Date</th>
                          <th style={{ width: 100, textAlign: "center" }}>Status</th>
                          <th style={{ width: 120, textAlign: "right" }}>Total (₹)</th>
                          <th style={{ width: 120, textAlign: "right" }}>Paid (₹)</th>
                          <th style={{ width: 140, textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.orders.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--color-muted)" }}>
                              No orders found for this patient.
                            </td>
                          </tr>
                        ) : (
                          history.orders.map((order) => {
                            const isPaid = Number(order.paid_amount || 0) >= Number(order.total_amount || 0);
                            return (
                              <tr key={order.id}>
                                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                                  #{order.id}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 12 }}>
                                    {order.test_names || "—"}
                                  </div>
                                </td>
                                <td style={{ fontSize: 11, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                                  {formatDateOnly(order.created_at)}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <Badge
                                    tone={
                                      order.status === "Completed"
                                        ? "success"
                                        : order.status === "Pending"
                                        ? "warning"
                                        : "info"
                                    }
                                    size="sm"
                                  >
                                    {order.status || "Pending"}
                                  </Badge>
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                                  {formatCurrency(order.total_amount)}
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: isPaid ? "var(--color-emerald-700)" : "inherit" }}>
                                  {formatCurrency(order.paid_amount)}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                    {onViewReport && (
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          handleCloseHistory();
                                          onViewReport(order.id);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        icon={<FileText size={11} />}
                                      >
                                        Report
                                      </Button>
                                    )}
                                    {onViewReceipt && (
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          handleCloseHistory();
                                          onViewReceipt(order.id);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        icon={<CreditCard size={11} />}
                                      >
                                        Receipt
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 2: Payments */}
                {activeTab === "payments" && (
                  <div className="data-table-wrap" style={{ maxHeight: 380, overflow: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 90 }}>Order #</th>
                          <th>Invoice Reference</th>
                          <th style={{ width: 140 }}>Payment Date</th>
                          <th style={{ width: 130, textAlign: "right" }}>Total Bill (₹)</th>
                          <th style={{ width: 130, textAlign: "right" }}>Paid Amount (₹)</th>
                          <th style={{ width: 130, textAlign: "right" }}>Due Balance (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.payments.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--color-muted)" }}>
                              No payment transactions recorded for this patient.
                            </td>
                          </tr>
                        ) : (
                          history.payments.map((payment, idx) => {
                            const total = Number(payment.total_amount || 0);
                            const paid = Number(payment.new_paid || 0);
                            const due = Math.max(total - paid, 0);

                            return (
                              <tr key={payment.id || idx}>
                                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                                  #{payment.order_id}
                                </td>
                                <td>
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                                    {payment.invoice_no || `INV-${payment.order_id}`}
                                  </span>
                                </td>
                                <td style={{ fontSize: 11, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                                  {formatDate(payment.created_at)}
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                                  {formatCurrency(total)}
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-emerald-700)", fontWeight: 600 }}>
                                  {formatCurrency(paid)}
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: due > 0 ? "var(--color-rose-700)" : "inherit" }}>
                                  {formatCurrency(due)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 3: Diagnostic Results */}
                {activeTab === "results" && (
                  <div className="data-table-wrap" style={{ maxHeight: 380, overflow: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Order #</th>
                          <th>Test Panel</th>
                          <th>Parameter</th>
                          <th style={{ width: 110 }}>Result Value</th>
                          <th style={{ width: 90 }}>Unit</th>
                          <th style={{ width: 120 }}>Reference Range</th>
                          <th style={{ width: 85, textAlign: "center" }}>Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.reports.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--color-muted)" }}>
                              No diagnostic results recorded for this patient yet.
                            </td>
                          </tr>
                        ) : (
                          history.reports.map((item, idx) => {
                            const flag = getFlagStatus(item.value, item.normal_range);

                            return (
                              <tr key={idx}>
                                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                                  #{item.order_id}
                                </td>
                                <td style={{ fontWeight: 600, fontSize: 12 }}>
                                  {item.test_name}
                                </td>
                                <td style={{ fontSize: 12 }}>
                                  {item.parameter_name}
                                </td>
                                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>
                                  {item.value || "—"}
                                </td>
                                <td style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
                                  {item.unit || "—"}
                                </td>
                                <td style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
                                  {item.normal_range || "—"}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  {flag === "High" ? (
                                    <span className="result-flag-badge result-flag-badge--high">High</span>
                                  ) : flag === "Low" ? (
                                    <span className="result-flag-badge result-flag-badge--low">Low</span>
                                  ) : flag === "Normal" ? (
                                    <span className="result-flag-badge result-flag-badge--normal">Normal</span>
                                  ) : (
                                    <span style={{ color: "var(--color-muted)", fontSize: 11 }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 4: Timeline */}
                {activeTab === "timeline" && (
                  <div style={{ maxHeight: 380, overflow: "auto", padding: "8px 4px" }}>
                    {history.timeline.length === 0 ? (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--color-muted)", fontSize: 12 }}>
                        No timeline events recorded.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {history.timeline.map((entry, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 12,
                              padding: "8px 12px",
                              background: "var(--color-surface-soft)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            <div style={{ marginTop: 2, color: "var(--color-primary)" }}>
                              {entry.event_type === "order_created" ? (
                                <FileText size={14} />
                              ) : entry.event_type === "payment_made" ? (
                                <CreditCard size={14} style={{ color: "var(--color-emerald-600)" }} />
                              ) : entry.event_type === "results_entered" ? (
                                <FlaskConical size={14} style={{ color: "var(--color-indigo-600)" }} />
                              ) : (
                                <Activity size={14} />
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>
                                {entry.description}
                              </div>
                              <div style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 2 }}>
                                {formatDate(entry.timestamp)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Edit3 size={12} />}
                  onClick={() => handleStartEdit(selectedPatient)}
                >
                  Edit Demographics
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={12} />}
                  onClick={() => handleStartDelete(selectedPatient)}
                >
                  Delete Patient Record
                </Button>
              </div>
              <Button variant="secondary" size="sm" onClick={handleCloseHistory}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Patient Demographics Modal */}
      {editModalOpen && editingPatient && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => {
            if (!savingEdit) {
              setEditModalOpen(false);
              setEditingPatient(null);
            }
          }}
          title="Edit Patient Details"
          subtitle={`Editing demographics for ${editingPatient.patient_code || `PID-${editingPatient.id}`}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label" htmlFor="edit-patient-name">
                Full Name *
              </label>
              <Input
                id="edit-patient-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Patient Full Name"
                disabled={savingEdit}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="form-label" htmlFor="edit-patient-age">
                  Age & Unit *
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <Input
                    id="edit-patient-age"
                    type="number"
                    value={editAgeValue}
                    min={0}
                    max={150}
                    onChange={(e) =>
                      setEditAgeValue(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    disabled={savingEdit}
                    placeholder="Age"
                    style={{ flex: 1 }}
                    required
                  />
                  <select
                    id="edit-patient-age-unit"
                    value={editAgeUnit}
                    onChange={(e) => setEditAgeUnit(e.target.value as AgeUnit)}
                    disabled={savingEdit}
                    className="ui-input"
                    style={{ width: 85 }}
                  >
                    <option value="Years">Years</option>
                    <option value="Months">Months</option>
                    <option value="Days">Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="edit-patient-gender">
                  Gender *
                </label>
                <select
                  id="edit-patient-gender"
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as Gender)}
                  disabled={savingEdit}
                  className="ui-input"
                  style={{ width: "100%" }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="form-label" htmlFor="edit-patient-phone">
                  Phone Number
                </label>
                <Input
                  id="edit-patient-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="10-digit mobile (optional)"
                  disabled={savingEdit}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="edit-patient-referred-by">
                  Referred By
                </label>
                <input
                  id="edit-patient-referred-by"
                  list="edit-doctors-list"
                  value={editReferredBy}
                  onChange={(e) => setEditReferredBy(e.target.value)}
                  placeholder="Doctor name or Self"
                  disabled={savingEdit}
                  className="ui-input"
                  style={{ width: "100%" }}
                />
                <datalist id="edit-doctors-list">
                  <option value="Self" />
                  {doctorsList.map((doc) => (
                    <option key={doc} value={doc} />
                  ))}
                </datalist>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingPatient(null);
                }}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingEdit}
                disabled={!editName.trim() || editAgeValue === ""}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Patient Confirmation Dialog */}
      {deleteConfirmPatient && (
        <ConfirmationDialog
          open={Boolean(deleteConfirmPatient)}
          title={`Delete Patient Record: ${deleteConfirmPatient.name}?`}
          description={`Are you sure you want to delete patient "${deleteConfirmPatient.name}" (${deleteConfirmPatient.patient_code || `PID-${deleteConfirmPatient.id}`})? All associated medical history, tests, reports, and billing data will also be permanently deleted. This action cannot be undone.`}
          confirmLabel={deletingPatient ? "Deleting..." : "Permanently Delete"}
          cancelLabel="Keep Record"
          danger
          loading={deletingPatient}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (!deletingPatient) setDeleteConfirmPatient(null);
          }}
        />
      )}

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