import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Card from "../../../components/ui/Card";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import Badge from "../../../components/ui/Badge";
import { colors } from "../../../components/ui/styles";
import type { Patient, Test, ToastMessage } from "../../../types";

type SelectedTest = Test & { selectedParameterIds: number[] };

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

export default function TestSelector({ patient, layout = "inline", onOpenReceipt }: TestSelectorProps) {
  const [tests, setTests] = useState<Test[]>([]);
  const [selected, setSelected] = useState<SelectedTest[]>([]);
  const [billedTests, setBilledTests] = useState<SelectedTest[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [activeChecklistId, setActiveChecklistId] = useState<number | null>(null);

  useEffect(() => {
    loadTests();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? tests.filter((test) => {
          const parameterMatch = test.parameters.some((param) => param.name.toLowerCase().includes(query));
          return test.name.toLowerCase().includes(query) || parameterMatch;
        })
      : tests;
    return list.slice(0, 10);
  }, [search, tests]);

  const loadTests = async () => {
    try {
      setTests((await invoke("get_tests")) as Test[]);
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load test catalog", type: "error" });
    }
  };

  const addTest = (test: Test) => {
    setSelected((prev) => {
      if (prev.some((item) => item.id === test.id)) return prev;
      return [...prev, { ...test, selectedParameterIds: test.parameters.map((param) => param.id) }];
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
        const selectedParameterIds = test.selectedParameterIds.includes(parameterId)
          ? test.selectedParameterIds.filter((id) => id !== parameterId)
          : [...test.selectedParameterIds, parameterId];
        return { ...test, selectedParameterIds };
      }),
    );
  };

  const subtotal = selected.reduce((sum, test) => sum + test.price, 0);
  const selectedParameterCount = selected.reduce((sum, test) => sum + test.selectedParameterIds.length, 0);
  const activeChecklistTest = selected.find((test) => test.id === activeChecklistId) || null;
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = Math.max(subtotal - discountValue, 0);
  const billTestsSnapshot = lastOrder ? billedTests : selected;
  const billSubtotal = lastOrder ? lastOrder.subtotal : subtotal;
  const billDiscount = lastOrder ? lastOrder.discount : discountValue;
  const billTotal = lastOrder ? lastOrder.total : total;

  const saveOrder = async () => {
    if (!patient) {
      setToast({ message: "Select a patient before creating an order", type: "error" });
      return;
    }

    if (selected.length === 0) {
      setToast({ message: "Select at least one test", type: "warning" });
      return;
    }

    const parameterIds = selected.flatMap((test) => test.selectedParameterIds);
    if (parameterIds.length === 0) {
      setToast({ message: "Select at least one sub test", type: "warning" });
      return;
    }

    try {
      setSaving(true);
      const orderTests = selected;
      const orderId = (await invoke("create_order", {
        patientId: patient.id,
        testIds: selected.map((test) => test.id),
        parameterIds,
        totalAmount: total,
        discountAmount: discountValue,
      })) as number;

      setToast({ message: "Bill created successfully", type: "success" });
      setBilledTests(orderTests);
      setLastOrder({ id: orderId, total, paid: 0, subtotal, discount: discountValue });
      setPaymentAmount("");
      setDiscount("");
      setSelected([]);
      setSearch("");
    } catch (err) {
      console.error(err);
      setToast({ message: typeof err === "string" ? err : "Failed to create order", type: "error" });
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
      setToast({ message: "Payment cannot exceed pending amount", type: "error" });
      return;
    }

    try {
      setPaymentSaving(true);
      await invoke("update_payment", {
        orderId: lastOrder.id,
        paidAmount: lastOrder.paid + amount,
      });
      setLastOrder({ ...lastOrder, paid: lastOrder.paid + amount });
      setPaymentAmount("");
      setToast({ message: "Payment recorded successfully", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: typeof err === "string" ? err : "Failed to record payment", type: "error" });
    } finally {
      setPaymentSaving(false);
    }
  };

  const selectionContent = (
    <div style={selectionPane}>
      <div style={searchWrap}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search test or sub test" />
        {(search || selected.length === 0) && filtered.length > 0 && (
          <div style={catalog}>
            {filtered.map((test) => (
              <button key={test.id} onClick={() => addTest(test)} style={catalogItem}>
                <span>
                  <span style={{ fontWeight: 800 }}>{test.name}</span>
                  <span style={catalogMeta}>{test.parameters.length} sub tests</span>
                </span>
                <span style={{ color: colors.muted }}>Rs {test.price}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={selectedHeader}>
        <span style={{ fontWeight: 850 }}>Selected Tests</span>
        <Badge tone={selected.length ? "info" : "neutral"}>
          {selected.length} tests / {selectedParameterCount} sub tests
        </Badge>
      </div>

      <div style={selectedBox}>
        {selected.length === 0 ? (
          <div style={empty}>Search and add tests to build the order.</div>
        ) : (
          selected.map((test) => (
            <div key={test.id} style={selectedRow} onClick={() => setActiveChecklistId(test.id)}>
              <div style={testHead}>
                <div>
                  <div style={{ fontWeight: 850 }}>{test.name}</div>
                  <div style={{ color: colors.muted, fontSize: 12 }}>
                    Click to choose sub tests - {test.selectedParameterIds.length} of {test.parameters.length} selected
                  </div>
                </div>
                <div style={rowActions}>
                  <span style={{ fontWeight: 900 }}>Rs {test.price}</span>
                  <span style={editPill}>Sub Tests</span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      removeTest(test.id);
                    }}
                    style={removeBtn}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const billingContent = (
    <div style={billingPane}>
      <div style={billTests}>
        <div style={billTestsHead}>
          <span>Selected Tests</span>
          <span>{billTestsSnapshot.length}</span>
        </div>
        <div style={billTestsList}>
          {billTestsSnapshot.length === 0 ? (
            <span style={billEmpty}>No tests selected</span>
          ) : (
            billTestsSnapshot.map((test) => (
              <div key={test.id} style={billTestRow}>
                <span>{test.name}</span>
                <span>Rs {test.price}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={footer}>
        <div style={billingBox}>
          <div>
            <div style={footerLabel}>Subtotal</div>
            <div style={amountText}>Rs {billSubtotal}</div>
          </div>
          <div>
            <div style={footerLabel}>Discount</div>
            <Input
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              type="number"
              placeholder="0"
              disabled={saving || selected.length === 0 || Boolean(lastOrder)}
              style={{ width: "100%" }}
            />
            {lastOrder && billDiscount > 0 && <div style={discountNote}>Rs {billDiscount}</div>}
          </div>
          <div>
            <div style={footerLabel}>Net Total</div>
            <div style={totalText}>Rs {billTotal}</div>
          </div>
        </div>
        {lastOrder ? (
          <div style={billActions}>
            <Button onClick={() => onOpenReceipt?.(lastOrder.id)} variant="success">
              Print Receipt
            </Button>
            <Button onClick={startNewBill} variant="secondary">
              New Bill
            </Button>
          </div>
        ) : (
          <Button onClick={saveOrder} disabled={saving || selected.length === 0}>
            {saving ? "Saving..." : "Create Bill"}
          </Button>
        )}
      </div>

      {lastOrder && (
        <div style={paymentPanel}>
          <div style={paymentHead}>
            <div>
              <div style={paymentTitle}>Payment</div>
              <div style={paymentMeta}>
                Order #{lastOrder.id} - Pending Rs {Math.max(lastOrder.total - lastOrder.paid, 0)}
              </div>
            </div>
            <Badge tone={lastOrder.paid >= lastOrder.total ? "success" : "warning"}>
              Rs {lastOrder.paid} paid
            </Badge>
          </div>
          <div style={paymentControls}>
            <Input
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              type="number"
              placeholder="Partial amount"
              disabled={paymentSaving || lastOrder.paid >= lastOrder.total}
            />
            <Button
              onClick={() => setPaymentAmount(String(Math.max(lastOrder.total - lastOrder.paid, 0)))}
              variant="secondary"
              disabled={paymentSaving || lastOrder.paid >= lastOrder.total}
            >
              Full
            </Button>
            <Button
              onClick={recordPayment}
              variant="success"
              disabled={paymentSaving || lastOrder.paid >= lastOrder.total}
            >
              {lastOrder.paid >= lastOrder.total ? "Paid" : paymentSaving ? "Saving..." : "Record"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const floatingUi = (
    <>
      {activeChecklistTest && (
        <div style={checklistOverlay} onClick={() => setActiveChecklistId(null)}>
          <div style={checklistPanel} onClick={(event) => event.stopPropagation()}>
            <div style={checklistHeader}>
              <div>
                <div style={checklistTitle}>{activeChecklistTest.name}</div>
                <div style={checklistMeta}>Select only the sub tests needed for this patient</div>
              </div>
              <button onClick={() => setActiveChecklistId(null)} style={closeBtn}>
                Close
              </button>
            </div>

            <div style={checklistBody}>
              {activeChecklistTest.parameters.map((param) => (
                <label key={param.id} style={parameterItem}>
                  <input
                    type="checkbox"
                    checked={activeChecklistTest.selectedParameterIds.includes(param.id)}
                    onChange={() => toggleParameter(activeChecklistTest.id, param.id)}
                  />
                  <span>
                    <span style={parameterName}>{param.name}</span>
                    <span style={parameterMeta}>
                      {param.unit || "No unit"} - {param.normal_range || "No range"}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div style={checklistFooter}>
              <Button
                onClick={() =>
                  setSelected((prev) =>
                    prev.map((test) =>
                      test.id === activeChecklistTest.id
                        ? { ...test, selectedParameterIds: test.parameters.map((param) => param.id) }
                        : test,
                    ),
                  )
                }
                variant="secondary"
              >
                Select All
              </Button>
              <Button onClick={() => setActiveChecklistId(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );

  if (layout === "visitGrid") {
    return (
      <>
        <Card title="Test Order" eyebrow="Step 2" right={<Badge tone="success">Active</Badge>} style={{ gridArea: "tests" }}>
          {selectionContent}
        </Card>
        <Card title="Billing" eyebrow="Create Order" compact style={{ gridArea: "billing" }}>
          {billingContent}
        </Card>
        {floatingUi}
      </>
    );
  }

  return (
    <div style={container}>
      <div style={orderGrid}>
        {selectionContent}
        {billingContent}
      </div>
      {floatingUi}
    </div>
  );
}

const container = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 9,
};

const searchWrap = {
  position: "relative" as const,
};

const orderGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(420px, 1fr) minmax(320px, 0.56fr)",
  gap: 14,
  alignItems: "start",
};

const selectionPane = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 9,
};

const billingPane = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  padding: 9,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  background: colors.surfaceSoft,
};

const billTests = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  background: colors.surface,
  overflow: "hidden",
};

const billTestsHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "7px 9px",
  color: colors.muted,
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase" as const,
  borderBottom: `1px solid ${colors.border}`,
};

const billTestsList = {
  display: "flex",
  flexDirection: "column" as const,
  maxHeight: 92,
  overflowY: "auto" as const,
};

const billTestRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "7px 9px",
  color: colors.text,
  fontSize: 12,
  fontWeight: 800,
  borderBottom: `1px solid ${colors.border}`,
};

const billEmpty = {
  padding: "8px 9px",
  color: colors.muted,
  fontSize: 12,
};

const billActions = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const discountNote = {
  color: colors.muted,
  fontSize: 11,
  marginTop: 3,
};

const catalog = {
  position: "absolute" as const,
  left: 0,
  right: 0,
  top: "calc(100% + 6px)",
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  boxShadow: "0 18px 40px rgba(20,33,61,0.14)",
  overflow: "hidden",
  zIndex: 20,
};

const catalogItem = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  border: 0,
  borderBottom: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  cursor: "pointer",
  textAlign: "left" as const,
  fontSize: 13,
};

const catalogMeta = {
  display: "block",
  color: colors.muted,
  fontSize: 12,
  marginTop: 3,
};

const selectedHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
};

const selectedBox = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  background: colors.surfaceSoft,
  minHeight: 74,
  maxHeight: 150,
  overflowY: "auto" as const,
};

const selectedRow = {
  width: "100%",
  padding: "9px 10px",
  borderBottom: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  cursor: "pointer",
  textAlign: "left" as const,
};

const testHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap" as const,
  gap: 12,
};

const rowActions = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: 7,
};

const removeBtn = {
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 7,
  background: colors.surface,
  color: colors.danger,
  cursor: "pointer",
  padding: "5px 7px",
  fontSize: 12,
  fontWeight: 800,
};

const editPill = {
  border: `1px solid ${colors.primary}`,
  borderRadius: 999,
  color: colors.primary,
  background: colors.primarySoft,
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 900,
};

const checklistOverlay = {
  position: "fixed" as const,
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "rgba(16,34,53,0.22)",
  zIndex: 80,
  padding: 18,
};

const checklistPanel = {
  width: "min(460px, 100%)",
  maxHeight: "78vh",
  display: "flex",
  flexDirection: "column" as const,
  borderRadius: 8,
  background: colors.surface,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: "0 24px 70px rgba(20,33,61,0.22)",
  overflow: "hidden",
};

const checklistHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: 14,
  borderBottom: `1px solid ${colors.border}`,
};

const checklistTitle = {
  color: colors.text,
  fontSize: 16,
  fontWeight: 900,
};

const checklistMeta = {
  color: colors.muted,
  fontSize: 12,
  marginTop: 4,
};

const closeBtn = {
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 7,
  background: colors.surface,
  color: colors.text,
  cursor: "pointer",
  padding: "6px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const checklistBody = {
  display: "grid",
  gap: 8,
  padding: 12,
  overflowY: "auto" as const,
};

const checklistFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: 12,
  borderTop: `1px solid ${colors.border}`,
};

const parameterItem = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  minHeight: 48,
  padding: 9,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  background: colors.surfaceSoft,
  cursor: "pointer",
};

const parameterName = {
  display: "block",
  color: colors.text,
  fontSize: 13,
  fontWeight: 800,
};

const parameterMeta = {
  display: "block",
  color: colors.muted,
  fontSize: 11,
  marginTop: 2,
};

const empty = {
  padding: 12,
  color: colors.muted,
  fontSize: 13,
};

const footer = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "stretch",
  gap: 8,
  paddingTop: 0,
};

const billingBox = {
  display: "grid",
  gridTemplateColumns: "1fr 92px 1fr",
  alignItems: "flex-end",
  gap: 8,
};

const footerLabel = {
  color: colors.muted,
  fontSize: 12,
  fontWeight: 800,
};

const totalText = {
  color: colors.text,
  fontSize: 16,
  fontWeight: 900,
};

const amountText = {
  color: colors.text,
  fontSize: 15,
  fontWeight: 850,
};

const paymentPanel = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 6,
  padding: 8,
  borderRadius: 8,
  border: `1px solid ${colors.successSoft}`,
  background: "#f0fdf4",
};

const paymentHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
};

const paymentTitle = {
  color: colors.text,
  fontSize: 13,
  fontWeight: 900,
};

const paymentMeta = {
  color: colors.muted,
  fontSize: 12,
  marginTop: 3,
};

const paymentControls = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  gap: 6,
};
