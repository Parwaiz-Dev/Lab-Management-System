import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, RotateCcw, Plus, X, Edit3 } from "lucide-react";
import Toast from "../../../components/ui/Toast";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import type { Patient, ToastMessage } from "../../../types";
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
  selectedPatient?: Patient | null;
  onSelectPatient: (patient: Patient | null) => void;
  onSelectPreset?: (testName: string) => void;
}

const POPULAR_PRESETS = [
  { label: "CBC", fullName: "CBC (Complete Blood Count)" },
  { label: "Lipid Profile", fullName: "Lipid Profile" },
  { label: "LFT", fullName: "Liver Function Test (LFT)" },
  { label: "KFT", fullName: "Kidney Function Test (KFT)" },
  { label: "Thyroid Profile", fullName: "Thyroid Profile T3 T4 TSH" },
  { label: "Sugar (FBS)", fullName: "Fasting Blood Sugar" },
  { label: "HbA1c", fullName: "HbA1c" },
  { label: "Urine Routine", fullName: "Urine Routine" },
  { label: "Dengue NS1", fullName: "Dengue NS1" },
  { label: "Widal Test", fullName: "Widal Test" },
];

export default function PatientForm({
  selectedPatient,
  onSelectPatient,
  onSelectPreset,
}: PatientFormProps) {
  const [name, setName] = useState("");
  const [ageValue, setAgeValue] = useState<number | null>(null);
  const [ageUnit, setAgeUnit] = useState<AgeUnit>("Years");
  const [gender, setGender] = useState<Gender>("Male");
  const [phone, setPhone] = useState("");
  const [referredBy, setReferredBy] = useState("Self");

  // Inline edit state for active patient
  const [isEditingActive, setIsEditingActive] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAgeVal, setEditAgeVal] = useState<number | "">("");
  const [editAgeUnit, setEditAgeUnit] = useState<AgeUnit>("Years");
  const [editGender, setEditGender] = useState<Gender>("Male");
  const [editPhone, setEditPhone] = useState("");
  const [isUpdatingActive, setIsUpdatingActive] = useState(false);

  const [suggestions, setSuggestions] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [newDoctor, setNewDoctor] = useState("");
  const [showAddDoctor, setShowAddDoctor] = useState(false);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctorSaving, setDoctorSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const requestRef = useRef(0);

  const isExisting = Boolean(selectedPatient);
  const cleanedName = name.trim();

  const showToast = useCallback((message: string, type: ToastMessage["type"]) => {
    setToast({ message, type });
  }, []);

  const loadDoctors = useCallback(async () => {
    try {
      const data = await patientService.getDoctors();

      const cleaned = Array.from(
        new Set(data.map((doctor) => doctor.trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      setDoctors(cleaned);
    } catch (err) {
      console.error("Failed to load doctors:", err);
      showToast("Failed to load doctors", "error");
    }
  }, [showToast]);

  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    const query = name.trim();

    if (isExisting || query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const timer = window.setTimeout(async () => {
      try {
        setIsSearching(true);

        const results = await patientService.searchPatients(query);

        if (requestRef.current === requestId) {
          setSuggestions(results);
        }
      } catch (err) {
        console.error("Search failed:", err);

        if (requestRef.current === requestId) {
          setSuggestions([]);
        }
      } finally {
        if (requestRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [name, isExisting]);

  const handleNameChange = (value: string) => {
    setName(value);
    setSuggestions([]);
    setFormErrors({});

    if (selectedPatient) {
      onSelectPatient(null);
    }
  };

  const selectPatient = (patient: Patient) => {
    onSelectPatient(patient);
    setName(patient.name);
    setAgeValue(patient.age_value ?? null);
    setAgeUnit((patient.age_unit as AgeUnit) || "Years");
    setGender((patient.gender as Gender) || "Male");
    setPhone(patient.phone || "");
    setReferredBy(patient.referred_by || "Self");
    setSuggestions([]);
    setFormErrors({});
  };

  const clearForm = () => {
    setName("");
    setAgeValue(null);
    setAgeUnit("Years");
    setGender("Male");
    setPhone("");
    setReferredBy("Self");
    setNewDoctor("");
    setShowAddDoctor(false);
    setSuggestions([]);
    setFormErrors({});
    onSelectPatient(null);
  };

  const addNewDoctor = async () => {
    const error = validateDoctorName(newDoctor);

    if (error) {
      showToast(error, "error");
      return;
    }

    try {
      setDoctorSaving(true);
      await patientService.addDoctor(newDoctor.trim());
      await loadDoctors();
      setReferredBy(newDoctor.trim());
      setNewDoctor("");
      setShowAddDoctor(false);
      showToast("Doctor added successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to add doctor", "error");
    } finally {
      setDoctorSaving(false);
    }
  };

  const savePatient = async () => {
    if (isExisting) {
      showToast("Patient already registered", "info");
      return;
    }

    const cleanedPhone = phone.trim();

    const errors = validatePatientForm(
      cleanedName,
      ageValue,
      ageUnit,
      gender,
      cleanedPhone
    );
    setFormErrors(errors);

    if (hasErrors(errors)) {
      showToast(getFirstError(errors) || "Please check patient details", "error");
      return;
    }

    if (ageValue === null) {
      showToast("Age is required", "error");
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
      setSuggestions([]);
      setFormErrors({});
      showToast(`Patient "${cleanedName}" saved`, "success");
    } catch (err: any) {
      console.error(err);
      showToast(typeof err === "string" ? err : err?.message || "Failed to save patient", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditingActive = () => {
    if (!selectedPatient) return;
    setEditName(selectedPatient.name || "");
    setEditAgeVal(selectedPatient.age_value ?? "");
    setEditAgeUnit((selectedPatient.age_unit as AgeUnit) || "Years");
    setEditGender((selectedPatient.gender as Gender) || "Male");
    setEditPhone(selectedPatient.phone || "");
    setIsEditingActive(true);
  };

  const saveEditingActive = async () => {
    if (!selectedPatient) return;
    if (!editName.trim()) {
      showToast("Patient name is required", "error");
      return;
    }
    const age = editAgeVal === "" ? 0 : Number(editAgeVal);
    if (age < 0 || age > 150) {
      showToast("Age must be between 0 and 150", "error");
      return;
    }

    try {
      setIsUpdatingActive(true);
      await patientService.updatePatient(selectedPatient.id, {
        name: editName.trim(),
        ageValue: age,
        ageUnit: editAgeUnit,
        gender: editGender,
        phone: editPhone.trim() || null,
        referredBy: selectedPatient.referred_by || null,
      });

      const updated: Patient = {
        ...selectedPatient,
        name: editName.trim(),
        age_value: age,
        age_unit: editAgeUnit,
        gender: editGender,
        phone: editPhone.trim() || null,
      };

      onSelectPatient(updated);
      setIsEditingActive(false);
      showToast("Patient details updated successfully", "success");
    } catch (err: any) {
      console.error(err);
      showToast(typeof err === "string" ? err : err?.message || "Failed to update patient", "error");
    } finally {
      setIsUpdatingActive(false);
    }
  };

  return (
    <div className="patient-form-container">
      {selectedPatient ? (
        /* Rich Active Patient Banner */
        <div className="patient-active-summary-card">
          <div className="patient-active-summary-card__header">
            <div>
              <div className="patient-active-summary-card__name">{selectedPatient.name}</div>
              <div className="patient-active-summary-card__code">
                {selectedPatient.patient_code || `PID #${selectedPatient.id}`}
              </div>
            </div>
            <Badge tone="success" size="sm">Active Patient</Badge>
          </div>

          {isEditingActive ? (
            /* Inline Edit Active Patient Form */
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0", borderTop: "1px solid var(--color-border-light)", borderBottom: "1px solid var(--color-border-light)", marginTop: 4, marginBottom: 4 }}>
              <div>
                <label className="form-label" style={{ fontSize: 11, marginBottom: 2 }}>Full Name *</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Patient name"
                  sizeVariant="sm"
                  disabled={isUpdatingActive}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 2 }}>Age & Unit *</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Input
                      type="number"
                      value={editAgeVal}
                      min={0}
                      max={150}
                      onChange={(e) => setEditAgeVal(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Age"
                      sizeVariant="sm"
                      style={{ flex: 1, minWidth: 45 }}
                      disabled={isUpdatingActive}
                    />
                    <select
                      value={editAgeUnit}
                      onChange={(e) => setEditAgeUnit(e.target.value as AgeUnit)}
                      disabled={isUpdatingActive}
                      className="ui-input ui-input--sm"
                      style={{ width: 68 }}
                    >
                      <option value="Years">Yrs</option>
                      <option value="Months">Mths</option>
                      <option value="Days">Days</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 2 }}>Gender *</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as Gender)}
                    disabled={isUpdatingActive}
                    className="ui-input ui-input--sm"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11, marginBottom: 2 }}>Mobile Number</label>
                <Input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Mobile number (optional)"
                  sizeVariant="sm"
                  disabled={isUpdatingActive}
                />
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={saveEditingActive}
                  loading={isUpdatingActive}
                  disabled={!editName.trim() || editAgeVal === ""}
                  style={{ flex: 1 }}
                >
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditingActive(false)}
                  disabled={isUpdatingActive}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="patient-active-summary-card__details">
              <div className="patient-active-summary-card__row">
                <span className="patient-active-label">Demographics:</span>
                <span className="patient-active-val">
                  {selectedPatient.age_value ?? "-"} {selectedPatient.age_unit || "Years"} • {selectedPatient.gender}
                </span>
              </div>
              <div className="patient-active-summary-card__row">
                <span className="patient-active-label">Mobile:</span>
                <span className="patient-active-val">
                  {selectedPatient.phone ? `📞 ${selectedPatient.phone}` : "Not provided"}
                </span>
              </div>
              {/* Editable Doctor Selection for This Visit */}
              <div style={{ borderTop: "1px solid var(--color-border-light)", paddingTop: 6, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <label className="form-label" htmlFor="patient-active-referred-by" style={{ margin: 0, fontSize: 11 }}>
                    Referring Doctor (This Visit)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddDoctor((prev) => !prev)}
                    style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}
                  >
                    {showAddDoctor ? <X size={11} /> : <Plus size={11} />}
                    <span>{showAddDoctor ? "Cancel" : "New Dr"}</span>
                  </button>
                </div>

                <select
                  id="patient-active-referred-by"
                  value={referredBy}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReferredBy(val);
                    onSelectPatient({
                      ...selectedPatient,
                      referred_by: val === "Self" ? null : val,
                    });
                  }}
                  disabled={isSubmitting}
                  className="ui-input ui-input--sm"
                  style={{ width: "100%" }}
                >
                  <option value="Self">Self (Direct Patient)</option>
                  {doctors.map((doctor) => (
                    <option key={doctor} value={doctor}>
                      {doctor}
                    </option>
                  ))}
                </select>

                {showAddDoctor && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <Input
                      value={newDoctor}
                      onChange={(e) => setNewDoctor(e.target.value)}
                      disabled={isSubmitting || doctorSaving}
                      placeholder="Dr. Full Name & Degree"
                      sizeVariant="sm"
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={async () => {
                        const docName = newDoctor.trim();
                        await addNewDoctor();
                        if (docName) {
                          onSelectPatient({
                            ...selectedPatient,
                            referred_by: docName,
                          });
                        }
                      }}
                      variant="primary"
                      size="sm"
                      loading={doctorSaving}
                      disabled={!newDoctor.trim() || isSubmitting}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="patient-active-summary-card__actions" style={{ display: "flex", gap: 6 }}>
            {!isEditingActive && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={startEditingActive}
                icon={<Edit3 size={12} />}
                style={{ flex: 1 }}
              >
                Edit Info
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={clearForm}
              icon={<RotateCcw size={12} />}
              style={{ flex: isEditingActive ? 1 : 1 }}
            >
              Change Patient
            </Button>
          </div>
        </div>
      ) : (
        /* Patient Entry / Search Form */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Search or Create Row */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <label className="form-label" htmlFor="patient-name" style={{ margin: 0 }}>
                Patient Name
              </label>
              <Badge tone={name ? "info" : "neutral"} size="sm">
                {isSearching
                  ? "Searching..."
                  : name
                    ? "New Patient"
                    : "Type to Search"}
              </Badge>
            </div>

            <div style={{ position: "relative" }}>
              <Input
                id="patient-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isSubmitting}
                placeholder="Search existing or enter new patient name..."
                sizeVariant="sm"
                invalid={Boolean(formErrors.name)}
                autoComplete="off"
              />

              {suggestions.length > 0 && (
                <div
                  className="patient-suggestions"
                  role="listbox"
                  aria-label="Patient suggestions"
                  style={{ position: "absolute", left: 0, right: 0, zIndex: 30 }}
                >
                  <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "var(--color-muted)", background: "var(--color-surface-soft)" }}>
                    MATCHING PATIENT RECORDS ({suggestions.length})
                  </div>
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p)}
                      className="patient-suggestion"
                      role="option"
                    >
                      <span className="patient-suggestion__main">
                        <strong>{p.name}</strong>
                        <span>{p.patient_code || `ID #${p.id}`} {p.phone ? `• 📞 ${p.phone}` : ""}</span>
                      </span>

                      <span className="patient-suggestion__meta">
                        <Badge tone="neutral">{p.age_value ?? "-"} {p.age_unit || ""} • {p.gender}</Badge>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {formErrors.name && <div className="form-error">{formErrors.name}</div>}
          </div>

          {/* Compact Demographic Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Age" error={formErrors.age} htmlFor="patient-age">
              <div style={{ display: "flex", gap: 4 }}>
                <Input
                  id="patient-age"
                  type="number"
                  value={ageValue ?? ""}
                  min={0}
                  max={150}
                  onChange={(e) =>
                    setAgeValue(e.target.value === "" ? null : Number(e.target.value))
                  }
                  disabled={isSubmitting}
                  invalid={Boolean(formErrors.age)}
                  placeholder="Age"
                  sizeVariant="sm"
                  style={{ flex: "1 1 50px", minWidth: 50 }}
                />
                <select
                  id="patient-age-unit"
                  value={ageUnit}
                  onChange={(e) => setAgeUnit(e.target.value as AgeUnit)}
                  disabled={isSubmitting}
                  className="ui-input ui-input--sm"
                  style={{ width: 68 }}
                >
                  <option value="Years">Yrs</option>
                  <option value="Months">Mths</option>
                  <option value="Days">Days</option>
                </select>
              </div>
            </Field>

            <Field label="Gender" error={formErrors.gender} htmlFor="patient-gender">
              <select
                id="patient-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                disabled={isSubmitting}
                className="ui-input ui-input--sm"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>

          {/* Phone Field */}
          <Field label="Mobile / Contact" error={formErrors.phone} htmlFor="patient-phone">
            <Input
              id="patient-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
              placeholder="10-digit mobile number (optional)"
              invalid={Boolean(formErrors.phone)}
              sizeVariant="sm"
            />
          </Field>

          {/* Referring Doctor with inline quick-add */}
          <div style={{ borderTop: "1px solid var(--color-border-light)", paddingTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <label className="form-label" htmlFor="patient-referred-by" style={{ margin: 0 }}>
                Referring Doctor
              </label>
              <button
                type="button"
                onClick={() => setShowAddDoctor((prev) => !prev)}
                style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}
              >
                {showAddDoctor ? <X size={12} /> : <Plus size={12} />}
                <span>{showAddDoctor ? "Cancel" : "New Dr"}</span>
              </button>
            </div>

            <select
              id="patient-referred-by"
              value={referredBy}
              onChange={(e) => setReferredBy(e.target.value)}
              disabled={isSubmitting}
              className="ui-input ui-input--sm"
            >
              <option value="Self">Self (Direct Patient)</option>
              {doctors.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {doctor}
                </option>
              ))}
            </select>

            {showAddDoctor && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <Input
                  value={newDoctor}
                  onChange={(e) => setNewDoctor(e.target.value)}
                  disabled={isSubmitting || doctorSaving}
                  placeholder="Dr. Full Name & Degree"
                  sizeVariant="sm"
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={addNewDoctor}
                  variant="primary"
                  size="sm"
                  loading={doctorSaving}
                  disabled={!newDoctor.trim() || isSubmitting}
                >
                  Save
                </Button>
              </div>
            )}
          </div>

          {/* Form Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, paddingTop: 6, borderTop: "1px solid var(--color-border-light)" }}>
            <Button
              type="button"
              onClick={savePatient}
              loading={isSubmitting}
              disabled={!cleanedName || ageValue === null}
              variant="primary"
              size="sm"
              icon={<Check size={13} />}
              style={{ flex: 1 }}
            >
              Register & Select
            </Button>

            <Button
              type="button"
              onClick={clearForm}
              variant="secondary"
              size="sm"
              disabled={isSubmitting}
              icon={<RotateCcw size={13} />}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Quick Test Presets (Fills lower workspace of Card 1) */}
      <div className="patient-presets-panel">
        <div className="patient-presets-panel__header">
          <span>⚡ Fast Test Presets</span>
          <span className="patient-presets-panel__hint">Click to add to order</span>
        </div>
        <div className="patient-presets-panel__chips">
          {POPULAR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="patient-preset-chip"
              onClick={() => onSelectPreset?.(preset.fullName)}
              title={`Quickly add ${preset.fullName} to test order`}
            >
              <Plus size={10} />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
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
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label className="form-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}