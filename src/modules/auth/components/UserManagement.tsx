import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, RefreshCw, UserPlus, Users } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import type { User, ToastMessage, SessionInfo } from "../../../types";
import { userService } from "../../auth/services/userService";
import { authService } from "../services/authService";

interface UserManagementProps {
  showToast: (message: string, type: ToastMessage["type"]) => void;
  currentSession?: SessionInfo | null;
}

export default function UserManagement({ showToast, currentSession }: UserManagementProps) {
  const [session, setSession] = useState<SessionInfo | null>(currentSession ?? null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  // ── Create form ──
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("staff");

  // ── Reset Password Modal state ──
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (currentSession) {
      setSession(currentSession);
    } else {
      void authService.getCurrentSession().then(setSession).catch(() => {});
    }
  }, [currentSession]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userService.listUsers();
      setUsers(data);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load users",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUsername.trim() || !newPassword.trim()) {
      showToast("Username and password are required", "warning");
      return;
    }

    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters", "warning");
      return;
    }

    try {
      setCreating(true);
      await userService.createUser(newUsername.trim(), newPassword, newRole);
      showToast(`User "${newUsername.trim()}" created`, "success");
      setNewUsername("");
      setNewPassword("");
      setNewRole("staff");
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to create user",
        "error"
      );
    } finally {
      setCreating(false);
    }
  };

  const activeAdminCount = users.filter(
    (u) => u.role === "admin" && u.is_active
  ).length;

  const handleToggleClick = (user: User) => {
    if (user.is_active) {
      const isSelf = Boolean(session && user.id === session.user_id);
      if (isSelf) {
        showToast("You cannot deactivate your own administrator account.", "error");
        return;
      }
      if (user.role === "admin" && activeAdminCount <= 1) {
        showToast(
          "The last active administrator cannot be deactivated. Create another administrator first.",
          "error"
        );
        return;
      }
      setDeactivatingUser(user);
    } else {
      void executeToggleActive(user);
    }
  };

  const executeToggleActive = async (user: User) => {
    try {
      setTogglingUserId(user.id);
      const msg = await userService.toggleUserActive(user.id);
      showToast(
        msg || (user.is_active
          ? `User "${user.username}" deactivated`
          : `User "${user.username}" activated`),
        "success"
      );
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update user",
        "error"
      );
    } finally {
      setTogglingUserId(null);
      setDeactivatingUser(null);
    }
  };

  const openResetModal = (user: User) => {
    setResetUser(user);
    setResetPassword("");
    setResetConfirmPassword("");
    setShowResetPassword(false);
    setShowResetConfirm(false);
    setResetError("");
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    setResetError("");

    if (!resetPassword) {
      setResetError("New password is required.");
      return;
    }
    if (resetPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    try {
      setResetLoading(true);
      const msg = await userService.adminResetPassword(resetUser.id, resetPassword);
      showToast(
        msg || `Password reset for "${resetUser.username}". They must change it upon next login.`,
        "success"
      );
      setResetUser(null);
      await loadUsers();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <Card
      icon={<Users size={18} />}
      title="User Management"
      eyebrow="Admin access controls & staff accounts"
      className="user-management-card"
      right={
        <Button onClick={loadUsers} variant="outline" size="sm" disabled={loading} icon={<RefreshCw size={14} />}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      }
    >
      {/* ── Compact Create User Form ── */}
      <form className="user-management-create" onSubmit={handleCreateUser}>
        <div className="user-management-create__title">
          <UserPlus size={16} className="text-indigo-600" />
          <span>Add New System User</span>
        </div>

        <div className="user-management-create__row">
          <div className="user-management-create__field">
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Username"
              disabled={creating}
              autoComplete="off"
            />
          </div>

          <div className="user-management-create__field">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password (min 8 chars)"
              disabled={creating}
              autoComplete="new-password"
            />
          </div>

          <div className="user-management-create__role-field">
            <select
              className="user-management-create__select"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              disabled={creating}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={creating || !newUsername.trim() || newPassword.length < 8}
            icon={<UserPlus size={14} />}
          >
            {creating ? "Creating..." : "Create User"}
          </Button>
        </div>
      </form>

      {/* ── User Table ── */}
      <div className="user-management-table-wrap">
        <table className="user-management-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created On</th>
              <th className="user-management-table__actions-col">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="user-management-table__empty">
                  <span className="ui-spinner" aria-hidden="true" />
                  <span>Loading users…</span>
                </td>
              </tr>
            )}

            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="user-management-table__empty">
                  No users found.
                </td>
              </tr>
            )}

            {users.map((user) => {
              const isSelf = Boolean(session && user.id === session.user_id);
              const isLastActiveAdmin = user.role === "admin" && user.is_active && activeAdminCount <= 1;

              let deactivationDisabled = false;
              let disabledReason: string | undefined = undefined;

              if (user.is_active) {
                if (isSelf) {
                  deactivationDisabled = true;
                  disabledReason = "You cannot deactivate your own administrator account.";
                } else if (isLastActiveAdmin) {
                  deactivationDisabled = true;
                  disabledReason = "The last active administrator cannot be deactivated. Create another administrator first.";
                }
              }

              const isUpdating = togglingUserId === user.id;

              return (
                <tr key={user.id} className={!user.is_active ? "user-management-table__row--inactive" : ""}>
                  <td>
                    <span className="user-management-table__username">
                      {user.username}
                      {isSelf && (
                        <span style={{ fontSize: "11px", marginLeft: "6px", color: "var(--color-primary-600, #4f46e5)", fontWeight: 600 }}>
                          (You)
                        </span>
                      )}
                    </span>
                  </td>

                  <td>
                    <Badge tone={user.role === "admin" ? "danger" : "info"}>
                      {user.role === "admin" ? "Admin" : "Staff"}
                    </Badge>
                  </td>

                  <td>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Badge tone={user.is_active ? "success" : "neutral"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {user.must_change_password && (
                        <Badge tone="warning" title="Password reset by admin; user must change it at next login">
                          Reset Pending
                        </Badge>
                      )}
                    </div>
                  </td>

                  <td className="user-management-table__date">
                    {formatDate(user.created_at)}
                  </td>

                  <td className="user-management-table__actions-col">
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openResetModal(user)}
                        disabled={isSelf}
                        title={isSelf ? "Use 'Change Password' in Settings to change your own password" : `Reset password for ${user.username}`}
                        icon={<KeyRound size={13} />}
                      >
                        Reset Password
                      </Button>

                      <span
                        title={disabledReason}
                        style={{ display: "inline-block", cursor: deactivationDisabled ? "not-allowed" : undefined }}
                      >
                        <Button
                          size="sm"
                          variant={user.is_active ? "outline" : "secondary"}
                          onClick={() => handleToggleClick(user)}
                          disabled={isUpdating || deactivationDisabled}
                          title={disabledReason}
                        >
                          {isUpdating
                            ? "Updating..."
                            : user.is_active
                              ? "Deactivate"
                              : "Activate"}
                        </Button>
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Confirmation Dialog for Deactivation ── */}
      <ConfirmationDialog
        open={deactivatingUser !== null}
        title={`Deactivate User "${deactivatingUser?.username}"?`}
        description={`Are you sure you want to deactivate ${deactivatingUser?.role === "admin" ? "administrator" : "user"} "${deactivatingUser?.username}"? Once deactivated, they will not be able to log in to LocaLIMS.`}
        confirmLabel="Deactivate User"
        cancelLabel="Cancel"
        danger
        loading={togglingUserId === deactivatingUser?.id}
        onConfirm={() => {
          if (deactivatingUser) {
            void executeToggleActive(deactivatingUser);
          }
        }}
        onCancel={() => setDeactivatingUser(null)}
      />

      {/* ── Admin Reset Password Modal ── */}
      <Modal
        open={resetUser !== null}
        onClose={() => setResetUser(null)}
        title={`Reset Password for "${resetUser?.username}"`}
        subtitle="Set a new temporary password. The user will be required to change it at their next login."
        maxWidth="sm"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setResetUser(null)}
              disabled={resetLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResetPasswordSubmit}
              loading={resetLoading}
              disabled={!resetPassword || resetPassword.length < 8 || resetPassword !== resetConfirmPassword}
            >
              Reset Password
            </Button>
          </div>
        }
      >
        <form onSubmit={handleResetPasswordSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {resetError && (
            <div style={{ padding: "8px 12px", background: "var(--color-danger-soft, #fee2e2)", color: "var(--color-danger, #ef4444)", borderRadius: "6px", fontSize: "12px" }}>
              {resetError}
            </div>
          )}

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600 }}>New Password *</label>
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
              >
                {showResetPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showResetPassword ? "Hide" : "Show"}</span>
              </button>
            </div>
            <Input
              type={showResetPassword ? "text" : "password"}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              disabled={resetLoading}
              autoComplete="new-password"
              autoFocus
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600 }}>Confirm New Password *</label>
              <button
                type="button"
                onClick={() => setShowResetConfirm(!showResetConfirm)}
                style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
              >
                {showResetConfirm ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showResetConfirm ? "Hide" : "Show"}</span>
              </button>
            </div>
            <Input
              type={showResetConfirm ? "text" : "password"}
              value={resetConfirmPassword}
              onChange={(e) => setResetConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              disabled={resetLoading}
              autoComplete="new-password"
            />
          </div>

          {resetPassword && resetPassword.length < 8 && (
            <span style={{ fontSize: "11px", color: "var(--color-danger, #ef4444)" }}>
              Password must be at least 8 characters
            </span>
          )}
          {resetPassword && resetConfirmPassword && resetPassword !== resetConfirmPassword && (
            <span style={{ fontSize: "11px", color: "var(--color-danger, #ef4444)" }}>
              Passwords do not match
            </span>
          )}
        </form>
      </Modal>
    </Card>
  );
}
