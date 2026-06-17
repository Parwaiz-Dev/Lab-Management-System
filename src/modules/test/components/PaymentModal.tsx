import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import type { DashboardOrderRow, PaymentHistoryEntry } from "../../../types";
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
  const [history, setHistory] = useState<PaymentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  const {
    id: orderId,
    patientName,
    tests,
    totalAmount,
    paidAmount,
    paymentStatus,
  } = order;

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

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const rows = await testService.getPaymentHistory(orderId);
      setHistory(rows);
    } catch (err) {
      console.error("Failed to load payment history:", err);
      setHistoryError(getErrorMessage(err, "Failed to load payment history"));
    } finally {
      setHistoryLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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

  const formatDateTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
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
          <Amount icon="&#x1F4B0;" label="Total Amount" value={total} />
          <Amount icon="&#x2705;" label="Paid Amount" value={paid} />
          <Amount icon="&#x23F3;" label="Pending" value={remaining} highlight />
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

        <section className="payment-modal__history-section">
          <div className="payment-modal__history-head">
            <h3 className="payment-modal__history-title">Payment History</h3>
            {history.length > 0 && (
              <span className="payment-modal__history-count">
                {history.length} {history.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>

          {historyLoading && (
            <div className="payment-modal__history-state">
              <span className="payment-modal__history-spinner" aria-hidden="true" />
              <span>Loading payment history…</span>
            </div>
          )}

          {historyError && !historyLoading && (
            <div className="payment-modal__history-state payment-modal__history-state--error">
              {historyError}
            </div>
          )}

          {!historyLoading && !historyError && history.length === 0 && (
            <div className="payment-modal__history-state">
              No payment history for this order yet.
            </div>
          )}

          {!historyLoading && !historyError && history.length > 0 && (
            <div className="payment-modal__history-table-wrap">
              <table className="payment-modal__history-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => {
                    const added = entry.new_paid - entry.previous_paid;
                    return (
                      <tr key={entry.id}>
                        <td>
                          <span className="payment-modal__history-date">
                            {formatDateTime(entry.created_at)}
                          </span>
                        </td>
                        <td>{money(entry.previous_paid)}</td>
                        <td>{money(entry.new_paid)}</td>
                        <td>
                          <span
                            className={
                              added > 0
                                ? "payment-modal__history-added"
                                : "payment-modal__history-added--zero"
                            }
                          >
                            {added > 0 ? `+${money(added)}` : money(0)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
  icon,
  label,
  value,
  highlight,
}: {
  icon?: string;
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
      {icon && <span className="payment-modal__amount-icon">{icon}</span>}
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}