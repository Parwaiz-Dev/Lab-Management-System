import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";



export default function PatientForm({ onSelectPatient }: any) {
  const [name, setName] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isExisting, setIsExisting] = useState(false);

  const [ageValue, setAgeValue] = useState<number | null>(null);
  const [ageUnit, setAgeUnit] = useState("Years");

  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Male");
  const [referredBy, setReferredBy] = useState("Dr. Sharma");

  const [doctors, setDoctors] = useState<string[]>([]);
  const [newDoctor, setNewDoctor] = useState("");

  // ✅ Load doctors on component mount
  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const data = await invoke("get_doctors");
      setDoctors(data as string[]);
    } catch (err) {
      console.error("Failed to load doctors:", err);
    }
  };

  // 🔍 Search patients
  const handleSearch = async (value: string) => {
    setName(value);
    setIsExisting(false);

    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const results = await invoke("search_patients", { query: value });
      setSuggestions(results as any[]);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Select existing patient
  const selectPatient = (p: any) => {
    setName(p.name);
    setAgeValue(p.age_value);
    setAgeUnit(p.age_unit || "Years");
    setPhone(p.phone || "");
    setGender(p.gender || "Male");
    setReferredBy(p.referred_by || "Dr. Sharma");

    setIsExisting(true);
    setSuggestions([]);
    onSelectPatient(p);
  };

  // ➕ Add new doctor
  const addNewDoctor = async () => {
    if (!newDoctor) return;

    try {
      await invoke("add_doctor", { name: newDoctor });
      setNewDoctor("");
      loadDoctors();
    } catch (err) {
      console.error(err);
    }
  };

  // 💾 Save patient
  const savePatient = async () => {
    if (!name) {
      alert("Name is required");
      return;
    }

    if (isExisting) {
      alert("Patient already exists");
      return;
    }

    try {
      const id = await invoke("create_patient", {
        name,
        ageValue,
        ageUnit,
        gender,
        phone: phone || null,
        referredBy,
    });

onSelectPatient({
  id,
  name,
  patient_code: "PID"
});
      

      // Reset form
      setName("");
      setAgeValue(null);
      setPhone("");
      setIsExisting(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h2>Patient Entry</h2>

      {/* 🔍 Name Search */}
      <input
        placeholder="Search or enter name"
        value={name}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ border: "1px solid #ccc", marginTop: 5 }}>
          {suggestions.map((p) => (
            <div
              key={p.id}
              onClick={() => selectPatient(p)}
              style={{ padding: 5, cursor: "pointer" }}
            >
              {p.name} ({p.patient_code})
            </div>
          ))}
        </div>
      )}

      {/* New patient indicator */}
      {name && suggestions.length === 0 && !isExisting && (
        <div style={{ color: "green", marginTop: 5 }}>
          ➕ New Patient will be created
        </div>
      )}

      {/* Age */}
      <div>
        <input
          type="number"
          placeholder="Age"
          value={ageValue ?? ""}
          onChange={(e) => setAgeValue(Number(e.target.value))}
        />

        <select value={ageUnit} onChange={(e) => setAgeUnit(e.target.value)}>
          <option>Years</option>
          <option>Months</option>
          <option>Days</option>
        </select>
      </div>

      {/* Gender */}
      <div>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
      </div>

      {/* Phone */}
      <div>
        <input
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      {/* 🧑‍⚕️ Referral (Dynamic Doctors) */}
      <div>
        <label>Referred By:</label>

        <select
          value={referredBy}
          onChange={(e) => setReferredBy(e.target.value)}
        >
          <option>Self</option>
          {doctors.map((doc) => (
            <option key={doc}>{doc}</option>
          ))}
        </select>

        {/* Add new doctor */}
        <div style={{ marginTop: 5 }}>
          <input
            placeholder="Add new doctor"
            value={newDoctor}
            onChange={(e) => setNewDoctor(e.target.value)}
          />
          <button onClick={addNewDoctor}>Add</button>
        </div>
      </div>

      {/* Save */}
      <button onClick={savePatient} style={{ marginTop: 10 }}>
        {isExisting ? "Existing Patient" : "Save New Patient"}
      </button>
    </div>
  );
}
