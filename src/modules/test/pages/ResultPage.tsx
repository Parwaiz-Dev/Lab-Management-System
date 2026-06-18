import { useEffect, useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import type { OrderParameter, ToastMessage } from "../../../types";
import { getErrorMessage, testService } from "../services/testService";

type ResultPageProps = {
  orderId: number;
  onBack: () => void;
  onViewReport: (orderId: number) => void;
};

interface ExistingResultRow {
  parameterId: number;
  value: string;
}
type FlagStatus = "" | "Low" | "High" | "Normal";

function getFlagStatus(value: string, range: string): FlagStatus {
  const num = Number.parseFloat(String(value || "").replace(/,/g, ""));
  if (Number.isNaN(num) || !range) return "";
  const cleanRange = String(range || "").trim().toLowerCase();
  if (!cleanRange) return "";
  if (cleanRange.startsWith("<=")) {
    const max = Number.parseFloat(cleanRange.replace("<=", ""));
    if (Number.isNaN(max)) return "";
    return num > max ? "High" : "";
  }
  if (cleanRange.startsWith("<")) {
    const max = Number.parseFloat(cleanRange.replace("<", ""));
    if (Number.isNaN(max)) return "";
    return num >= max ? "High" : "";
  }
  if (cleanRange.startsWith(">=")) {
    const min = Number.parseFloat(cleanRange.replace(">=", ""));
    if (Number.isNaN(min)) return "";
    return num < min ? "Low" : "";
  }
  if (cleanRange.startsWith(">")) {
    const min = Number.parseFloat(cleanRange.replace(">", ""));
    if (Number.isNaN(min)) return "";
    return num <= min ? "Low" : "";
  }
  const match = cleanRange.match(
    /(-?\d+(\.\d+)?)\s*(?:-|to)\s*(-?\d+(\.\d+)?)/
  );
  if (!match) return "";
  const min = Number.parseFloat(match[1]);
  const max = Number.parseFloat(match[3]);
  if (Number.isNaN(min) || Number.isNaN(max)) return "";
  if (num < min) return "Low";
  if (num > max) return "High";
  return "";
}

export default function ResultPage({
  orderId,
  onBack,
  onViewReport,
}: ResultPageProps) {
  const [params, setParams] = useState<OrderParameter[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    const loadAll = async () => {
      try {
        setLoading(true);

        const [parameters, existingResults] = await Promise.all([
          testService.getParametersByOrder(orderId),
          testService.getResultsByOrder(orderId),
        ]);

        setParams(parameters);

        const resultMap: Record<number, string> = {};

        (existingResults as ExistingResultRow[]).forEach(({ parameterId, value }) => {
          resultMap[parameterId] = value;
        });

        setValues(resultMap);
      } catch (err) {
        console.error(err);
        setToast({
          message: getErrorMessage(err, "Failed to load order results"),
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    if (orderId) void loadAll();
  }, [orderId]);

  const handleChange = (id: number, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const saveResults = async () => {
    const rowsToSave = params
      .map((param) => ({
        parameterId: param.id,
        value: values[param.id]?.trim() || "",
      }))
      .filter((row) => row.value);

    if (rowsToSave.length === 0) {
      setToast({
        message: "Enter at least one result before saving",
        type: "warning",
      });
      return;
    }

    try {
      setSaving(true);

      await testService.saveResults(orderId, rowsToSave);

      setToast({ message: "Results saved successfully", type: "success" });
    } catch (err) {
      console.error("Save error:", err);
      setToast({
        message: getErrorMessage(err, "Failed to save results"),
        type: "error",
      });
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
            Enter clinical result values against each selected sub test.
            Existing values are prefilled when available.
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
        icon={<FlaskConical size={18} />}
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

            <Button
              onClick={() => setShowConfirm(true)}
              disabled={saving || loading || enteredCount === 0}
            >
              {saving ? "Saving..." : "Save Results"}
            </Button>
          </div>
        }
        className="result-page__card"
      >
        <div className="result-page__content">
          {loading && (
            <div className="result-page__empty">Loading parameters...</div>
          )}

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
                    <span>Flag</span>
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
                          onChange={(e) =>
                            handleChange(param.id, e.target.value)
                          }
                          placeholder={`Enter ${param.name}`}
                          disabled={saving}
                        />

                        <Badge tone={hasValue ? "success" : "neutral"}>
                          {hasValue ? "Entered" : "Pending"}
                        </Badge>

                        <div className="result-page__flag">
                          {hasValue && param.normal_range ? (
                            getFlagStatus(value, param.normal_range) === "High" ? (
                              <Badge tone="danger">High</Badge>
                            ) : getFlagStatus(value, param.normal_range) === "Low" ? (
                              <Badge tone="warning">Low</Badge>
                            ) : (
                              <Badge tone="success">Normal</Badge>
                            )
                          ) : (
                            <span className="result-page__muted">-</span>
                          )}
                        </div>
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

      <ConfirmationDialog
        open={showConfirm}
        title="Complete Result Entry"
        description={`You are about to save ${enteredCount} of ${params.length} result values. Values cannot be edited after saving. Proceed?`}
        confirmLabel="Save Results"
        cancelLabel="Review Again"
        loading={saving}
        onConfirm={() => {
          setShowConfirm(false);
          saveResults();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}