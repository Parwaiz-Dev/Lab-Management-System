import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Plus,
  RotateCcw,
  Trash2,
  TestTube2,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import SearchInput from "../../../components/ui/SearchInput";
import type { DashboardOrderRow, Test } from "../../../types";
import { getErrorMessage, money, testService } from "../services/testService";

interface AddTestModalProps {
  order: DashboardOrderRow;
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedTestEntry {
  test: Test;
  customPrice: string; // string for input editing
}

export default function AddTestModal({
  order,
  onClose,
  onSuccess,
}: AddTestModalProps) {
  const [catalogTests, setCatalogTests] = useState<Test[]>([]);
  const [existingTestIds, setExistingTestIds] = useState<Set<number>>(new Set());
  const [existingTestNames, setExistingTestNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTests, setSelectedTests] = useState<Map<number, SelectedTestEntry>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currentTotal = Number(order.totalAmount || 0);
  const currentPaid = Number(order.paidAmount || 0);
  const currentDue = Math.max(currentTotal - currentPaid, 0);

  // Load catalog and existing order tests
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [allTests, orderParams] = await Promise.all([
          testService.getTests(),
          testService.getParametersByOrder(order.id).catch(() => []),
        ]);

        if (cancelled) return;

        setCatalogTests(allTests.filter((t) => t.is_active !== false));

        // Gather existing test IDs from parameters
        const idSet = new Set<number>();
        orderParams.forEach((p) => {
          if (p.test_id) idSet.add(p.test_id);
        });

        // Also gather names from order.tests string
        const nameSet = new Set<string>();
        if (order.tests) {
          order.tests
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
            .forEach((n) => nameSet.add(n));
        }

        setExistingTestIds(idSet);
        setExistingTestNames(nameSet);
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Failed to load test catalog."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [order.id, order.tests]);

  const isAlreadyOnOrder = useCallback(
    (test: Test): boolean => {
      if (existingTestIds.has(test.id)) return true;
      if (existingTestNames.has(test.name.trim().toLowerCase())) return true;
      return false;
    },
    [existingTestIds, existingTestNames]
  );

  // Filter available catalog tests based on search query
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return catalogTests;
    return catalogTests.filter((t) => t.name.toLowerCase().includes(q));
  }, [catalogTests, searchQuery]);

  const handleToggleTest = (test: Test) => {
    if (isAlreadyOnOrder(test)) return;

    setSelectedTests((prev) => {
      const next = new Map(prev);
      if (next.has(test.id)) {
        next.delete(test.id);
      } else {
        next.set(test.id, {
          test,
          customPrice: String(test.price ?? 0),
        });
      }
      return next;
    });
    setError("");
  };

  const handlePriceChange = (testId: number, value: string) => {
    setSelectedTests((prev) => {
      const existing = prev.get(testId);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(testId, { ...existing, customPrice: value });
      return next;
    });
  };

  const handleResetPrice = (testId: number) => {
    setSelectedTests((prev) => {
      const existing = prev.get(testId);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(testId, {
        ...existing,
        customPrice: String(existing.test.price ?? 0),
      });
      return next;
    });
  };

  const handlePriceBlur = (testId: number) => {
    const entry = selectedTests.get(testId);
    if (!entry) return;
    if (entry.customPrice.trim() === "") {
      handleResetPrice(testId);
    }
  };

  const handleRemoveSelected = (testId: number) => {
    setSelectedTests((prev) => {
      const next = new Map(prev);
      next.delete(testId);
      return next;
    });
  };

  // Calculations for added tests
  const { addedTotal, hasInvalidPrice, customPricesMap } = useMemo(() => {
    let sum = 0;
    let invalid = false;
    const priceMap: Record<number, number> = {};

    selectedTests.forEach(({ test, customPrice }) => {
      const num = Number(customPrice);
      if (customPrice.trim() === "" || isNaN(num) || num < 0) {
        invalid = true;
      } else {
        sum += num;
        if (num !== test.price) {
          priceMap[test.id] = num;
        }
      }
    });

    return {
      addedTotal: sum,
      hasInvalidPrice: invalid,
      customPricesMap: priceMap,
    };
  }, [selectedTests]);

  const newTotal = currentTotal + addedTotal;
  const newDue = Math.max(newTotal - currentPaid, 0);

  const handleSubmit = async () => {
    if (selectedTests.size === 0) {
      setError("Please select at least one test to add.");
      return;
    }

    if (hasInvalidPrice) {
      setError("Please enter a valid, non-negative price for all selected tests.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const testIds = Array.from(selectedTests.keys());
      const customPrices = Object.keys(customPricesMap).length > 0 ? customPricesMap : undefined;

      await testService.addTestsToOrder(order.id, {
        test_ids: testIds,
        custom_prices: customPrices,
      });

      onSuccess();
    } catch (err) {
      console.error("Failed to add tests to order:", err);
      setError(getErrorMessage(err, "Failed to add tests to order."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Add Tests to Order #${order.id}`}
      subtitle={`Patient: ${order.patientName} | Current Total: ${money(currentTotal)}`}
      maxWidth="lg"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Error notification */}
        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-danger)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Existing order context card */}
        <div
          style={{
            background: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-muted)", fontWeight: 500 }}>
              Existing Tests on Order:
            </span>
            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
              {order.tests || "None"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", paddingTop: 4, borderTop: "1px dashed var(--color-border)" }}>
            <span>
              Total: <strong style={{ fontFamily: "var(--font-mono)" }}>{money(currentTotal)}</strong>
            </span>
            <span style={{ color: "var(--color-muted)" }}>•</span>
            <span>
              Paid: <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-success)" }}>{money(currentPaid)}</strong>
            </span>
            <span style={{ color: "var(--color-muted)" }}>•</span>
            <span>
              Current Due:{" "}
              <strong style={{ fontFamily: "var(--font-mono)", color: currentDue > 0 ? "var(--color-danger)" : "var(--color-text)" }}>
                {money(currentDue)}
              </strong>
            </span>
          </div>
        </div>

        {/* Two-panel layout: Left = Catalog selection, Right = Selected tests & Pricing */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            minHeight: 280,
          }}
        >
          {/* Left panel: Test Catalog */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: 10,
              background: "var(--color-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>
                Available Catalog Tests
              </span>
              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                {filteredCatalog.length} tests
              </span>
            </div>

            <SearchInput
              value={searchQuery}
              onChangeValue={setSearchQuery}
              onClear={() => setSearchQuery("")}
              placeholder="Search catalog..."
              sizeVariant="sm"
            />

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                maxHeight: 260,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                paddingRight: 2,
              }}
            >
              {loading ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--color-muted)", fontSize: 12 }}>
                  <span className="ui-spinner" style={{ marginRight: 6 }} /> Loading tests...
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--color-muted)", fontSize: 12 }}>
                  No matching tests found.
                </div>
              ) : (
                filteredCatalog.map((t) => {
                  const already = isAlreadyOnOrder(t);
                  const isSelected = selectedTests.has(t.id);

                  return (
                    <div
                      key={t.id}
                      onClick={() => !already && handleToggleTest(t)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "7px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: isSelected
                          ? "1px solid var(--color-primary)"
                          : "1px solid var(--color-border)",
                        background: already
                          ? "var(--color-surface-soft)"
                          : isSelected
                          ? "rgba(79, 70, 229, 0.08)"
                          : "var(--color-surface)",
                        cursor: already ? "not-allowed" : "pointer",
                        opacity: already ? 0.6 : 1,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            border: isSelected
                              ? "1px solid var(--color-primary)"
                              : "1px solid var(--color-border-strong)",
                            background: isSelected ? "var(--color-primary)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                          }}
                        >
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text)" }}>
                          {t.name}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {already ? (
                          <Badge tone="neutral">Already Added</Badge>
                        ) : (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "var(--color-muted)",
                            }}
                          >
                            {money(t.price)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Selected Tests & Custom Pricing */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: 10,
              background: "var(--color-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>
                Selected Tests to Add ({selectedTests.size})
              </span>
              {selectedTests.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTests(new Map())}
                  style={{
                    fontSize: 11,
                    color: "var(--color-danger)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                maxHeight: 260,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                paddingRight: 2,
              }}
            >
              {selectedTests.size === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "36px 12px",
                    color: "var(--color-muted)",
                    fontSize: 12,
                    textAlign: "center",
                    gap: 6,
                  }}
                >
                  <TestTube2 size={24} style={{ opacity: 0.4 }} />
                  <span>Select tests from the left catalog to add them to this order.</span>
                </div>
              ) : (
                Array.from(selectedTests.values()).map(({ test, customPrice }) => {
                  const standardPrice = test.price ?? 0;
                  const currentCustomNum = Number(customPrice);
                  const isModified = !isNaN(currentCustomNum) && currentCustomNum !== standardPrice;
                  const isInvalid = customPrice.trim() === "" || isNaN(currentCustomNum) || currentCustomNum < 0;

                  return (
                    <div
                      key={test.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: isInvalid
                          ? "1px solid var(--color-danger)"
                          : "1px solid var(--color-border)",
                        background: "var(--color-surface-soft)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>
                          {test.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelected(test.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--color-muted)",
                            padding: 2,
                          }}
                          title="Remove test"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Custom price field */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--color-muted)" }}>
                          <span>Std: {money(standardPrice)}</span>
                          {isModified && (
                            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                              (Custom)
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)" }}>₹</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={customPrice}
                            onChange={(e) => handlePriceChange(test.id, e.target.value)}
                            onBlur={() => handlePriceBlur(test.id)}
                            style={{
                              width: 80,
                              height: 26,
                              padding: "2px 6px",
                              fontSize: 12,
                              fontFamily: "var(--font-mono)",
                              fontWeight: 600,
                              borderRadius: "var(--radius-sm)",
                              border: isInvalid
                                ? "1px solid var(--color-danger)"
                                : "1px solid var(--color-border)",
                              background: "var(--color-surface)",
                              color: "var(--color-text)",
                              textAlign: "right",
                            }}
                          />
                          {isModified && (
                            <button
                              type="button"
                              onClick={() => handleResetPrice(test.id)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--color-muted)",
                                padding: "2px 4px",
                              }}
                              title="Reset to catalog price"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Financial impact summary strip */}
        <div
          style={{
            background: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span>
              Added Tests: <strong>{selectedTests.size}</strong>
            </span>
            <span style={{ color: "var(--color-muted)" }}>•</span>
            <span>
              Additional:{" "}
              <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>
                +{money(addedTotal)}
              </strong>
            </span>
            <span style={{ color: "var(--color-muted)" }}>•</span>
            <span>
              New Total:{" "}
              <strong style={{ fontFamily: "var(--font-mono)" }}>{money(newTotal)}</strong>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--color-muted)" }}>New Due:</span>
            <strong
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: newDue > 0 ? "var(--color-danger)" : "var(--color-success)",
              }}
            >
              {money(newDue)}
            </strong>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || selectedTests.size === 0 || hasInvalidPrice}
            icon={submitting ? <span className="ui-spinner" /> : <Plus size={14} />}
          >
            {submitting
              ? "Adding Tests..."
              : `Add ${selectedTests.size} Test${selectedTests.size === 1 ? "" : "s"} (${money(addedTotal)})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
