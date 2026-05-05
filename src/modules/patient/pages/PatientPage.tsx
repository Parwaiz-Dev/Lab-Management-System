import { useState } from "react";
import PatientForm from "../components/PatientForm";
import TestSelector from "../../test/components/TestSelector";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import { colors } from "../../../components/ui/styles";
import type { Patient } from "../../../types";

export default function PatientPage({ onOpenReceipt }: { onOpenReceipt?: (id: number) => void }) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  return (
    <div style={layout}>
      <Card
        title="Patient Details"
        eyebrow="Step 1"
        right={<Badge tone={selectedPatient ? "success" : "info"}>{selectedPatient ? "Selected" : "Ready"}</Badge>}
        style={{ gridArea: "patient" }}
      >
        <PatientForm onSelectPatient={setSelectedPatient} />
      </Card>

      {selectedPatient ? (
        <TestSelector patient={selectedPatient} layout="visitGrid" onOpenReceipt={onOpenReceipt} />
      ) : (
        <>
          <Card title="Test Order" eyebrow="Step 2" right={<Badge tone="neutral">Waiting</Badge>} style={{ gridArea: "tests" }}>
            <EmptyState title="Waiting for patient" text="Test selection unlocks once the patient is active." />
          </Card>
          <Card title="Create Order" eyebrow="Billing" style={{ gridArea: "billing" }}>
            <EmptyState title="Waiting for patient" text="Test selection unlocks once the patient is active." />
          </Card>
        </>
      )}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={emptyState}>
      <div style={{ fontWeight: 800, color: colors.text }}>{title}</div>
      <div style={{ color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{text}</div>
    </div>
  );
}

const layout = {
  display: "grid",
  gridTemplateColumns: "minmax(560px, 1fr) minmax(390px, 0.62fr)",
  gridTemplateAreas: `
    "patient tests"
    "billing tests"
  `,
  gap: 14,
  alignItems: "start",
  maxWidth: 1280,
};

const emptyState = {
  border: `1px dashed ${colors.borderStrong}`,
  borderRadius: 8,
  padding: 14,
  background: colors.surfaceSoft,
};
