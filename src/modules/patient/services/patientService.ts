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

export const patientService = {
  searchPatients(query: string) {
    return invoke<Patient[]>("search_patients", { query });
  },

  getDoctors() {
    return invoke<string[]>("get_doctors");
  },

  addDoctor(name: string) {
    return invoke<void>("add_doctor", { name });
  },

  createPatient(payload: CreatePatientPayload) {
    return invoke<number>("create_patient", payload);
  },
};
