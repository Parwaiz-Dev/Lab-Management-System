import { invoke } from "@tauri-apps/api/core";
import type { PatientHistoryResponse } from "../../../types";

function toErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
}

export const patientHistoryService = {
  async getPatientHistory(patientId: number): Promise<PatientHistoryResponse> {
    try {
      return await invoke<PatientHistoryResponse>("get_patient_history", {
        patientId,
      });
    } catch (error) {
      throw new Error(
        toErrorMessage(error, "Failed to load patient history"),
      );
    }
  },
};