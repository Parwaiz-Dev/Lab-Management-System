import { useState } from "react";
import PatientForm from "../components/PatientForm";
import TestSelector from "../../test/components/TestSelector";

import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";

export default function PatientPage() {
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  return (
    <div style={container}>
      
      {/* LEFT */}
      <div style={left}>
        
        {/* HEADER */}
        <div style={header}>
          <h2 style={title}>Lab Management</h2>
          <p style={subText}>
            Patient registration & billing workflow
          </p>
        </div>

        {/* PATIENT FORM */}
        <Card title="Patient Entry" right={<Badge>New</Badge>}>
          <PatientForm onSelectPatient={setSelectedPatient} />
        </Card>

        {/* ACTIVE PATIENT */}
        {selectedPatient && (
          <Card>
            <div style={activeRow}>
              <div>
                <div style={name}>{selectedPatient.name}</div>
                <div style={muted}>
                  ID: {selectedPatient.patient_code}
                </div>
              </div>

              <Badge>Active</Badge>
            </div>
          </Card>
        )}
      </div>

      {/* RIGHT */}
      <div style={right}>
        
        {/* TEST SELECTOR */}
        <Card title="Select Tests">
          {!selectedPatient ? (
            <div style={emptyState}>
              No patient selected <br />
              <span style={muted}>
                Select or create a patient first
              </span>
            </div>
          ) : (
            <TestSelector patient={selectedPatient} />
          )}
        </Card>

        {/* SUMMARY */}
        <Card title="Summary">
          <div style={summary}>
            <Row label="Status" value="Ready" success />
            <Row label="Mode" value="Offline" />
          </div>
        </Card>
      </div>
    </div>
  );
}

//
// 🧩 ROW
//
function Row({ label, value, success }: any) {
  return (
    <div style={row}>
      <span>{label}</span>
      <span style={{ color: success ? "#16a34a" : "#0f172a" }}>
        {value}
      </span>
    </div>
  );
}

//
// 🎨 MATCHED STYLES (YOUR SYSTEM)
//

const container = {
  display: "flex",
  gap: 12,                // tighter spacing
  height: "100%",
};

const left = {
  flex: 2,
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

const right = {
  flex: 1,
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

const header = {
  marginBottom: 4,
};

const title = {
  margin: 0,
  fontSize: 18,           // reduced (matches your UI)
};

const subText = {
  fontSize: 12,
  color: "#64748b",
  margin: 0,
};

const activeRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const name = {
  fontWeight: 600,
  fontSize: 13,
};

const muted = {
  fontSize: 11,
  color: "#64748b",
};

const emptyState = {
  padding: 8,
  borderRadius: 4,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  fontSize: 12,
};

const summary = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
};