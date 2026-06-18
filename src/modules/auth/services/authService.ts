import { invoke } from "@tauri-apps/api/core";
import type { LoginResponse, SessionInfo } from "../../../types";

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
}

export const authService = {
  /** Authenticate with username + password. Returns user info on success. */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      return await invoke<LoginResponse>("login", { username, password });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Login failed. Check credentials."));
    }
  },

  /** Log out the current session. */
  async logout(): Promise<void> {
    try {
      await invoke<string>("logout");
    } catch (error) {
      throw new Error(toErrorMessage(error, "Logout failed."));
    }
  },

  /** Get the active session (null if nobody is logged in). */
  async getCurrentSession(): Promise<SessionInfo | null> {
    try {
      return await invoke<SessionInfo | null>("get_current_session");
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to check session."));
    }
  },
};