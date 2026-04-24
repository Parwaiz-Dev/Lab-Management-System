import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// 📄 Professional Lab Report
export default function ReportPage({ orderId, onBack }: any) {
  // 📊 Report data
  const [data, setData] = useState<any[]>([]);

  // 👤 Patient
  const [patient, setPatient] = useState<any>(null);

  // ⚙️ Settings
  const [labName, setLabName] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [logo, setLogo] = useState("");

  // 🔄 Load all data
  useEffect(() => {
    loadReport();
    loadPatient();
    loadSettings();
  }, []);

  // 📊 Report values
  const loadReport = async () => {
    const res = await invoke("get_report", { orderId });
    setData(res as any[]);
  };

  // 👤 Patient details
  const loadPatient = async () => {
    const res = await invoke("get_patient_by_order", { orderId });
    setPatient(res);
  };

  // ⚙️ Settings
  const loadSettings = async () => {
    const name = await invoke("get_setting", { key: "lab_name" });
    const address = await invoke("get_setting", { key: "lab_address" });
    const logoPath = await invoke("get_setting", { key: "lab_logo" });

    setLabName(name as string);
    setLabAddress(address as string);
    setLogo(logoPath as string);
  };

  // 🖨️ Print
  const handlePrint = () => {
    window.print();
  };

  // 🔴 Abnormal logic
  const isAbnormal = (value: string, range: string) => {
    const num = parseFloat(value);
    const parts = range.split("-");
    if (parts.length !== 2) return false;

    const min = parseFloat(parts[0]);
    const max = parseFloat(parts[1]);

    return num < min || num > max;
  };

  return (
    <div style={{ padding: 20 }}>
      {/* 🖨️ Hide buttons while printing */}
      <style>
        {`
          @media print {
            button {
              display: none;
            }
          }
        `}
      </style>

      {/* 📄 REPORT */}
      <div
        id="report"
        style={{
          maxWidth: 800,
          margin: "auto",
          padding: 20,
          border: "1px solid #000",
          background: "#fff",
        }}
      >
        {/* 🏥 HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 15,
            marginBottom: 10,
          }}
        >
          {/* 🖼 LOGO */}
          {logo && (
            <img
              src={`file://${logo}`}
              alt="logo"
              style={{ width: 60, height: 60, objectFit: "contain" }}
            />
          )}

          {/* 🏥 LAB INFO */}
          <div>
            <h2 style={{ margin: 0 }}>🏥 {labName || "Lab Name"}</h2>
            <p style={{ margin: 0 }}>{labAddress || "Address"}</p>
          </div>
        </div>

        <hr />

        {/* 👤 PATIENT INFO */}
        <div style={{ marginBottom: 15 }}>
          <strong>Patient:</strong> {patient?.[0] || "---"} <br />
          <strong>Age:</strong> {patient?.[1] || "---"} <br />
          <strong>Gender:</strong> {patient?.[2] || "---"} <br />
          <strong>Date:</strong> {new Date().toLocaleDateString()}
        </div>

        {/* 📊 TABLE */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={cell}>Test</th>
              <th style={cell}>Value</th>
              <th style={cell}>Unit</th>
              <th style={cell}>Normal Range</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row, i) => {
              const abnormal = isAbnormal(row[1], row[3]);

              return (
                <tr key={i}>
                  <td style={cell}>{row[0]}</td>

                  <td
                    style={{
                      ...cell,
                      color: abnormal ? "red" : "black",
                      fontWeight: abnormal ? "bold" : "normal",
                    }}
                  >
                    {row[1]} {abnormal && "⚠"}
                  </td>

                  <td style={cell}>{row[2]}</td>
                  <td style={cell}>{row[3]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ✍️ SIGNATURE */}
        <div style={{ marginTop: 40, textAlign: "right" }}>
          <p>Doctor Signature</p>
          <div
            style={{
              borderTop: "1px solid black",
              width: 200,
              marginLeft: "auto",
            }}
          />
        </div>
      </div>

      {/* 🔘 ACTION BUTTONS */}
      <div style={{ marginTop: 20 }}>
        <button onClick={handlePrint}>🖨️ Print</button>
        <button onClick={onBack} style={{ marginLeft: 10 }}>
          ⬅ Back
        </button>
      </div>
    </div>
  );
}

// 🎨 TABLE CELL STYLE
const cell = {
  border: "1px solid #ccc",
  padding: "8px",
  textAlign: "left" as const,
};