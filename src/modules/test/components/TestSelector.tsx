import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

export default function TestSelector({ patient }: any) {
  const [tests, setTests] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    const res = await invoke("get_tests");
    setTests(res as any[]);
    setFiltered(res as any[]);
  };

  const handleSearch = (value: string) => {
    setSearch(value);

    const f = tests.filter((t) =>
      t[1].toLowerCase().includes(value.toLowerCase())
    );

    setFiltered(f);
  };

  const addTest = (t: any) => {
    if (!selected.find((x) => x[0] === t[0])) {
      setSelected([...selected, t]);
    }
    setSearch("");
    setFiltered([]);
  };

  const removeTest = (id: number) => {
    setSelected(selected.filter((t) => t[0] !== id));
  };

  const total = selected.reduce((sum, t) => sum + t[2], 0);

  const saveOrder = async () => {
    if (!patient) {
      alert("Select patient first");
      return;
    }

    if (selected.length === 0) {
      alert("Select at least one test");
      return;
    }

    await invoke("create_order", {
      patientId: patient.id,
      testIds: selected.map((t) => t[0]),
      totalAmount: total,
    });

    alert("Order saved!");
    setSelected([]);
  };

  return (
    <div style={container}>
      {/* 🔍 SEARCH */}
      <div style={{ position: "relative" }}>
        <Input
          value={search}
          onChange={(e: any) => handleSearch(e.target.value)}
          placeholder="Search test..."
        />

        {/* DROPDOWN */}
        {search && filtered.length > 0 && (
          <div style={dropdown}>
            {filtered.map((t) => (
              <div key={t[0]} style={item} onClick={() => addTest(t)}>
                <span>{t[1]}</span>
                <span style={price}>₹{t[2]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SELECTED */}
      <div style={selectedBox}>
        {selected.length === 0 && (
          <div style={empty}>No tests selected</div>
        )}

        {selected.map((t) => (
          <div key={t[0]} style={row}>
            <span>{t[1]}</span>

            <span style={right}>
              ₹{t[2]}

              <span
                onClick={() => removeTest(t[0])}
                style={remove}
              >
                ✕
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={footer}>
        <span style={{ fontWeight: 600 }}>
          Total: ₹{total}
        </span>

        <Button onClick={saveOrder}>
          Save Order
        </Button>
      </div>
    </div>
  );
}

//
// 🎨 IMPROVED STYLES
//

const container = {
  fontSize: 13,
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const dropdown = {
  position: "absolute" as const,
  top: "100%",
  left: 0,
  right: 0,
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  maxHeight: 150,
  overflowY: "auto" as const,
  zIndex: 10,
};

const item = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 8px",
  cursor: "pointer",
};

const price = {
  color: "#64748b",
};

const selectedBox = {
  border: "1px solid #e2e8f0",
  borderRadius: 6,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 8px",
  borderBottom: "1px solid #f1f5f9",
};

const right = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const remove = {
  cursor: "pointer",
  color: "#ef4444",
  fontWeight: "bold",
};

const empty = {
  padding: 8,
  color: "#94a3b8",
};

const footer = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};