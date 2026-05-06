import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import Toast from "../../../components/ui/Toast";

type ResultParameterRow = [
  id: number,
  name: string,
  unit: string,
  normalRange: string,
];

type ResultEntryProps = {
  orderId: number;
  parameters: ResultParameterRow[];
};

type ToastState = {
  message: string;
  type: "success" | "error" | "warning" | "info";
};

export default function ResultEntry({ orderId, parameters }: ResultEntryProps) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const enteredCount = useMemo(() => {
    return parameters.filter((param) => values[param[0]]?.trim()).length;
  }, [parameters, values]);

  const totalCount = parameters.length;

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
    const rowsToSave = parameters
      .map((param) => ({
        parameterId: param[0],
        value: values[param[0]]?.trim(),
      }))
      .filter((row) => row.value);

    if (rowsToSave.length === 0) {
      setToast({
        message: "Enter at least one result value before saving",
        type: "warning",
      });
      return;
    }

    try {
      setSaving(true);

      for (const row of rowsToSave) {
        await invoke("save_result", {
          orderId,
          parameterId: row.parameterId,
          value: row.value,
        });
      }

      setToast({
        message: `${rowsToSave.length} result${rowsToSave.length > 1 ? "s" : ""} saved successfully`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to save results:", err);

      setToast({
        message: typeof err === "string" ? err : "Failed to save results",
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

          <Badge tone={enteredCount === totalCount && totalCount > 0 ? "success" : "info"}>
            {enteredCount}/{totalCount} completed
          </Badge>
        </div>

        {parameters.length === 0 ? (
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
              {parameters.map((param, index) => {
                const [id, name, unit, normalRange] = param;
                const value = values[id] ?? "";
                const hasValue = Boolean(value.trim());

                return (
                  <div key={id} className="result-entry__row">
                    <div className="result-entry__param">
                      <span className="result-entry__serial">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div>
                        <strong>{name}</strong>
                        <small>Parameter ID: {id}</small>
                      </div>
                    </div>

                    <div className="result-entry__muted">
                      {unit?.trim() || "—"}
                    </div>

                    <div className="result-entry__range">
                      {normalRange?.trim() || "Not defined"}
                    </div>

                    <Input
                      value={value}
                      placeholder="Enter value"
                      disabled={saving}
                      onChange={(e) => handleChange(id, e.target.value)}
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
            onClick={clearAll}
            variant="secondary"
            disabled={saving || enteredCount === 0}
          >
            Clear
          </Button>

          <Button
            onClick={saveAll}
            loading={saving}
            disabled={saving || parameters.length === 0 || enteredCount === 0}
          >
            {saving ? "Saving..." : "Save Results"}
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