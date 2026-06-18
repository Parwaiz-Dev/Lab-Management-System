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

        <Button onClick={() => window.print()} icon={<Printer size={16} />}>Print Receipt</Button>
      </div>

      <article className="receipt-document">
        <header className="receipt-document__header">
          <div className="receipt-document__brand">
            {logoSrc ? (
              <img
                className="receipt-document__logo-img"
                src={logoSrc}
                alt="Lab logo"
              />
            ) : (
              <div className="receipt-document__logo">LM</div>
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

          <div className="receipt-document__signature">
            <div />
            <span>Authorized Signature</span>
          </div>
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