import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import Toast from "../../../components/ui/Toast";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import { colors } from "../../../components/ui/styles";
import type { Patient } from "../../../types";
import { getFirstError, hasErrors, validateDoctorName, validatePatientForm } from "../../../lib/validation";

interface PatientFormProps {
  onSelectPatient: (patient: Patient) => void;
}

export default function PatientForm({ onSelectPatient }: PatientFormProps) {
  const [name, setName] = useState("");
  const [ageValue, setAgeValue] = useState<number | null>(null);
  const [ageUnit, setAgeUnit] = useState<"Years" | "Months" | "Days">("Years");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [phone, setPhone] = useState("");
  const [referredBy, setReferredBy] = useState("Self");
  const [suggestions, setSuggestions] = useState<Patient[]>([]);
  const [isExisting, setIsExisting] = useState(false);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [newDoctor, setNewDoctor] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "warning" | "info") => {
    setToast({ message, type });
  };

  const loadDoctors = useCallback(async () => {
    try {
      const data = (await invoke("get_doctors")) as string[];
      setDoctors(data);
      if (referredBy !== "Self" && !data.includes(referredBy)) {
        setReferredBy("Self");
      }
    } catch (err) {
      console.error("Failed to load doctors:", err);
      showToast("Failed to load doctors", "error");
    }
  }, [referredBy]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const handleSearch = useCallback(async (value: string) => {
    setName(value);
    setIsExisting(false);
    setFormErrors({});

    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = (await invoke("search_patients", { query: value })) as Patient[];
      setSuggestions(results);
    } catch (err) {
      console.error("Search failed:", err);
      showToast("Failed to search patients", "error");
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const selectPatient = useCallback(
    (patient: Patient) => {
      setName(patient.name);
      setAgeValue(patient.age_value);
      setAgeUnit(patient.age_unit);
      setPhone(patient.phone || "");
      setGender(patient.gender);
      setReferredBy(patient.referred_by || "Self");
      setIsExisting(true);
      setSuggestions([]);
      setFormErrors({});
      onSelectPatient(patient);
    },
    [onSelectPatient]
  );

  const addNewDoctor = useCallback(async () => {
    const error = validateDoctorName(newDoctor);
    if (error) {
      showToast(error, "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await invoke("add_doctor", { name: newDoctor });
      showToast(`Doctor "${newDoctor}" added`, "success");
      setNewDoctor("");
      await loadDoctors();
      setReferredBy(newDoctor);
    } catch (err) {
      console.error("Failed to add doctor:", err);
      showToast(typeof err === "string" ? err : "Failed to add doctor", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [newDoctor, loadDoctors]);

  const savePatient = useCallback(async () => {
    const errors = validatePatientForm(name, ageValue, ageUnit, gender, phone);

    if (hasErrors(errors)) {
      setFormErrors(errors);
      showToast(getFirstError(errors) || "Please fix patient details", "error");
      return;
    }

    if (isExisting) {
      showToast("This patient is already selected", "warning");
      return;
    }

    try {
      setIsSubmitting(true);
      const patientId = (await invoke("create_patient", {
        name,
        ageValue,
        ageUnit,
        gender,
        phone: phone || null,
        referredBy: referredBy === "Self" ? null : referredBy,
      })) as number;

      const newPatient: Patient = {
        id: patientId,
        name,
        patient_code: `PID-${new Date().getFullYear()}-${String(patientId).padStart(4, "0")}`,
        age_value: ageValue,
        age_unit: ageUnit,
        gender,
        phone: phone || null,
        referred_by: referredBy === "Self" ? null : referredBy,
      };

      onSelectPatient(newPatient);
      showToast(`Patient "${name}" saved`, "success");
      setIsExisting(true);
      setSuggestions([]);
    } catch (err) {
      console.error("Failed to save patient:", err);
      showToast(typeof err === "string" ? err : "Failed to save patient", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [name, ageValue, ageUnit, gender, phone, referredBy, isExisting, onSelectPatient]);

  const clearForm = () => {
    setName("");
    setAgeValue(null);
    setPhone("");
    setGender("Male");
    setAgeUnit("Years");
    setReferredBy("Self");
    setIsExisting(false);
    setSuggestions([]);
    setFormErrors({});
  };

  return (
    <div style={container}>
      <div style={searchPanel}>
        <label style={label}>Find or create patient</label>
        <div style={searchRow}>
          <Input
            value={name}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={isSubmitting}
            placeholder="Type patient name"
            style={{ borderColor: formErrors.name ? colors.danger : colors.borderStrong }}
          />
          <Badge tone={isExisting ? "success" : name ? "info" : "neutral"}>
            {isSearching ? "Searching" : isExisting ? "Existing" : name ? "New" : "Idle"}
          </Badge>
        </div>
        {formErrors.name && <div style={errorText}>{formErrors.name}</div>}

        {suggestions.length > 0 && (
          <div style={suggestionsBox}>
            {suggestions.map((patient) => (
              <button key={patient.id} onClick={() => selectPatient(patient)} style={suggestionItem}>
                <span>
                  <strong>{patient.name}</strong>
                  <span style={{ color: colors.muted }}> · {patient.patient_code}</span>
                </span>
                <span style={{ color: colors.muted }}>
                  {patient.age_value} {patient.age_unit}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={grid}>
        <Field label="Age" error={formErrors.age}>
          <Input
            type="number"
            value={ageValue ?? ""}
            min={0}
            max={150}
            onChange={(e) => setAgeValue(e.target.value ? Number(e.target.value) : null)}
            disabled={isSubmitting}
            style={{ borderColor: formErrors.age ? colors.danger : colors.borderStrong }}
          />
        </Field>

        <Field label="Age Unit" error={formErrors.ageUnit}>
          <select
            value={ageUnit}
            onChange={(e) => setAgeUnit(e.target.value as "Years" | "Months" | "Days")}
            disabled={isSubmitting}
            style={selectStyle}
          >
            <option>Years</option>
            <option>Months</option>
            <option>Days</option>
          </select>
        </Field>

        <Field label="Gender" error={formErrors.gender}>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "Male" | "Female" | "Other")}
            disabled={isSubmitting}
            style={selectStyle}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </Field>

        <Field label="Phone" error={formErrors.phone}>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
            placeholder="Optional"
            style={{ borderColor: formErrors.phone ? colors.danger : colors.borderStrong }}
          />
        </Field>
      </div>

      <div style={doctorPanel}>
        <Field label="Referred By">
          <select value={referredBy} onChange={(e) => setReferredBy(e.target.value)} disabled={isSubmitting} style={selectStyle}>
            <option value="Self">Self</option>
            {doctors.map((doctor) => (
              <option key={doctor} value={doctor}>
                {doctor}
              </option>
            ))}
          </select>
        </Field>

        <div style={addDoctor}>
          <Input
            value={newDoctor}
            onChange={(e) => setNewDoctor(e.target.value)}
            disabled={isSubmitting}
            placeholder="Add referring doctor"
          />
          <Button onClick={addNewDoctor} variant="secondary" disabled={!newDoctor || isSubmitting}>
            Add
          </Button>
        </div>
      </div>

      <div style={actions}>
        <Button onClick={savePatient} disabled={!name || !ageValue || isExisting || isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Patient"}
        </Button>
        <Button onClick={clearForm} variant="secondary">
          Clear
        </Button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <div style={errorText}>{error}</div>}
    </div>
  );
}

const container = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const searchPanel = {
  position: "relative" as const,
};

const searchRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 8,
};

const label = {
  display: "block",
  color: colors.text,
  fontSize: 11,
  fontWeight: 800,
  marginBottom: 4,
};

const labelStyle = label;

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
  gap: 8,
};

const selectStyle = {
  width: "100%",
  minHeight: 32,
  padding: "5px 8px",
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 8,
  background: colors.surface,
  color: colors.text,
  fontSize: 13,
  outline: "none",
};

const suggestionsBox = {
  position: "absolute" as const,
  left: 0,
  right: 0,
  top: "calc(100% + 7px)",
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  boxShadow: "0 18px 40px rgba(20,33,61,0.14)",
  overflow: "hidden",
  zIndex: 30,
};

const suggestionItem = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  border: 0,
  borderBottom: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  cursor: "pointer",
  textAlign: "left" as const,
  fontSize: 13,
};

const doctorPanel = {
  display: "grid",
  gridTemplateColumns: "minmax(170px, 0.7fr) minmax(230px, 1fr)",
  gap: 8,
  alignItems: "end",
};

const addDoctor = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 8,
};

const actions = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 7,
  paddingTop: 0,
};

const errorText = {
  color: colors.danger,
  fontSize: 12,
  marginTop: 5,
};
