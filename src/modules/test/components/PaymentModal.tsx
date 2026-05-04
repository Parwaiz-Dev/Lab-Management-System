import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { colors, shadow } from "../../../components/ui/styles";

export type DashboardOrderRow = [
  id: number,
  patientName: string,
  tests: string,
  totalAmount: number,
  paidAmount: number,
  paymentStatus: string,
];

type PaymentModalProps = {
  order: DashboardOrderRow;
  onClose: () => void;
  onDone: () => void;
};

export default function PaymentModal({ order, onClose, onDone }: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = Number(order[3] || 0);
  const paid = Number(order[4] || 0);
  const remaining = Math.max(total - paid, 0);

  const handleSubmit = async () => {
    const pay = Number(amount);

    if (!pay || pay <= 0) {
      setError("Enter a valid payment amount");
      return;
    }

    if (pay > remaining) {
      setError("Payment cannot exceed pending amount");
      return;
    }

    try {
      setSaving(true);
      await invoke("update_payment", {
        orderId: order[0],
        paidAmount: paid + pay,
      });

      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={header}>
          <div>
            <h2 style={title}>Record Payment</h2>
            <p style={subtitle}>{order[1]} · Order #{order[0]}</p>
          </div>
          <button onClick={onClose} style={closeBtn}>
            Close
          </button>
        </div>

        <div style={summaryGrid}>
          <Amount label="Total" value={total} />
          <Amount label="Paid" value={paid} />
          <Amount label="Pending" value={remaining} strong />
        </div>

        <div>
          <label style={label}>Payment amount</label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" type="number" />
          {error && <div style={errorText}>{error}</div>}
        </div>

        <div style={footer}>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="success" disabled={saving}>
            {saving ? "Saving..." : "Confirm Payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Amount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div style={amountBox}>
      <div style={amountLabel}>{label}</div>
      <div style={{ ...amountValue, color: strong ? colors.danger : colors.text }}>Rs {value.toFixed(0)}</div>
    </div>
  );
}

const overlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(15, 34, 53, 0.45)",
  display: "grid",
  placeItems: "center",
  zIndex: 1000,
};

const modal = {
  width: 460,
  background: colors.surface,
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  boxShadow: shadow,
  padding: 18,
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
};

const title = {
  fontSize: 18,
  fontWeight: 900,
  color: colors.text,
};

const subtitle = {
  marginTop: 4,
  color: colors.muted,
  fontSize: 13,
};

const closeBtn = {
  border: `1px solid ${colors.borderStrong}`,
  background: colors.surface,
  color: colors.muted,
  borderRadius: 7,
  padding: "7px 10px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
};

const amountBox = {
  padding: 12,
  borderRadius: 8,
  background: colors.surfaceSoft,
  border: `1px solid ${colors.border}`,
};

const amountLabel = {
  color: colors.muted,
  fontSize: 12,
  fontWeight: 800,
};

const amountValue = {
  marginTop: 5,
  fontSize: 18,
  fontWeight: 900,
};

const label = {
  display: "block",
  color: colors.text,
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 7,
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const errorText = {
  color: colors.danger,
  fontSize: 12,
  marginTop: 6,
};
