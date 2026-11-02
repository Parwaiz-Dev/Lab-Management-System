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
                {receipt.status === "Paid" ? "FULL PAYMENT" : receipt.status === "Partial" ? "PARTIAL PAYMENT" : "PAYMENT PENDING"}
              </Badge>
            </div>

            <div className="receipt-document__meta-row">
              <span>Invoice No:</span>
              <strong>{invoiceNumber}</strong>
            </div>

            <div className="receipt-document__meta-row">
              <span>Order ID:</span>
              <strong>{orderNumber}</strong>
            </div>

            <div className="receipt-document__meta-row">
              <span>Date:</span>
              <strong>{formattedDate}</strong>
            </div>
          </div>
        </header>

        {/* Patient Details Grid (Compact 4-column block) */}
        <section className="receipt-document__patient-grid">
          <div className="receipt-document__patient-item">
            <span className="receipt-document__patient-label">Patient Name</span>
            <strong className="receipt-document__patient-value">{displayPatientName}</strong>
          </div>

          <div className="receipt-document__patient-item">
            <span className="receipt-document__patient-label">Patient ID</span>
            <strong className="receipt-document__patient-value">{displayPatientCode}</strong>
          </div>

          <div className="receipt-document__patient-item">
            <span className="receipt-document__patient-label">Age / Gender</span>
            <strong className="receipt-document__patient-value">{displayAgeSex}</strong>
          </div>

          <div className="receipt-document__patient-item">
            <span className="receipt-document__patient-label">Referred By</span>
            <strong className="receipt-document__patient-value">{displayReferredBy}</strong>
          </div>
        </section>

        {/* Billed Tests Table */}
        <section className="receipt-document__section">
          <table className="receipt-document__table">
            <thead>
              <tr>
                <th style={{ width: "32px", textAlign: "center" }}>#</th>
                <th>Investigation / Test Description</th>
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
                    <td style={{ textAlign: "center", color: "var(--color-muted)", fontSize: "11px" }}>
                      {index + 1}
                    </td>

                    <td>
                      <div className="receipt-document__test-name">{test.test_name}</div>
                      {test.parameter_names && test.parameter_names.length > 0 && (
                        <div className="receipt-document__test-params">
                          {test.parameter_names.join(", ")}
                        </div>
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
        </section>

        {/* Financial Breakdown & Settlement */}
        <section className="receipt-document__bottom">
          <div className="receipt-document__payment-info">
            <div className="receipt-document__mode-block">
              <span className="receipt-document__mode-label">Payment Mode:</span>
              <strong className="receipt-document__mode-value">
                {receipt.paid > 0 ? (receipt.paymentMethod || "Not recorded") : "Unpaid / Pay Later"}
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
              label={receipt.pending > 0 ? "Balance Due" : "Balance Due"}
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
        <span>Printed receipt occupies the upper half of standard A4 paper. Lower half is left blank for tear-off or lab documentation.</span>
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
        {discount ? `-${money(value)}` : value === 0 && danger ? "NIL (₹0.00)" : money(value)}
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
    margin-bottom: 14px;
  }

  .receipt-view__half-hint {
    width: 100%;
    max-width: 720px;
    margin-top: 14px;
    padding: 8px 14px;
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
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.05);
    padding: 18px 24px 14px;
    box-sizing: border-box;
    font-family: inherit;
    color: #0f172a;
  }

  /* Header */
  .receipt-document__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 12px;
    border-bottom: 2px solid #4f46e5;
    margin-bottom: 10px;
  }

  .receipt-document__brand {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .receipt-document__logo-img {
    height: 42px;
    max-width: 110px;
    object-fit: contain;
  }

  .receipt-document__eyebrow {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4f46e5;
    margin-bottom: 1px;
  }

  .receipt-document__brand h1 {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
    margin: 0 0 1px 0;
    line-height: 1.2;
  }

  .receipt-document__brand p {
    font-size: 11px;
    color: #64748b;
    margin: 0;
    line-height: 1.3;
  }

  .receipt-document__meta {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .receipt-document__badge-wrap {
    margin-bottom: 2px;
  }

  .receipt-document__meta-row {
    font-size: 11.5px;
    display: flex;
    gap: 6px;
    align-items: baseline;
  }

  .receipt-document__meta-row span {
    color: #64748b;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .receipt-document__meta-row strong {
    color: #0f172a;
    font-family: var(--font-mono, monospace);
    font-weight: 700;
  }

  /* Patient Details Grid */
  .receipt-document__patient-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1.2fr;
    gap: 8px 12px;
    padding: 8px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .receipt-document__patient-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .receipt-document__patient-label {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .receipt-document__patient-value {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Table */
  .receipt-document__section {
    margin-bottom: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }

  .receipt-document__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }

  .receipt-document__table th {
    background: #f8fafc;
    padding: 6px 10px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
  }

  .receipt-document__table td {
    padding: 5px 10px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  .receipt-document__table tr:last-child td {
    border-bottom: none;
  }

  .receipt-document__test-name {
    font-weight: 600;
    color: #1e293b;
    font-size: 11.5px;
  }

  .receipt-document__test-params {
    color: #64748b;
    font-size: 10px;
    line-height: 1.25;
  }

  .receipt-document__amount {
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-weight: 700;
    color: #0f172a;
    font-size: 11.5px;
  }

  .receipt-document__empty-cell {
    text-align: center;
    color: #94a3b8;
    padding: 14px !important;
  }

  /* Bottom Billing Strip */
  .receipt-document__bottom {
    display: grid;
    grid-template-columns: 1fr 220px;
    gap: 16px;
    align-items: start;
    padding-top: 8px;
    margin-bottom: 8px;
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
    letter-spacing: 0.04em;
  }

  .receipt-document__mode-value {
    color: #0f172a;
    font-weight: 700;
    background: #f1f5f9;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: capitalize;
  }

  .receipt-document__terms-note {
    font-size: 9.5px;
    color: #94a3b8;
    line-height: 1.35;
    margin: 4px 0 0 0;
  }

  .receipt-document__totals {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .receipt-document__total-row {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: #475569;
    padding: 1px 0;
  }

  .receipt-document__total-row strong {
    font-family: var(--font-mono, monospace);
    font-weight: 600;
    color: #1e293b;
  }

  .receipt-document__total-row--discount strong {
    color: #16a34a;
  }

  .receipt-document__total-row--strong {
    font-size: 12.5px;
    font-weight: 700;
    color: #0f172a;
    padding-top: 3px;
    border-top: 1px dashed #cbd5e1;
  }

  .receipt-document__total-row--strong strong {
    font-size: 13px;
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
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
  }

  .receipt-document__footer-left span {
    font-size: 10px;
    color: #64748b;
    font-style: italic;
  }

  .receipt-document__signature {
    text-align: center;
    width: 140px;
  }

  .receipt-document__signature-line {
    border-bottom: 1px solid #94a3b8;
    margin-bottom: 4px;
    height: 24px;
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
     Upper half contains the invoice; lower half remains blank.
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
      height: 100% !important;
      overflow: visible !important;
      background: #ffffff !important;
      font-size: 11pt !important;
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
      border: 1px solid #cbd5e1 !important;
      border-radius: 4px !important;
      padding: 12mm 14mm 8mm !important;
      box-sizing: border-box !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    /* Prevent orphan table rows if test list is longer */
    .receipt-document__table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .receipt-document__header {
      border-bottom: 2px solid #4f46e5 !important;
      padding-bottom: 8px !important;
      margin-bottom: 8px !important;
    }

    .receipt-document__patient-grid {
      background: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      padding: 6px 10px !important;
      margin-bottom: 8px !important;
    }

    .receipt-document__section {
      margin-bottom: 8px !important;
    }

    .receipt-document__bottom {
      padding-top: 6px !important;
      margin-bottom: 6px !important;
    }

    .receipt-document__footer {
      padding-top: 6px !important;
    }
  }
`;
