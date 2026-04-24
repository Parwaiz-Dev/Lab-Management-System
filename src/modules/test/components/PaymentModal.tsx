import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function PaymentModal({ order, onClose, onDone }: any) {
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState(0);
  const [gstEnabled, setGstEnabled] = useState(true);

  const total = order[3];
  const paid = order[4];

  const gst = gstEnabled ? (total - discount) * 0.18 : 0;
  const finalTotal = total - discount + gst;
  const remaining = finalTotal - paid;

  const handleSubmit = async () => {
    const pay = parseFloat(amount);

    if (isNaN(pay) || pay <= 0) {
      alert("Invalid amount");
      return;
    }

    await invoke("update_payment", {
      orderId: order[0],
      paidAmount: paid + pay,
    });

    onDone();
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3>💰 Payment</h3>

        <p>Total: ₹{total}</p>

        <div style={field}>
          <label>Discount</label>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
            style={input}
          />
        </div>

        <div style={field}>
          <label>
            <input
              type="checkbox"
              checked={gstEnabled}
              onChange={() => setGstEnabled(!gstEnabled)}
            />
            Apply GST (18%)
          </label>
        </div>

        <p>GST: ₹{gst.toFixed(2)}</p>
        <p><b>Final Total: ₹{finalTotal.toFixed(2)}</b></p>
        <p>Paid: ₹{paid}</p>
        <p>Remaining: ₹{remaining.toFixed(2)}</p>

        <input
          placeholder="Enter payment amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={input}
        />

        <div style={{ marginTop: 15 }}>
          <button onClick={handleSubmit} style={payBtn}>
            Confirm
          </button>

          <button onClick={onClose} style={cancelBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
};

const modal = {
  background: "white",
  padding: 20,
  borderRadius: 10,
  width: 320,
};

const field = { marginTop: 10 };

const input = {
  width: "100%",
  padding: 8,
  marginTop: 5,
};

const payBtn = {
  background: "green",
  color: "white",
  padding: "8px 12px",
  border: "none",
};

const cancelBtn = {
  marginLeft: 10,
};