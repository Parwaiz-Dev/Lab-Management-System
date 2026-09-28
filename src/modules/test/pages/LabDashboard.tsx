import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  FileText,
  CreditCard,
  Wallet,
  RotateCcw,
  FileDown,
  Filter,
  Users,
  Eye,
  Receipt,
  MoreVertical,
  Ban,
} from "lucide-react";
import {
  exportOrdersToPdf,
  exportDoctorRevenueToPdf,
} from "../../../utils/exportUtils";
import PaymentModal from "../components/PaymentModal";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import Toast from "../../../components/ui/Toast";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import SearchInput from "../../../components/ui/SearchInput";
import StatCard from "../../../components/ui/StatCard";
import Modal from "../../../components/ui/Modal";
import EmptyState from "../../../components/ui/EmptyState";
import type { DashboardOrderRow, DoctorRevenueRow } from "../../../types";
import { getErrorMessage, money, testService } from "../services/testService";

type LabDashboardProps = {
  onSelectOrder: (orderId: number) => void;
  onOpenReceipt: (orderId: number) => void;
  onEditOrder?: (orderId: number) => void;
};

export default function LabDashboard({
  onSelectOrder,
  onOpenReceipt,
  onEditOrder,
}: LabDashboardProps) {
  const [orders, setOrders] = useState<DashboardOrderRow[]>([]);
  const [paymentModal, setPaymentModal] = useState<DashboardOrderRow | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [doctorRevenue, setDoctorRevenue] = useState<DoctorRevenueRow[]>([]);
  const [showRevenue, setShowRevenue] = useState(false);
  const [cancelDialogOrderId, setCancelDialogOrderId] = useState<number | null>(null);
  const [statusDialog, setStatusDialog] = useState<{
    orderId: number;
    newStatus: string;
    label: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (menuOpen === null) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const loadOrders = useCallback(async () => {
    const data = await testService.getOrders();
    setOrders(data);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      await loadOrders();
    } finally {
      setLoading(false);
    }
  }, [loadOrders]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const applyDateFilter = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      await loadOrders();
      return;
    }
    try {
      setLoading(true);
      const data = await testService.getOrdersByDateRange(dateFrom, dateTo);
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, loadOrders]);

  const handleClearDateFilter = useCallback(async () => {
    setDateFrom("");
    setDateTo("");
    await loadOrders();
  }, [loadOrders]);

  const loadDoctorRevenue = useCallback(async () => {
    const from = dateFrom || "";
    const to = dateTo || "";
    try {
      const data = await testService.getDoctorRevenue(from, to);
      setDoctorRevenue(data);
      setShowRevenue(true);
    } catch {
      setDoctorRevenue([]);
      setToast({
        message: "Could not load doctor revenue. Check the database connection and try again.",
        tone: "error",
      });
      setShowRevenue(true);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openRevenue") === "1") {
      void loadDoctorRevenue();
    }
    const payId = params.get("openPayment");
    if (payId && orders.length > 0) {
      const target = orders.find((o) => o.id === Number(payId)) || orders[0];
      if (target) setPaymentModal(target);
    }
  }, [orders, loadDoctorRevenue]);

  const handleConfirmCancel = useCallback(async () => {
    if (cancelDialogOrderId === null) return;
    try {
      await testService.cancelOrder(cancelDialogOrderId);
      setToast({ message: "Order cancelled successfully.", tone: "success" });
      await loadOrders();
    } catch (err) {
      setToast({
        message: getErrorMessage(err, "Failed to cancel order."),
        tone: "error",
      });
    } finally {
      setCancelDialogOrderId(null);
    }
  }, [cancelDialogOrderId, loadOrders]);

  const handleConfirmStatusChange = useCallback(async () => {
    if (!statusDialog) return;
    try {
      await testService.updateOrderStatus(
        statusDialog.orderId,
        statusDialog.newStatus,
      );
      setToast({
        message: `Order marked as ${statusDialog.newStatus}.`,
        tone: "success",
      });
      await loadOrders();
    } catch (err) {
      setToast({
        message: getErrorMessage(err, "Failed to update status."),
        tone: "error",
      });
    } finally {
      setStatusDialog(null);
    }
  }, [statusDialog, loadOrders]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();

    if (!text) return orders;

    return orders.filter((order) =>
      `${order.id} ${order.patientName || ""} ${order.tests || ""} ${order.paymentStatus || ""} ${order.reportStatus || ""}`
        .toLowerCase()
        .includes(text)
    );
  }, [orders, query]);

  const dateRangeLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Up to ${dateTo}`;
    return "All Time";
  }, [dateFrom, dateTo]);

  const handleExportOrdersPdf = useCallback(async () => {
    try {
      const savedPath = await exportOrdersToPdf(filteredOrders, dateRangeLabel);
      if (savedPath) {
        setToast({
          message: `PDF exported successfully to ${savedPath}`,
          tone: "success",
        });
      }
    } catch (err) {
      setToast({
        message: getErrorMessage(err, "Failed to export PDF."),
        tone: "error",
      });
    }
  }, [filteredOrders, dateRangeLabel]);

  const handleExportDoctorRevenuePdf = useCallback(async () => {
    try {
      const savedPath = await exportDoctorRevenueToPdf(doctorRevenue, dateRangeLabel);
      if (savedPath) {
        setToast({
          message: `PDF exported successfully to ${savedPath}`,
          tone: "success",
        });
      }
    } catch (err) {
      setToast({
        message: getErrorMessage(err, "Failed to export doctor revenue PDF."),
        tone: "error",
      });
    }
  }, [doctorRevenue, dateRangeLabel]);

  // Derived KPI calculations
  const pendingCollectionsCount = useMemo(() => {
    return orders.filter(
      (order) => String(order.paymentStatus).toLowerCase() !== "completed"
    ).length;
  }, [orders]);

  const pendingReportsCount = useMemo(() => {
    return orders.filter(
      (order) =>
        String(order.reportStatus || "Pending").toLowerCase() !== "completed"
    ).length;
  }, [orders]);

  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  }, [orders]);

  const totalCollected = useMemo(() => {
    return orders.reduce((sum, o) => sum + Number(o.paidAmount || 0), 0);
  }, [orders]);

  const totalDue = useMemo(() => {
    return Math.max(totalRevenue - totalCollected, 0);
  }, [totalRevenue, totalCollected]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 4 Primary KPI Cards (Chavan Saree Center compact stat cards) */}
      <div className="dashboard-kpi-grid">
        <StatCard
          title="Total Orders"
          value={orders.length}
          subtext={`Filtered: ${filteredOrders.length} records`}
          icon={<ClipboardList size={18} />}
          tone="indigo"
        />

        <StatCard
          title="Pending Reports"
          value={pendingReportsCount}
          subtext="Awaiting result entry"
          icon={<FileText size={18} />}
          tone="amber"
        />

        <StatCard
          title="Due Collections"
          value={money(totalDue)}
          subtext={`${pendingCollectionsCount} pending bills`}
          icon={<CreditCard size={18} />}
          tone="rose"
        />

        <StatCard
          title="Total Collected"
          value={money(totalCollected)}
          subtext={`Billed: ${money(totalRevenue)}`}
          icon={<Wallet size={18} />}
          tone="emerald"
        />
      </div>

      {/* Filter and Toolbar Bar (Matching Chavan Saree Center filter bar) */}
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
        <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
          <SearchInput
            value={query}
            onChangeValue={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search Order #, Patient, Test, Status..."
            sizeVariant="sm"
          />
        </div>

        {/* Date Range & Action Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-muted)" }}>
            <span style={{ fontWeight: 600 }}>Date:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="ui-input ui-input--sm"
              style={{ width: 130 }}
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="ui-input ui-input--sm"
              style={{ width: 130 }}
            />
            <Button
              type="button"
              onClick={applyDateFilter}
              variant="secondary"
              size="sm"
              disabled={loading || !dateFrom || !dateTo}
              icon={<Filter size={12} />}
            >
              Filter
            </Button>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={handleClearDateFilter}
                style={{ fontSize: 11, color: "var(--color-danger)", fontWeight: 600, padding: "2px 6px" }}
              >
                Clear
              </button>
            )}
          </div>

          <span style={{ width: 1, height: 20, background: "var(--color-border)" }} />

          <Button
            type="button"
            onClick={loadDoctorRevenue}
            variant="outline"
            size="sm"
            icon={<Users size={12} />}
          >
            Doctor Revenue
          </Button>

          <Button
            type="button"
            onClick={handleExportOrdersPdf}
            variant="outline"
            size="sm"
            disabled={filteredOrders.length === 0}
            icon={<FileDown size={12} />}
            title="Save filtered orders to PDF"
          >
            Export PDF
          </Button>

          <Button
            type="button"
            onClick={loadAll}
            variant="secondary"
            size="sm"
            disabled={loading}
            icon={<RotateCcw size={12} />}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Main Orders Table (Chavan compact table style) */}
      <Card
        compact
        title="Order Worklist"
        eyebrow="OPERATIONAL QUEUE"
        badge={
          <Badge tone="neutral">
            {filteredOrders.length} orders
          </Badge>
        }
      >
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Order #</th>
                <th>Patient Details</th>
                <th>Tests Ordered</th>
                <th style={{ width: 110, textAlign: "center" }}>Report</th>
                <th style={{ width: 150, textAlign: "right" }}>Billing (Total / Due)</th>
                <th style={{ width: 100, textAlign: "center" }}>Payment</th>
                <th style={{ width: 170, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--color-muted)" }}>
                    <span className="ui-spinner" style={{ marginRight: 8 }} /> Loading lab orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center" }}>
                    <EmptyState
                      compact
                      title="No matching orders found"
                      subtitle={query ? "Try adjusting your search query or date filter." : "Create an order from Patient Intake to get started."}
                    />
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const orderId = Number(order.id);
                  const reportStatus = order.reportStatus || "Pending";
                  const paymentStatus = order.paymentStatus || "Pending";
                  const total = Number(order.totalAmount || 0);
                  const paid = Number(order.paidAmount || 0);
                  const pending = Math.max(total - paid, 0);
                  const isCompletedPayment = String(paymentStatus).toLowerCase() === "completed";

                  let reportTone: "success" | "warning" | "info" | "neutral" = "warning";
                  if (reportStatus === "Completed") reportTone = "success";
                  else if (reportStatus === "In Progress") reportTone = "info";
                  else if (reportStatus === "Cancelled") reportTone = "neutral";

                  let paymentTone: "success" | "warning" | "danger" | "neutral" = "danger";
                  if (isCompletedPayment) paymentTone = "success";
                  else if (paid > 0) paymentTone = "warning";

                  return (
                    <tr key={orderId}>
                      {/* Order ID */}
                      <td>
                        <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                          #{orderId}
                        </span>
                      </td>

                      {/* Patient Name */}
                      <td>
                        <strong style={{ display: "block", color: "var(--color-text)", fontWeight: 600 }}>
                          {order.patientName || "Unknown Patient"}
                        </strong>
                      </td>

                      {/* Tests */}
                      <td style={{ maxWidth: 260 }}>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "var(--color-text-soft)",
                            fontSize: 12,
                          }}
                          title={order.tests}
                        >
                          {order.tests || "—"}
                        </span>
                      </td>

                      {/* Report Status */}
                      <td style={{ textAlign: "center" }}>
                        <Badge tone={reportTone}>{reportStatus}</Badge>
                      </td>

                      {/* Billing Amount & Pending */}
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: "var(--color-text)", display: "block" }}>
                          {money(total)}
                        </span>
                        <span style={{ fontSize: 11, color: pending > 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                          {pending > 0 ? `Due: ${money(pending)}` : "Fully Paid"}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td style={{ textAlign: "center" }}>
                        <Badge tone={paymentTone}>{paymentStatus}</Badge>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {!isCompletedPayment && (
                            <button
                              type="button"
                              onClick={() => setPaymentModal(order)}
                              className="table-action-btn"
                              style={{ background: "var(--color-success-soft)", color: "var(--color-success-text)", borderColor: "var(--color-success-border)" }}
                              title="Record Payment"
                            >
                              Pay
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onSelectOrder(orderId)}
                            className="table-action-btn"
                            title="Enter or View Results"
                          >
                            <Eye size={12} />
                            <span>Results</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenReceipt(orderId)}
                            className="table-action-btn"
                            title="Print Payment Receipt"
                          >
                            <Receipt size={12} />
                            <span>Receipt</span>
                          </button>

                          {/* Context Menu for Cancel / Reopen / Edit */}
                          <div
                            style={{ position: "relative" }}
                            ref={menuOpen === orderId ? menuRef : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => setMenuOpen((prev) => (prev === orderId ? null : orderId))}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "var(--radius-sm)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--color-muted)",
                                border: "1px solid var(--color-border)",
                              }}
                              aria-label="More order actions"
                            >
                              <MoreVertical size={12} />
                            </button>

                            {menuOpen === orderId && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "100%",
                                  marginTop: 4,
                                  zIndex: 40,
                                  background: "var(--color-surface)",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: "var(--radius-md)",
                                  boxShadow: "var(--shadow-md)",
                                  padding: 4,
                                  minWidth: 120,
                                }}
                              >
                                {reportStatus !== "Cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuOpen(null);
                                      setCancelDialogOrderId(orderId);
                                    }}
                                    style={{
                                      width: "100%",
                                      textAlign: "left",
                                      padding: "6px 8px",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "var(--color-danger)",
                                      borderRadius: "var(--radius-sm)",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <Ban size={12} />
                                    <span>Cancel Order</span>
                                  </button>
                                )}
                                {reportStatus === "In Progress" && onEditOrder && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuOpen(null);
                                      onEditOrder(orderId);
                                    }}
                                    style={{
                                      width: "100%",
                                      textAlign: "left",
                                      padding: "6px 8px",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "var(--color-text)",
                                      borderRadius: "var(--radius-sm)",
                                    }}
                                  >
                                    Add Test
                                  </button>
                                )}
                                {reportStatus === "Cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuOpen(null);
                                      setStatusDialog({
                                        orderId,
                                        newStatus: "Pending",
                                        label: "Reopen",
                                      });
                                    }}
                                    style={{
                                      width: "100%",
                                      textAlign: "left",
                                      padding: "6px 8px",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "var(--color-primary)",
                                      borderRadius: "var(--radius-sm)",
                                    }}
                                  >
                                    Reopen
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Doctor Revenue Modal Dialog (Matching Chavan Saree Center Modal) */}
      <Modal
        isOpen={showRevenue}
        onClose={() => setShowRevenue(false)}
        title="Doctor Revenue & Referral Breakdown"
        subtitle={`Period: ${dateFrom || "All time"} to ${dateTo || "Today"}`}
        maxWidth="lg"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Compact summary strip with PDF export action */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 12px",
              background: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>Doctors: <strong>{doctorRevenue.length}</strong></span>
              <span style={{ width: 1, height: 12, background: "var(--color-border)" }} />
              <span>Referrals: <strong style={{ fontFamily: "var(--font-mono)" }}>{doctorRevenue.reduce((s, d) => s + Number(d.referral_count ?? d.order_count ?? 0), 0)}</strong></span>
              <span style={{ width: 1, height: 12, background: "var(--color-border)" }} />
              <span>Billed: <strong style={{ fontFamily: "var(--font-mono)" }}>{money(doctorRevenue.reduce((s, d) => s + Number(d.eligible_amount ?? d.total_amount ?? 0), 0))}</strong></span>
              <span style={{ width: 1, height: 12, background: "var(--color-border)" }} />
              <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                Doctor Share: <strong style={{ fontFamily: "var(--font-mono)" }}>{money(doctorRevenue.reduce((s, d) => s + Number(d.commission_earned ?? d.share_amount ?? 0), 0))}</strong>
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportDoctorRevenuePdf}
              disabled={doctorRevenue.length === 0}
              icon={<FileDown size={12} />}
              title="Save Doctor Revenue Statement to PDF"
            >
              Export PDF
            </Button>
          </div>

          {doctorRevenue.length === 0 ? (
            <EmptyState
              compact
              title="No referral revenue records"
              subtitle="No registered doctors or orders recorded for the selected period."
            />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table doctor-revenue-table">
                <thead>
                  <tr>
                    <th>Doctor / Referring Clinic</th>
                    <th style={{ textAlign: "center", width: 75 }}>Referrals</th>
                    <th style={{ textAlign: "right", width: 110 }}>Billed (₹)</th>
                    <th style={{ textAlign: "right", width: 100 }}>Paid (₹)</th>
                    <th style={{ textAlign: "right", width: 100 }}>Due (₹)</th>
                    <th style={{ textAlign: "center", width: 85 }}>Share %</th>
                    <th style={{ textAlign: "right", width: 120 }}>Commission (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorRevenue.map((doc, idx) => {
                    const refCount = Number(doc.referral_count ?? doc.order_count ?? 0);
                    const totalBilled = Number(doc.eligible_amount ?? doc.total_amount ?? 0);
                    const paid = Number(doc.paid_amount ?? doc.commission_paid ?? 0);
                    const pending = Number(doc.pending_amount ?? Math.max(totalBilled - paid, 0));
                    const sharePct = Number(doc.share_percentage ?? 0);
                    const commission = Number(
                      doc.commission_earned ?? doc.share_amount ?? (totalBilled * sharePct) / 100
                    );

                    return (
                      <tr key={doc.doctor_id ?? `${doc.doctor_name}-${idx}`}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>
                            {doc.doctor_name || "Self / Walk-in"}
                          </div>
                          {refCount === 0 && (
                            <span style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 500 }}>
                              Registered (No orders yet)
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>
                          {refCount}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {money(totalBilled)}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--color-emerald-700)", fontFamily: "var(--font-mono)" }}>
                          {money(paid)}
                        </td>
                        <td style={{ textAlign: "right", color: pending > 0 ? "var(--color-rose-700)" : "inherit", fontFamily: "var(--font-mono)" }}>
                          {money(pending)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="doctor-revenue-badge">
                            {sharePct}%
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-primary)" }}>
                          {money(commission)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total Summary Row */}
                  <tr style={{ background: "var(--color-surface-soft)", fontWeight: 700, borderTop: "2px solid var(--color-border)" }}>
                    <td>Total</td>
                    <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>
                      {doctorRevenue.reduce((s, d) => s + Number(d.referral_count ?? d.order_count ?? 0), 0)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {money(doctorRevenue.reduce((s, d) => s + Number(d.eligible_amount ?? d.total_amount ?? 0), 0))}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--color-emerald-700)", fontFamily: "var(--font-mono)" }}>
                      {money(doctorRevenue.reduce((s, d) => s + Number(d.paid_amount ?? d.commission_paid ?? 0), 0))}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--color-rose-700)", fontFamily: "var(--font-mono)" }}>
                      {money(doctorRevenue.reduce((s, d) => s + Number(d.pending_amount ?? Math.max((d.eligible_amount ?? d.total_amount ?? 0) - (d.paid_amount ?? d.commission_paid ?? 0), 0)), 0))}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--color-muted)", fontSize: 11 }}>—</td>
                    <td style={{ textAlign: "right", color: "var(--color-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                      {money(doctorRevenue.reduce((s, d) => s + Number(d.commission_earned ?? d.share_amount ?? 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" size="sm" onClick={() => setShowRevenue(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      {paymentModal && (
        <PaymentModal
          order={paymentModal}
          onClose={() => setPaymentModal(null)}
          onDone={loadAll}
        />
      )}

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={cancelDialogOrderId !== null}
        title="Cancel Order"
        description="Are you sure you want to cancel this order? This action will mark the report as cancelled."
        confirmLabel="Cancel Order"
        cancelLabel="Keep Order"
        danger
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelDialogOrderId(null)}
      />

      <ConfirmationDialog
        open={statusDialog !== null}
        title={`${statusDialog?.label} Order`}
        description={`Set order #${statusDialog?.orderId} status to "${statusDialog?.newStatus}"?`}
        confirmLabel={statusDialog?.label || "Confirm"}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusDialog(null)}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}