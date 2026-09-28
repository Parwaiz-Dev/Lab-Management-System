import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
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
  const [presetToAdd, setPresetToAdd] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo_state")) {
      setSelectedPatient({
        id: 1,
        name: "Rohit Sharma",
        patient_code: "PID-2026-0001",
        age_value: 34,
        age_unit: "Years",
        gender: "Male",
        phone: "9876543210",
        referred_by: "Dr. Chavan",
      });
    }
  }, []);

  return (
    <div className="patient-intake-layout-v3">
      <Card
        icon={<UserRound size={18} />}
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
          onSelectPreset={(testName) => setPresetToAdd(testName)}
        />
      </Card>

      <TestSelector
        patient={selectedPatient}
        layout="visitGrid"
        onOpenReceipt={onOpenReceipt}
        presetToAdd={presetToAdd}
        onClearPreset={() => setPresetToAdd(null)}
        onResetPatient={() => {
          setSelectedPatient(null);
          setPresetToAdd(null);
        }}
      />
    </div>
  );
}