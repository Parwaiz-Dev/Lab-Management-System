import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import type { ToastMessage } from "../../../types";
import { userService } from "../services/userService";

interface ChangePasswordCardProps {
  showToast: (message: string, type: ToastMessage["type"]) => void;
  username: string;
}

export default function ChangePasswordCard({
  showToast,
  username,
}: ChangePasswordCardProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      showToast("Current password is required", "warning");
      return;
    }

    if (!newPassword) {
      showToast("New password is required", "warning");
      return;
    }

    if (newPassword.length < 8) {
      showToast("New password must be at least 8 characters", "warning");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New password and confirmation do not match", "warning");
      return;
    }

    try {
      setLoading(true);
      const msg = await userService.changePassword(currentPassword, newPassword);
      showToast(msg || "Password changed successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to change password",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      icon={<KeyRound size={18} />}
      title="Change Password"
      eyebrow="Account Security"
      className="settings-change-password-card"
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: "var(--color-muted, #64748b)", margin: 0 }}>
          Change your account password for <strong>{username}</strong>. Your new password must be at least 8 characters long.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {/* Current Password */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text, #1e293b)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Lock size={13} />
                Current Password *
              </label>
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{ background: "none", border: "none", color: "var(--color-muted, #64748b)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}
              >
                {showCurrent ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showCurrent ? "Hide" : "Show"}</span>
              </button>
            </div>
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {/* New Password */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text, #1e293b)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <KeyRound size={13} />
                New Password *
              </label>
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{ background: "none", border: "none", color: "var(--color-muted, #64748b)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}
              >
                {showNew ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showNew ? "Hide" : "Show"}</span>
              </button>
            </div>
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          {/* Confirm New Password */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text, #1e293b)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Lock size={13} />
                Confirm New Password *
              </label>
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ background: "none", border: "none", color: "var(--color-muted, #64748b)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}
              >
                {showConfirm ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showConfirm ? "Hide" : "Show"}</span>
              </button>
            </div>
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
        </div>

        {newPassword && newPassword.length < 8 && (
          <span style={{ fontSize: 11, color: "var(--color-danger, #ef4444)" }}>
            New password must be at least 8 characters.
          </span>
        )}
        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <span style={{ fontSize: 11, color: "var(--color-danger, #ef4444)" }}>
            Passwords do not match.
          </span>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={
              loading ||
              !currentPassword ||
              newPassword.length < 8 ||
              newPassword !== confirmPassword
            }
            icon={<ShieldCheck size={14} />}
          >
            {loading ? "Updating Password…" : "Update Password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

