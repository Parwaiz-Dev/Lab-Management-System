import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import type { DashboardOrderRow } from "../../../types";
import { getErrorMessage, money, testService } from "../services/testService";

type PaymentModalProps = {
  order: DashboardOrderRow;
  onClose: () => void;
  onDone: () => void;
};

export default function PaymentModal({
  order,
  onClose,
  onDone,
}: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [orderId, patientName, tests, totalAmount, paidAmount, paymentStatus] =
    order;

  const total = Number(totalAmount || 0);
  const paid = Number(paidAmount || 0);
  const remaining = Math.max(total - paid, 0);

  const paymentValue = Number(amount || 0);

  const progressPercent = useMemo(() => {
    if (!total) return 0;
    return Math.min(Math.round((paid / total) * 100), 100);
  }, [paid, total]);

  const afterPaymentPaid = Math.min(paid + paymentValue, total);
  const afterPaymentPending = Math.max(total - afterPaymentPaid, 0);

  const canSubmit =
    !saving &&
    remaining > 0 &&
    paymentValue > 0 &&
    paymentValue <= remaining;

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    window.addEventListener("keydown", onEscape);

    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose, saving]);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setError("");
  };

  const setQuickAmount = (value: number) => {
    setAmount(String(Math.max(value, 0)));
    setError("");
  };

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
      setError("");

      await testService.updatePayment(orderId, paid + pay);

      onDone();
      onClose();
    } catch (err) {
      console.error("Failed to record payment:", err);
      setError(getErrorMessage(err, "Failed to record payment"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="payment-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div className="payment-modal" onClick={(event) => event.stopPropagation()}>
        <div className="payment-modal__topbar" />

        <header className="payment-modal__header">
          <div>
            <div className="payment-modal__eyebrow">Payment Collection</div>
            <h2 id="payment-modal-title" className="payment-modal__title">
              Record Payment
            </h2>
            <p className="payment-modal__subtitle">
              {patientName} · Order #{orderId}
            </p>
          </div>

          <div className="payment-modal__header-actions">
            <Badge tone={remaining <= 0 ? "success" : "warning"}>
              {remaining <= 0 ? "Paid" : paymentStatus || "Pending"}
            </Badge>

            <button
              type="button"
              className="payment-modal__close"
              onClick={onClose}
              disabled={saving}
              aria-label="Close payment modal"
            >
              ×
            </button>
          </div>
        </header>

        <section className="payment-modal__order-card">
          <div>
            <span className="payment-modal__label">Selected Tests</span>
            <strong>{tests || "No tests available"}</strong>
          </div>

          <div className="payment-modal__order-id">
            <span>Order</span>
            <strong>#{orderId}</strong>
          </div>
        </section>

        <section className="payment-modal__summary-grid">
          <Amount label="Total Amount" value={total} />
          <Amount label="Paid Amount" value={paid} />
          <Amount label="Pending" value={remaining} highlight />
        </section>

        <section className="payment-modal__progress-card">
          <div className="payment-modal__progress-head">
            <span>Payment Progress</span>
            <strong>{progressPercent}%</strong>
          </div>

          <div className="payment-modal__progress-track">
            <div
              className="payment-modal__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="payment-modal__progress-meta">
            <span>{money(paid)} collected</span>
            <span>{money(remaining)} pending</span>
          </div>
        </section>

        <section className="payment-modal__form-section">
          <label className="payment-modal__field-label" htmlFor="payment-amount">
            Payment amount
          </label>

          <div className="payment-modal__amount-row">
            <Input
              id="payment-amount"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="Enter amount"
              type="number"
              min={0}
              max={remaining}
              step="0.01"
              autoFocus
              disabled={saving || remaining <= 0}
            />

            <Button
              onClick={() => setQuickAmount(remaining)}
              variant="secondary"
              disabled={saving || remaining <= 0}
            >
              Full
            </Button>
          </div>

          <div className="payment-modal__quick-actions">
            <button
              type="button"
              onClick={() => setQuickAmount(Math.round(remaining / 2))}
              disabled={saving || remaining <= 0}
            >
              50%
            </button>

            <button
              type="button"
              onClick={() => setQuickAmount(remaining)}
              disabled={saving || remaining <= 0}
            >
              Full pending
            </button>

            <button
              type="button"
              onClick={() => {
                setAmount("");
                setError("");
              }}
              disabled={saving || !amount}
            >
              Clear
            </button>
          </div>

          {amount && Number(amount) > 0 && (
            <div className="payment-modal__preview">
              <div>
                <span>Paid after this payment</span>
                <strong>{money(afterPaymentPaid)}</strong>
              </div>

              <div>
                <span>Pending after payment</span>
                <strong>{money(afterPaymentPending)}</strong>
              </div>
            </div>
          )}

          {error && <div className="payment-modal__error">{error}</div>}
        </section>

        <footer className="payment-modal__footer">
          <Button onClick={onClose} variant="secondary" disabled={saving}>
            Cancel
          </Button>

          <Button onClick={handleSubmit} variant="success" disabled={!canSubmit}>
            {saving ? "Saving..." : "Confirm Payment"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function Amount({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "payment-modal__amount-box",
        highlight ? "payment-modal__amount-box--highlight" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}