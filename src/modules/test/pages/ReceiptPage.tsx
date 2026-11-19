import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import type { ReceiptData, ReceiptLine, ReportPatientInfo } from "../../../types";
import { settingsService } from "../../settings/services/settingsService";
import { getErrorMessage, money, testService } from "../services/testService";

type ReceiptPageProps = {
  orderId: number;
  onBack: () => void;
};

export default function ReceiptPage({ orderId, onBack }: ReceiptPageProps) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [patientInfo, setPatientInfo] = useState<ReportPatientInfo | null>(null);
  const [labName, setLabName] = useState("Your Lab");
  const [labAddress, setLabAddress] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      try {
        setLoading(true);
        setError("");

        const [receipt, settings, patient] = await Promise.all([
          testService.getReceipt(orderId),
          settingsService.getLabSettings(),
          testService.getPatientByOrder(orderId).catch(() => null),
        ]);

        if (cancelled) return;

        setData(receipt);
        setPatientInfo(patient);
        setLabName(settings.lab_name || "Your Lab");
        setLabAddress(settings.lab_address || "");
        setLogo(settings.lab_logo || "");
      } catch (err) {
        if (!cancelled) {
          console.error("Receipt error:", err);
          setError(getErrorMessage(err, "Failed to load receipt"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const receipt = useMemo(() => {
    if (!data) {
      return {
        patient: "",
        invoice: "",
        total: 0,
        paid: 0,
        discount: 0,
        paymentMethod: undefined,
        tests: [] as ReceiptLine[],
        subtotal: 0,
        pending: 0,
        status: "Pending",
        orderDate: "",
      };
    }

    const cleanTests = data.tests || [];

    const calculatedSubtotal = cleanTests.reduce(
      (sum: number, test: ReceiptLine) => sum + Number(test.price ?? 0),
      0
    );
    const subtotal =
      cleanTests.length > 0
        ? calculatedSubtotal
        : Number(data.total || 0) + Number(data.discount || 0);

    const pending = Math.max(Number(data.total || 0) - Number(data.paid || 0), 0);

    return {
      patient: data.patient,
      invoice: data.invoice,
      total: Number(data.total || 0),
      paid: Number(data.paid || 0),
      discount: Number(data.discount || 0),
      paymentMethod: data.payment_method,
      tests: cleanTests,
      subtotal,
      pending,
      status: pending <= 0 ? "Paid" : data.paid > 0 ? "Partial" : "Pending",
      orderDate: data.order_date || "",
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

  const invoiceNumber = receipt.invoice || patientInfo?.invoice_no || `INV-${orderId}`;
  const orderNumber = data.order_number || patientInfo?.order_number || `LAB-${orderId}`;
  const displayPatientName = patientInfo?.patient_name || receipt.patient || "Patient";
  const displayPatientCode = patientInfo?.patient_code || data.patient_code || "—";
  const displayAgeSex =
    patientInfo?.age_sex ||
    (patientInfo?.age_value
      ? `${patientInfo.age_value} ${patientInfo.age_unit || "Yrs"} / ${patientInfo.gender || "—"}`
      : "—");
  const displayReferredBy = patientInfo?.referred_by || "Self";
  const formattedDate = receipt.orderDate || new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="receipt-view">
      <style>{compactInvoicePrintCss}</style>

      {/* Screen toolbar */}
      <div className="receipt-view__toolbar no-print">
        <Button onClick={onBack} variant="secondary" icon={<ArrowLeft size={16} />}>
          Back to Operations
        </Button>

        <Button onClick={() => void printReceipt()} icon={<Printer size={16} />}>
          Print Invoice
        </Button>
      </div>

      {/* Compact A4 Upper-Half Invoice */}
      <article className="receipt-document">
        {/* Header */}
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
              <div className="receipt-document__eyebrow">Medical Laboratory Invoice</div>
              <h1>{labName || "Diagnostic Laboratory"}</h1>
              <p>{labAddress || "Clinical Laboratory Services"}</p>
            </div>
          </div>

          <div className="receipt-document__meta">
            <div className="receipt-document__badge-wrap">
              <Badge tone={receipt.status === "Paid" ? "success" : receipt.status === "Partial" ? "warning" : "neutral"}>
                {receipt.status === "Paid" ? "PAID" : receipt.status === "Partial" ? "PARTIAL" : "UNPAID"}
              </Badge>
            </div>

            <div className="receipt-document__meta-row">
              <span>Receipt No:</span>
              <strong>{invoiceNumber}</strong>
            </div>

            <div className="receipt-document__meta-row">
              <span>Lab Ref No:</span>
              <strong>{orderNumber}</strong>
            </div>

            <div className="receipt-document__meta-row">
              <span>Date:</span>
              <strong>{formattedDate}</strong>
            </div>
          </div>
        </header>

        {/* Patient Details (4-Column Equal-Width Grid) */}
        <section className="receipt-document__patient-grid">
          <div className="receipt-document__patient-col">
            <span className="receipt-document__patient-label">Patient Name</span>
            <strong className="receipt-document__patient-value">{displayPatientName}</strong>
          </div>

          <div className="receipt-document__patient-col">
            <span className="receipt-document__patient-label">PID</span>
            <strong className="receipt-document__patient-value">{displayPatientCode}</strong>
          </div>

          <div className="receipt-document__patient-col">
            <span className="receipt-document__patient-label">Age / Sex</span>
            <strong className="receipt-document__patient-value">{displayAgeSex}</strong>
          </div>

          <div className="receipt-document__patient-col receipt-document__patient-col--last">
            <span className="receipt-document__patient-label">Referred By</span>
            <strong className="receipt-document__patient-value">{displayReferredBy}</strong>
          </div>
        </section>

        {/* Billed Tests Table (3 Columns: #, Investigation / Test Name, Amount) */}
        <section className="receipt-document__section">
          <table className="receipt-document__table">
            <thead>
              <tr>
                <th style={{ width: "32px", textAlign: "center" }}>#</th>
                <th style={{ textAlign: "left" }}>Investigation / Test Name</th>
                <th style={{ width: "110px", textAlign: "right" }}>Amount (₹)</th>
              </tr>
            </thead>

            <tbody>
              {receipt.tests.length === 0 ? (
                <tr>
                  <td colSpan={3} className="receipt-document__empty-cell">
                    No investigations listed for this order.
                  </td>
                </tr>
              ) : (
                receipt.tests.map((test: ReceiptLine, index: number) => (
                  <tr key={`${test.test_name}-${index}`}>
                    <td className="receipt-document__col-num">
                      {index + 1}
                    </td>

                    <td className="receipt-document__col-name">
                      {test.test_name}
                    </td>

                    <td className="receipt-document__amount">
                      {money(Number(test.price || 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Financial Breakdown & Settlement */}
        <section className="receipt-document__bottom">
          <div className="receipt-document__payment-info">
            <div className="receipt-document__mode-block">
              <span className="receipt-document__mode-label">Payment Mode:</span>
              <strong className="receipt-document__mode-value">
                {receipt.paid > 0 ? (receipt.paymentMethod || "Cash / UPI") : "Unpaid"}
              </strong>
            </div>

            <div className="receipt-document__mode-block">
              <span className="receipt-document__mode-label">Payment Status:</span>
              <strong className="receipt-document__mode-value">
                {receipt.status === "Paid" ? "Paid in Full" : receipt.status === "Partial" ? "Partially Paid" : "Payment Pending"}
              </strong>
            </div>

            <p className="receipt-document__terms-note">
              Computer-generated receipt valid without physical signature. All tests performed under standard diagnostic laboratory protocols.
            </p>
          </div>

          <div className="receipt-document__totals">
            <ReceiptRow label="Subtotal" value={receipt.subtotal} />

            {receipt.discount > 0 && (
              <ReceiptRow label="Discount" value={receipt.discount} discount />
            )}

            <ReceiptRow label="Net Amount" value={receipt.total} strong />
            <ReceiptRow label="Amount Paid" value={receipt.paid} />
            <ReceiptRow
              label="Balance Due"
              value={receipt.pending}
              danger={receipt.pending > 0}
              strong
            />
          </div>
        </section>

        {/* Footer & Signature Line */}
        <footer className="receipt-document__footer">
          <div className="receipt-document__footer-left">
            <span>Thank you for choosing {labName || "our laboratory"}.</span>
          </div>

          <div className="receipt-document__signature">
            <div className="receipt-document__signature-line" />
            <span>Authorized Signatory</span>
          </div>
        </footer>
      </article>

      {/* Screen-only blank lower-half indicator */}
      <div className="receipt-view__half-hint no-print">
        <span>Printed receipt occupies approximately the upper half of standard A4 paper. Lower half remains blank.</span>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  strong,
  danger,
  discount,
}: {
  label: string;
  value: number;
  strong?: boolean;
  danger?: boolean;
  discount?: boolean;
}) {
  return (
    <div
      className={[
        "receipt-document__total-row",
        strong ? "receipt-document__total-row--strong" : "",
        danger ? "receipt-document__total-row--danger" : "",
        discount ? "receipt-document__total-row--discount" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>
        {discount ? `-${money(value)}` : money(value)}
      </strong>
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
          Back to Operations
        </Button>
      </div>
    </div>
  );
}

const compactInvoicePrintCss = `
  /* Screen display */
  .receipt-view {
    padding: 20px;
    background: var(--color-surface-subtle, #f8fafc);
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .receipt-view__toolbar {
    width: 100%;
    max-width: 720px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .receipt-view__half-hint {
    width: 100%;
    max-width: 720px;
    margin-top: 12px;
    padding: 6px 12px;
    background: rgba(79, 70, 229, 0.06);
    border: 1px dashed rgba(79, 70, 229, 0.25);
    border-radius: 6px;
    font-size: 11px;
    color: var(--color-primary, #4f46e5);
    text-align: center;
  }

  /* Invoice Document Container */
  .receipt-document {
    width: 100%;
    max-width: 720px;
    background: #ffffff;
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.05);
    padding: 16px 20px 12px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
  }

  /* Header */
  .receipt-document__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 8px;
    border-bottom: 1.5px solid #0f172a;
    margin-bottom: 8px;
  }

  .receipt-document__brand {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .receipt-document__logo-img {
    height: 38px;
    max-width: 95px;
    object-fit: contain;
  }

  .receipt-document__eyebrow {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4f46e5;
    margin-bottom: 1px;
  }

  .receipt-document__brand h1 {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: #0f172a;
    margin: 0;
    line-height: 1.15;
  }

  .receipt-document__brand p {
    font-size: 10.5px;
    color: #475569;
    margin: 1px 0 0;
    line-height: 1.25;
  }

  .receipt-document__meta {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }

  .receipt-document__badge-wrap {
    margin-bottom: 1px;
  }

  .receipt-document__meta-row {
    font-size: 11px;
    display: flex;
    gap: 6px;
    align-items: baseline;
  }

  .receipt-document__meta-row span {
    color: #64748b;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .receipt-document__meta-row strong {
    color: #0f172a;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 700;
  }

  /* Patient Details (4-Column Equal-Width Grid) */
  .receipt-document__patient-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    width: 100%;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    margin-bottom: 8px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .receipt-document__patient-col {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 6px 10px;
    border-right: 1px solid #e2e8f0;
    min-width: 0;
    box-sizing: border-box;
  }

  .receipt-document__patient-col:last-child,
  .receipt-document__patient-col--last {
    border-right: none;
  }

  .receipt-document__patient-label {
    font-size: 8.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin-bottom: 2px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .receipt-document__patient-value {
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.3;
    word-break: break-word;
    overflow-wrap: anywhere;
    white-space: normal;
    min-width: 0;
  }

  /* Table */
  .receipt-document__section {
    margin-bottom: 8px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    overflow: hidden;
  }

  .receipt-document__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }

  .receipt-document__table th {
    background: #f1f5f9;
    padding: 5px 8px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #334155;
    border-bottom: 1.5px solid #0f172a;
  }

  .receipt-document__table td {
    padding: 5px 8px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  .receipt-document__table tr:last-child td {
    border-bottom: none;
  }

  .receipt-document__col-num {
    width: 28px;
    text-align: center;
    color: #64748b;
    font-size: 10.5px;
    font-family: ui-monospace, monospace;
  }

  .receipt-document__col-name {
    text-align: left;
    font-weight: 600;
    color: #0f172a;
    font-size: 11.5px;
  }

  .receipt-document__amount {
    width: 100px;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 700;
    color: #0f172a;
    font-size: 11.5px;
  }

  .receipt-document__empty-cell {
    text-align: center;
    color: #94a3b8;
    padding: 12px !important;
  }

  /* Bottom Billing Strip */
  .receipt-document__bottom {
    display: grid;
    grid-template-columns: 1fr 200px;
    gap: 14px;
    align-items: start;
    padding-top: 6px;
    margin-bottom: 6px;
    border-top: 1px solid #e2e8f0;
  }

  .receipt-document__payment-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .receipt-document__mode-block {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .receipt-document__mode-label {
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 9.5px;
    letter-spacing: 0.03em;
  }

  .receipt-document__mode-value {
    color: #0f172a;
    font-weight: 700;
    background: #f1f5f9;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10.5px;
  }

  .receipt-document__terms-note {
    font-size: 9.5px;
    color: #94a3b8;
    line-height: 1.35;
    margin: 3px 0 0 0;
  }

  .receipt-document__totals {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .receipt-document__total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 11px;
    color: #475569;
    padding: 1px 0;
  }

  .receipt-document__total-row strong {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 600;
    color: #1e293b;
    font-size: 11px;
  }

  .receipt-document__total-row--discount strong {
    color: #16a34a;
  }

  .receipt-document__total-row--strong {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    padding: 3px 0;
    border-top: 1px dashed #cbd5e1;
    border-bottom: 1px dashed #cbd5e1;
    margin: 1px 0;
  }

  .receipt-document__total-row--strong strong {
    font-size: 12px;
    font-weight: 800;
  }

  .receipt-document__total-row--danger {
    color: #dc2626;
  }

  .receipt-document__total-row--danger strong {
    color: #dc2626;
    font-weight: 800;
  }

  /* Footer & Signature */
  .receipt-document__footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 6px;
    border-top: 1px solid #e2e8f0;
  }

  .receipt-document__footer-left span {
    font-size: 10px;
    color: #64748b;
    font-style: italic;
  }

  .receipt-document__signature {
    text-align: center;
    width: 130px;
  }

  .receipt-document__signature-line {
    border-bottom: 1px solid #94a3b8;
    margin-bottom: 3px;
    height: 18px;
  }

  .receipt-document__signature span {
    font-size: 9.5px;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
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

  /* ═══════════════════════════════════════════════════════
     A4 PORTRAIT COMPACT PRINT STYLES
     Upper half contains the receipt; lower half remains blank.
     ═══════════════════════════════════════════════════════ */
  @media print {
    .no-print,
    button {
      display: none !important;
    }

    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }

    html,
    body,
    #root {
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
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
      max-width: 100% !important;
      box-shadow: none !important;
      border: 1px solid #94a3b8 !important;
      border-radius: 3px !important;
      padding: 5mm 7mm 4mm !important;
      box-sizing: border-box !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    .receipt-document__table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .receipt-document__patient-grid {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      background: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .receipt-document__patient-col {
      border-right: 1px solid #cbd5e1 !important;
    }

    .receipt-document__patient-col:last-child,
    .receipt-document__patient-col--last {
      border-right: none !important;
    }
  }
`;
