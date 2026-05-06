import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import PaymentModal from "../components/PaymentModal";
import type { DashboardOrderRow } from "../components/PaymentModal";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";

type LabDashboardProps = {
  onSelectOrder: (orderId: number) => void;
  onOpenReceipt: (orderId: number) => void;
};

const money = (value: number) => `Rs ${Number(value || 0).toFixed(0)}`;

export default function LabDashboard({
  onSelectOrder,
  onOpenReceipt,
}: LabDashboardProps) {
  const [orders, setOrders] = useState<DashboardOrderRow[]>([]);
  const [statuses, setStatuses] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState<[number, number, number]>([0, 0, 0]);
  const [paymentModal, setPaymentModal] = useState<DashboardOrderRow | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    const data = (await invoke("get_orders")) as DashboardOrderRow[];
    setOrders(data);

    const map: Record<number, string> = {};

    await Promise.all(
      data.map(async (order) => {
        try {
          map[order[0]] = (await invoke("get_order_status", {
            orderId: order[0],
          })) as string;
        } catch {
          map[order[0]] = "Pending";
        }
      })
    );

    setStatuses(map);
  }, []);

  const loadSummary = useCallback(async () => {
    const res = await invoke("get_daily_summary");
    setSummary(res as [number, number, number]);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadOrders(), loadSummary()]);
    } finally {
      setLoading(false);
    }
  }, [loadOrders, loadSummary]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();

    if (!text) return orders;

    return orders.filter((order) =>
      `${order[1]} ${order[2]} ${order[5]} ${statuses[order[0]] || ""}`
        .toLowerCase()
        .includes(text)
    );
  }, [orders, query, statuses]);

  const pendingOrders = orders.filter((order) => order[5] !== "Completed").length;

  return (
    <div className="lab-dashboard">
      <section className="lab-dashboard__hero">
        <div>
          <div className="lab-dashboard__eyebrow">Lab Operations</div>
          <h2>Orders, payments, receipts, and result entry.</h2>
          <p>
            Track today&apos;s billing, pending collections, and lab report progress
            from one clean worklist.
          </p>
        </div>

        <div className="lab-dashboard__hero-actions">
          <Button onClick={loadAll} variant="secondary" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </section>

      <div className="lab-dashboard__metrics">
        <Metric title="Total Billing" value={money(summary[0])} tone="info" />
        <Metric title="Collected" value={money(summary[1])} tone="success" />
        <Metric title="Pending" value={money(summary[2])} tone="danger" />
        <Metric title="Orders" value={String(orders.length)} tone="neutral" />
        <Metric title="Pending Orders" value={String(pendingOrders)} tone="warning" />
      </div>

      <Card
        title="Order Worklist"
        eyebrow="Today and recent"
        right={
          <div className="lab-dashboard__toolbar">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient, test, status"
            />

            <Button onClick={loadAll} variant="secondary" disabled={loading}>
              Refresh
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
              filteredOrders.map((order) => {
                const reportStatus = statuses[order[0]] || "Pending";
                const paymentStatus = order[5];
                const total = Number(order[3] || 0);
                const paid = Number(order[4] || 0);
                const pending = Math.max(total - paid, 0);

                return (
                  <div key={order[0]} className="lab-dashboard__row">
                    <div className="lab-dashboard__patient">
                      <strong>{order[1]}</strong>
                      <span>Order #{order[0]}</span>
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
                      {paymentStatus !== "Completed" && (
                        <Button
                          onClick={() => setPaymentModal(order)}
                          variant="success"
                        >
                          Pay
                        </Button>
                      )}

                      <Button
                        onClick={() => onOpenReceipt(order[0])}
                        variant="secondary"
                      >
                        Receipt
                      </Button>

                      <Button
                        onClick={() => onSelectOrder(order[0])}
                        variant="primary"
                      >
                        Results
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </Card>

      {paymentModal && (
        <PaymentModal
          order={paymentModal}
          onClose={() => setPaymentModal(null)}
          onDone={() => {
            void loadOrders();
            void loadSummary();
          }}
        />
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

  const tone =
    normalized === "Completed"
      ? "success"
      : normalized === "Partial"
        ? "warning"
        : "danger";

  return <Badge tone={tone}>{normalized}</Badge>;
}