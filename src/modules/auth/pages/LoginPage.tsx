import { useState, type FormEvent } from "react";
import { Heart, Lock, LogIn, User } from "lucide-react";
import { authService } from "../services/authService";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

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
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
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
          <div className="login-card__mark">
            <Heart size={26} strokeWidth={2} />
          </div>
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
              <User size={14} className="form-label__icon" />
              Username
            </label>
            <Input
              id="login-username"
              invalid={error !== "" && !username.trim()}
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
              <Lock size={14} className="form-label__icon" />
              Password
            </label>
            <Input
              id="login-password"
              invalid={error !== "" && !password}
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="login-card__submit"
            disabled={loading}
            aria-busy={loading}
            icon={<LogIn size={18} />}
          >
            {loading && <span className="ui-spinner" aria-hidden="true" />}
            <span>{loading ? "Signing in…" : "Sign In"}</span>
          </Button>
        </form>

        <p className="login-card__hint">
          Default credentials: <code>admin</code> / <code>admin123</code>
        </p>
      </div>
    </div>
  );
}