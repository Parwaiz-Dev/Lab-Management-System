import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import PaymentModal from "../components/PaymentModal";

export default function LabDashboard({ onSelectOrder, onOpenReceipt }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any>({});
  const [summary, setSummary] = useState<[number, number, number]>([0, 0, 0]);

  // 💰 PAYMENT MODAL STATE
  const [paymentModal, setPaymentModal] = useState<any>(null);

  useEffect(() => {
    loadOrders();
    loadSummary();
  }, []);

  // 📊 LOAD ORDERS
  const loadOrders = async () => {
    const data = await invoke("get_orders");
    setOrders(data as any[]);

    const map: any = {};
    for (const o of data as any[]) {
      const status = await invoke("get_order_status", { orderId: o[0] });
      map[o[0]] = status;
    }
    setStatuses(map);
  };

  // 💰 LOAD SUMMARY
  const loadSummary = async () => {
    const res = await invoke("get_daily_summary");
    setSummary(res as [number, number, number]);
  };

  // 🎨 COLOR LOGIC
  const getColor = (status: string) => {
    if (status === "Pending") return "#ef4444";
    if (status === "Partial") return "#f59e0b";
    return "#22c55e";
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>📊 Lab Dashboard</h2>

      {/* 💰 SUMMARY CARDS */}
      <div style={summaryRow}>
        <Card title="Total ₹" value={summary[0]} />
        <Card title="Paid ₹" value={summary[1]} color="green" />
        <Card title="Pending ₹" value={summary[2]} color="red" />
      </div>

      {/* 📋 HEADER */}
      <div style={header}>
        <span>Patient</span>
        <span>Tests</span>
        <span>Report</span>
        <span>Total</span>
        <span>Paid</span>
        <span>Status</span>
        <span>Actions</span>
      </div>

      {/* 📄 DATA ROWS */}
      {orders.map((o) => {
        const remaining = o[3] - o[4];

        return (
          <div key={o[0]} style={row}>
            {/* Patient */}
            <span>{o[1]}</span>

            {/* Tests */}
            <span>{o[2]}</span>

            {/* Report */}
            <span style={{ color: getColor(statuses[o[0]]) }}>
              {statuses[o[0]] || "Loading"}
            </span>

            {/* Total */}
            <span>₹{o[3]}</span>

            {/* Paid */}
            <span>₹{o[4]}</span>

            {/* Status */}
            <span style={{ color: getColor(o[5]) }}>
              {o[5]}
            </span>

            {/* ACTIONS */}
            <div style={actions}>
              {/* 💰 PAY */}
              {o[5] !== "Completed" && (
                <button
                  style={payBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPaymentModal(o); // OPEN MODAL
                  }}
                >
                  💰 Pay
                </button>
              )}

              {/* 🧾 RECEIPT */}
              <button
                style={receiptBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReceipt(o[0]);
                }}
              >
                🧾 Receipt
              </button>

              {/* 👁 VIEW */}
              <button
                style={viewBtn}
                onClick={() => onSelectOrder(o[0])}
              >
                👁 View
              </button>
            </div>
          </div>
        );
      })}

      {/* 💰 PAYMENT MODAL */}
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

//
// 🧩 SUMMARY CARD
//
function Card({ title, value, color }: any) {
  return (
    <div style={{ ...card, borderTop: `4px solid ${color || "#3b82f6"}` }}>
      <p style={{ margin: 0, color: "#64748b" }}>{title}</p>
      <h2 style={{ margin: 0 }}>₹{value}</h2>
    </div>
  );
}

//
// 🎨 STYLES
//

const summaryRow = {
  display: "flex",
  gap: 20,
  marginBottom: 20,
};

const card = {
  flex: 1,
  padding: 15,
  background: "white",
  borderRadius: 10,
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const header = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1fr 2fr",
  fontWeight: "bold",
  padding: 12,
  background: "#e2e8f0",
  borderRadius: 6,
};

const row = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1fr 2fr",
  padding: 12,
  marginTop: 8,
  background: "white",
  borderRadius: 6,
  alignItems: "center",
};

const actions = {
  display: "flex",
  gap: 8,
};

const payBtn = {
  background: "#22c55e",
  color: "white",
  border: "none",
  padding: "5px 10px",
  borderRadius: 4,
  cursor: "pointer",
};

const receiptBtn = {
  background: "#3b82f6",
  color: "white",
  border: "none",
  padding: "5px 10px",
  borderRadius: 4,
  cursor: "pointer",
};

const viewBtn = {
  background: "#64748b",
  color: "white",
  border: "none",
  padding: "5px 10px",
  borderRadius: 4,
  cursor: "pointer",
};