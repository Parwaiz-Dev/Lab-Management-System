import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function ResultPage({ orderId, onBack, onViewReport }: any) {
  const [params, setParams] = useState<any[]>([]);
  const [values, setValues] = useState<any>({});

  // ✅ FIXED useEffect
  useEffect(() => {
    if (orderId) {
      loadParams();
      loadExistingResults();
    }
  }, [orderId]);

  const loadParams = async () => {
    const data = await invoke("get_parameters_by_order", { orderId });
    console.log("PARAMS:", data);
    setParams(data as any[]);
  };

  const loadExistingResults = async () => {
    const res = await invoke("get_results_by_order", { orderId });

    const map: any = {};

    (res as any[]).forEach(([paramId, value]) => {
      map[paramId] = value;
    });

    setValues(map);
  };

  // ✅ FIXED state update
  const handleChange = (id: number, value: string) => {
    setValues((prev: any) => ({
      ...prev,
      [id]: value,
    }));
  };

  // ✅ IMPROVED SAVE
  const saveResults = async () => {
    try {
      for (const p of params) {
        const value = values[p[0]];

        if (!value) continue;

        console.log("Saving:", p[0], value);

        await invoke("save_result", {
          orderId,
          parameterId: p[0],
          value: value.toString(),
        });
      }

      alert("Saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save");
    }
  };

  return (
    <div>
      <h2>Enter Report</h2>

      {params.map((p) => (
        <div key={p[0]} style={{ marginBottom: 10 }}>
          <label>
            {p[1]} ({p[2]}) [{p[3]}]
          </label>
          <br />
          <input
            value={values[p[0]] || ""}
            onChange={(e) => handleChange(p[0], e.target.value)}
            placeholder="Enter value"
          />
        </div>
      ))}

      <div style={{ marginTop: 20 }}>
        <button onClick={saveResults}>💾 Save / Update</button>

        <button
          onClick={() => onViewReport(orderId)}
          style={{ marginLeft: 10 }}
        >
          📄 View Report
        </button>

        <button onClick={onBack} style={{ marginLeft: 10 }}>
          ⬅ Back
        </button>
      </div>
    </div>
  );
}