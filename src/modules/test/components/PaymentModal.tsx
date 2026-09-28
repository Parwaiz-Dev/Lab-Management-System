import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
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
    void loadHistory();
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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Record Payment"
      subtitle={`Order #${orderId} · ${patientName}`}
      maxWidth="lg"
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={saving}
          >
            <Banknote size={15} />
            Confirm Payment ({money(paymentValue || 0)})
          </Button>
        </div>
      }
    >
      <div className="payment-modal-box">
        {/* Order Meta Bar */}
        <div className="payment-modal-order-bar">
          <div className="payment-modal-order-meta">
            <FileText size={15} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
            <div>
              <span style={{ color: "var(--color-muted)" }}>Tests: </span>
              <strong style={{ color: "var(--color-text)" }}>{tests || "No tests listed"}</strong>
            </div>
          </div>
          <Badge
            tone={
              remaining <= 0
                ? "success"
                : paymentStatus === "Partial"
                ? "warning"
                : "danger"
            }
          >
            {remaining <= 0 ? "Fully Paid" : paymentStatus || "Pending"}
          </Badge>
        </div>

        {/* 3 Summary Stats */}
        <div className="payment-modal-stats-grid">
          <div className="payment-modal-stat-box">
            <span className="payment-modal-stat-label">Total Bill</span>
            <span className="payment-modal-stat-val">{money(total)}</span>
          </div>

          <div className="payment-modal-stat-box payment-modal-stat-box--paid">
            <span className="payment-modal-stat-label" style={{ color: "var(--color-emerald-700)" }}>
              Paid Amount
            </span>
            <span className="payment-modal-stat-val" style={{ color: "var(--color-emerald-700)" }}>
              {money(paid)}
            </span>
          </div>

          <div className="payment-modal-stat-box payment-modal-stat-box--due">
            <span className="payment-modal-stat-label" style={{ color: "var(--color-rose-700)" }}>
              Pending Due
            </span>
            <span className="payment-modal-stat-val" style={{ color: "var(--color-rose-700)" }}>
              {money(remaining)}
            </span>
          </div>
        </div>

        {/* Progress Track */}
        <div className="payment-modal-progress-wrap">
          <div className="payment-modal-progress-label">
            <span>Payment Progress</span>
            <strong style={{ fontFamily: "var(--font-mono)" }}>{progressPercent}%</strong>
          </div>
          <div className="payment-modal-progress-track">
            <div
              className="payment-modal-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Payment Entry Form */}
        {remaining > 0 ? (
          <div className="payment-modal-entry-card">
            <div className="payment-modal-entry-header">
              <label className="payment-modal-entry-title">
                <Banknote size={14} style={{ color: "var(--color-primary)" }} />
                Collect Amount (₹)
              </label>

              {/* Quick Preset Buttons */}
              <div className="payment-modal-quick-chips">
                <button
                  type="button"
                  onClick={() => setQuickAmount(Math.round(remaining / 2))}
                  disabled={saving}
                  className="payment-modal-chip-btn"
                >
                  50% ({money(Math.round(remaining / 2))})
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(remaining)}
                  disabled={saving}
                  className="payment-modal-chip-btn payment-modal-chip-btn--full"
                >
                  Full Pending ({money(remaining)})
                </button>
                {amount && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmount("");
                      setError("");
                    }}
                    disabled={saving}
                    className="payment-modal-chip-btn"
                    style={{ color: "var(--color-rose-600)" }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <Input
              id="payment-amount"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder={`Enter amount up to ${remaining}`}
              type="number"
              min={0}
              max={remaining}
              step="1"
              autoFocus
              disabled={saving}
            />

            {error && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--color-danger)",
                background: "rgba(239, 68, 68, 0.08)",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                fontWeight: 600,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Live Impact Preview */}
            {paymentValue > 0 && paymentValue <= remaining && (
              <div className="payment-modal-impact-preview">
                <div>
                  <span style={{ color: "var(--color-muted)", display: "block" }}>Total Paid After:</span>
                  <strong style={{ color: "var(--color-emerald-700)", fontFamily: "var(--font-mono)" }}>
                    {money(afterPaymentPaid)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--color-muted)", display: "block" }}>Remaining Due:</span>
                  <strong style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>
                    {money(afterPaymentPending)}
                  </strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-emerald-800)",
            fontSize: 12,
            fontWeight: 600,
          }}>
            <CheckCircle2 size={16} style={{ color: "var(--color-emerald-600)" }} />
            <span>This order is fully settled. No further payments pending.</span>
          </div>
        )}

        {/* Payment History Audit Section */}
        <div className="payment-modal-history-wrap">
          <div className="payment-modal-history-head">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} style={{ color: "var(--color-muted)" }} />
              <span>Payment History</span>
            </div>
            {history.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "none", fontWeight: 500 }}>
                {history.length} {history.length === 1 ? "transaction" : "transactions"}
              </span>
            )}
          </div>

          {historyLoading ? (
            <div style={{ fontSize: 12, color: "var(--color-muted)", padding: "16px 0", textAlign: "center" }}>
              Loading transactions…
            </div>
          ) : historyError ? (
            <div style={{ fontSize: 12, color: "var(--color-danger)", padding: "8px 0" }}>{historyError}</div>
          ) : history.length === 0 ? (
            <div style={{
              fontSize: 12,
              color: "var(--color-muted)",
              padding: 12,
              textAlign: "center",
              background: "var(--color-surface-soft)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
            }}>
              No previous payments recorded for this order.
            </div>
          ) : (
            <div className="payment-modal-history-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th style={{ textAlign: "right" }}>Previous</th>
                    <th style={{ textAlign: "right" }}>New Paid</th>
                    <th style={{ textAlign: "right" }}>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => {
                    const added = entry.new_paid - entry.previous_paid;
                    return (
                      <tr key={entry.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text)" }}>
                            <Calendar size={12} style={{ color: "var(--color-muted)" }} />
                            <span>{formatDateTime(entry.created_at)}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>
                          {money(entry.previous_paid)}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                          {money(entry.new_paid)}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-emerald-700)" }}>
                          {added > 0 ? `+${money(added)}` : money(0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}