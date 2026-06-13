import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PaymentModal from "../components/PaymentModal";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import Toast from "../../../components/ui/Toast";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
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

  const loadDoctorRevenue = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const from = dateFrom || today;
    const to = dateTo || today;
    try {
      const data = await testService.getDoctorRevenue(from, to);
      setDoctorRevenue(data);
      setShowRevenue(true);
    } catch {
      setDoctorRevenue([]);
    }
  }, [dateFrom, dateTo]);

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
      `${order[1]} ${order[2]} ${order[5] || ""} ${order[6] || ""}`
        .toLowerCase()
        .includes(text)
    );
  }, [orders, query]);

  const exportCSV = useCallback(() => {
    const rows = filteredOrders;
    if (rows.length === 0) return;
    const header = "Order ID,Patient,Test,Report Status,Total,Paid,Pending,Payment Status\n";
    const body = rows
      .map((order) => {
        const orderId = Number(order[0]);
        const status = order[6] || "Pending";
        const total = Number(order[3] || 0);
        const paid = Number(order[4] || 0);
        const pending = Math.max(total - paid, 0);
        return [
          orderId,
          `"${order[1] || "Unknown"}"`,
          `"${order[2] || "-"}"`,
          status,
          total,
          paid,
          pending,
          order[5] || "Pending",
        ].join(",");
      })
      .join("\n");
    const csv = header + body;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredOrders]);

  const pendingCollections = orders.filter(
    (order) => String(order[5]).toLowerCase() !== "completed"
  ).length;

  const pendingReports = orders.filter(
    (order) =>
      String(order[6] || "Pending").toLowerCase() !==
      "completed"
  ).length;

  return (
    <div className="lab-dashboard">
      <div className="lab-dashboard__metrics">
        <Metric title="Orders" value={String(orders.length)} tone="neutral" />
        <Metric
          title="Pending Reports"
          value={String(pendingReports)}
          tone="warning"
        />
        <Metric
          title="Pending Collections"
          value={String(pendingCollections)}
          tone="warning"
        />
      </div>

      <Card
        title="Order Worklist"
        eyebrow="Today and recent"
        right={
          <div className="lab-dashboard__toolbar">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
            />
            <Button
              type="button"
              onClick={applyDateFilter}
              variant="secondary"
              disabled={loading}
            >
              Filter
            </Button>
            <Button
              type="button"
              onClick={loadDoctorRevenue}
              variant="secondary"
            >
              Doctor Revenue
            </Button>
            <Button
              type="button"
              onClick={exportCSV}
              variant="secondary"
              disabled={filteredOrders.length === 0}
            >
              Export CSV
            </Button>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient, test, status"
            />
            <Button
              type="button"
              onClick={loadAll}
              variant="secondary"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        }
        className="lab-dashboard__card"
      >
        <div className="lab-dashboard__table-wrap">
          <div className="lab-dashboard__table">
            <div className="lab-dashboard__table-head">
              <span>Patient</span>
              <span>Tests</span>
              <span>Report</span>
              <span>Billing</span>
              <span>Payment</span>
              <span>Actions</span>
            </div>

            {loading && (
              <div className="lab-dashboard__state">Loading orders...</div>
            )}

            {!loading && filteredOrders.length === 0 && (
              <div className="lab-dashboard__state">
                No matching orders yet. Create an order from Patient Intake.
              </div>
            )}

            {!loading &&
              filteredOrders.map((order, index) => {
                const orderId = Number(order[0]);
                const reportStatus = order[6] || "Pending";
                const paymentStatus = order[5] || "Pending";
                const total = Number(order[3] || 0);
                const paid = Number(order[4] || 0);
                const pending = Math.max(total - paid, 0);
                const isCompleted =
                  String(paymentStatus).toLowerCase() === "completed";

                return (
                  <div
                    key={`${orderId}-${index}`}
                    className="lab-dashboard__row"
                  >
                    <div className="lab-dashboard__patient">
                      <strong>{order[1] || "Unknown Patient"}</strong>
                      <span>Order #{orderId}</span>
                    </div>

                    <div className="lab-dashboard__tests" title={order[2]}>
                      {order[2] || "—"}
                    </div>

                    <StatusBadge status={reportStatus} />

                    <div className="lab-dashboard__billing">
                      <strong>{money(total)}</strong>
                      <span>
                        Paid {money(paid)} · Pending {money(pending)}
                      </span>
                    </div>

                    <StatusBadge status={paymentStatus} />

                    <div className="lab-dashboard__actions">
                      {!isCompleted && (
                        <Button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setPaymentModal(order);
                          }}
                          variant="success"
                        >
                          Pay
                        </Button>
                      )}

                      <Button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onOpenReceipt(orderId);
                        }}
                        variant="secondary"
                      >
                        Receipt
                      </Button>

                      <Button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onSelectOrder(orderId);
                        }}
                        variant="primary"
                      >
                        Results
                      </Button>

                      <div
                        className="lab-dashboard__menu-wrap"
                        ref={menuOpen === orderId ? menuRef : undefined}
                      >
                        <button
                          type="button"
                          className="lab-dashboard__menu-trigger"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setMenuOpen((prev) =>
                              prev === orderId ? null : orderId,
                            );
                          }}
                          aria-label="More actions"
                        >
                          ⋮
                        </button>

                        {menuOpen === orderId && (
                          <div className="lab-dashboard__menu-dropdown">
                            {reportStatus !== "Completed" &&
                              reportStatus !== "Cancelled" && (
                                <button
                                  type="button"
                                  className="lab-dashboard__menu-item lab-dashboard__menu-item--danger"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setMenuOpen(null);
                                    setCancelDialogOrderId(orderId);
                                  }}
                                >
                                  Cancel Order
                                </button>
                              )}
                            {reportStatus === "In Progress" &&
                              onEditOrder && (
                                <button
                                  type="button"
                                  className="lab-dashboard__menu-item"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setMenuOpen(null);
                                    onEditOrder(orderId);
                                  }}
                                >
                                  Add Test
                                </button>
                              )}
                            {reportStatus === "Cancelled" && (
                              <button
                                type="button"
                                className="lab-dashboard__menu-item"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setMenuOpen(null);
                                  setStatusDialog({
                                    orderId,
                                    newStatus: "Pending",
                                    label: "Reopen",
                                  });
                                }}
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </Card>

      {paymentModal && (
        <PaymentModal
          key={`payment-${paymentModal[0]}`}
          order={paymentModal}
          onClose={() => setPaymentModal(null)}
          onDone={() => {
            void loadOrders();
          }}
        />
      )}

      {cancelDialogOrderId !== null && (
        <ConfirmationDialog
          open={cancelDialogOrderId !== null}
          title="Cancel Order"
          description={`Are you sure you want to cancel order #${cancelDialogOrderId}? This action cannot be undone.`}
          confirmLabel="Yes, Cancel Order"
          danger
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelDialogOrderId(null)}
        />
      )}

      {statusDialog !== null && (
        <ConfirmationDialog
          open={statusDialog !== null}
          title={`${statusDialog.label} Order`}
          description={`Mark order #${statusDialog.orderId} as "${statusDialog.newStatus}"?`}
          confirmLabel={`Yes, ${statusDialog.label}`}
          onConfirm={handleConfirmStatusChange}
          onCancel={() => setStatusDialog(null)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.tone}
          onClose={() => setToast(null)}
        />
      )}

      {showRevenue && (
        <Card
          title="Doctor Revenue"
          eyebrow={`${dateFrom || "All time"} – ${dateTo || "Today"}`}
          right={
            <Button
              type="button"
              onClick={() => setShowRevenue(false)}
              variant="secondary"
            >
              Close
            </Button>
          }
          className="lab-dashboard__card"
        >
          <div className="lab-dashboard__table-wrap">
            <div className="lab-dashboard__table">
              <div className="lab-dashboard__table-head">
                <span>Doctor</span>
                <span>Orders</span>
                <span>Total</span>
                <span>Paid</span>
                <span>Pending</span>
              </div>
              {doctorRevenue.length === 0 && (
                <div className="lab-dashboard__state">No revenue data found.</div>
              )}
              {doctorRevenue.map((row, index) => (
                <div key={`${row.doctor_name}-${index}`} className="lab-dashboard__row">
                  <div className="lab-dashboard__patient">
                    <strong>{row.doctor_name || "Unknown"}</strong>
                  </div>
                  <div className="lab-dashboard__tests">{row.order_count}</div>
                  <div className="lab-dashboard__billing">
                    <strong>{money(row.total_amount)}</strong>
                  </div>
                  <div className="lab-dashboard__billing">
                    <strong>{money(row.paid_amount)}</strong>
                  </div>
                  <div className="lab-dashboard__billing">
                    <strong>{money(row.pending_amount)}</strong>
                  </div>
                  <div className="lab-dashboard__actions" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "info" | "success" | "danger" | "warning" | "neutral";
}) {
  return (
    <div className={`lab-dashboard__metric lab-dashboard__metric--${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status || "Pending";
  const lower = normalized.toLowerCase();

  const tone =
    lower === "completed" || lower === "paid"
      ? "success"
      : lower === "partial"
        ? "warning"
        : "danger";

  return <Badge tone={tone}>{normalized}</Badge>;
}