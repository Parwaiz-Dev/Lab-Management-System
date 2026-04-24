import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function ReceiptPage({ orderId, onBack }: any) {
  const [data, setData] = useState<any>(null);
  const [labName, setLabName] = useState("Your Lab Name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Run only when orderId is available
  useEffect(() => {
    if (orderId !== null && orderId !== undefined) {
      loadReceipt();
      loadSettings();
    }
  }, [orderId]);

  // 📊 Load receipt data
  const loadReceipt = async () => {
    try {
      setLoading(true);
      setError("");

      console.log("ORDER ID:", orderId);

      const res = await invoke("get_receipt", { orderId });
      console.log("RECEIPT DATA:", res);

      if (!res || !Array.isArray(res)) {
        throw new Error("Invalid data format");
      }

      setData(res);
    } catch (err: any) {
      console.error("Receipt error:", err);
      setError("Failed to load receipt");
    } finally {
      setLoading(false);
    }
  };

  // ⚙️ Load lab name
  const loadSettings = async () => {
    try {
      const name = await invoke("get_setting", { key: "lab_name" });
      if (name) setLabName(name as string);
    } catch (err) {
      console.error("Settings error:", err);
    }
  };

  // 🖨 Print
  const handlePrint = () => {
    window.print();
  };

  // 🔄 Loading UI
  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <p>Loading receipt...</p>
        <button onClick={onBack}>⬅ Back</button>
      </div>
    );
  }

  // ❌ Error UI
  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={onBack}>⬅ Back</button>
      </div>
    );
  }

  // ❗ No data
  if (!data) {
    return (
      <div style={{ padding: 20 }}>
        <p>No receipt found</p>
        <button onClick={onBack}>⬅ Back</button>
      </div>
    );
  }

  // ✅ Expected structure from backend
  const [patient, invoice, total, paid, tests] = data;

  const gstRate = 0.18;
  const gst = total * gstRate;
  const grandTotal = total + gst;
  const pending = grandTotal - paid;

  return (
    <div style={{ padding: 20 }}>
      {/* 🖨 Hide buttons while printing */}
      <style>
        {`
          @media print {
            button {
              display: none;
            }
          }
        `}
      </style>

      {/* 📄 Receipt Box */}
      <div style={box}>
        {/* 🏥 Header */}
        <div style={{ textAlign: "center" }}>
          <h2>🏥 {labName}</h2>
          <p>Payment Receipt</p>
          <hr />
        </div>

        {/* 📄 Info */}
        <p><b>Invoice No:</b> {invoice}</p>
        <p><b>Date:</b> {new Date().toLocaleDateString()}</p>
        <p><b>Patient:</b> {patient}</p>

        {/* 📊 Table */}
        <table style={{ width: "100%", marginTop: 10 }}>
          <thead>
            <tr>
              <th style={th}>Test</th>
              <th style={th}>Price</th>
            </tr>
          </thead>

          <tbody>
            {tests?.map((t: any, i: number) => (
              <tr key={i}>
                <td style={td}>{t[0]}</td>
                <td style={td}>₹{t[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr />

        {/* 💰 Totals */}
        <div style={{ marginTop: 10 }}>
          <div style={rowLine}>
            <span>Subtotal</span>
            <span>₹{total}</span>
          </div>

          <div style={rowLine}>
            <span>GST (18%)</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>

          <div style={rowLine}>
            <b>Total</b>
            <b>₹{grandTotal.toFixed(2)}</b>
          </div>

          <div style={rowLine}>
            <span>Paid</span>
            <span>₹{paid}</span>
          </div>

          <div style={rowLine}>
            <span>Pending</span>
            <span>₹{pending.toFixed(2)}</span>
          </div>
        </div>

        <hr />

        {/* ✍ Signature */}
        <div style={{ marginTop: 30, textAlign: "right" }}>
          <p>Authorized Signature</p>
          <div style={signLine}></div>
        </div>

        {/* 🙏 Footer */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <p>Thank you! Visit again</p>
        </div>
      </div>

      {/* 🔘 Buttons */}
      <div style={{ marginTop: 20 }}>
        <button onClick={handlePrint}>🖨 Print / PDF</button>
        <button onClick={onBack} style={{ marginLeft: 10 }}>
          ⬅ Back
        </button>
      </div>
    </div>
  );
}

// 🎨 Styles

const box = {
  width: "100%",
  maxWidth: "500px",
  margin: "20px auto",
  border: "2px solid black",
  padding: 20,
  background: "#fff",
  fontFamily: "monospace",
};

const th = {
  textAlign: "left" as const,
  borderBottom: "1px solid black",
  padding: 5,
};

const td = {
  padding: 5,
};

const rowLine = {
  display: "flex",
  justifyContent: "space-between",
};

const signLine = {
  borderTop: "1px solid black",
  width: 150,
  marginLeft: "auto",
};