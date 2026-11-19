import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  EyeOff,
  Receipt,
  MoreVertical,
  Ban,
  Plus,
  Pencil,
} from "lucide-react";
import {
  exportOrdersToPdf,
  exportDoctorRevenueToPdf,
} from "../../../utils/exportUtils";
import PaymentModal from "../components/PaymentModal";
import AddTestModal from "../components/AddTestModal";
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
  onOpenReport?: (orderId: number) => void;
  onEditOrder?: (orderId: number) => void;
  userRole?: string;
};

export type QuickFilterMode = "today" | "yesterday" | "last3" | "last7" | "custom";

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getFilterRange = (mode: "today" | "yesterday" | "last3" | "last7"): { from: string; to: string } => {
  const now = new Date();
  const today = formatLocalDate(now);

  if (mode === "today") {
    return { from: today, to: today };
  }
  if (mode === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = formatLocalDate(y);
    return { from: yStr, to: yStr };
  }
  if (mode === "last3") {
    const d = new Date(now);
    d.setDate(d.getDate() - 2); // Today and the previous two calendar days = 3 days
    return { from: formatLocalDate(d), to: today };
  }
  if (mode === "last7") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6); // Today and the previous six calendar days = 7 days
    return { from: formatLocalDate(d), to: today };
  }
  return { from: today, to: today };
};

export default function LabDashboard({
  onSelectOrder,
  onOpenReceipt,
  onOpenReport,
  onEditOrder: _onEditOrder,
  userRole,
}: LabDashboardProps) {
  const initialToday = useMemo(() => getFilterRange("today").from, []);
  const [filterMode, setFilterMode] = useState<QuickFilterMode>("today");
  const [orders, setOrders] = useState<DashboardOrderRow[]>([]);
  const [totalCollectedAmount, setTotalCollectedAmount] = useState<number>(0);
  const [paymentModal, setPaymentModal] = useState<DashboardOrderRow | null>(null);
  const [addTestOrder, setAddTestOrder] = useState<DashboardOrderRow | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(initialToday);
  const [dateTo, setDateTo] = useState(initialToday);
  const [doctorRevenue, setDoctorRevenue] = useState<DoctorRevenueRow[]>([]);
  const [showRevenue, setShowRevenue] = useState(false);
  const [cancelDialogOrderId, setCancelDialogOrderId] = useState<number | null>(null);
  const [statusDialog, setStatusDialog] = useState<{
    orderId: number;
    newStatus: string;
    label: string;
  } | null>(null);

  // Edit Lab Reference Number Dialog State
  const [editRefOrder, setEditRefOrder] = useState<{
    id: number;
    currentRef: string;
  } | null>(null);
  const [newRefInput, setNewRefInput] = useState("");
  const [editRefError, setEditRefError] = useState<string | null>(null);
  const [savingRef, setSavingRef] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  const [hideFinancials, setHideFinancials] = useState<boolean>(() => {
    try {
      return localStorage.getItem("localims_hide_financials") === "true";
    } catch {
      return false;
    }
  });

  const toggleHideFinancials = useCallback(() => {
    setHideFinancials((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("localims_hide_financials", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Pagination
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (menuOpen === null) return;

    const handleClose = (e?: Event) => {
      if (e && e.type === "mousedown") {
        const target = e.target as Node;
        if (menuRef.current?.contains(target)) return;
        if (activeButtonRef.current?.contains(target)) return;
      }
      setMenuOpen(null);
      setMenuPosition(null);
      activeButtonRef.current = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(null);
        setMenuPosition(null);
        activeButtonRef.current = null;
      }
    };

    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Reset three-dot menu when page, query, or date filter changes
  useEffect(() => {
    setMenuOpen(null);
    setMenuPosition(null);
    activeButtonRef.current = null;
  }, [currentPage, query, filterMode, dateFrom, dateTo]);

  const loadDashboardData = useCallback(async (from: string, to: string) => {
    const fromVal = from || to;
    const toVal = to || from;
    const [ordersData, collections] = await Promise.all([
      testService.getOrdersByDateRange(fromVal, toVal),
      testService.getCollectionsByDateRange(fromVal, toVal),
    ]);
    setOrders(ordersData);
    setTotalCollectedAmount(collections);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      await loadDashboardData(dateFrom, dateTo);
    } finally {
      setLoading(false);
    }
  }, [loadDashboardData, dateFrom, dateTo]);

  useEffect(() => {
    void loadAll();
  }, []); // Defaults to today's orders on mount

  const handleSelectQuickFilter = useCallback(async (mode: "today" | "yesterday" | "last3" | "last7") => {
    const { from, to } = getFilterRange(mode);
    setFilterMode(mode);
    setDateFrom(from);
    setDateTo(to);
    setLoading(true);
    try {
      await loadDashboardData(from, to);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, [loadDashboardData]);

  const handleSelectCustomMode = useCallback(() => {
    setFilterMode("custom");
  }, []);

  const applyCustomFilter = useCallback(async () => {
    if (!dateFrom && !dateTo) return;
    const from = dateFrom || dateTo;
    const to = dateTo || dateFrom;
    setLoading(true);
    try {
      await loadDashboardData(from, to);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, loadDashboardData]);

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
      await loadDashboardData(dateFrom, dateTo);
    } catch (err) {
      setToast({
        message: getErrorMessage(err, "Failed to cancel order."),
        tone: "error",
      });
    } finally {
      setCancelDialogOrderId(null);
    }
  }, [cancelDialogOrderId, loadDashboardData, dateFrom, dateTo]);

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
      await loadDashboardData(dateFrom, dateTo);
    } catch (err) {
      setToast({
        message: getErrorMessage(err, "Failed to update status."),
        tone: "error",
      });
    } finally {
      setStatusDialog(null);
    }
  }, [statusDialog, loadDashboardData, dateFrom, dateTo]);

  const handleOpenEditRef = useCallback((order: DashboardOrderRow) => {
    setMenuOpen(null);
    setMenuPosition(null);
    activeButtonRef.current = null;
    const currentRef = order.orderNumber || `#${order.id}`;
    setEditRefOrder({ id: order.id, currentRef });
    setNewRefInput(order.orderNumber || "");
    setEditRefError(null);
  }, []);

  const handleSaveEditRef = useCallback(async () => {
    if (!editRefOrder) return;
    const clean = newRefInput.trim();
    if (!clean) {
      setEditRefError("Lab Reference Number cannot be empty");
      return;
    }
    if (clean.length > 20) {
      setEditRefError("Lab Reference Number cannot exceed 20 characters");
      return;
    }
    if (!/^[a-zA-Z0-9\-_/.]+$/.test(clean)) {
      setEditRefError("Only letters, numbers, hyphens, underscores, slashes, or dots are allowed");
      return;
    }

    // If unchanged, simply close without modifying or logging
    if (clean === editRefOrder.currentRef) {
      setEditRefOrder(null);
      setEditRefError(null);
      return;
    }

    try {
      setSavingRef(true);
      setEditRefError(null);
      await testService.updateOrderReferenceNumber(editRefOrder.id, clean);

      // Immediately refresh the displayed reference in local state without navigating away
      setOrders((prev) =>
        prev.map((o) => (o.id === editRefOrder.id ? { ...o, orderNumber: clean } : o))
      );

      setToast({
        message: `Lab Reference Number updated to "${clean}".`,
        tone: "success",
      });
      setEditRefOrder(null);
      setEditRefError(null);
    } catch (err) {
      setEditRefError(getErrorMessage(err, "Failed to update Lab Reference Number"));
    } finally {
      setSavingRef(false);
    }
  }, [editRefOrder, newRefInput]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();

    if (!text) return orders;

    return orders.filter((order) =>
      `${order.id} ${order.orderNumber || ""} ${order.patientCode || ""} ${order.invoiceNo || ""} ${order.patientName || ""} ${order.tests || ""} ${order.paymentStatus || ""} ${order.reportStatus || ""}`
        .toLowerCase()
        .includes(text)
    );
  }, [orders, query]);

  // Reset to page 1 whenever search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, safePage, PAGE_SIZE]);

  const dateRangeLabel = useMemo(() => {
    if (filterMode === "today") return `Today (${dateFrom})`;
    if (filterMode === "yesterday") return `Yesterday (${dateFrom})`;
    if (filterMode === "last3") return `Last 3 Days (${dateFrom} to ${dateTo})`;
    if (filterMode === "last7") return `Last 7 Days (${dateFrom} to ${dateTo})`;
    if (dateFrom && dateTo && dateFrom === dateTo) return dateFrom;
    if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Up to ${dateTo}`;
    return dateFrom || "Custom Range";
  }, [filterMode, dateFrom, dateTo]);

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

  // Derived KPI calculations (excluding cancelled orders from pending reports and due calculations)
  const activeOrders = useMemo(() => {
    return orders.filter(
      (order) => String(order.reportStatus || "").toLowerCase() !== "cancelled"
    );
  }, [orders]);

  const pendingCollectionsCount = useMemo(() => {
    return activeOrders.filter(
      (order) => String(order.paymentStatus).toLowerCase() !== "completed"
    ).length;
  }, [activeOrders]);

  const pendingReportsCount = useMemo(() => {
    return activeOrders.filter(
      (order) =>
        String(order.reportStatus || "Pending").toLowerCase() !== "completed"
    ).length;
  }, [activeOrders]);

  const totalRevenue = useMemo(() => {
    return activeOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  }, [activeOrders]);

  const totalDue = useMemo(() => {
    return activeOrders.reduce((sum, o) => {
      const total = Number(o.totalAmount || 0);
      const paid = Number(o.paidAmount || 0);
      return sum + Math.max(total - paid, 0);
    }, 0);
  }, [activeOrders]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 4 Primary KPI Cards (Chavan Saree Center compact stat cards) - Admin only */}
      {userRole === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
            <button
              type="button"
              onClick={toggleHideFinancials}
              title={hideFinancials ? "Show financial amounts" : "Hide financial amounts"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-muted)",
                background: "transparent",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: "3px 8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-text)";
                e.currentTarget.style.borderColor = "var(--color-border-strong)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-muted)";
                e.currentTarget.style.borderColor = "var(--color-border)";
              }}
            >
              {hideFinancials ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>{hideFinancials ? "Show Amounts" : "Hide Amounts"}</span>
            </button>
          </div>
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
              value={hideFinancials ? "••••••" : money(totalDue)}
              subtext={hideFinancials ? "••••••" : `${pendingCollectionsCount} pending bills`}
              icon={<CreditCard size={18} />}
              tone="rose"
            />

            <StatCard
              title="Total Collected"
              value={hideFinancials ? "••••••" : money(totalCollectedAmount)}
              subtext={hideFinancials ? "••••••" : `Orders Billed: ${money(totalRevenue)}`}
              icon={<Wallet size={18} />}
              tone="emerald"
            />
          </div>
        </div>
      )}

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

        {/* Quick Date Filters & Action Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
            <Button
              type="button"
              onClick={() => void handleSelectQuickFilter("today")}
              variant={filterMode === "today" ? "primary" : "secondary"}
              size="sm"
              disabled={loading}
            >
              Today
            </Button>
            <Button
              type="button"
              onClick={() => void handleSelectQuickFilter("yesterday")}
              variant={filterMode === "yesterday" ? "primary" : "secondary"}
              size="sm"
              disabled={loading}
            >
              Yesterday
            </Button>
            <Button
              type="button"
              onClick={() => void handleSelectQuickFilter("last3")}
              variant={filterMode === "last3" ? "primary" : "secondary"}
              size="sm"
              disabled={loading}
            >
              Last 3 Days
            </Button>
            <Button
              type="button"
              onClick={() => void handleSelectQuickFilter("last7")}
              variant={filterMode === "last7" ? "primary" : "secondary"}
              size="sm"
              disabled={loading}
            >
              Last 7 Days
            </Button>
            <Button
              type="button"
              onClick={handleSelectCustomMode}
              variant={filterMode === "custom" ? "primary" : "secondary"}
              size="sm"
              disabled={loading}
            >
              Custom Range
            </Button>
          </div>

          {filterMode === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-muted)" }}>
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
                onClick={applyCustomFilter}
                variant="secondary"
                size="sm"
                disabled={loading || (!dateFrom && !dateTo)}
                icon={<Filter size={12} />}
              >
                Filter
              </Button>
            </div>
          )}

          <span style={{ width: 1, height: 20, background: "var(--color-border)" }} />

          {userRole === "admin" && (
            <Button
              type="button"
              onClick={loadDoctorRevenue}
              variant="outline"
              size="sm"
              icon={<Users size={12} />}
            >
              Doctor Revenue
            </Button>
          )}

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
        <div className="data-table-wrap" style={{ minHeight: 240 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>LAB REF #</th>
                <th>Patient Details</th>
                <th>Tests Ordered</th>
                <th style={{ width: 110, textAlign: "center" }}>Report</th>
                <th style={{ width: 150, textAlign: "right" }}>Billing (Total / Due)</th>
                <th style={{ width: 100, textAlign: "center" }}>Payment</th>
                <th className="col-actions" style={{ width: 280, minWidth: 280, textAlign: "right" }}>Actions</th>
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
                paginatedOrders.map((order) => {
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
                          {order.orderNumber || `#${orderId}`}
                        </span>
                      </td>

                      {/* Patient Details: Name and Patient ID */}
                      <td>
                        <strong style={{ display: "block", color: "var(--color-text)", fontWeight: 600 }}>
                          {order.patientName || "Unknown Patient"}
                        </strong>
                        {order.patientCode && (
                          <span style={{ display: "block", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-soft)", marginTop: 2 }}>
                            {order.patientCode}
                          </span>
                        )}
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
                      <td className="col-actions" style={{ textAlign: "right", minWidth: 280, whiteSpace: "nowrap" }}>
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

                          {onOpenReport && (
                            <button
                              type="button"
                              onClick={() => onOpenReport(orderId)}
                              className="table-action-btn"
                              title="Preview or Print Clinical Report"
                            >
                              <FileText size={12} />
                              <span>Report</span>
                            </button>
                          )}

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
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                if (menuOpen === orderId) {
                                  setMenuOpen(null);
                                  setMenuPosition(null);
                                  activeButtonRef.current = null;
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const spaceBelow = window.innerHeight - rect.bottom;
                                  const spaceAbove = rect.top;
                                  const openUpward = spaceBelow < 110 && spaceAbove > spaceBelow;
                                  setMenuPosition({
                                    top: openUpward ? undefined : rect.bottom + 4,
                                    bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
                                    right: Math.max(8, window.innerWidth - rect.right),
                                  });
                                  setMenuOpen(orderId);
                                  activeButtonRef.current = e.currentTarget;
                                }
                              }}
                              style={{
                                width: 26,
                                height: 26,
                                minWidth: 26,
                                flexShrink: 0,
                                borderRadius: "var(--radius-sm)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--color-muted)",
                                border: "1px solid var(--color-border)",
                                cursor: "pointer",
                                background: menuOpen === orderId ? "var(--color-surface-hover)" : "var(--color-surface)",
                              }}
                              aria-label="More order actions"
                              title="More actions"
                            >
                              <MoreVertical size={13} />
                            </button>

                            {menuOpen === orderId && menuPosition && createPortal(
                              <div
                                ref={menuRef}
                                className="order-actions-dropdown"
                                style={{
                                  top: menuPosition.top,
                                  bottom: menuPosition.bottom,
                                  right: menuPosition.right,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditRef(order)}
                                  className="order-actions-dropdown__item"
                                >
                                  <Pencil size={12} />
                                  <span>Edit Lab Ref</span>
                                </button>
                                {reportStatus !== "Cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuOpen(null);
                                      setMenuPosition(null);
                                      activeButtonRef.current = null;
                                      setCancelDialogOrderId(orderId);
                                    }}
                                    className="order-actions-dropdown__item order-actions-dropdown__item--danger"
                                  >
                                    <Ban size={12} />
                                    <span>Cancel Order</span>
                                  </button>
                                )}
                                {reportStatus !== "Cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuOpen(null);
                                      setMenuPosition(null);
                                      activeButtonRef.current = null;
                                      setAddTestOrder(order);
                                    }}
                                    className="order-actions-dropdown__item order-actions-dropdown__item--primary"
                                  >
                                    <Plus size={12} />
                                    <span>Add Test</span>
                                  </button>
                                )}
                                {reportStatus === "Cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuOpen(null);
                                      setMenuPosition(null);
                                      activeButtonRef.current = null;
                                      setStatusDialog({
                                        orderId,
                                        newStatus: "Pending",
                                        label: "Reopen",
                                      });
                                    }}
                                    className="order-actions-dropdown__item order-actions-dropdown__item--primary"
                                  >
                                    Reopen
                                  </button>
                                )}
                              </div>,
                              document.body
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

        {/* Pagination Bar */}
        {!loading && filteredOrders.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 4px 2px",
              borderTop: "1px solid var(--color-border)",
              marginTop: 4,
            }}
          >
            {/* Page info */}
            <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
              Showing{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredOrders.length)}
              </strong>
              {" "}of{" "}
              <strong style={{ color: "var(--color-text)" }}>{filteredOrders.length}</strong>
              {" "}orders
            </span>

            {/* Page navigation */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: safePage <= 1 ? "var(--color-surface-soft)" : "var(--color-surface)",
                  color: safePage <= 1 ? "var(--color-muted)" : "var(--color-text)",
                  cursor: safePage <= 1 ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                ← Prev
              </button>

              {/* Page number pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span key={`ellipsis-${idx}`} style={{ fontSize: 11, color: "var(--color-muted)", padding: "0 2px" }}>…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item as number)}
                      style={{
                        minWidth: 28,
                        height: 26,
                        padding: "0 6px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        borderRadius: "var(--radius-sm)",
                        border: safePage === item ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                        background: safePage === item ? "rgba(79, 70, 229, 0.12)" : "var(--color-surface)",
                        color: safePage === item ? "var(--color-primary)" : "var(--color-text)",
                        cursor: "pointer",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                    >
                      {item}
                    </button>
                  )
                )}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: safePage >= totalPages ? "var(--color-surface-soft)" : "var(--color-surface)",
                  color: safePage >= totalPages ? "var(--color-muted)" : "var(--color-text)",
                  cursor: safePage >= totalPages ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
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
            <div className="data-table-wrap" style={{ minHeight: 240 }}>
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

      {/* Add Test Modal */}
      {addTestOrder && (
        <AddTestModal
          order={addTestOrder}
          onClose={() => setAddTestOrder(null)}
          onSuccess={async () => {
            setAddTestOrder(null);
            setToast({
              message: "Tests added to order successfully.",
              tone: "success",
            });
            await loadAll();
          }}
        />
      )}

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

      {/* Edit Lab Reference Number Dialog */}
      <Modal
        isOpen={editRefOrder !== null}
        onClose={() => {
          if (!savingRef) {
            setEditRefOrder(null);
            setEditRefError(null);
          }
        }}
        title="Edit Lab Reference Number"
        maxWidth="sm"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditRefOrder(null);
                setEditRefError(null);
              }}
              disabled={savingRef}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveEditRef}
              loading={savingRef}
              disabled={savingRef}
            >
              Save
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0" }}>
          <div>
            <span style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 4 }}>
              Current Lab Reference Number
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--color-text)",
                background: "var(--color-surface-soft)",
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                display: "inline-block",
                border: "1px solid var(--color-border)",
              }}
            >
              {editRefOrder?.currentRef || "—"}
            </span>
          </div>

          <div>
            <label
              htmlFor="new-lab-ref-input"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)", display: "block", marginBottom: 6 }}
            >
              New Lab Reference Number
            </label>
            <input
              id="new-lab-ref-input"
              type="text"
              value={newRefInput}
              onChange={(e) => {
                setNewRefInput(e.target.value);
                if (editRefError) setEditRefError(null);
              }}
              placeholder="Enter new reference..."
              maxLength={20}
              disabled={savingRef}
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                borderRadius: "var(--radius-sm)",
                border: editRefError ? "1px solid var(--color-danger)" : "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                outline: "none",
              }}
            />
            {editRefError ? (
              <span style={{ fontSize: 11.5, color: "var(--color-danger)", display: "block", marginTop: 4 }}>
                {editRefError}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--color-muted)", display: "block", marginTop: 4 }}>
                Duplicate numbers are allowed. Allowed characters: letters, numbers, hyphens, underscores, slashes, or dots.
              </span>
            )}
          </div>
        </div>
      </Modal>

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