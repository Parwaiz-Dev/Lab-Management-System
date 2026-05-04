import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Button from "../../../components/ui/Button";
import type { ReceiptLine } from "../../../types";

type ReceiptPageProps = {
  orderId: number;
  onBack: () => void;
};

type ReceiptData = [patient: string, invoice: string, total: number, paid: number, discount: number, tests: ReceiptLine[]];

export default function ReceiptPage({ orderId, onBack }: ReceiptPageProps) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [labName, setLabName] = useState("Your Lab Name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReceipt = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await invoke("get_receipt", { orderId });
        if (!res || !Array.isArray(res)) throw new Error("Invalid receipt data");
        setData(res as ReceiptData);
      } catch (err) {
        console.error("Receipt error:", err);
        setError("Failed to load receipt");
      } finally {
        setLoading(false);
      }
    };

    const loadSettings = async () => {
      const name = await invoke("get_setting", { key: "lab_name" });
      if (name) setLabName(name as string);
    };

    if (orderId !== null && orderId !== undefined) {
      loadReceipt();
      loadSettings();
    }
  }, [orderId]);

  if (loading) return <StateView text="Loading receipt..." onBack={onBack} />;
  if (error) return <StateView text={error} onBack={onBack} danger />;
  if (!data) return <StateView text="No receipt found" onBack={onBack} />;

  const [patient, invoice, total, paid, discount, tests] = data;
  const subtotal = tests?.reduce((sum: number, test: ReceiptLine) => sum + Number(test.price || 0), 0) || total + discount;
  const pending = Math.max(total - paid, 0);

  return (
    <div style={page}>
      <style>{printCss}</style>

      <div style={actions}>
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
        <Button onClick={() => window.print()}>Print Receipt</Button>
      </div>

      <article style={paper}>
        <header style={header}>
          <div>
            <h1 style={labTitle}>{labName}</h1>
            <p style={subtitle}>Payment Receipt</p>
          </div>
          <div style={meta}>
            <strong>{invoice}</strong>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </header>

        <section style={patientBox}>
          <span>Patient</span>
          <strong>{patient}</strong>
        </section>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Test</th>
              <th style={{ ...th, textAlign: "right" }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {tests?.map((test: ReceiptLine, index: number) => (
              <tr key={index}>
                <td style={td}>
                  <strong>{test.test_name}</strong>
                  {test.parameter_names.length > 0 && (
                    <div style={subTests}>{test.parameter_names.join(", ")}</div>
                  )}
                </td>
                <td style={{ ...td, textAlign: "right" }}>Rs {test.price}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section style={totals}>
          <Row label="Subtotal" value={subtotal} />
          {discount > 0 && <Row label="Discount" value={discount} />}
          <Row label="Net Total" value={total} strong />
          <Row label="Paid" value={paid} />
          <Row label="Pending" value={pending} strong />
        </section>

        <footer style={footer}>
          <p>Thank you for choosing {labName}.</p>
          <div style={signature}>
            <div style={line} />
            Authorized Signature
          </div>
        </footer>
      </article>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div style={{ ...totalRow, fontWeight: strong ? 950 : 700 }}>
      <span>{label}</span>
      <span>Rs {Number(value || 0).toFixed(0)}</span>
    </div>
  );
}

function StateView({ text, onBack, danger }: { text: string; onBack: () => void; danger?: boolean }) {
  return (
    <div style={{ padding: 24 }}>
      <p style={{ color: danger ? "#b42318" : "#66788a", marginBottom: 12 }}>{text}</p>
      <Button onClick={onBack} variant="secondary">
        Back
      </Button>
    </div>
  );
}

const printCss = `
  @media print {
    button { display: none !important; }
    body { background: white; }
  }
`;

const page = {
  minHeight: "100vh",
  background: "#eef3f8",
  padding: 24,
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  maxWidth: 520,
  margin: "0 auto 14px",
};

const paper = {
  maxWidth: 520,
  margin: "0 auto",
  background: "#ffffff",
  border: "1px solid #d9e3ec",
  padding: 28,
  color: "#14213d",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  borderBottom: "2px solid #14213d",
  paddingBottom: 16,
};

const labTitle = {
  fontSize: 24,
  fontWeight: 950,
};

const subtitle = {
  color: "#66788a",
  marginTop: 5,
};

const meta = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 5,
  textAlign: "right" as const,
  fontSize: 13,
};

const patientBox = {
  margin: "18px 0",
  padding: 12,
  borderRadius: 8,
  border: "1px solid #d9e3ec",
  background: "#f7fafc",
  display: "flex",
  justifyContent: "space-between",
};

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const th = {
  textAlign: "left" as const,
  background: "#14213d",
  color: "white",
  padding: "10px 12px",
  fontSize: 12,
};

const td = {
  borderBottom: "1px solid #d9e3ec",
  padding: "10px 12px",
  fontSize: 13,
};

const subTests = {
  color: "#66788a",
  fontSize: 11,
  lineHeight: 1.45,
  marginTop: 4,
};

const totals = {
  marginTop: 16,
  borderTop: "1px solid #d9e3ec",
  paddingTop: 12,
};

const totalRow = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 0",
};

const footer = {
  marginTop: 34,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 24,
  color: "#66788a",
  fontSize: 12,
};

const signature = {
  width: 180,
  color: "#14213d",
  textAlign: "center" as const,
  fontWeight: 800,
};

const line = {
  borderTop: "1px solid #14213d",
  marginBottom: 8,
};
