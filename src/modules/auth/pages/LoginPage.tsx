import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  FlaskConical,
  Lock,
  LogIn,
  ShieldCheck,
  User,
} from "lucide-react";
import { authService } from "../services/authService";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const APP_VERSION = "0.1.0";
const BUILD_TAG = "stable";
const BUILD_YEAR = new Date().getFullYear();

function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clock = useMemo(() => formatClock(now), [now]);
  const dateLabel = useMemo(() => formatDate(now), [now]);
  const greeting = useMemo(() => greetingFor(now), [now]);

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
      {/* Ambient background */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg__grid" />
        <div className="login-bg__orb login-bg__orb--a" />
        <div className="login-bg__orb login-bg__orb--b" />
        <div className="login-bg__orb login-bg__orb--c" />
      </div>

      <div className="login-stage">
        {/* Status bar */}
        <header className="login-topbar">
          <div className="login-topbar__item" title="Current time">
            <Clock size={14} className="login-topbar__icon" aria-hidden="true" />
            <span className="login-topbar__clock">{clock}</span>
          </div>
          <span className="login-topbar__divider" aria-hidden="true" />
          <div className="login-topbar__item" title="Current date">
            <Calendar size={14} className="login-topbar__icon" aria-hidden="true" />
            <span>{dateLabel}</span>
          </div>
        </header>

        {/* Login card */}
        <main className="login-card">
          <div className="login-card__header">
            <div className="login-card__mark" aria-hidden="true">
              <FlaskConical size={26} strokeWidth={2} className="login-card__mark-icon" />
            </div>
            <h1 className="login-card__title">LocaLIMS</h1>
            <p className="login-card__subtitle">Laboratory Information Management System</p>
          </div>

          <p className="login-card__welcome">
            {greeting}. Sign in to continue to your workspace.
          </p>

          <form className="login-card__form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="login-card__error" role="alert">
                <AlertCircle size={15} className="login-card__error-icon" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="form-field login-field login-field--username">
              <label className="form-label" htmlFor="login-username">
                <User size={14} className="form-label__icon" aria-hidden="true" />
                Username
              </label>
              <div className="login-input-wrap">
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
                <User size={16} className="login-input-wrap__leading" aria-hidden="true" />
              </div>
            </div>

            <div className="form-field login-field login-field--password">
              <label className="form-label" htmlFor="login-password">
                <Lock size={14} className="form-label__icon" aria-hidden="true" />
                Password
              </label>
              <div className="login-input-wrap login-input-wrap--password">
                <Input
                  id="login-password"
                  invalid={error !== "" && !password}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <Lock size={16} className="login-input-wrap__leading" aria-hidden="true" />
                <button
                  type="button"
                  className="login-input-wrap__toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                >
                  {showPassword ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="login-field login-field--submit">
              <Button
                type="submit"
                variant="primary"
                className="login-card__submit"
                loading={loading}
                icon={<LogIn size={17} />}
              >
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </div>
          </form>

          <div className="login-card__meta">
            <span className="login-card__secure">
              <ShieldCheck size={13} aria-hidden="true" />
              Secured local session
            </span>
            <span className="login-card__hint">
              Default: <code>admin</code> / <code>admin123</code>
            </span>
          </div>
        </main>

        {/* Footer */}
        <footer className="login-footer">
          <span className="login-footer__item">LocaLIMS v{APP_VERSION}</span>
          <span className="login-footer__dot" aria-hidden="true" />
          <span className="login-footer__item">Build {BUILD_TAG}</span>
          <span className="login-footer__dot" aria-hidden="true" />
          <span className="login-footer__item">© {BUILD_YEAR} Locavanties</span>
        </footer>
      </div>
    </div>
  );
}
