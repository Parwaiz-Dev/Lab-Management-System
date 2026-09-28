import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import type { ReceiptData, ReceiptLine } from "../../../types";
import { settingsService } from "../../settings/services/settingsService";
import { getErrorMessage, money, testService } from "../services/testService";

type ReceiptPageProps = {
  orderId: number;
  onBack: () => void;
};

export default function ReceiptPage({ orderId, onBack }: ReceiptPageProps) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [labName, setLabName] = useState("Your Lab");
  const [labAddress, setLabAddress] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        setError("");

        const [receipt, settings] = await Promise.all([
          testService.getReceipt(orderId),
          settingsService.getLabSettings(),
        ]);

        setData(receipt);
        setLabName(settings.lab_name || "Your Lab");
        setLabAddress(settings.lab_address || "");
        setLogo(settings.lab_logo || "");
      } catch (err) {
        console.error("Receipt error:", err);
        setError(getErrorMessage(err, "Failed to load receipt"));
      } finally {
        setLoading(false);
      }
    };

    void loadAll();
  }, [orderId]);

  const receipt = useMemo(() => {
    if (!data) {
      return {
        patient: "",
        invoice: "",
        total: 0,
        paid: 0,
        discount: 0,
        tests: [] as ReceiptLine[],
        subtotal: 0,
        pending: 0,
        status: "Pending",
      };
    }

    const cleanTests = data.tests || [];

    const subtotal =
      cleanTests.reduce(
        (sum: number, test: ReceiptLine) => sum + Number(test.price || 0),
        0
      ) || data.total + data.discount;

    const pending = Math.max(Number(data.total || 0) - Number(data.paid || 0), 0);

    return {
      patient: data.patient,
      invoice: data.invoice,
      total: Number(data.total || 0),
      paid: Number(data.paid || 0),
      discount: Number(data.discount || 0),
      tests: cleanTests,
      subtotal,
      pending,
      status: pending <= 0 ? "Paid" : data.paid > 0 ? "Partial" : "Pending",
    };
  }, [data]);

  const logoSrc = useMemo(() => settingsService.getLogoSrc(logo), [logo]);

  const printReceipt = async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => undefined)),
    );
    window.print();
  };

  if (loading) {
    return <ReceiptState text="Loading receipt..." onBack={onBack} />;
  }

  if (error) {
    return <ReceiptState text={error} onBack={onBack} danger />;
  }

  if (!data) {
    return <ReceiptState text="No receipt found" onBack={onBack} />;
  }

  return (
    <div className="receipt-view">
      <style>{printCss}</style>

      <div className="receipt-view__toolbar no-print">
        <Button onClick={onBack} variant="secondary" icon={<ArrowLeft size={16} />}>
          Back
        </Button>

        <Button onClick={() => void printReceipt()} icon={<Printer size={16} />}>Print Receipt</Button>
      </div>

      <article className="receipt-document">
        <header className="receipt-document__header">
          <div className="receipt-document__brand">
            {logoSrc && (
              <img
                className="receipt-document__logo-img"
                src={logoSrc}
                alt="Lab logo"
              />
            )}

            <div>
              <div className="receipt-document__eyebrow">Payment Receipt</div>
              <h1>{labName || "Your Lab"}</h1>
              <p>{labAddress || "Laboratory billing receipt"}</p>
            </div>
          </div>

          <div className="receipt-document__meta">
            <Badge tone={receipt.status === "Paid" ? "success" : "warning"}>
              {receipt.status}
            </Badge>

            <div>
              <span>Receipt No.</span>
              <strong>{receipt.invoice || `INV-${orderId}`}</strong>
            </div>

            <div>
              <span>Date</span>
              <strong>{new Date().toLocaleDateString()}</strong>
            </div>
          </div>
        </header>

        <section className="receipt-document__patient-card">
          <div>
            <span>Patient Name</span>
            <strong>{receipt.patient}</strong>
          </div>

          <div>
            <span>Order ID</span>
            <strong>#{orderId}</strong>
          </div>
        </section>

        <section className="receipt-document__section">
          <div className="receipt-document__section-title">
            <h2>Tests Billed</h2>
            <span>{receipt.tests.length} item(s)</span>
          </div>

          <div className="receipt-document__table-wrap">
            <table className="receipt-document__table">
              <thead>
                <tr>
                  <th style={{ width: "54%" }}>Test</th>
                  <th>Sub Tests</th>
                  <th style={{ width: "120px" }}>Amount</th>
                </tr>
              </thead>

              <tbody>
                {receipt.tests.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="receipt-document__empty-cell">
                      No tests found for this receipt.
                    </td>
                  </tr>
                ) : (
                  receipt.tests.map((test: ReceiptLine, index: number) => (
                    <tr key={`${test.test_name}-${index}`}>
                      <td>
                        <strong>{test.test_name}</strong>
                      </td>

                      <td>
                        {test.parameter_names?.length > 0 ? (
                          <small>{test.parameter_names.join(", ")}</small>
                        ) : (
                          <small>—</small>
                        )}
                      </td>

                      <td className="receipt-document__amount">
                        {money(Number(test.price || 0))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="receipt-document__bottom">
          <div className="receipt-document__note">
            <strong>Payment Note</strong>
            <p>
              This receipt confirms the amount collected against the listed lab
              order. Pending amount, if any, should be collected separately.
            </p>
          </div>

          <div className="receipt-document__totals">
            <ReceiptRow label="Subtotal" value={receipt.subtotal} />

            {receipt.discount > 0 && (
              <ReceiptRow label="Discount" value={receipt.discount} />
            )}

            <ReceiptRow label="Net Total" value={receipt.total} strong />
            <ReceiptRow label="Paid" value={receipt.paid} />
            <ReceiptRow label="Pending" value={receipt.pending} danger strong />
          </div>
        </section>

        <footer className="receipt-document__footer">
          <div>
            <strong>Thank you for choosing {labName || "our lab"}.</strong>
            <p>Computer-generated receipt.</p>
          </div>

          {/* <div className="receipt-document__signature">
            <div />
            <span>Authorized Signature</span>
          </div> */}
        </footer>
      </article>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: number;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={[
        "receipt-document__total-row",
        strong ? "receipt-document__total-row--strong" : "",
        danger ? "receipt-document__total-row--danger" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}

function ReceiptState({
  text,
  onBack,
  danger,
}: {
  text: string;
  onBack: () => void;
  danger?: boolean;
}) {
  return (
    <div className="receipt-state">
      <div
        className={[
          "receipt-state__box",
          danger ? "receipt-state__box--danger" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <strong>{text}</strong>

        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
      </div>
    </div>
  );
}

const printCss = `
  .receipt-view {
    padding: 24px;
    background: var(--color-surface-subtle, #f8fafc);
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .receipt-view__toolbar {
    width: 100%;
    max-width: 680px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .receipt-document {
    width: 100%;
    max-width: 680px;
    background: #ffffff;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
    padding: 32px 36px;
    box-sizing: border-box;
    font-family: inherit;
    color: var(--color-text, #0f172a);
  }

  .receipt-document__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 2px solid var(--color-primary-600, #4f46e5);
    margin-bottom: 20px;
  }

  .receipt-document__brand {
    display: flex;
    gap: 14px;
    align-items: center;
  }

  .receipt-document__logo-img {
    height: 48px;
    max-width: 120px;
    object-fit: contain;
  }

  .receipt-document__eyebrow {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-primary-600, #4f46e5);
    margin-bottom: 2px;
  }

  .receipt-document__brand h1 {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
    margin: 0 0 2px 0;
  }

  .receipt-document__brand p {
    font-size: 12px;
    color: #64748b;
    margin: 0;
  }

  .receipt-document__meta {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .receipt-document__meta div {
    font-size: 12px;
    display: flex;
    gap: 6px;
  }

  .receipt-document__meta span {
    color: #64748b;
  }

  .receipt-document__meta strong {
    color: #0f172a;
    font-family: var(--font-mono, monospace);
  }

  .receipt-document__patient-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    margin-bottom: 24px;
  }

  .receipt-document__patient-card div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .receipt-document__patient-card span {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .receipt-document__patient-card strong {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
  }

  .receipt-document__section {
    margin-bottom: 24px;
  }

  .receipt-document__section-title {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }

  .receipt-document__section-title h2 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #334155;
    margin: 0;
  }

  .receipt-document__section-title span {
    font-size: 11px;
    color: #94a3b8;
  }

  .receipt-document__table-wrap {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }

  .receipt-document__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .receipt-document__table th {
    background: #f8fafc;
    padding: 8px 12px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
  }

  .receipt-document__table td {
    padding: 10px 12px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  .receipt-document__table tr:last-child td {
    border-bottom: none;
  }

  .receipt-document__table strong {
    font-weight: 600;
    color: #1e293b;
  }

  .receipt-document__table small {
    display: block;
    color: #64748b;
    font-size: 11.5px;
    line-height: 1.3;
  }

  .receipt-document__amount {
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-weight: 700;
    color: #0f172a;
  }

  .receipt-document__empty-cell {
    text-align: center;
    color: #94a3b8;
    padding: 20px !important;
  }

  .receipt-document__bottom {
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: 24px;
    align-items: start;
    padding-top: 16px;
    margin-bottom: 24px;
    border-top: 1px solid #e2e8f0;
  }

  .receipt-document__note strong {
    display: block;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin-bottom: 4px;
  }

  .receipt-document__note p {
    font-size: 11.5px;
    color: #94a3b8;
    line-height: 1.4;
    margin: 0;
  }

  .receipt-document__totals {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .receipt-document__total-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #475569;
  }

  .receipt-document__total-row strong {
    font-family: var(--font-mono, monospace);
    font-weight: 600;
    color: #1e293b;
  }

  .receipt-document__total-row--strong {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    padding-top: 4px;
    border-top: 1px dashed #cbd5e1;
  }

  .receipt-document__total-row--strong strong {
    font-size: 15px;
    font-weight: 800;
  }

  .receipt-document__total-row--danger {
    color: #dc2626;
  }

  .receipt-document__total-row--danger strong {
    color: #dc2626;
    font-weight: 800;
  }

  .receipt-document__footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 24px;
    border-top: 1px solid #e2e8f0;
    margin-top: 12px;
  }

  .receipt-document__footer strong {
    font-size: 12px;
    color: #334155;
    display: block;
  }

  .receipt-document__footer p {
    font-size: 11px;
    color: #94a3b8;
    margin: 2px 0 0 0;
  }

  .receipt-document__signature {
    text-align: center;
    width: 160px;
  }

  .receipt-document__signature div {
    border-bottom: 1px solid #94a3b8;
    margin-bottom: 6px;
    height: 36px;
  }

  .receipt-document__signature span {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
  }

  .receipt-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  .receipt-state__box {
    background: #fff;
    border: 1px solid #e2e8f0;
    padding: 24px 32px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  @media print {
    .no-print,
    button {
      display: none !important;
    }

    html,
    body,
    #root {
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
      background: #ffffff !important;
    }

    .app-shell,
    .app-main,
    .page-content,
    .receipt-view {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
      background: #ffffff !important;
    }

    .receipt-document {
      width: 100% !important;
      max-width: none !important;
      min-height: auto !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
    }

    @page {
      size: A4;
      margin: 12mm;
    }
  }
`;