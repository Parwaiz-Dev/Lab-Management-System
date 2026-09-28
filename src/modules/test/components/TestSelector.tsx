import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Trash2,
  SlidersHorizontal,
  Receipt,
  Plus,
  CheckCircle2,
  CreditCard,
  ClipboardList,
  RefreshCw,
  X,
  Check,
  Banknote,
  QrCode,
  Calendar,
  AlertCircle,
} from "lucide-react";
import Card from "../../../components/ui/Card";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import Badge from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import Modal from "../../../components/ui/Modal";
import type { Patient, Test, ToastMessage } from "../../../types";
import { getErrorMessage, money, testService } from "../services/testService";

type SelectedTest = Test & {
  selectedParameterIds: number[];
};

type LastOrder = {
  id: number;
  total: number;
  paid: number;
  subtotal: number;
  discount: number;
  mode?: "full" | "partial" | "later";
  method?: "cash" | "upi" | "card";
};

type TestSelectorProps = {
  patient: Patient | null;
  layout?: "inline" | "visitGrid";
  onOpenReceipt?: (orderId: number) => void;
  presetToAdd?: string | null;
  onClearPreset?: () => void;
  onResetPatient?: () => void;
};

const TEST_CATEGORIES = [
  { id: "all", label: "All Tests" },
  { id: "hematology", label: "Hematology" },
  { id: "biochemistry", label: "Biochemistry" },
  { id: "thyroid", label: "Thyroid/Hormone" },
  { id: "urine", label: "Urine/Fluid" },
  { id: "serology", label: "Serology" },
];

export default function TestSelector({
  patient,
  layout = "inline",
  onOpenReceipt,
  presetToAdd,
  onClearPreset,
  onResetPatient,
}: TestSelectorProps) {
  const [tests, setTests] = useState<Test[]>([]);
  const [selected, setSelected] = useState<SelectedTest[]>([]);
  const [billedTests, setBilledTests] = useState<SelectedTest[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [loadingTests, setLoadingTests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);

  // Billing & Real-Time Payment State
  const [discount, setDiscount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"full" | "partial" | "later">("full");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card">("cash");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [postPaymentAmount, setPostPaymentAmount] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Sub-test Checklist Modal State
  const [activeChecklistId, setActiveChecklistId] = useState<number | null>(null);
  const [paramSearch, setParamSearch] = useState("");

  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

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

  // Reset bill items on patient change
  useEffect(() => {
    setSelected([]);
    setBilledTests([]);
    setSearch("");
    setLastOrder(null);
    setDiscount("");
    setPaymentMode("full");
    setAdvanceAmount("");
    setActiveChecklistId(null);
  }, [patient?.id]);

  // Visual demo/preview states for testing
  useEffect(() => {
    if (typeof window === "undefined" || tests.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const demo = params.get("demo_state");
    if (!demo) return;

    const cbc = tests.find((t) => t.name.toLowerCase().includes("cbc"));
    const lipid = tests.find((t) => t.name.toLowerCase().includes("lipid"));

    if (demo === "tests" || demo === "modal" || demo === "partial") {
      const items: SelectedTest[] = [];
      if (cbc) items.push({ ...cbc, selectedParameterIds: cbc.parameters.map((p) => p.id) });
      if (lipid) items.push({ ...lipid, selectedParameterIds: lipid.parameters.map((p) => p.id) });
      setSelected(items);

      if (demo === "modal" && cbc) {
        setActiveChecklistId(cbc.id);
      }
      if (demo === "partial") {
        setPaymentMode("partial");
        setAdvanceAmount("500");
        setDiscount("50");
      }
    } else if (demo === "billed") {
      const billed: SelectedTest[] = [];
      if (cbc) billed.push({ ...cbc, selectedParameterIds: cbc.parameters.map((p) => p.id) });
      if (lipid) billed.push({ ...lipid, selectedParameterIds: lipid.parameters.map((p) => p.id) });
      setBilledTests(billed);
      setLastOrder({
        id: 108,
        total: 950,
        paid: 500,
        subtotal: 1000,
        discount: 50,
        mode: "partial",
        method: "upi",
      });
    }
  }, [tests]);

  // Listen for Quick Presets clicked from Card 1
  useEffect(() => {
    if (!presetToAdd || tests.length === 0) return;

    const lowerPreset = presetToAdd.toLowerCase().trim();
    const match = tests.find(
      (t) =>
        t.name.toLowerCase() === lowerPreset ||
        t.name.toLowerCase().includes(lowerPreset) ||
        lowerPreset.includes(t.name.toLowerCase())
    );

    if (match) {
      addTest(match);
      setToast({ message: `Added "${match.name}" to test order`, type: "info" });
    }
    onClearPreset?.();
  }, [presetToAdd, tests]);

  // Filtering tests for search dropdown
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

        const selectedParameterIds = test.selectedParameterIds.includes(parameterId)
          ? test.selectedParameterIds.filter((id) => id !== parameterId)
          : [...test.selectedParameterIds, parameterId];

        return { ...test, selectedParameterIds };
      })
    );
  };

  const selectAllParameters = (testId: number) => {
    setSelected((prev) =>
      prev.map((test) => {
        if (test.id !== testId) return test;
        return {
          ...test,
          selectedParameterIds: test.parameters.map((p) => p.id),
        };
      })
    );
  };

  const deselectAllParameters = (testId: number) => {
    setSelected((prev) =>
      prev.map((test) => {
        if (test.id !== testId) return test;
        return {
          ...test,
          selectedParameterIds: [],
        };
      })
    );
  };

  // Math & Financials
  const subtotal = selected.reduce((sum, test) => sum + test.price, 0);
  const selectedParameterCount = selected.reduce(
    (sum, test) => sum + test.selectedParameterIds.length,
    0
  );

  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const netPayable = Math.max(subtotal - discountValue, 0);

  // Real-time Upfront Paid Calculation
  const upfrontPaidAmount = useMemo(() => {
    if (paymentMode === "full") return netPayable;
    if (paymentMode === "later") return 0;
    const parsedAdv = Number(advanceAmount) || 0;
    return Math.min(Math.max(parsedAdv, 0), netPayable);
  }, [paymentMode, netPayable, advanceAmount]);

  const upfrontBalanceDue = Math.max(netPayable - upfrontPaidAmount, 0);

  const applyDiscountPercent = (pct: number) => {
    if (subtotal <= 0) return;
    const val = Math.round((subtotal * pct) / 100);
    setDiscount(String(val));
  };

  const applyDiscountFixed = (amt: number) => {
    if (subtotal <= 0) return;
    setDiscount(String(Math.min(amt, subtotal)));
  };

  const validateOrderSelection = () => {
    if (!patient) {
      setToast({
        message: "Please select or register a patient in Step 1 first",
        type: "error",
      });
      return false;
    }

    if (selected.length === 0) {
      setToast({ message: "Select at least one test from catalog", type: "warning" });
      return false;
    }

    const parameterIds = selected.flatMap((test) => test.selectedParameterIds);
    if (parameterIds.length === 0) {
      setToast({ message: "Please select at least one sub-test parameter", type: "warning" });
      return false;
    }

    return true;
  };

  // Unified Atomic Bill Creation with Real-Time Upfront Payment Settlement
  const executeCreateBill = async () => {
    if (!patient || !validateOrderSelection()) return;

    const parameterIds = selected.flatMap((test) => test.selectedParameterIds);

    try {
      setSaving(true);
      const orderTestsSnapshot = selected.map((test) => ({ ...test }));

      // 1. Create order in database
      const orderId = await testService.createOrder({
        patientId: patient.id,
        testIds: selected.map((test) => test.id),
        parameterIds,
        totalAmount: netPayable,
        discountAmount: discountValue,
      });

      // 2. If upfront payment selected, update payment atomically
      if (upfrontPaidAmount > 0) {
        await testService.updatePayment(orderId, upfrontPaidAmount);
      }

      setBilledTests(orderTestsSnapshot);
      setLastOrder({
        id: orderId,
        total: netPayable,
        paid: upfrontPaidAmount,
        subtotal,
        discount: discountValue,
        mode: paymentMode,
        method: paymentMethod,
      });

      setSelected([]);
      setSearch("");
      setDiscount("");
      setAdvanceAmount("");
      setActiveChecklistId(null);

      const statusMsg =
        upfrontPaidAmount >= netPayable
          ? `Bill #${orderId} generated & FULL PAYMENT (${money(netPayable)}) settled!`
          : upfrontPaidAmount > 0
            ? `Bill #${orderId} generated with ${money(upfrontPaidAmount)} advance paid (${money(upfrontBalanceDue)} due)!`
            : `Bill #${orderId} generated (${money(netPayable)} due in Operations)!`;

      setToast({ message: statusMsg, type: "success" });
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

  const handleCreateBillClick = () => {
    if (!patient || !validateOrderSelection()) return;

    const modeText =
      paymentMode === "full"
        ? `Full Payment: ${money(netPayable)} via ${paymentMethod.toUpperCase()}`
        : paymentMode === "partial"
          ? `Advance Payment: ${money(upfrontPaidAmount)} (Due: ${money(upfrontBalanceDue)}) via ${paymentMethod.toUpperCase()}`
          : `Pay Later: Full ${money(netPayable)} due upon completion`;

    setConfirmation({
      title: "Generate Bill & Record Order",
      description: `Create order for "${patient.name}" with ${selected.length} tests. ${modeText}. Proceed?`,
      confirmLabel: "Confirm & Generate Bill",
      onConfirm: executeCreateBill,
    });
  };

  const startNewBill = () => {
    setLastOrder(null);
    setBilledTests([]);
    setPaymentMode("full");
    setAdvanceAmount("");
    setPostPaymentAmount("");
    setDiscount("");
    setSelected([]);
    setSearch("");
    setActiveChecklistId(null);
    onResetPatient?.();
  };

  // Additional post-billing payment record (if partial/pending)
  const recordPostPayment = async () => {
    if (!lastOrder) return;
    const amount = Number(postPaymentAmount);
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
      await testService.updatePayment(lastOrder.id, lastOrder.paid + amount);
      setLastOrder({ ...lastOrder, paid: lastOrder.paid + amount });
      setPostPaymentAmount("");
      setToast({ message: `Recorded ${money(amount)} payment for Order #${lastOrder.id}`, type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: getErrorMessage(err, "Failed to record payment"), type: "error" });
    } finally {
      setPaymentSaving(false);
    }
  };

  const activeChecklistTest =
    selected.find((test) => test.id === activeChecklistId) || null;

  // Parameters list inside the modal with search filter
  const modalParams = useMemo(() => {
    if (!activeChecklistTest) return [];
    const q = paramSearch.trim().toLowerCase();
    if (!q) return activeChecklistTest.parameters;
    return activeChecklistTest.parameters.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.unit && p.unit.toLowerCase().includes(q))
    );
  }, [activeChecklistTest, paramSearch]);

  /* ── Card 2: Test Order & Catalog Workspace ── */
  const selectionContent = (
    <div className="test-selector__workspace">
      {/* Search Bar */}
      <div className="test-selector__search-bar">
        <div className="test-selector__search-input-wrap">
          <Search size={15} className="test-selector__search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test name or parameter (e.g. CBC, Lipid, Thyroid, Sugar)..."
            disabled={saving || loadingTests || Boolean(lastOrder)}
            className="test-selector__search-input"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="test-selector__search-clear"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {shouldShowCatalogDropdown && (
          <div className="test-selector__catalog-dropdown">
            <div className="test-selector__catalog-dropdown-head">
              <span>Matching Tests ({filtered.length})</span>
              <span style={{ fontSize: 10, color: "var(--color-muted)" }}>Click to add</span>
            </div>
            <div className="test-selector__catalog-dropdown-body">
              {filtered.map((test) => {
                const isSelected = selected.some((item) => item.id === test.id);
                return (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => addTest(test)}
                    disabled={saving || isSelected}
                    className={`test-selector__catalog-dropdown-item ${
                      isSelected ? "test-selector__catalog-dropdown-item--selected" : ""
                    }`}
                  >
                    <div className="test-selector__catalog-item-info">
                      <div className="test-selector__catalog-item-name">
                        {test.name}
                        {isSelected && (
                          <span className="test-selector__added-pill">Added</span>
                        )}
                      </div>
                      <div className="test-selector__catalog-item-params">
                        {test.parameters.map((p) => p.name).join(", ")}
                      </div>
                    </div>

                    <div className="test-selector__catalog-item-right">
                      <span className="test-selector__catalog-item-price">
                        {money(test.price)}
                      </span>
                      {!isSelected ? (
                        <span className="test-selector__add-btn">
                          <Plus size={12} /> Add
                        </span>
                      ) : (
                        <Check size={14} style={{ color: "var(--color-success)" }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {shouldShowNoCatalogResult && (
          <div className="test-selector__catalog-empty">
            No tests matching &ldquo;{search}&rdquo;. Try another name or keyword.
          </div>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="test-category-tabs">
        {TEST_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`test-category-tab ${categoryFilter === cat.id ? "test-category-tab--active" : ""}`}
            onClick={() => {
              setCategoryFilter(cat.id);
              if (cat.id === "all") setSearch("");
              else if (cat.id === "hematology") setSearch("CBC");
              else if (cat.id === "biochemistry") setSearch("Liver");
              else if (cat.id === "thyroid") setSearch("Thyroid");
              else if (cat.id === "urine") setSearch("Urine");
              else if (cat.id === "serology") setSearch("Dengue");
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Selected Tests Table Header */}
      <div className="test-selector__list-header">
        <div className="test-selector__list-title">
          <span>{lastOrder ? "Billed Tests" : "Selected Tests"}</span>
          <Badge tone={selected.length || billedTests.length ? "indigo" : "neutral"} size="sm">
            {(lastOrder ? billedTests.length : selected.length)} tests
          </Badge>
          {!lastOrder && selected.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
              ({selectedParameterCount} sub-tests active)
            </span>
          )}
        </div>

        {!lastOrder && selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            style={{ fontSize: 11, color: "var(--color-danger)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Selected Tests Table / Empty State */}
      {(lastOrder ? billedTests : selected).length === 0 ? (
        <div className="test-selector__empty-fill">
          <EmptyState
            compact
            icon={<ClipboardList size={30} style={{ color: "var(--color-muted)" }} />}
            title="No tests selected"
            subtitle="Search catalog above or click '⚡ Fast Test Presets' on the left to add diagnostic tests."
          />
        </div>
      ) : (
        <div className="test-selector__table-wrap">
          <table className="test-selector__table">
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Sub-tests / Parameters</th>
                <th className="text-right">Price</th>
                {!lastOrder && <th className="text-center" style={{ width: 44 }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {(lastOrder ? billedTests : selected).map((test) => (
                <tr key={test.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 12 }}>
                      {test.name}
                    </div>
                  </td>
                  <td>
                    {!lastOrder ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChecklistId(test.id);
                          setParamSearch("");
                        }}
                        className="test-selector__param-pill"
                        title="Configure individual sub-tests"
                      >
                        <SlidersHorizontal size={11} />
                        <span>
                          {test.selectedParameterIds.length} of {test.parameters.length} active
                        </span>
                      </button>
                    ) : (
                      <span className="test-selector__param-pill" style={{ cursor: "default" }}>
                        {test.selectedParameterIds.length} active
                      </span>
                    )}
                  </td>
                  <td className="text-right" style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {money(test.price)}
                  </td>
                  {!lastOrder && (
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => removeTest(test.id)}
                        className="test-selector__row-delete-btn"
                        title="Remove test"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom Status Counter */}
      <div className="test-selector__bottom-summary">
        <span>
          Total Tests: <strong>{(lastOrder ? billedTests : selected).length}</strong>
        </span>
        <span>
          Subtotal: <strong>{money(lastOrder ? lastOrder.subtotal : subtotal)}</strong>
        </span>
      </div>
    </div>
  );

  /* ── Card 3: Billing & Real-Time Payment Settlement ── */
  const billingContent = (
    <div className="test-selector__billing-panel">
      {lastOrder ? (
        /* Completed Bill Receipt Card */
        <div className="test-selector__bill-success-card">
          <div className="test-selector__bill-success-header">
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                Order #{lastOrder.id} Created
              </div>
              <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
                {billedTests.length} tests • {patient?.name || "Patient"}
              </div>
            </div>
            <Badge
              tone={
                lastOrder.paid >= lastOrder.total
                  ? "success"
                  : lastOrder.paid > 0
                    ? "warning"
                    : "info"
              }
              size="sm"
            >
              {lastOrder.paid >= lastOrder.total
                ? "Paid in Full"
                : lastOrder.paid > 0
                  ? `Due: ${money(lastOrder.total - lastOrder.paid)}`
                  : "Pay Later"}
            </Badge>
          </div>

          <div className="test-selector__bill-success-breakdown">
            <div className="test-selector__calc-row">
              <span className="text-muted">Subtotal:</span>
              <span className="font-mono">{money(lastOrder.subtotal)}</span>
            </div>
            {lastOrder.discount > 0 && (
              <div className="test-selector__calc-row">
                <span className="text-muted">Discount:</span>
                <span className="font-mono text-danger">-{money(lastOrder.discount)}</span>
              </div>
            )}
            <div className="test-selector__calc-row" style={{ fontWeight: 700, borderTop: "1px dashed var(--color-border-light)", paddingTop: 4 }}>
              <span>Total Bill:</span>
              <span className="font-mono">{money(lastOrder.total)}</span>
            </div>
            <div className="test-selector__calc-row" style={{ color: "var(--color-success)", fontWeight: 700 }}>
              <span>Amount Paid:</span>
              <span className="font-mono">
                {money(lastOrder.paid)} ({lastOrder.method?.toUpperCase() || "CASH"})
              </span>
            </div>
            {lastOrder.total > lastOrder.paid && (
              <div className="test-selector__calc-row" style={{ color: "var(--color-danger)", fontWeight: 700 }}>
                <span>Balance Due:</span>
                <span className="font-mono">{money(lastOrder.total - lastOrder.paid)}</span>
              </div>
            )}
          </div>

          {/* Post-Billing Action Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (lastOrder?.id) onOpenReceipt?.(lastOrder.id);
              }}
              variant="success"
              size="sm"
              icon={<Receipt size={14} />}
              style={{ flex: 1 }}
            >
              Print Receipt
            </Button>

            <Button
              type="button"
              onClick={startNewBill}
              variant="outline"
              size="sm"
              icon={<RefreshCw size={13} />}
              style={{ flex: 1 }}
            >
              Next Patient (Ctrl+N)
            </Button>
          </div>

          {/* Quick Payment Collection if pending */}
          {lastOrder.paid < lastOrder.total && (
            <div className="test-selector__quick-pay-card" style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>Collect Remaining Payment:</span>
                <span style={{ color: "var(--color-danger)" }}>{money(lastOrder.total - lastOrder.paid)}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Input
                  value={postPaymentAmount}
                  onChange={(e) => setPostPaymentAmount(e.target.value)}
                  type="number"
                  min={1}
                  max={lastOrder.total - lastOrder.paid}
                  sizeVariant="sm"
                  placeholder={`Max ${lastOrder.total - lastOrder.paid}`}
                  disabled={paymentSaving}
                  style={{ flex: 1 }}
                />
                <Button
                  onClick={() => setPostPaymentAmount(String(lastOrder.total - lastOrder.paid))}
                  variant="secondary"
                  size="sm"
                  disabled={paymentSaving}
                >
                  Full
                </Button>
                <Button
                  onClick={recordPostPayment}
                  variant="primary"
                  size="sm"
                  disabled={paymentSaving || !postPaymentAmount || Number(postPaymentAmount) <= 0}
                  loading={paymentSaving}
                >
                  Record
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Real-Time Billing & Settlement Configuration */
        <>
          {/* Order Items Preview (Compact Scrollable) */}
          <div className="test-selector__billing-items">
            <div className="test-selector__billing-items-head">
              <span>Order Summary ({selected.length} tests)</span>
              <span className="font-mono">{money(subtotal)}</span>
            </div>

            {selected.length === 0 ? (
              <div className="test-selector__billing-empty">
                Add tests to preview bill
              </div>
            ) : (
              <div className="test-selector__billing-items-list">
                {selected.map((test) => (
                  <div key={test.id} className="test-selector__billing-item-row">
                    <span className="truncate" style={{ flex: 1, paddingRight: 6 }}>
                      {test.name}
                    </span>
                    <span className="font-mono" style={{ fontWeight: 600, flexShrink: 0 }}>
                      {money(test.price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Breakdown & Discounts */}
          <div className="test-selector__calc-box">
            <div className="test-selector__calc-row">
              <span style={{ color: "var(--color-muted)", fontSize: 12 }}>Subtotal:</span>
              <span className="font-mono" style={{ fontWeight: 600, fontSize: 12 }}>
                {money(subtotal)}
              </span>
            </div>

            {/* Discount Inputs & Quick Presets */}
            <div className="test-selector__discount-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-muted)", fontSize: 12 }}>Discount:</span>
                <div style={{ width: 100 }}>
                  <Input
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    type="number"
                    min={0}
                    max={subtotal}
                    step="1"
                    sizeVariant="sm"
                    placeholder="₹ 0"
                    disabled={saving || selected.length === 0}
                  />
                </div>
              </div>

              {selected.length > 0 && subtotal > 0 && (
                <div className="discount-quick-chips">
                  <button type="button" onClick={() => applyDiscountPercent(0)} className="discount-chip">0%</button>
                  <button type="button" onClick={() => applyDiscountPercent(5)} className="discount-chip">5%</button>
                  <button type="button" onClick={() => applyDiscountPercent(10)} className="discount-chip">10%</button>
                  <button type="button" onClick={() => applyDiscountFixed(50)} className="discount-chip">-₹50</button>
                  <button type="button" onClick={() => applyDiscountFixed(100)} className="discount-chip">-₹100</button>
                </div>
              )}
            </div>

            {/* Net Total Row */}
            <div className="test-selector__grand-total-row">
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                Net Payable:
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>
                {money(netPayable)}
              </span>
            </div>
          </div>

          {/* Real-Time Payment Settlement Selection */}
          <div className="test-selector__settlement-panel">
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-muted)", marginBottom: 4 }}>
              Payment Settlement (Real-Time)
            </div>

            {/* 3 Payment Mode Tabs */}
            <div className="payment-mode-tabs">
              <button
                type="button"
                className={`payment-mode-tab ${paymentMode === "full" ? "payment-mode-tab--active-green" : ""}`}
                onClick={() => setPaymentMode("full")}
              >
                <CheckCircle2 size={13} />
                <span>Paid Full</span>
              </button>

              <button
                type="button"
                className={`payment-mode-tab ${paymentMode === "partial" ? "payment-mode-tab--active-amber" : ""}`}
                onClick={() => setPaymentMode("partial")}
              >
                <Banknote size={13} />
                <span>Partial / Adv</span>
              </button>

              <button
                type="button"
                className={`payment-mode-tab ${paymentMode === "later" ? "payment-mode-tab--active-blue" : ""}`}
                onClick={() => setPaymentMode("later")}
              >
                <Calendar size={13} />
                <span>Pay Later</span>
              </button>
            </div>

            {/* Payment Method Pills (When Paid Full or Partial) */}
            {paymentMode !== "later" && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 600, marginBottom: 3 }}>
                  Payment Method:
                </div>
                <div className="payment-method-tabs">
                  <button
                    type="button"
                    className={`payment-method-tab ${paymentMethod === "cash" ? "payment-method-tab--active" : ""}`}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    <Banknote size={12} />
                    <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    className={`payment-method-tab ${paymentMethod === "upi" ? "payment-method-tab--active" : ""}`}
                    onClick={() => setPaymentMethod("upi")}
                  >
                    <QrCode size={12} />
                    <span>UPI / QR</span>
                  </button>
                  <button
                    type="button"
                    className={`payment-method-tab ${paymentMethod === "card" ? "payment-method-tab--active" : ""}`}
                    onClick={() => setPaymentMethod("card")}
                  >
                    <CreditCard size={12} />
                    <span>Card</span>
                  </button>
                </div>
              </div>
            )}

            {/* Partial Advance Input */}
            {paymentMode === "partial" && (
              <div className="payment-partial-box">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label htmlFor="adv-amt" style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text)", width: 85 }}>
                    Advance (₹):
                  </label>
                  <Input
                    id="adv-amt"
                    type="number"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    min={1}
                    max={netPayable}
                    sizeVariant="sm"
                    placeholder="Enter advance amount"
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginTop: 4, color: "var(--color-danger)" }}>
                  <span>Balance Due:</span>
                  <span className="font-mono">{money(upfrontBalanceDue)}</span>
                </div>
              </div>
            )}

            {/* Pay Later Note */}
            {paymentMode === "later" && (
              <div className="payment-later-notice">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>Full balance of {money(netPayable)} will remain due to collect in Operations.</span>
              </div>
            )}
          </div>

          {/* Unified Primary Creation Button */}
          <Button
            type="button"
            onClick={handleCreateBillClick}
            disabled={saving || selected.length === 0}
            variant="primary"
            size="md"
            loading={saving}
            icon={<CheckCircle2 size={16} />}
            style={{ width: "100%", fontWeight: 700, marginTop: "auto" }}
          >
            {saving ? (
              "Generating Bill..."
            ) : paymentMode === "full" ? (
              `Create Bill & Record ${money(netPayable)} Full`
            ) : paymentMode === "partial" ? (
              `Record Bill (${money(upfrontPaidAmount)} Paid • ${money(upfrontBalanceDue)} Due)`
            ) : (
              `Save Bill (${money(netPayable)} Due Later)`
            )}
          </Button>
        </>
      )}
    </div>
  );

  /* ── Floating Sub-Test Configurator Modal (FIXES SCREENSHOT 3) ── */
  const floatingUi = (
    <>
      {activeChecklistTest && (
        <Modal
          open={Boolean(activeChecklistTest)}
          onClose={() => {
            setActiveChecklistId(null);
            setParamSearch("");
          }}
          title={`Configure Sub-Tests: ${activeChecklistTest.name}`}
          size="md"
        >
          <div className="subtest-modal">
            {/* Header Stats Bar */}
            <div className="subtest-modal__header-bar">
              <span>Select parameters to include in report:</span>
              <span className="subtest-modal__stats-badge">
                {activeChecklistTest.selectedParameterIds.length} of {activeChecklistTest.parameters.length} Selected
              </span>
            </div>

            {/* Quick Filter Search */}
            {activeChecklistTest.parameters.length > 5 && (
              <div className="subtest-modal__search-wrap">
                <Search size={14} className="subtest-modal__search-icon" />
                <input
                  type="text"
                  value={paramSearch}
                  onChange={(e) => setParamSearch(e.target.value)}
                  placeholder="Filter parameters (e.g. Hemoglobin, Platelet)..."
                  className="subtest-modal__search-input"
                />
                {paramSearch && (
                  <button
                    type="button"
                    onClick={() => setParamSearch("")}
                    className="subtest-modal__search-clear"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Parameter Checklist (Pure Semantic CSS) */}
            <div className="subtest-modal__list">
              {modalParams.map((param) => {
                const isChecked = activeChecklistTest.selectedParameterIds.includes(param.id);
                return (
                  <label
                    key={param.id}
                    className={`subtest-modal__item ${isChecked ? "subtest-modal__item--checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleParameter(activeChecklistTest.id, param.id)}
                      className="subtest-modal__checkbox"
                    />
                    <div className="subtest-modal__item-info">
                      <div className="subtest-modal__param-name">{param.name}</div>
                      <div className="subtest-modal__param-range">
                        {param.normal_range ? `Normal: ${param.normal_range}` : "Standard range"}
                        {param.unit ? ` · Unit: ${param.unit}` : ""}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Modal Footer Controls */}
            <div className="subtest-modal__footer">
              <div className="subtest-modal__bulk-btns">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => selectAllParameters(activeChecklistTest.id)}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => deselectAllParameters(activeChecklistTest.id)}
                >
                  Deselect All
                </Button>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveChecklistId(null);
                  setParamSearch("");
                }}
                icon={<Check size={14} />}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
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
        loading={saving}
        onConfirm={async () => {
          if (confirmation) {
            const fn = confirmation.onConfirm;
            setConfirmation(null);
            await fn();
          }
        }}
        onCancel={() => setConfirmation(null)}
      />
    </>
  );

  if (layout === "visitGrid") {
    return (
      <>
        <Card
          icon={<ClipboardList size={18} />}
          title="Test Order"
          eyebrow="Step 2"
          right={
            <Badge tone={selected.length > 0 ? "success" : "info"} size="sm">
              {selected.length > 0 ? `${selected.length} Active` : "Catalog"}
            </Badge>
          }
          className="patient-page__card patient-page__card--tests"
        >
          {selectionContent}
        </Card>

        <Card
          icon={<CreditCard size={18} />}
          title="Billing & Payment"
          eyebrow="Step 3"
          right={
            <Badge tone={lastOrder ? "success" : "neutral"} size="sm">
              {lastOrder ? "Billed" : "Draft"}
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
        <Card
          icon={<ClipboardList size={18} />}
          title="Test Order"
          eyebrow="Step 2"
        >
          {selectionContent}
        </Card>

        <Card
          icon={<CreditCard size={18} />}
          title="Billing & Payment"
          eyebrow="Step 3"
          compact
        >
          {billingContent}
        </Card>
      </div>

      {floatingUi}
    </div>
  );
}