import { invoke } from "@tauri-apps/api/core";
import type { Patient } from "../../../types";

export type AgeUnit = "Years" | "Months" | "Days";
export type Gender = "Male" | "Female" | "Other";

export interface CreatePatientPayload {
  name: string;
  ageValue: number;
  ageUnit: AgeUnit;
  gender: Gender;
  phone: string | null;
  referredBy: string | null;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
    const values = Object.values(error);
    if (values.length > 0 && typeof values[0] === "string") {
      return values[0];
    }
  }
  return fallback;
}

const hasDesktopBridge = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MOCK_DOCTORS: string[] = ["Dr. Chavan", "Dr. A. Sharma", "Dr. K. Patel", "Dr. R. Deshmukh"];
const MOCK_PATIENTS: Patient[] = [
  {
    id: 1,
    name: "Rohit Sharma",
    patient_code: "PID-2026-0001",
    age_value: 34,
    age_unit: "Years",
    gender: "Male",
    phone: "9876543210",
    referred_by: "Dr. Chavan",
  },
  {
    id: 2,
    name: "Pooja Patil",
    patient_code: "PID-2026-0002",
    age_value: 28,
    age_unit: "Years",
    gender: "Female",
    phone: "9123456780",
    referred_by: "Self",
  },
  {
    id: 3,
    name: "Amit Kulkarni",
    patient_code: "PID-2026-0003",
    age_value: 45,
    age_unit: "Years",
    gender: "Male",
    phone: "9988776655",
    referred_by: "Dr. A. Sharma",
  },
];

export const patientService = {
  async searchPatients(query = ""): Promise<Patient[]> {
    const cleaned = query.trim();

    if (!hasDesktopBridge()) {
      if (!cleaned) return [...MOCK_PATIENTS];
      const q = cleaned.toLowerCase();
      return MOCK_PATIENTS.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.patient_code.toLowerCase().includes(q) ||
          (p.phone && p.phone.includes(q))
      );
    }

    try {
      return await invoke<Patient[]>("search_patients", { query: cleaned });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to search patients"));
    }
  },

  async getDoctors(): Promise<string[]> {
    if (!hasDesktopBridge()) {
      return [...MOCK_DOCTORS];
    }

    try {
      return await invoke<string[]>("get_doctors");
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to load doctors"));
    }
  },

  async addDoctor(name: string): Promise<void> {
    const cleanedName = name.trim();

    if (!hasDesktopBridge()) {
      if (!MOCK_DOCTORS.includes(cleanedName)) {
        MOCK_DOCTORS.push(cleanedName);
      }
      return;
    }

    try {
      await invoke("add_doctor", { name: cleanedName });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to add doctor"));
    }
  },

  async createPatient(payload: CreatePatientPayload): Promise<number> {
    if (!hasDesktopBridge()) {
      const newId = Math.floor(Date.now() % 10000);
      MOCK_PATIENTS.push({
        id: newId,
        name: payload.name.trim(),
        patient_code: `PID-${new Date().getFullYear()}-${String(newId).padStart(4, "0")}`,
        age_value: payload.ageValue,
        age_unit: payload.ageUnit,
        gender: payload.gender,
        phone: payload.phone?.trim() || null,
        referred_by: payload.referredBy?.trim() || null,
      });
      return newId;
    }

    try {
      return await invoke<number>("create_patient", {
        name: payload.name.trim(),
        ageValue: payload.ageValue,
        ageUnit: payload.ageUnit,
        gender: payload.gender,
        phone: payload.phone?.trim() || null,
        referredBy: payload.referredBy?.trim() || null,
      });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to create patient"));
    }
  },

  async updatePatient(id: number, payload: CreatePatientPayload): Promise<void> {
    if (!hasDesktopBridge()) {
      const idx = MOCK_PATIENTS.findIndex((p) => p.id === id);
      if (idx >= 0) {
        MOCK_PATIENTS[idx] = {
          ...MOCK_PATIENTS[idx],
          name: payload.name.trim(),
          age_value: payload.ageValue,
          age_unit: payload.ageUnit,
          gender: payload.gender,
          phone: payload.phone?.trim() || null,
          referred_by: payload.referredBy?.trim() || null,
        };
      }
      return;
    }

    try {
      await invoke("update_patient", {
        id,
        name: payload.name.trim(),
        ageValue: payload.ageValue,
        ageUnit: payload.ageUnit,
        gender: payload.gender,
        phone: payload.phone?.trim() || null,
        referredBy: payload.referredBy?.trim() || null,
      });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to update patient"));
    }
  },

  async deletePatient(id: number): Promise<void> {
    if (!hasDesktopBridge()) {
      const idx = MOCK_PATIENTS.findIndex((p) => p.id === id);
      if (idx >= 0) {
        MOCK_PATIENTS.splice(idx, 1);
      }
      return;
    }

    try {
      await invoke("delete_patient", { id });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to delete patient"));
    }
  },
};
