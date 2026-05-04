import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import { colors } from "../../../components/ui/styles";
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

export default function TestCatalogManager() {
  const [tests, setTests] = useState<Test[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<Test | null>(null);
  const [activeTestId, setActiveTestId] = useState<number | null>(null);
  const [parameterDraft, setParameterDraft] = useState<ParameterDraft>(emptyParameter);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const loadTests = async () => {
      const data = (await invoke("get_tests")) as Test[];
      setTests(data);
      setActiveTestId((current) => current ?? data[0]?.id ?? null);
    };

    loadTests();
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return tests;
    return tests.filter((test) => {
      const parameterMatch = test.parameters.some((param) => param.name.toLowerCase().includes(text));
      return test.name.toLowerCase().includes(text) || parameterMatch;
    });
  }, [tests, query]);

  const activeTest = tests.find((test) => test.id === activeTestId) || filtered[0] || null;

  const refreshTests = async () => {
    const data = (await invoke("get_tests")) as Test[];
    setTests(data);
    setActiveTestId((current) => current ?? data[0]?.id ?? null);
  };

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
    const amount = Number(price);

    if (!name.trim() || Number.isNaN(amount) || amount < 0) {
      setToast({ message: "Enter a test name and valid price", type: "warning" });
      return;
    }

    try {
      if (editing) {
        await invoke("update_test", {
          testId: editing.id,
          name,
          price: amount,
        });
        setToast({ message: "Test updated", type: "success" });
      } else {
        const id = (await invoke("add_test", { name, price: amount })) as number;
        setActiveTestId(id);
        setToast({ message: "Test added", type: "success" });
      }

      resetForm();
      await refreshTests();
    } catch (err) {
      setToast({ message: typeof err === "string" ? err : "Failed to save test", type: "error" });
    }
  };

  const saveParameter = async () => {
    const testId = parameterDraft.testId || activeTest?.id;
    if (!testId || !parameterDraft.name.trim()) {
      setToast({ message: "Select a test and enter sub test name", type: "warning" });
      return;
    }

    try {
      if (parameterDraft.id) {
        await invoke("update_test_parameter", {
          parameterId: parameterDraft.id,
          name: parameterDraft.name,
          unit: parameterDraft.unit,
          normalRange: parameterDraft.normal_range,
        });
        setToast({ message: "Sub test updated", type: "success" });
      } else {
        await invoke("add_test_parameter", {
          testId,
          name: parameterDraft.name,
          unit: parameterDraft.unit,
          normalRange: parameterDraft.normal_range,
        });
        setToast({ message: "Sub test added", type: "success" });
      }

      resetParameter();
      await refreshTests();
    } catch (err) {
      setToast({ message: typeof err === "string" ? err : "Failed to save sub test", type: "error" });
    }
  };

  const removeTest = async (test: Test) => {
    if (!confirm(`Delete ${test.name}? Existing old orders will keep their order records, but this test leaves the catalog.`)) {
      return;
    }

    try {
      await invoke("delete_test", { testId: test.id });
      setToast({ message: "Test deleted", type: "success" });
      if (editing?.id === test.id) resetForm();
      if (activeTestId === test.id) setActiveTestId(null);
      await refreshTests();
    } catch (err) {
      setToast({ message: typeof err === "string" ? err : "Failed to delete test", type: "error" });
    }
  };

  const removeParameter = async (parameter: TestParameter) => {
    if (!confirm(`Delete sub test ${parameter.name}?`)) return;

    try {
      await invoke("delete_test_parameter", { parameterId: parameter.id });
      setToast({ message: "Sub test deleted", type: "success" });
      if (parameterDraft.id === parameter.id) resetParameter();
      await refreshTests();
    } catch (err) {
      setToast({ message: typeof err === "string" ? err : "Failed to delete sub test", type: "error" });
    }
  };

  return (
    <Card
      title="Test Management"
      eyebrow={`${tests.length} tests available`}
      right={<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tests" style={{ width: 220 }} />}
    >
      <div style={editor}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Test / panel name" />
        <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Price" />
        <Button onClick={saveTest}>{editing ? "Update" : "Add Test"}</Button>
        {editing && (
          <Button onClick={resetForm} variant="secondary">
            Cancel
          </Button>
        )}
      </div>

      <div style={layout}>
        <div style={table}>
          <div style={headerRow}>
            <span>Test</span>
            <span>Price</span>
            <span>Actions</span>
          </div>

          {filtered.map((test) => (
            <div
              key={test.id}
              style={{
                ...dataRow,
                background: activeTest?.id === test.id ? colors.primarySoft : colors.surface,
              }}
              onClick={() => setActiveTestId(test.id)}
            >
              <div>
                <div style={{ fontWeight: 850 }}>{test.name}</div>
                <div style={{ color: colors.muted, fontSize: 12 }}>
                  ID {test.id} - {test.parameters.length} sub tests
                </div>
              </div>
              <strong>Rs {test.price}</strong>
              <div style={actions}>
                <Button onClick={() => startEdit(test)} variant="secondary">
                  Edit
                </Button>
                <Button onClick={() => removeTest(test)} variant="danger">
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        <section style={parameterPanel}>
          <div>
            <div style={panelTitle}>{activeTest?.name || "Select a test"}</div>
            <div style={panelMeta}>Manage sub tests, units, and reference ranges</div>
          </div>

          <div style={parameterEditor}>
            <Input
              value={parameterDraft.name}
              onChange={(e) => setParameterDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Sub test name"
            />
            <Input
              value={parameterDraft.unit}
              onChange={(e) => setParameterDraft((prev) => ({ ...prev, unit: e.target.value }))}
              placeholder="Unit"
            />
            <Input
              value={parameterDraft.normal_range}
              onChange={(e) => setParameterDraft((prev) => ({ ...prev, normal_range: e.target.value }))}
              placeholder="Reference range"
            />
            <Button onClick={saveParameter} disabled={!activeTest}>
              {parameterDraft.id ? "Update" : "Add"}
            </Button>
            {parameterDraft.id && (
              <Button onClick={resetParameter} variant="secondary">
                Cancel
              </Button>
            )}
          </div>

          <div style={parameterList}>
            {!activeTest?.parameters.length && <div style={empty}>No sub tests added.</div>}
            {activeTest?.parameters.map((parameter) => (
              <div key={parameter.id} style={parameterRow}>
                <div>
                  <div style={{ fontWeight: 850 }}>{parameter.name}</div>
                  <div style={{ color: colors.muted, fontSize: 12 }}>
                    {parameter.unit || "No unit"} - {parameter.normal_range || "No range"}
                  </div>
                </div>
                <div style={actions}>
                  <Button onClick={() => startParameterEdit(activeTest, parameter)} variant="secondary">
                    Edit
                  </Button>
                  <Button onClick={() => removeParameter(parameter)} variant="danger">
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Card>
  );
}

const editor = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) 130px auto auto",
  gap: 8,
  alignItems: "center",
  marginBottom: 14,
};

const layout = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1fr) minmax(320px, 0.9fr)",
  gap: 14,
  alignItems: "start",
};

const table = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  overflow: "hidden",
  maxHeight: 520,
  overflowY: "auto" as const,
};

const headerRow = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 150px",
  gap: 10,
  padding: "10px 12px",
  background: colors.surfaceSoft,
  color: colors.muted,
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase" as const,
};

const dataRow = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 150px",
  gap: 10,
  alignItems: "center",
  padding: 12,
  borderTop: `1px solid ${colors.border}`,
  cursor: "pointer",
};

const actions = {
  display: "flex",
  gap: 7,
  justifyContent: "flex-end",
  flexWrap: "wrap" as const,
};

const parameterPanel = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  background: colors.surface,
  padding: 12,
};

const panelTitle = {
  color: colors.text,
  fontSize: 16,
  fontWeight: 900,
};

const panelMeta = {
  color: colors.muted,
  fontSize: 12,
  marginTop: 4,
};

const parameterEditor = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 130px auto auto",
  gap: 8,
  marginTop: 12,
};

const parameterList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  marginTop: 12,
};

const parameterRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
  padding: 10,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  background: colors.surfaceSoft,
};

const empty = {
  color: colors.muted,
  fontSize: 13,
  padding: 10,
};
