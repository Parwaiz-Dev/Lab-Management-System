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

function toErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
}

export const patientService = {
  async searchPatients(query: string): Promise<Patient[]> {
    const cleaned = query.trim();

    if (cleaned.length < 2) return [];

    try {
      return await invoke<Patient[]>("search_patients", { query: cleaned });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to search patients"));
    }
  },

  async getDoctors(): Promise<string[]> {
    try {
      return await invoke<string[]>("get_doctors");
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to load doctors"));
    }
  },

  async addDoctor(name: string): Promise<void> {
    const cleanedName = name.trim();

    try {
      await invoke("add_doctor", { name: cleanedName });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to add doctor"));
    }
  },

  async createPatient(payload: CreatePatientPayload): Promise<number> {
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
};
