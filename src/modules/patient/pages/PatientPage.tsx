import { useState } from "react";
import PatientForm from "../components/PatientForm";
import TestSelector from "../../test/components/TestSelector";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import type { Patient } from "../../../types";

export default function PatientPage({
  onOpenReceipt,
}: {
  onOpenReceipt?: (id: number) => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  return (
    <div className="patient-intake-layout-v3">
      <Card
        title="Patient Details"
        eyebrow="Step 1"
        right={
          <Badge tone={selectedPatient ? "success" : "info"}>
            {selectedPatient ? "Selected" : "Ready"}
          </Badge>
        }
        className="patient-intake-layout-v3__patient patient-page__card patient-page__card--patient"
      >
        <PatientForm
          selectedPatient={selectedPatient}
          onSelectPatient={setSelectedPatient}
        />
      </Card>

      <TestSelector
        patient={selectedPatient}
        layout="visitGrid"
        onOpenReceipt={onOpenReceipt}
      />
    </div>
  );
}