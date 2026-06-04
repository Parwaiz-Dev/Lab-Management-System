import { useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import Toast from "../../../components/ui/Toast";
import type { ToastMessage } from "../../../types";
import { getErrorMessage, testService } from "../services/testService";

type ResultParameterTuple = [
  id: number,
  name: string,
  unit: string,
  normalRange: string,
];

type ResultParameterObject = {
  id: number;
  name: string;
  unit?: string;
  normalRange?: string;
  normal_range?: string;
};

type ResultParameterInput = ResultParameterTuple | ResultParameterObject;

type NormalizedParameter = {
  id: number;
  name: string;
  unit: string;
  normalRange: string;
};

type ResultEntryProps = {
  orderId: number;
  parameters: ResultParameterInput[];
};

function normalizeParameter(param: ResultParameterInput): NormalizedParameter {
  if (Array.isArray(param)) {
    return {
      id: Number(param[0]),
      name: String(param[1] || ""),
      unit: String(param[2] || ""),
      normalRange: String(param[3] || ""),
    };
  }

  return {
    id: Number(param.id),
    name: String(param.name || ""),
    unit: String(param.unit || ""),
    normalRange: String(param.normalRange || param.normal_range || ""),
  };
}

export default function ResultEntry({ orderId, parameters }: ResultEntryProps) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const normalizedParameters = useMemo(() => {
    return parameters
      .map(normalizeParameter)
      .filter((param) => Number.isFinite(param.id) && param.id > 0);
  }, [parameters]);

  const enteredCount = useMemo(() => {
    return normalizedParameters.filter((param) => values[param.id]?.trim())
      .length;
  }, [normalizedParameters, values]);

  const totalCount = normalizedParameters.length;

  const handleChange = (id: number, value: string) => {
    setValues((current) => ({
      ...current,
      [id]: value,
    }));
  };

  const clearAll = () => {
    setValues({});
    setToast({
      message: "Result values cleared",
      type: "info",
    });
  };

  const saveAll = async () => {
    const rowsToSave = normalizedParameters
      .map((param) => ({
        parameterId: param.id,
        value: values[param.id]?.trim() || "",
      }))
      .filter((row) => row.value);

    if (!orderId || orderId <= 0) {
      setToast({
        message: "Invalid order selected",
        type: "error",
      });
      return;
    }

    if (rowsToSave.length === 0) {
      setToast({
        message: "Enter at least one result value before saving",
        type: "warning",
      });
      return;
    }

    try {
      setSaving(true);

      await testService.saveResults(orderId, rowsToSave);

      setToast({
        message: `${rowsToSave.length} result${
          rowsToSave.length > 1 ? "s" : ""
        } saved successfully`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to save results:", err);

      setToast({
        message: getErrorMessage(err, "Failed to save results"),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="result-entry">
      <div className="result-entry__hero">
        <div>
          <div className="result-entry__eyebrow">Result Entry</div>
          <h2 className="result-entry__title">Enter Test Results</h2>
          <p className="result-entry__subtitle">
            Capture parameter values for order #{orderId}. Only entered values
            will be saved.
          </p>
        </div>

        <div className="result-entry__stats">
          <div className="result-entry__stat-card">
            <span>Total Parameters</span>
            <strong>{totalCount}</strong>
          </div>

          <div className="result-entry__stat-card result-entry__stat-card--active">
            <span>Entered</span>
            <strong>{enteredCount}</strong>
          </div>
        </div>
      </div>

      <div className="result-entry__panel">
        <div className="result-entry__panel-head">
          <div>
            <h3>Parameters</h3>
            <p>Enter values against each selected sub test.</p>
          </div>

          <Badge
            tone={
              enteredCount === totalCount && totalCount > 0 ? "success" : "info"
            }
          >
            {enteredCount}/{totalCount} completed
          </Badge>
        </div>

        {normalizedParameters.length === 0 ? (
          <div className="result-entry__empty">
            <div className="result-entry__empty-icon">+</div>
            <strong>No parameters found</strong>
            <span>
              This order does not have any result parameters available for entry.
            </span>
          </div>
        ) : (
          <div className="result-entry__table">
            <div className="result-entry__table-head">
              <span>Parameter</span>
              <span>Unit</span>
              <span>Normal Range</span>
              <span>Result Value</span>
              <span>Status</span>
            </div>

            <div className="result-entry__table-body">
              {normalizedParameters.map((param, index) => {
                const value = values[param.id] ?? "";
                const hasValue = Boolean(value.trim());

                return (
                  <div key={param.id} className="result-entry__row">
                    <div className="result-entry__param">
                      <span className="result-entry__serial">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div>
                        <strong>{param.name}</strong>
                        <small>Parameter ID: {param.id}</small>
                      </div>
                    </div>

                    <div className="result-entry__muted">
                      {param.unit.trim() || "—"}
                    </div>

                    <div className="result-entry__range">
                      {param.normalRange.trim() || "Not defined"}
                    </div>

                    <Input
                      value={value}
                      placeholder="Enter value"
                      disabled={saving}
                      onChange={(e) => handleChange(param.id, e.target.value)}
                    />

                    <Badge tone={hasValue ? "success" : "neutral"}>
                      {hasValue ? "Entered" : "Pending"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="result-entry__actions">
          <Button
            type="button"
            onClick={clearAll}
            variant="secondary"
            disabled={saving || enteredCount === 0}
          >
            Clear
          </Button>

          <Button
            type="button"
            onClick={saveAll}
            loading={saving}
            disabled={saving || normalizedParameters.length === 0 || enteredCount === 0}
          >
            Save Results
          </Button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  );
}