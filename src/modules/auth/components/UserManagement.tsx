import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, UserPlus, Users } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import type { User, ToastMessage } from "../../../types";
import { userService } from "../../auth/services/userService";

interface UserManagementProps {
  showToast: (message: string, type: ToastMessage["type"]) => void;
}

export default function UserManagement({ showToast }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // ── Create form ──
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("staff");

  // ── Async safety ──
  // fetchSeqRef: id of the latest list request. A response is applied only
  // if it is still the latest one, so a stale response can never overwrite
  // newer state. The effect cleanup bumps the counter, which also stops
  // in-flight requests from touching state after unmount.
  // mountedRef: set to false on unmount; guards the create/toggle handlers
  // from writing state after the component is gone.
  const fetchSeqRef = useRef(0);
  const mountedRef = useRef(true);

  // Shared fetch core — `seq` must still be the latest request for any state
  // write to be applied. Never sets state synchronously, so it is safe to
  // call directly from an effect.
  const fetchUsers = useCallback(
    async (seq: number) => {
      try {
        const data = await userService.listUsers();
        if (fetchSeqRef.current === seq) setUsers(data);
      } catch (err) {
        if (fetchSeqRef.current === seq) {
          showToast(
            err instanceof Error ? err.message : "Failed to load users",
            "error"
          );
        }
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [showToast]
  );

  // Event-driven reload (Refresh button, after create/toggle).
  const loadUsers = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    await fetchUsers(seq);
  }, [fetchUsers]);

  // Initial load. The `loading` state starts as true, so no synchronous
  // state write is needed here.
  useEffect(() => {
    mountedRef.current = true;
    const seq = ++fetchSeqRef.current;
    void fetchUsers(seq);

    return () => {
      mountedRef.current = false;
      fetchSeqRef.current += 1; // invalidate any in-flight request
    };
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUsername.trim() || !newPassword.trim()) {
      showToast("Username and password are required", "warning");
      return;
    }

    try {
      setCreating(true);
      await userService.createUser(newUsername.trim(), newPassword, newRole);
      if (!mountedRef.current) return;
      showToast(`User "${newUsername.trim()}" created`, "success");
      setNewUsername("");
      setNewPassword("");
      setNewRole("staff");
      await loadUsers();
    } catch (err) {
      if (mountedRef.current) {
        showToast(
          err instanceof Error ? err.message : "Failed to create user",
          "error"
        );
      }
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      setTogglingUserId(user.id);
      await userService.toggleUserActive(user.id);
      if (!mountedRef.current) return;
      showToast(
        user.is_active
          ? `User "${user.username}" deactivated`
          : `User "${user.username}" activated`,
        "success"
      );
      await loadUsers();
    } catch (err) {
      if (mountedRef.current) {
        showToast(
          err instanceof Error ? err.message : "Failed to update user",
          "error"
        );
      }
    } finally {
      if (mountedRef.current) setTogglingUserId(null);
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
      eyebrow="Admin controls"
      className="user-management-card"
      right={
        <Button onClick={loadUsers} variant="secondary" disabled={loading} icon={<RefreshCw size={16} />}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      }
    >
      {/* ── Create User Form ── */}
      <form className="user-management-create" onSubmit={handleCreateUser}>
        <div className="user-management-create__fields">
          <div className="user-management-create__field">
            <label className="user-management-create__label">Username</label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter username"
              disabled={creating}
              autoComplete="off"
            />
          </div>

          <div className="user-management-create__field">
            <label className="user-management-create__label">Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter password"
              disabled={creating}
              autoComplete="new-password"
            />
          </div>

          <div className="user-management-create__field">
            <label className="user-management-create__label">Role</label>
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
        </div>

        <div className="user-management-create__action">
          <Button type="submit" disabled={creating || !newUsername.trim() || !newPassword.trim()} icon={<UserPlus size={16} />}>
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
              <th>Created</th>
              <th className="user-management-table__actions-col">Actions</th>
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

            {users.map((user) => (
              <tr key={user.id} className={!user.is_active ? "user-management-table__row--inactive" : ""}>
                <td>
                  <span className="user-management-table__username">{user.username}</span>
                </td>

                <td>
                  <Badge tone={user.role === "admin" ? "danger" : "info"}>
                    {user.role === "admin" ? "Admin" : "Staff"}
                  </Badge>
                </td>

                <td>
                  <Badge tone={user.is_active ? "success" : "neutral"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>

                <td className="user-management-table__date">
                  {formatDate(user.created_at)}
                </td>

                <td className="user-management-table__actions-col">
                  <Button
                    variant={user.is_active ? "danger" : "success"}
                    onClick={() => handleToggleActive(user)}
                    disabled={togglingUserId === user.id}
                  >
                    {togglingUserId === user.id
                      ? "Updating..."
                      : user.is_active
                        ? "Deactivate"
                        : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}