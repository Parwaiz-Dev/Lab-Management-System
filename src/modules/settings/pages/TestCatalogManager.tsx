import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import Badge from "../../../components/ui/Badge";
import type { Test, TestParameter, ToastMessage } from "../../../types";

type ParameterDraft = {
  id?: number;
  testId?: number;
  name: string;
  unit: string;
  normal_range: string;
};

const emptyParameter: ParameterDraft = {
  name: "",
  unit: "",
  normal_range: "",
};

const money = (value: number) => `Rs ${Number(value || 0).toFixed(0)}`;

export default function TestCatalogManager() {
  const [tests, setTests] = useState<Test[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<Test | null>(null);
  const [activeTestId, setActiveTestId] = useState<number | null>(null);
  const [parameterDraft, setParameterDraft] =
    useState<ParameterDraft>(emptyParameter);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTest, setSavingTest] = useState(false);
  const [savingParameter, setSavingParameter] = useState(false);

  const refreshTests = async (nextActiveId?: number | null) => {
    const data = (await invoke("get_tests")) as Test[];
    setTests(data);

    setActiveTestId((current) => {
      if (nextActiveId !== undefined) return nextActiveId;
      if (current && data.some((test) => test.id === current)) return current;
      return data[0]?.id ?? null;
    });
  };

  useEffect(() => {
    const loadTests = async () => {
      try {
        setLoading(true);
        await refreshTests();
      } catch (err) {
        console.error("Failed to load tests:", err);
        setToast({ message: "Failed to load test catalog", type: "error" });
      } finally {
        setLoading(false);
      }
    };

    void loadTests();
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();

    if (!text) return tests;

    return tests.filter((test) => {
      const parameterMatch = test.parameters.some((param) =>
        param.name.toLowerCase().includes(text)
      );

      return (
        test.name.toLowerCase().includes(text) ||
        String(test.price).includes(text) ||
        parameterMatch
      );
    });
  }, [tests, query]);

  const activeTest =
    tests.find((test) => test.id === activeTestId) || filtered[0] || null;

  const totalParameters = useMemo(() => {
    return tests.reduce((sum, test) => sum + test.parameters.length, 0);
  }, [tests]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setPrice("");
  };

  const resetParameter = () => {
    setParameterDraft(emptyParameter);
  };

  const startEdit = (test: Test) => {
    setEditing(test);
    setName(test.name);
    setPrice(String(test.price));
    setActiveTestId(test.id);
  };

  const startParameterEdit = (test: Test, parameter: TestParameter) => {
    setActiveTestId(test.id);
    setParameterDraft({
      id: parameter.id,
      testId: test.id,
      name: parameter.name,
      unit: parameter.unit,
      normal_range: parameter.normal_range,
    });
  };

  const saveTest = async () => {
    const cleanedName = name.trim();
    const amount = Number(price);

    if (!cleanedName || Number.isNaN(amount) || amount < 0) {
      setToast({
        message: "Enter a test name and valid price",
        type: "warning",
      });
      return;
    }

    try {
      setSavingTest(true);

      if (editing) {
        await invoke("update_test", {
          testId: editing.id,
          name: cleanedName,
          price: amount,
        });

        setToast({ message: "Test updated", type: "success" });
        await refreshTests(editing.id);
      } else {
        const id = (await invoke("add_test", {
          name: cleanedName,
          price: amount,
        })) as number;

        setToast({ message: "Test added", type: "success" });
        await refreshTests(id);
      }

      resetForm();
    } catch (err) {
      setToast({
        message: typeof err === "string" ? err : "Failed to save test",
        type: "error",
      });
    } finally {
      setSavingTest(false);
    }
  };

  const saveParameter = async () => {
    const testId = parameterDraft.testId || activeTest?.id;
    const cleanedName = parameterDraft.name.trim();

    if (!testId || !cleanedName) {
      setToast({
        message: "Select a test and enter sub test name",
        type: "warning",
      });
      return;
    }

    try {
      setSavingParameter(true);

      if (parameterDraft.id) {
        await invoke("update_test_parameter", {
          parameterId: parameterDraft.id,
          name: cleanedName,
          unit: parameterDraft.unit.trim(),
          normalRange: parameterDraft.normal_range.trim(),
        });

        setToast({ message: "Sub test updated", type: "success" });
      } else {
        await invoke("add_test_parameter", {
          testId,
          name: cleanedName,
          unit: parameterDraft.unit.trim(),
          normalRange: parameterDraft.normal_range.trim(),
        });

        setToast({ message: "Sub test added", type: "success" });
      }

      resetParameter();
      await refreshTests(testId);
    } catch (err) {
      setToast({
        message: typeof err === "string" ? err : "Failed to save sub test",
        type: "error",
      });
    } finally {
      setSavingParameter(false);
    }
  };

  const removeTest = async (test: Test) => {
    if (
      !confirm(
        `Delete ${test.name}? Existing old orders will keep their order records, but this test leaves the catalog.`
      )
    ) {
      return;
    }

    try {
      await invoke("delete_test", { testId: test.id });

      setToast({ message: "Test deleted", type: "success" });

      if (editing?.id === test.id) resetForm();
      if (activeTestId === test.id) setActiveTestId(null);

      await refreshTests(null);
    } catch (err) {
      setToast({
        message: typeof err === "string" ? err : "Failed to delete test",
        type: "error",
      });
    }
  };

  const removeParameter = async (parameter: TestParameter) => {
    if (!confirm(`Delete sub test ${parameter.name}?`)) return;

    try {
      await invoke("delete_test_parameter", { parameterId: parameter.id });

      setToast({ message: "Sub test deleted", type: "success" });

      if (parameterDraft.id === parameter.id) resetParameter();

      await refreshTests(activeTest?.id ?? null);
    } catch (err) {
      setToast({
        message: typeof err === "string" ? err : "Failed to delete sub test",
        type: "error",
      });
    }
  };

  const selectTestByKeyboard = (
    event: React.KeyboardEvent<HTMLDivElement>,
    testId: number
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveTestId(testId);
    }
  };

  return (
    <Card
      title="Test Catalog Management"
      eyebrow="Panels, prices, sub tests, units, and reference ranges"
      right={
        <div className="test-manager-toolbar-v2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tests or sub tests"
          />

          <Badge tone="info">{tests.length} tests</Badge>
        </div>
      }
      className="test-manager-card-v2"
    >
      <div className="test-manager-v2">
        <section className="test-manager-v2__summary">
          <SummaryItem label="Tests" value={tests.length} />
          <SummaryItem label="Sub Tests" value={totalParameters} />
          <SummaryItem
            label="Selected"
            value={activeTest ? activeTest.parameters.length : 0}
          />
        </section>

        <section className="test-manager-editor-v2">
          <div>
            <h3>{editing ? "Edit Test / Panel" : "Create Test / Panel"}</h3>
            <p>Add or update the billable test master used in patient intake.</p>
          </div>

          <div className="test-manager-editor-v2__fields">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Test / panel name"
              disabled={savingTest}
            />

            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              placeholder="Price"
              disabled={savingTest}
            />

            <Button onClick={saveTest} disabled={savingTest}>
              {savingTest ? "Saving..." : editing ? "Update Test" : "Add Test"}
            </Button>

            {editing && (
              <Button onClick={resetForm} variant="secondary" disabled={savingTest}>
                Cancel
              </Button>
            )}
          </div>
        </section>

        <div className="test-manager-v2__layout">
          <section className="test-manager-list-v2">
            <div className="test-manager-list-v2__header">
              <div>
                <h3>Catalog</h3>
                <p>Select a test to manage its sub tests.</p>
              </div>
            </div>

            <div className="test-manager-list-v2__table-head">
              <span>Test</span>
              <span>Price</span>
              <span>Actions</span>
            </div>

            <div className="test-manager-list-v2__rows">
              {loading && (
                <div className="test-manager-v2__empty">Loading tests...</div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="test-manager-v2__empty">
                  No tests found. Add a new test above.
                </div>
              )}

              {!loading &&
                filtered.map((test) => (
                  <div
                    key={test.id}
                    role="button"
                    tabIndex={0}
                    className={[
                      "test-manager-row-v2",
                      activeTest?.id === test.id
                        ? "test-manager-row-v2--active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setActiveTestId(test.id)}
                    onKeyDown={(event) => selectTestByKeyboard(event, test.id)}
                  >
                    <div>
                      <strong>{test.name}</strong>
                      <span>
                        ID {test.id} · {test.parameters.length} sub tests
                      </span>
                    </div>

                    <strong className="test-manager-row-v2__price">
                      {money(test.price)}
                    </strong>

                    <span className="test-manager-row-v2__actions">
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          startEdit(test);
                        }}
                        variant="secondary"
                      >
                        Edit
                      </Button>

                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeTest(test);
                        }}
                        variant="danger"
                      >
                        Delete
                      </Button>
                    </span>
                  </div>
                ))}
            </div>
          </section>

          <section className="test-manager-detail-v2">
            <div className="test-manager-detail-v2__head">
              <div>
                <h3>{activeTest?.name || "Select a test"}</h3>
                <p>Manage sub tests, units, and reference ranges.</p>
              </div>

              <Badge tone={activeTest ? "success" : "neutral"}>
                {activeTest ? `${activeTest.parameters.length} sub tests` : "Idle"}
              </Badge>
            </div>

            <div className="test-manager-parameter-form-v2">
              <Input
                value={parameterDraft.name}
                onChange={(e) =>
                  setParameterDraft((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Sub test name"
                disabled={!activeTest || savingParameter}
              />

              <Input
                value={parameterDraft.unit}
                onChange={(e) =>
                  setParameterDraft((prev) => ({
                    ...prev,
                    unit: e.target.value,
                  }))
                }
                placeholder="Unit"
                disabled={!activeTest || savingParameter}
              />

              <Input
                value={parameterDraft.normal_range}
                onChange={(e) =>
                  setParameterDraft((prev) => ({
                    ...prev,
                    normal_range: e.target.value,
                  }))
                }
                placeholder="Reference range"
                disabled={!activeTest || savingParameter}
              />

              <Button
                onClick={saveParameter}
                disabled={!activeTest || savingParameter}
              >
                {savingParameter
                  ? "Saving..."
                  : parameterDraft.id
                    ? "Update"
                    : "Add"}
              </Button>

              {parameterDraft.id && (
                <Button
                  onClick={resetParameter}
                  variant="secondary"
                  disabled={savingParameter}
                >
                  Cancel
                </Button>
              )}
            </div>

            <div className="test-manager-parameter-list-v2">
              {!activeTest?.parameters.length && (
                <div className="test-manager-v2__empty">
                  No sub tests added for this test.
                </div>
              )}

              {activeTest?.parameters.map((parameter) => (
                <div key={parameter.id} className="test-manager-parameter-row-v2">
                  <div>
                    <strong>{parameter.name}</strong>
                    <span>
                      {parameter.unit || "No unit"} ·{" "}
                      {parameter.normal_range || "No range"}
                    </span>
                  </div>

                  <div className="test-manager-parameter-row-v2__actions">
                    <Button
                      onClick={() => startParameterEdit(activeTest, parameter)}
                      variant="secondary"
                    >
                      Edit
                    </Button>

                    <Button
                      onClick={() => removeParameter(parameter)}
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </Card>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="test-manager-summary-item-v2">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}