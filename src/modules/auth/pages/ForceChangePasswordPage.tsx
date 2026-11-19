import { useState, type FormEvent } from "react";
import { KeyRound, Lock, Eye, EyeOff, LogOut, CheckCircle2 } from "lucide-react";
import { userService } from "../services/userService";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import type { SessionInfo } from "../../../types";

interface ForceChangePasswordPageProps {
  session: SessionInfo;
  onPasswordChanged: () => void;
  onLogout: () => void;
}

export default function ForceChangePasswordPage({
  session,
  onPasswordChanged,
  onLogout,
}: ForceChangePasswordPageProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Please enter your current (temporary) password.");
      return;
    }

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      await userService.forceChangePassword(currentPassword, newPassword);
      onPasswordChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card" style={{ maxWidth: 440 }}>
        <div className="login-card__header">
          <div className="login-card__mark" style={{ background: "var(--color-warning-soft, #fef3c7)", color: "var(--color-warning, #d97706)" }}>
            <KeyRound size={26} strokeWidth={2} />
          </div>
          <h1 className="login-card__title">Password Change Required</h1>
          <p className="login-card__subtitle" style={{ marginTop: 6, lineHeight: 1.4 }}>
            Hello <strong>{session.username}</strong>, your password was reset by an administrator. Please set a new personal password to continue.
          </p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="login-card__error" role="alert" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label" htmlFor="force-current-password" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Lock size={14} className="form-label__icon" />
                Current (Temporary) Password
              </span>
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}
              >
                {showCurrent ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showCurrent ? "Hide" : "Show"}</span>
              </button>
            </label>
            <Input
              id="force-current-password"
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter the password provided by admin"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label" htmlFor="force-new-password" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <KeyRound size={14} className="form-label__icon" />
                New Password (min 8 characters)
              </span>
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}
              >
                {showNew ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showNew ? "Hide" : "Show"}</span>
              </button>
            </label>
            <Input
              id="force-new-password"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter new password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field" style={{ marginBottom: 18 }}>
            <label className="form-label" htmlFor="force-confirm-password" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Lock size={14} className="form-label__icon" />
                Confirm New Password
              </span>
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}
              >
                {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showConfirm ? "Hide" : "Show"}</span>
              </button>
            </label>
            <Input
              id="force-confirm-password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              aria-busy={loading}
              icon={<CheckCircle2 size={16} />}
            >
              {loading ? "Updating Password…" : "Update Password & Proceed"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLogout}
              disabled={loading}
              icon={<LogOut size={14} />}
            >
              Sign Out
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

