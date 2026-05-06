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
    <div
      className={[
        "patient-page",
        selectedPatient ? "patient-page--has-patient" : "patient-page--locked",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Card
        title="Patient Details"
        eyebrow="Step 1"
        right={
          <Badge tone={selectedPatient ? "success" : "info"}>
            {selectedPatient ? "Selected" : "Ready"}
          </Badge>
        }
        className="patient-page__card patient-page__card--patient"
      >
        <PatientForm onSelectPatient={setSelectedPatient} />
      </Card>

      {selectedPatient ? (
        <TestSelector
          patient={selectedPatient}
          layout="visitGrid"
          onOpenReceipt={onOpenReceipt}
        />
      ) : (
        <>
          <Card
            title="Test Order"
            eyebrow="Step 2"
            right={<Badge tone="neutral">Waiting</Badge>}
            className="patient-page__card patient-page__card--tests"
          >
            <EmptyState
              title="Waiting for patient"
              text="Select an existing patient or create a new one to unlock test selection."
            />
          </Card>

          <Card
            title="Billing"
            eyebrow="Create Order"
            right={<Badge tone="neutral">Locked</Badge>}
            className="patient-page__card patient-page__card--billing"
            compact
          >
            <EmptyState
              title="Billing locked"
              text="Billing becomes available after patient and test selection."
            />
          </Card>
        </>
      )}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">+</div>
      <div className="empty-state__title">{title}</div>
      <div className="empty-state__text">{text}</div>
    </div>
  );
}