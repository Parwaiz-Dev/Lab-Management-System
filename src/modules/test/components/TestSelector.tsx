import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "../../../components/ui/Card";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import Badge from "../../../components/ui/Badge";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import type { Patient, Test, ToastMessage } from "../../../types";
import { getErrorMessage, money, testService } from "../services/testService";

type SelectedTest = Test & {
  selectedParameterIds: number[];
};

type ConfirmationAction = "create_order" | "record_payment";

type ConfirmationState = {
  action: ConfirmationAction;
  title: string;
  description: string;
  confirmLabel: string;
};

type LastOrder = {
  id: number;
  total: number;
  paid: number;
  subtotal: number;
  discount: number;
};

type TestSelectorProps = {
  patient: Patient | null;
  layout?: "inline" | "visitGrid";
  onOpenReceipt?: (orderId: number) => void;
};

export default function TestSelector({
  patient,
  layout = "inline",
  onOpenReceipt,
}: TestSelectorProps) {
  const [tests, setTests] = useState<Test[]>([]);
  const [selected, setSelected] = useState<SelectedTest[]>([]);
  const [billedTests, setBilledTests] = useState<SelectedTest[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [loadingTests, setLoadingTests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [activeChecklistId, setActiveChecklistId] = useState<number | null>(
    null
  );
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(
    null
  );

  const loadTests = useCallback(async () => {
    try {
      setLoadingTests(true);
      const data = await testService.getTests();
      setTests(data);
    } catch (err) {
      console.error(err);
      setToast({
        message: getErrorMessage(err, "Failed to load test catalog"),
        type: "error",
      });
    } finally {
      setLoadingTests(false);
    }
  }, []);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  useEffect(() => {
    setSelected([]);
    setBilledTests([]);
    setSearch("");
    setLastOrder(null);
    setPaymentAmount("");
    setDiscount("");
    setActiveChecklistId(null);
  }, [patient?.id]);

  const filtered = useMemo(() => {
  const query = search.trim().toLowerCase();

  if (!query) return [];

  return tests
    .filter((test) => {
      const parameterMatch = test.parameters.some((param) =>
        param.name.toLowerCase().includes(query)
      );

      return test.name.toLowerCase().includes(query) || parameterMatch;
    })
    .slice(0, 10);
}, [search, tests]);

const shouldShowCatalogDropdown = search.trim().length > 0 && filtered.length > 0;
const shouldShowNoCatalogResult =
  search.trim().length > 0 && !loadingTests && filtered.length === 0;

  const addTest = (test: Test) => {
    setSelected((prev) => {
      if (prev.some((item) => item.id === test.id)) return prev;

      return [
        ...prev,
        {
          ...test,
          selectedParameterIds: test.parameters.map((param) => param.id),
        },
      ];
    });

    setSearch("");
  };

  const removeTest = (id: number) => {
    setSelected((prev) => prev.filter((test) => test.id !== id));
    setActiveChecklistId((current) => (current === id ? null : current));
  };

  const toggleParameter = (testId: number, parameterId: number) => {
    setSelected((prev) =>
      prev.map((test) => {
        if (test.id !== testId) return test;

        const selectedParameterIds = test.selectedParameterIds.includes(
          parameterId
        )
          ? test.selectedParameterIds.filter((id) => id !== parameterId)
          : [...test.selectedParameterIds, parameterId];

        return { ...test, selectedParameterIds };
      })
    );
  };

  const subtotal = selected.reduce((sum, test) => sum + test.price, 0);

  const selectedParameterCount = selected.reduce(
    (sum, test) => sum + test.selectedParameterIds.length,
    0
  );

  const activeChecklistTest =
    selected.find((test) => test.id === activeChecklistId) || null;

  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = Math.max(subtotal - discountValue, 0);

  const billTestsSnapshot = lastOrder ? billedTests : selected;
  const billSubtotal = lastOrder ? lastOrder.subtotal : subtotal;
  const billDiscount = lastOrder ? lastOrder.discount : discountValue;
  const billTotal = lastOrder ? lastOrder.total : total;
  const pendingAmount = lastOrder
    ? Math.max(lastOrder.total - lastOrder.paid, 0)
    : 0;

  const validateOrderSelection = () => {
    if (!patient) {
      setToast({
        message: "Select a patient before creating an order",
        type: "error",
      });
      return false;
    }

    if (selected.length === 0) {
      setToast({ message: "Select at least one test", type: "warning" });
      return false;
    }

    const parameterIds = selected.flatMap((test) => test.selectedParameterIds);

    if (parameterIds.length === 0) {
      setToast({ message: "Select at least one sub test", type: "warning" });
      return false;
    }

    return true;
  };

  const saveOrder = async () => {
    if (!patient || !validateOrderSelection()) return;

    const parameterIds = selected.flatMap((test) => test.selectedParameterIds);

    try {
      setSaving(true);

      const orderTestsSnapshot = selected.map((test) => ({ ...test }));

      const orderId = await testService.createOrder({
        patientId: patient.id,
        testIds: selected.map((test) => test.id),
        parameterIds,
        totalAmount: total,
        discountAmount: discountValue,
      });

      setBilledTests(orderTestsSnapshot);
      setLastOrder({
        id: orderId,
        total,
        paid: 0,
        subtotal,
        discount: discountValue,
      });

      setSelected([]);
      setSearch("");
      setDiscount("");
      setPaymentAmount("");
      setActiveChecklistId(null);

      setToast({ message: "Bill created successfully", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({
        message: getErrorMessage(err, "Failed to create order"),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const startNewBill = () => {
    setLastOrder(null);
    setBilledTests([]);
    setPaymentAmount("");
    setDiscount("");
    setSelected([]);
    setSearch("");
    setActiveChecklistId(null);
  };

  const recordPayment = async () => {
    if (!lastOrder) return;

    const amount = Number(paymentAmount);
    const pending = lastOrder.total - lastOrder.paid;

    if (!amount || amount <= 0) {
      setToast({ message: "Enter a valid payment amount", type: "warning" });
      return;
    }

    if (amount > pending) {
      setToast({
        message: "Payment cannot exceed pending amount",
        type: "error",
      });
      return;
    }

    try {
      setPaymentSaving(true);

      await testService.updatePayment(lastOrder.id, lastOrder.paid + amount);

      setLastOrder({ ...lastOrder, paid: lastOrder.paid + amount });
      setPaymentAmount("");
      setToast({ message: "Payment recorded successfully", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({
        message: getErrorMessage(err, "Failed to record payment"),
        type: "error",
      });
    } finally {
      setPaymentSaving(false);
    }
  };

  const requestConfirmation = (action: ConfirmationAction) => {
    if (action === "create_order") {
      if (!validateOrderSelection()) return;

      setConfirmation({
        action,
        title: "Create patient order",
        description:
          "You are about to create a new billable lab order. Confirm to proceed.",
        confirmLabel: "Create Bill",
      });

      return;
    }

    if (action === "record_payment") {
      if (!lastOrder) return;

      const amount = Number(paymentAmount);

      if (!amount || amount <= 0) {
        setToast({ message: "Enter a valid payment amount", type: "warning" });
        return;
      }

      if (amount > pendingAmount) {
        setToast({
          message: "Payment cannot exceed pending amount",
          type: "error",
        });
        return;
      }

      setConfirmation({
        action,
        title: "Confirm payment",
        description: `Apply a payment of ${money(amount)} to order #${lastOrder.id}?`,
        confirmLabel: "Record Payment",
      });
    }
  };

  const handleConfirm = async () => {
    if (!confirmation) return;

    const action = confirmation.action;
    setConfirmation(null);

    if (action === "create_order") await saveOrder();
    if (action === "record_payment") await recordPayment();
  };

  const selectionContent = (
    <div className="test-selector__content">
      <section className="test-selector__section">
        <div className="test-selector__section-head">
          <div>
            <div className="test-selector__section-title">Search Catalog</div>
            <div className="test-selector__section-subtitle">
              Add tests or panels for this patient.
            </div>
          </div>

          <Badge tone={tests.length ? "info" : "neutral"}>
            {loadingTests ? "Loading" : `${tests.length} tests`}
          </Badge>
        </div>

        <div className="test-selector__search">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test or sub test"
            disabled={saving || loadingTests}
          />

          {shouldShowCatalogDropdown && (
  <div className="test-selector__catalog-list">
    {filtered.map((test) => (
      <button
        key={test.id}
        type="button"
        onClick={() => addTest(test)}
        className="test-selector__catalog-item"
        disabled={saving}
      >
        <span>
          <strong>{test.name}</strong>
          <span className="test-selector__catalog-meta">
            {test.parameters.length} sub tests
          </span>
        </span>

        <span className="test-selector__catalog-price">
          {money(test.price)}
        </span>
      </button>
    ))}
  </div>
)}

{shouldShowNoCatalogResult && (
  <div className="test-selector__catalog-empty">
    No matching tests found.
  </div>
)}
        </div>
      </section>

      <section className="test-selector__section">
        <div className="test-selector__section-head">
          <div>
            <div className="test-selector__section-title">Selected Tests</div>
            <div className="test-selector__section-subtitle">
              Click a test to choose sub tests.
            </div>
          </div>

          <Badge tone={selected.length ? "success" : "neutral"}>
            {selected.length} tests / {selectedParameterCount} sub tests
          </Badge>
        </div>

        {selected.length === 0 ? (
          <div className="test-selector__empty">
            Search and add tests to build the order.
          </div>
        ) : (
          <div className="test-selector__selected-list">
            {selected.map((test) => (
              <div
                key={test.id}
                role="button"
                tabIndex={0}
                className={[
                  "test-selector__selected-item",
                  activeChecklistId === test.id
                    ? "test-selector__selected-item--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setActiveChecklistId(test.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveChecklistId(test.id);
                  }
                }}
              >
                <span className="test-selector__selected-main">
                  <strong>{test.name}</strong>
                  <span>
                    {test.selectedParameterIds.length} of{" "}
                    {test.parameters.length} sub tests selected
                  </span>
                </span>

                <span className="test-selector__selected-side">
                  <strong>{money(test.price)}</strong>
                  <span className="test-selector__badge-pill">Sub Tests</span>

                  <button
                    type="button"
                    className="test-selector__remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeTest(test.id);
                    }}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const billingContent = (
    <div className="test-selector__billing">
      <section className="test-selector__bill-card">
        <div className="test-selector__bill-head">
          <span>Selected Tests</span>
          <Badge tone={billTestsSnapshot.length ? "info" : "neutral"}>
            {billTestsSnapshot.length}
          </Badge>
        </div>

        <div className="test-selector__bill-list">
          {billTestsSnapshot.length === 0 ? (
            <div className="test-selector__empty">No tests selected.</div>
          ) : (
            billTestsSnapshot.map((test) => (
              <div key={test.id} className="test-selector__bill-row">
                <span>
                  <strong>{test.name}</strong>
                  <small>{test.selectedParameterIds.length} sub tests</small>
                </span>

                <strong>{money(test.price)}</strong>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="billing-summary">
        <div className="billing-summary__row">
          <span>Subtotal</span>
          <strong>{money(billSubtotal)}</strong>
        </div>

        <div className="billing-summary__row billing-summary__row--input">
          <span>Discount</span>
          <Input
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            type="number"
            min={0}
            max={subtotal}
            step="0.01"
            placeholder="0"
            disabled={saving || selected.length === 0 || Boolean(lastOrder)}
          />
        </div>

        {lastOrder && billDiscount > 0 && (
          <div className="billing-summary__note">
            Discount applied: {money(billDiscount)}
          </div>
        )}

        <div className="billing-summary__total">
          <span>Net Total</span>
          <strong>{money(billTotal)}</strong>
        </div>
      </section>

      {lastOrder ? (
        <div className="test-selector__billing-actions">
          <Button
  type="button"
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    if (lastOrder?.id) onOpenReceipt?.(lastOrder.id);
  }}
  variant="success"
>
  Print Receipt
</Button>

          <Button onClick={startNewBill} variant="secondary">
            New Bill
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => requestConfirmation("create_order")}
          disabled={saving || selected.length === 0}
        >
          {saving ? "Saving..." : "Create Bill"}
        </Button>
      )}

      {lastOrder && (
        <section className="payment-panel">
          <div className="payment-panel__header">
            <div>
              <div className="payment-panel__title">Payment</div>
              <div className="payment-panel__meta">
                Order #{lastOrder.id} · Pending {money(pendingAmount)}
              </div>
            </div>

            <Badge tone={lastOrder.paid >= lastOrder.total ? "success" : "warning"}>
              {money(lastOrder.paid)} paid
            </Badge>
          </div>

          <div className="payment-panel__controls">
            <Input
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              type="number"
              min={0}
              max={pendingAmount}
              step="0.01"
              placeholder="Partial amount"
              disabled={paymentSaving || lastOrder.paid >= lastOrder.total}
            />

            <Button
              onClick={() => setPaymentAmount(String(pendingAmount))}
              variant="secondary"
              disabled={paymentSaving || lastOrder.paid >= lastOrder.total}
            >
              Full
            </Button>

            <Button
              onClick={() => requestConfirmation("record_payment")}
              variant="success"
              disabled={paymentSaving || lastOrder.paid >= lastOrder.total}
            >
              {lastOrder.paid >= lastOrder.total
                ? "Paid"
                : paymentSaving
                  ? "Saving..."
                  : "Record"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );

  const floatingUi = (
    <>
      {activeChecklistTest && (
        <div
          className="test-selector__checklist-overlay"
          onClick={() => setActiveChecklistId(null)}
        >
          <div
            className="test-selector__checklist-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="test-selector__checklist-header">
              <div>
                <h3 className="test-selector__checklist-title">
                  {activeChecklistTest.name}
                </h3>

                <div className="test-selector__checklist-meta">
                  Select only the sub tests needed for this patient.
                </div>
              </div>

              <Button onClick={() => setActiveChecklistId(null)} variant="secondary">
                Close
              </Button>
            </div>

            <div className="test-selector__checklist-body">
              {activeChecklistTest.parameters.map((param) => (
                <label key={param.id} className="test-selector__parameter-item">
                  <input
                    type="checkbox"
                    checked={activeChecklistTest.selectedParameterIds.includes(
                      param.id
                    )}
                    onChange={() =>
                      toggleParameter(activeChecklistTest.id, param.id)
                    }
                  />

                  <span>
                    <span className="test-selector__parameter-name">
                      {param.name}
                    </span>

                    <span className="test-selector__parameter-meta">
                      {param.unit || "No unit"} ·{" "}
                      {param.normal_range || "No range"}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="test-selector__checklist-footer">
              <Button
                variant="secondary"
                onClick={() =>
                  setSelected((prev) =>
                    prev.map((test) =>
                      test.id === activeChecklistTest.id
                        ? {
                            ...test,
                            selectedParameterIds: test.parameters.map(
                              (param) => param.id
                            ),
                          }
                        : test
                    )
                  )
                }
              >
                Select All
              </Button>

              <Button onClick={() => setActiveChecklistId(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <ConfirmationDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? "Confirm action"}
        description={confirmation?.description ?? "Please confirm to continue."}
        confirmLabel={confirmation?.confirmLabel}
        loading={saving || paymentSaving}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmation(null)}
      />
    </>
  );

  if (layout === "visitGrid") {
    return (
      <>
        <Card
          title="Test Order"
          eyebrow="Step 2"
          right={<Badge tone="success">Active</Badge>}
          className="patient-page__card patient-page__card--tests"
        >
          {selectionContent}
        </Card>

        <Card
          title="Billing"
          eyebrow="Create Order"
          right={
            <Badge tone={lastOrder ? "success" : "info"}>
              {lastOrder ? "Created" : "Ready"}
            </Badge>
          }
          className="patient-page__card patient-page__card--billing"
          compact
        >
          {billingContent}
        </Card>

        {floatingUi}
      </>
    );
  }

  return (
    <div className="test-selector test-selector--inline">
      <div className="test-selector__inline-grid">
        <Card title="Test Order" eyebrow="Tests">
          {selectionContent}
        </Card>

        <Card title="Billing" eyebrow="Create Order" compact>
          {billingContent}
        </Card>
      </div>

      {floatingUi}
    </div>
  );
}