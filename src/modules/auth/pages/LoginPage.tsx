import { useState, type FormEvent } from "react";
import { authService } from "../services/authService";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await authService.login(username.trim(), password);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-card__header">
          <div className="login-card__mark">LM</div>
          <h1 className="login-card__title">LabManager</h1>
          <p className="login-card__subtitle">Desktop Lab Management System</p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="login-card__error" role="alert">
              {error}
            </div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              className={`ui-input ${error && !username.trim() ? "ui-input--invalid" : ""}`}
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className={`ui-input ${error && !password ? "ui-input--invalid" : ""}`}
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="ui-button ui-button--primary login-card__submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <span className="ui-spinner" aria-hidden="true" />}
            <span>{loading ? "Signing in…" : "Sign In"}</span>
          </button>
        </form>

        <p className="login-card__hint">
          Default credentials: <code>admin</code> / <code>admin123</code>
        </p>
      </div>
    </div>
  );
}