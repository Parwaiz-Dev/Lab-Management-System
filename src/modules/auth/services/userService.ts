import { invoke } from "@tauri-apps/api/core";
import type { User } from "../../../types";

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
}

export const userService = {
  /** List all registered users (Admin only). */
  async listUsers(): Promise<User[]> {
    try {
      return await invoke<User[]>("list_users");
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to load users."));
    }
  },

  /** Create a new user (Admin only). */
  async createUser(username: string, password: string, role: string): Promise<User> {
    try {
      return await invoke<User>("create_user", { username, password, role });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to create user."));
    }
  },

  /** Toggle a user's active status (Admin only). */
  async toggleUserActive(userId: number): Promise<string> {
    try {
      return await invoke<string>("toggle_user_active", { userId });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to update user status."));
    }
  },
};