import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import { colors } from "../../../components/ui/styles";
import type { OrderParameter, ToastMessage } from "../../../types";

type ResultPageProps = {
  orderId: number;
  onBack: () => void;
  onViewReport: (orderId: number) => void;
};

type ExistingResultRow = [parameterId: number, value: string];

export default function ResultPage({ orderId, onBack, onViewReport }: ResultPageProps) {
  const [params, setParams] = useState<OrderParameter[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);

  const groupedParams = useMemo(() => {
    const groups: { testId: number; testName: string; parameters: OrderParameter[] }[] = [];
    for (const param of params) {
      const group = groups.find((item) => item.testId === param.test_id);
      if (group) {
        group.parameters.push(param);
      } else {
        groups.push({ testId: param.test_id, testName: param.test_name, parameters: [param] });
      }
    }
    return groups;
  }, [params]);

  useEffect(() => {
    const loadParams = async () => {
      try {
        const data = await invoke("get_parameters_by_order", { orderId });
        setParams(data as OrderParameter[]);
      } catch (err) {
        console.error(err);
        setToast({ message: "Failed to load parameters", type: "error" });
      }
    };

    const loadExistingResults = async () => {
      try {
        const res = (await invoke("get_results_by_order", { orderId })) as ExistingResultRow[];
        const map: Record<number, string> = {};
        res.forEach(([paramId, value]) => {
          map[paramId] = value;
        });
        setValues(map);
      } catch (err) {
        console.error(err);
        setToast({ message: "Failed to load existing results", type: "error" });
      }
    };

    if (orderId) {
      loadParams();
      loadExistingResults();
    }
  }, [orderId]);

  const handleChange = (id: number, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const saveResults = async () => {
    try {
      setSaving(true);
      for (const param of params) {
        const value = values[param.id];
        if (!value) continue;
        await invoke("save_result", {
          orderId,
          parameterId: param.id,
          value: value.toString(),
        });
      }
      setToast({ message: "Results saved successfully", type: "success" });
    } catch (err) {
      console.error("Save error:", err);
      setToast({ message: "Failed to save results", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={`Order #${orderId} Results`}
      eyebrow="Laboratory values"
      right={
        <div style={actions}>
          <Button onClick={onBack} variant="secondary">
            Back
          </Button>
          <Button onClick={() => onViewReport(orderId)} variant="secondary">
            Preview Report
          </Button>
          <Button onClick={saveResults} disabled={saving}>
            {saving ? "Saving..." : "Save Results"}
          </Button>
        </div>
      }
    >
      <div style={table}>
        {params.length === 0 && <div style={emptyRow}>No parameters found for this order.</div>}

        {groupedParams.map((group) => (
          <section key={group.testId} style={testSection}>
            <div style={testSectionHead}>
              <div>
                <div style={testTitle}>{group.testName}</div>
                <div style={testHint}>
                  Enter values for these selected sub tests in the shown order.
                </div>
              </div>
              <span style={countPill}>{group.parameters.length} values</span>
            </div>

            <div style={headerRow}>
              <span>Sub Test / Parameter</span>
              <span>Unit</span>
              <span>Reference Range</span>
              <span>Result Value</span>
            </div>

            {group.parameters.map((param) => (
              <div key={param.id} style={dataRow}>
                <div>
                  <div style={primaryText}>{param.name}</div>
                  <div style={mutedText}>Parameter ID {param.id}</div>
                </div>
                <div style={mutedText}>{param.unit || "-"}</div>
                <div style={mutedText}>{param.normal_range || "-"}</div>
                <input
                  value={values[param.id] || ""}
                  onChange={(e) => handleChange(param.id, e.target.value)}
                  placeholder={`Enter ${param.name}`}
                  style={resultInput}
                />
              </div>
            ))}
          </section>
        ))}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Card>
  );
}

const actions = {
  display: "flex",
  gap: 8,
};

const table = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  overflow: "hidden",
  background: colors.surface,
};

const testSection = {
  borderTop: `1px solid ${colors.border}`,
};

const testSectionHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "13px 14px",
  background: colors.primarySoft,
};

const testTitle = {
  color: colors.text,
  fontSize: 15,
  fontWeight: 950,
};

const testHint = {
  color: colors.muted,
  fontSize: 12,
  marginTop: 3,
};

const countPill = {
  color: colors.primary,
  background: colors.surface,
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 900,
};

const headerRow = {
  display: "grid",
  gridTemplateColumns: "1.25fr 0.55fr 0.85fr 1fr",
  gap: 12,
  padding: "10px 12px",
  background: colors.surfaceSoft,
  color: colors.muted,
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase" as const,
};

const dataRow = {
  display: "grid",
  gridTemplateColumns: "1.25fr 0.55fr 0.85fr 1fr",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderTop: `1px solid ${colors.border}`,
};

const primaryText = {
  color: colors.text,
  fontWeight: 850,
};

const mutedText = {
  color: colors.muted,
  fontSize: 12,
};

const resultInput = {
  width: "100%",
  minHeight: 36,
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 8,
  padding: "8px 10px",
  outline: "none",
  color: colors.text,
};

const emptyRow = {
  padding: 18,
  color: colors.muted,
  fontSize: 13,
};
