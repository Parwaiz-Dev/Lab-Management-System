import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import PaymentModal from "../components/PaymentModal";
import type { DashboardOrderRow } from "../components/PaymentModal";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { colors } from "../../../components/ui/styles";

type LabDashboardProps = {
  onSelectOrder: (orderId: number) => void;
  onOpenReceipt: (orderId: number) => void;
};

export default function LabDashboard({ onSelectOrder, onOpenReceipt }: LabDashboardProps) {
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
    for (const order of data) {
      map[order[0]] = (await invoke("get_order_status", { orderId: order[0] })) as string;
    }
    setStatuses(map);
  }, []);

  const loadSummary = useCallback(async () => {
    const res = await invoke("get_daily_summary");
    setSummary(res as [number, number, number]);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOrders(), loadSummary()]);
    setLoading(false);
  }, [loadOrders, loadSummary]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAll();
    });
  }, [loadAll]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return orders;
    return orders.filter((order) => `${order[1]} ${order[2]} ${order[5]}`.toLowerCase().includes(text));
  }, [orders, query]);

  return (
    <div style={container}>
      <div style={metrics}>
        <Metric title="Total Billing" value={summary[0]} tone="info" />
        <Metric title="Collected" value={summary[1]} tone="success" />
        <Metric title="Pending" value={summary[2]} tone="danger" />
        <Metric title="Orders" value={orders.length} plain />
      </div>

      <Card
        title="Order Worklist"
        eyebrow="Today and recent"
        right={
          <div style={toolbar}>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient, test, status" />
            <Button onClick={loadAll} variant="secondary">
              Refresh
            </Button>
          </div>
        }
      >
        <div style={table}>
          <div style={headerRow}>
            <span>Patient</span>
            <span>Tests</span>
            <span>Report</span>
            <span>Billing</span>
            <span>Payment</span>
            <span>Actions</span>
          </div>

          {loading && <div style={emptyRow}>Loading orders...</div>}

          {!loading && filteredOrders.length === 0 && (
            <div style={emptyRow}>No matching orders yet. Create an order from Patient Intake.</div>
          )}

          {!loading &&
            filteredOrders.map((order) => {
              const reportStatus = statuses[order[0]] || "Pending";
              const paymentStatus = order[5];
              return (
                <div key={order[0]} style={dataRow}>
                  <div>
                    <div style={primaryText}>{order[1]}</div>
                    <div style={mutedText}>Order #{order[0]}</div>
                  </div>
                  <div style={mutedText}>{order[2]}</div>
                  <StatusBadge status={reportStatus} />
                  <div>
                    <div style={primaryText}>Rs {order[3]}</div>
                    <div style={mutedText}>Paid Rs {order[4]}</div>
                  </div>
                  <StatusBadge status={paymentStatus} />
                  <div style={actions}>
                    {paymentStatus !== "Completed" && (
                      <Button onClick={() => setPaymentModal(order)} variant="success">
                        Pay
                      </Button>
                    )}
                    <Button onClick={() => onOpenReceipt(order[0])} variant="secondary">
                      Receipt
                    </Button>
                    <Button onClick={() => onSelectOrder(order[0])} variant="primary">
                      Results
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      {paymentModal && (
        <PaymentModal
          order={paymentModal}
          onClose={() => setPaymentModal(null)}
          onDone={() => {
            loadOrders();
            loadSummary();
          }}
        />
      )}
    </div>
  );
}

function Metric({ title, value, tone, plain }: { title: string; value: number; tone?: "info" | "success" | "danger"; plain?: boolean }) {
  const border = tone === "success" ? colors.success : tone === "danger" ? colors.danger : colors.primary;
  return (
    <Card compact>
      <div style={{ borderLeft: plain ? "none" : `4px solid ${border}`, paddingLeft: plain ? 0 : 12 }}>
        <div style={metricLabel}>{title}</div>
        <div style={metricValue}>{plain ? value : `Rs ${Number(value || 0).toFixed(0)}`}</div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "Completed" ? "success" : status === "Partial" ? "warning" : "danger";
  return <Badge tone={tone}>{status}</Badge>;
}

const container = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
};

const metrics = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 14,
};

const metricLabel = {
  color: colors.muted,
  fontSize: 12,
  fontWeight: 800,
};

const metricValue = {
  color: colors.text,
  fontSize: 24,
  lineHeight: 1.2,
  fontWeight: 950,
  marginTop: 5,
};

const toolbar = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 260px) auto",
  gap: 8,
};

const table = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  overflow: "hidden",
};

const headerRow = {
  display: "grid",
  gridTemplateColumns: "minmax(120px, 1.1fr) minmax(150px, 1.5fr) minmax(78px, 0.7fr) minmax(88px, 0.7fr) minmax(82px, 0.7fr) minmax(210px, 1.3fr)",
  gap: 12,
  padding: "10px 12px",
  background: colors.surfaceSoft,
  color: colors.muted,
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase" as const,
};

const dataRow = {
  display: "grid",
  gridTemplateColumns: "minmax(120px, 1.1fr) minmax(150px, 1.5fr) minmax(78px, 0.7fr) minmax(88px, 0.7fr) minmax(82px, 0.7fr) minmax(210px, 1.3fr)",
  gap: 12,
  alignItems: "center",
  padding: "12px",
  borderTop: `1px solid ${colors.border}`,
  background: colors.surface,
  fontSize: 13,
};

const primaryText = {
  color: colors.text,
  fontWeight: 800,
};

const mutedText = {
  color: colors.muted,
  fontSize: 12,
  lineHeight: 1.35,
};

const actions = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 7,
  justifyContent: "flex-end",
};

const emptyRow = {
  padding: 20,
  color: colors.muted,
  fontSize: 13,
  background: colors.surface,
};
