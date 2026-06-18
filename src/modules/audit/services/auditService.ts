import { invoke } from "@tauri-apps/api/core";
import type { AuditLogEntry } from "../../../types";

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as Record<string, unknown>).message);
  }
  return fallback;
}

export const auditService = {
  async getAuditLogs(params: {
    tableName?: string;
    recordId?: number;
    userId?: number;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    try {
      return await invoke<AuditLogEntry[]>("get_audit_logs", {
        tableName: params.tableName ?? null,
        recordId: params.recordId ?? null,
        userId: params.userId ?? null,
        limit: params.limit ?? null,
        offset: params.offset ?? null,
      });
    } catch (error) {
      throw new Error(toErrorMessage(error, "Failed to fetch audit logs"));
    }
  },

  async getRecordHistory(
    tableName: string,
    recordId: number,
  ): Promise<AuditLogEntry[]> {
    try {
      return await invoke<AuditLogEntry[]>("get_record_history", {
        tableName,
        recordId,
      });
    } catch (error) {
      throw new Error(
        toErrorMessage(error, "Failed to fetch record history"),
      );
    }
  },

  async getUserActivity(userId: number): Promise<AuditLogEntry[]> {
    try {
      return await invoke<AuditLogEntry[]>("get_user_activity", {
        userId,
      });
    } catch (error) {
      throw new Error(
        toErrorMessage(error, "Failed to fetch user activity"),
      );
    }
  },
};