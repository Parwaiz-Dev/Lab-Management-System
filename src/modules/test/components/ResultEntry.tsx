import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type ResultParameterRow = [id: number, name: string, unit: string, normalRange: string];

type ResultEntryProps = {
  orderId: number;
  parameters: ResultParameterRow[];
};

export default function ResultEntry({ orderId, parameters }: ResultEntryProps) {
  const [values, setValues] = useState<Record<number, string>>({});

  const handleChange = (id: number, value: string) => {
    setValues({ ...values, [id]: value });
  };

  const saveAll = async () => {
    for (const param of parameters) {
      const value = values[param[0]];

      if (value) {
        await invoke("save_result", {
          orderId,
          parameterId: param[0],
          value,
        });
      }
    }

    alert("Results Saved");
  };

  return (
    <div>
      <h2>Enter Results</h2>

      {parameters.map((p) => (
        <div key={p[0]} style={{ marginBottom: 10 }}>
          <strong>{p[1]}</strong> ({p[2]}) [{p[3]}]

          <input
            style={{ marginLeft: 10 }}
            placeholder="Enter value"
            onChange={(e) => handleChange(p[0], e.target.value)}
          />
        </div>
      ))}

      <button onClick={saveAll}>Save Results</button>
    </div>
  );
}
