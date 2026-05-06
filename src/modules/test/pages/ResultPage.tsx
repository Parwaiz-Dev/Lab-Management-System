import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import type { OrderParameter, ToastMessage } from "../../../types";

type ResultPageProps = {
  orderId: number;
  onBack: () => void;
  onViewReport: (orderId: number) => void;
};

type ExistingResultRow = [parameterId: number, value: string];

export default function ResultPage({
  orderId,
  onBack,
  onViewReport,
}: ResultPageProps) {
  const [params, setParams] = useState<OrderParameter[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const groupedParams = useMemo(() => {
    const groups: {
      testId: number;
      testName: string;
      parameters: OrderParameter[];
    }[] = [];

    for (const param of params) {
      const group = groups.find((item) => item.testId === param.test_id);

      if (group) {
        group.parameters.push(param);
      } else {
        groups.push({
          testId: param.test_id,
          testName: param.test_name,
          parameters: [param],
        });
      }
    }

    return groups;
  }, [params]);

  const enteredCount = useMemo(() => {
    return params.filter((param) => values[param.id]?.trim()).length;
  }, [params, values]);

  useEffect(() => {
    const loadParams = async () => {
      const data = await invoke("get_parameters_by_order", { orderId });
      setParams(data as OrderParameter[]);
    };

    const loadExistingResults = async () => {
      const res = (await invoke("get_results_by_order", {
        orderId,
      })) as ExistingResultRow[];

      const map: Record<number, string> = {};

      res.forEach(([paramId, value]) => {
        map[paramId] = value;
      });

      setValues(map);
    };

    const loadAll = async () => {
      try {
        setLoading(true);
        await Promise.all([loadParams(), loadExistingResults()]);
      } catch (err) {
        console.error(err);
        setToast({ message: "Failed to load order results", type: "error" });
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      void loadAll();
    }
  }, [orderId]);

  const handleChange = (id: number, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const saveResults = async () => {
    const rowsToSave = params.filter((param) => values[param.id]?.trim());

    if (rowsToSave.length === 0) {
      setToast({
        message: "Enter at least one result before saving",
        type: "warning",
      });
      return;
    }

    try {
      setSaving(true);

      for (const param of rowsToSave) {
        await invoke("save_result", {
          orderId,
          parameterId: param.id,
          value: values[param.id].toString(),
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
    <div className="result-page">
      <section className="result-page__hero">
        <div>
          <div className="result-page__eyebrow">Laboratory Values</div>
          <h2>Order #{orderId} Results</h2>
          <p>
            Enter clinical result values against each selected sub test. Existing
            values are prefilled when available.
          </p>
        </div>

        <div className="result-page__stats">
          <div>
            <span>Total</span>
            <strong>{params.length}</strong>
          </div>

          <div>
            <span>Entered</span>
            <strong>{enteredCount}</strong>
          </div>
        </div>
      </section>

      <Card
        title="Result Entry"
        eyebrow="Sub tests and parameters"
        right={
          <div className="result-page__actions">
            <Button onClick={onBack} variant="secondary">
              Back
            </Button>

            <Button onClick={() => onViewReport(orderId)} variant="secondary">
              Preview Report
            </Button>

            <Button onClick={saveResults} disabled={saving || loading}>
              {saving ? "Saving..." : "Save Results"}
            </Button>
          </div>
        }
        className="result-page__card"
      >
        <div className="result-page__content">
          {loading && <div className="result-page__empty">Loading parameters...</div>}

          {!loading && params.length === 0 && (
            <div className="result-page__empty">
              No parameters found for this order.
            </div>
          )}

          {!loading &&
            groupedParams.map((group) => (
              <section key={group.testId} className="result-page__test-section">
                <div className="result-page__test-head">
                  <div>
                    <h3>{group.testName}</h3>
                    <p>Enter values for selected sub tests in this panel.</p>
                  </div>

                  <Badge tone="info">{group.parameters.length} values</Badge>
                </div>

                <div className="result-page__table">
                  <div className="result-page__table-head">
                    <span>Sub Test / Parameter</span>
                    <span>Unit</span>
                    <span>Reference Range</span>
                    <span>Result Value</span>
                    <span>Status</span>
                  </div>

                  {group.parameters.map((param) => {
                    const value = values[param.id] || "";
                    const hasValue = Boolean(value.trim());

                    return (
                      <div key={param.id} className="result-page__row">
                        <div className="result-page__param">
                          <strong>{param.name}</strong>
                          <span>Parameter ID {param.id}</span>
                        </div>

                        <div className="result-page__muted">
                          {param.unit || "-"}
                        </div>

                        <div className="result-page__range">
                          {param.normal_range || "-"}
                        </div>

                        <Input
                          value={value}
                          onChange={(e) => handleChange(param.id, e.target.value)}
                          placeholder={`Enter ${param.name}`}
                          disabled={saving}
                        />

                        <Badge tone={hasValue ? "success" : "neutral"}>
                          {hasValue ? "Entered" : "Pending"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </Card>
    </div>
  );
}