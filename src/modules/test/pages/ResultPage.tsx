import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, FileText, FlaskConical } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import Badge from "../../../components/ui/Badge";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import EmptyState from "../../../components/ui/EmptyState";
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
    return num > max ? "High" : "Normal";
  }
  if (cleanRange.startsWith("<")) {
    const max = Number.parseFloat(cleanRange.replace("<", ""));
    if (Number.isNaN(max)) return "";
    return num >= max ? "High" : "Normal";
  }
  if (cleanRange.startsWith(">=")) {
    const min = Number.parseFloat(cleanRange.replace(">=", ""));
    if (Number.isNaN(min)) return "";
    return num < min ? "Low" : "Normal";
  }
  if (cleanRange.startsWith(">")) {
    const min = Number.parseFloat(cleanRange.replace(">", ""));
    if (Number.isNaN(min)) return "";
    return num <= min ? "Low" : "Normal";
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
  return "Normal";
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
        const isDemo = new URLSearchParams(window.location.search).get("demo") || new URLSearchParams(window.location.search).get("mock");
        if (isDemo) {
          setParams([
            {
              id: 1,
              test_id: 1,
              test_name: "Complete Blood Count (CBC)",
              name: "Hemoglobin",
              unit: "g/dL",
              normal_range: "13.0 - 17.0",
            },
            {
              id: 2,
              test_id: 1,
              test_name: "Complete Blood Count (CBC)",
              name: "WBC Count",
              unit: "cells/mcL",
              normal_range: "4000 - 11000",
            },
            {
              id: 3,
              test_id: 1,
              test_name: "Complete Blood Count (CBC)",
              name: "Platelet Count",
              unit: "lakh/cumm",
              normal_range: "1.5 - 4.5",
            },
            {
              id: 4,
              test_id: 2,
              test_name: "Lipid Profile",
              name: "Total Cholesterol",
              unit: "mg/dL",
              normal_range: "< 200",
            },
            {
              id: 5,
              test_id: 2,
              test_name: "Lipid Profile",
              name: "Triglycerides",
              unit: "mg/dL",
              normal_range: "< 150",
            },
          ]);
          setValues({ 1: "14.2", 2: "7200", 3: "2.8" });
        } else {
          setToast({
            message: getErrorMessage(err, "Failed to load order results"),
            type: "error",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    if (orderId) void loadAll();
  }, [orderId]);

  const allParamIds = useMemo(() => params.map((p) => p.id), [params]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentId: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const currIdx = allParamIds.indexOf(currentId);
      if (currIdx >= 0 && currIdx < allParamIds.length - 1) {
        const nextId = allParamIds[currIdx + 1];
        document.getElementById(`result-param-${nextId}`)?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const currIdx = allParamIds.indexOf(currentId);
      if (currIdx > 0) {
        const prevId = allParamIds[currIdx - 1];
        document.getElementById(`result-param-${prevId}`)?.focus();
      }
    }
  };

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
    <div className="result-entry-workspace" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Top Header & Actions Toolbar */}
      <div className="result-toolbar">
        <div className="result-toolbar__left">
          <Button onClick={onBack} variant="outline" size="sm" icon={<ArrowLeft size={14} />}>
            Back
          </Button>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
                Order #{orderId} Clinical Results
              </h2>
              <Badge tone={enteredCount === params.length && params.length > 0 ? "success" : "info"} size="sm">
                {enteredCount === params.length && params.length > 0 ? "Completed" : "In Progress"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="result-toolbar__right">
          <div className="result-toolbar__stats">
            <span className="result-stat-chip">
              <span className="result-stat-chip__label">Total</span>
              <strong className="result-stat-chip__val font-mono">{params.length}</strong>
            </span>
            <span className="result-stat-chip result-stat-chip--entered">
              <span className="result-stat-chip__label">Entered</span>
              <strong className="result-stat-chip__val font-mono">{enteredCount}</strong>
            </span>
            <span className="result-stat-chip result-stat-chip--pending">
              <span className="result-stat-chip__label">Pending</span>
              <strong className="result-stat-chip__val font-mono">{params.length - enteredCount}</strong>
            </span>
          </div>

          <div className="result-toolbar__buttons">
            <Button
              onClick={() => onViewReport(orderId)}
              variant="outline"
              size="sm"
              icon={<FileText size={14} />}
            >
              Preview Report
            </Button>

            <Button
              onClick={() => setShowConfirm(true)}
              disabled={saving || loading || enteredCount === 0}
              variant="primary"
              size="sm"
              loading={saving}
              icon={<Check size={14} />}
            >
              Save Results
            </Button>
          </div>
        </div>
      </div>

      {/* Main Results Form */}
      {loading ? (
        <div style={{ padding: 32, textAlign: "center", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", fontSize: 12, color: "var(--color-muted)" }}>
          Loading clinical parameters…
        </div>
      ) : params.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={<FlaskConical size={32} style={{ color: "var(--color-muted)" }} />}
            title="No parameters found"
            subtitle="This order does not have any active sub-tests or parameters configured."
          />
        </Card>
      ) : (
        <div className={`result-entry-grid ${groupedParams.length === 1 ? "result-entry-grid--single" : ""}`}>
          {groupedParams.map((group) => {
            const groupEntered = group.parameters.filter((param) => values[param.id]?.trim()).length;
            const isGroupComplete = groupEntered === group.parameters.length && group.parameters.length > 0;

            return (
              <Card
                key={group.testId}
                compact
                className="result-entry-panel"
                icon={<FlaskConical size={14} />}
                title={group.testName}
                eyebrow="PANEL"
                right={
                  <span className="result-panel-progress" style={{ fontWeight: 600, color: isGroupComplete ? "var(--color-emerald-700)" : "var(--color-muted)" }}>
                    {groupEntered}/{group.parameters.length} entered
                  </span>
                }
              >
                <div className="data-table-wrap">
                  <table className="data-table result-parameter-table">
                    <thead>
                      <tr>
                        <th style={{ width: "32%" }}>Parameter</th>
                        <th style={{ width: "24%" }}>Result</th>
                        <th style={{ width: "14%" }}>Unit</th>
                        <th style={{ width: "18%" }}>Ref Range</th>
                        <th style={{ width: "12%", textAlign: "center" }}>Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.parameters.map((param) => {
                        const value = values[param.id] || "";
                        const hasValue = Boolean(value.trim());
                        const flag = hasValue && param.normal_range ? getFlagStatus(value, param.normal_range) : "";

                        let inputModifier = "";
                        if (flag === "High") inputModifier = "result-input-field--high";
                        else if (flag === "Low") inputModifier = "result-input-field--low";

                        return (
                          <tr key={param.id}>
                            <td>
                              <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 11.5, lineHeight: 1.2 }}>
                                {param.name}
                              </div>
                              <span style={{ fontSize: 9.5, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
                                #{param.id}
                              </span>
                            </td>

                            <td>
                              <input
                                id={`result-param-${param.id}`}
                                value={value}
                                onChange={(e) => handleChange(param.id, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, param.id)}
                                placeholder="Value..."
                                disabled={saving}
                                className={`result-input-field ${inputModifier}`}
                              />
                            </td>

                            <td style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                              {param.unit || "—"}
                            </td>

                            <td style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                              {param.normal_range || "—"}
                            </td>

                            <td style={{ textAlign: "center" }}>
                              {flag === "High" ? (
                                <span className="result-flag-badge result-flag-badge--high">
                                  High
                                </span>
                              ) : flag === "Low" ? (
                                <span className="result-flag-badge result-flag-badge--low">
                                  Low
                                </span>
                              ) : flag === "Normal" ? (
                                <span className="result-flag-badge result-flag-badge--normal">
                                  Normal
                                </span>
                              ) : (
                                <span style={{ color: "var(--color-muted)", fontSize: 11 }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirm}
        title="Save Clinical Results"
        description={`You are about to save ${enteredCount} of ${params.length} result values for Order #${orderId}. Confirm to persist these values.`}
        confirmLabel="Confirm & Save"
        cancelLabel="Keep Editing"
        loading={saving}
        onConfirm={() => {
          setShowConfirm(false);
          void saveResults();
        }}
        onCancel={() => setShowConfirm(false)}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}