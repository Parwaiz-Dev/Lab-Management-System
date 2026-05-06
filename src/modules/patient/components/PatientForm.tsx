import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Toast from "../../../components/ui/Toast";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import type { Patient } from "../../../types";
import {
  getFirstError,
  hasErrors,
  validateDoctorName,
  validatePatientForm,
} from "../../../lib/validation";
import {
  patientService,
  type AgeUnit,
  type Gender,
} from "../services/patientService";

interface PatientFormProps {
  onSelectPatient: (patient: Patient) => void;
}

type ToastState = {
  message: string;
  type: "success" | "error" | "warning" | "info";
};

export default function PatientForm({ onSelectPatient }: PatientFormProps) {
  const [name, setName] = useState("");
  const [ageValue, setAgeValue] = useState<number | null>(null);
  const [ageUnit, setAgeUnit] = useState<AgeUnit>("Years");
  const [gender, setGender] = useState<Gender>("Male");
  const [phone, setPhone] = useState("");
  const [referredBy, setReferredBy] = useState("Self");

  const [suggestions, setSuggestions] = useState<Patient[]>([]);
  const [isExisting, setIsExisting] = useState(false);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [newDoctor, setNewDoctor] = useState("");

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastState["type"]) => {
    setToast({ message, type });
  }, []);

  const loadDoctors = useCallback(async () => {
    try {
      const data = await patientService.getDoctors();
      setDoctors(data);
    } catch (err) {
      console.error("Failed to load doctors:", err);
      showToast("Failed to load doctors", "error");
    }
  }, [showToast]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    const query = name.trim();

    if (isExisting || query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await patientService.searchPatients(query);

        if (!cancelled) {
          setSuggestions(results);
        }
      } catch (err) {
        console.error("Search failed:", err);

        if (!cancelled) {
          setSuggestions([]);
          showToast("Failed to search patients", "error");
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [name, isExisting, showToast]);

  const handleNameChange = (value: string) => {
    setName(value);
    setIsExisting(false);
    setFormErrors({});
  };

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
    const cleanedDoctor = newDoctor.trim();
    const error = validateDoctorName(cleanedDoctor);

    if (error) {
      showToast(error, "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await patientService.addDoctor(cleanedDoctor);
      await loadDoctors();

      setNewDoctor("");
      setReferredBy(cleanedDoctor);
      showToast(`Doctor "${cleanedDoctor}" added`, "success");
    } catch (err) {
      console.error("Failed to add doctor:", err);
      showToast(typeof err === "string" ? err : "Failed to add doctor", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [newDoctor, loadDoctors, showToast]);

  const savePatient = useCallback(async () => {
    const cleanedName = name.trim();
    const cleanedPhone = phone.trim();

    const errors = validatePatientForm(
      cleanedName,
      ageValue,
      ageUnit,
      gender,
      cleanedPhone
    );

    if (hasErrors(errors)) {
      setFormErrors(errors);
      showToast(getFirstError(errors) || "Please fix patient details", "error");
      return;
    }

    if (ageValue === null) {
      showToast("Age is required", "error");
      return;
    }

    if (isExisting) {
      showToast("This patient is already selected", "warning");
      return;
    }

    try {
      setIsSubmitting(true);

      const patientId = await patientService.createPatient({
        name: cleanedName,
        ageValue,
        ageUnit,
        gender,
        phone: cleanedPhone || null,
        referredBy: referredBy === "Self" ? null : referredBy,
      });

      const newPatient: Patient = {
        id: patientId,
        name: cleanedName,
        patient_code: `PID-${new Date().getFullYear()}-${String(patientId).padStart(4, "0")}`,
        age_value: ageValue,
        age_unit: ageUnit,
        gender,
        phone: cleanedPhone || null,
        referred_by: referredBy === "Self" ? null : referredBy,
      };

      onSelectPatient(newPatient);
      setIsExisting(true);
      setSuggestions([]);
      showToast(`Patient "${cleanedName}" saved`, "success");
    } catch (err) {
      console.error("Failed to save patient:", err);
      showToast(typeof err === "string" ? err : "Failed to save patient", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    name,
    ageValue,
    ageUnit,
    gender,
    phone,
    referredBy,
    isExisting,
    onSelectPatient,
    showToast,
  ]);

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
    <div className="patient-form">
      <div className="patient-form__search">
        <label className="form-label" htmlFor="patient-name">
          Find or create patient
        </label>

        <div className="patient-form__search-row">
          <Input
            id="patient-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            disabled={isSubmitting}
            placeholder="Type patient name"
            invalid={Boolean(formErrors.name)}
            autoComplete="off"
          />

          <Badge tone={isExisting ? "success" : name ? "info" : "neutral"}>
            {isSearching ? "Searching" : isExisting ? "Existing" : name ? "New" : "Idle"}
          </Badge>
        </div>

        {formErrors.name && <div className="form-error">{formErrors.name}</div>}

        {suggestions.length > 0 && (
          <div className="patient-suggestions" role="listbox" aria-label="Patient suggestions">
            {suggestions.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => selectPatient(patient)}
                className="patient-suggestion"
                role="option"
              >
                <span className="patient-suggestion__main">
                  <strong>{patient.name}</strong>
                  <span>{patient.patient_code}</span>
                </span>

                <span className="patient-suggestion__meta">
                  {patient.age_value} {patient.age_unit}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="patient-form__grid">
        <Field label="Age" error={formErrors.age} htmlFor="patient-age">
          <Input
            id="patient-age"
            type="number"
            value={ageValue ?? ""}
            min={0}
            max={150}
            onChange={(e) => setAgeValue(e.target.value === "" ? null : Number(e.target.value))}
            disabled={isSubmitting}
            invalid={Boolean(formErrors.age)}
          />
        </Field>

        <Field label="Age Unit" error={formErrors.ageUnit} htmlFor="patient-age-unit">
          <select
            id="patient-age-unit"
            value={ageUnit}
            onChange={(e) => setAgeUnit(e.target.value as AgeUnit)}
            disabled={isSubmitting}
            className={[
              "ui-input",
              formErrors.ageUnit ? "ui-input--invalid" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <option>Years</option>
            <option>Months</option>
            <option>Days</option>
          </select>
        </Field>

        <Field label="Gender" error={formErrors.gender} htmlFor="patient-gender">
          <select
            id="patient-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender)}
            disabled={isSubmitting}
            className={[
              "ui-input",
              formErrors.gender ? "ui-input--invalid" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </Field>

        <Field label="Phone" error={formErrors.phone} htmlFor="patient-phone">
          <Input
            id="patient-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
            placeholder="Optional"
            invalid={Boolean(formErrors.phone)}
          />
        </Field>
      </div>

      <div className="patient-form__doctor-panel">
        <Field label="Referred By" htmlFor="patient-referred-by">
          <select
            id="patient-referred-by"
            value={referredBy}
            onChange={(e) => setReferredBy(e.target.value)}
            disabled={isSubmitting}
            className="ui-input"
          >
            <option value="Self">Self</option>

            {doctors.map((doctor) => (
              <option key={doctor} value={doctor}>
                {doctor}
              </option>
            ))}
          </select>
        </Field>

        <div className="patient-form__add-doctor">
          <Input
            value={newDoctor}
            onChange={(e) => setNewDoctor(e.target.value)}
            disabled={isSubmitting}
            placeholder="Add referring doctor"
          />

          <Button
            onClick={addNewDoctor}
            variant="secondary"
            disabled={!newDoctor.trim() || isSubmitting}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="patient-form__actions">
        <Button
          onClick={savePatient}
          loading={isSubmitting}
          disabled={!name.trim() || ageValue === null || isExisting}
        >
          {isSubmitting ? "Saving..." : "Save Patient"}
        </Button>

        <Button onClick={clearForm} variant="secondary" disabled={isSubmitting}>
          Clear
        </Button>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="form-field">
      <label className="form-label" htmlFor={htmlFor}>
        {label}
      </label>

      {children}

      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
