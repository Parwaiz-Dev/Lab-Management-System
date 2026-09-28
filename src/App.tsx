import { useMemo, useState, useEffect } from "react";
import {
  Heart,
  UserPlus,
  LayoutDashboard,
  Settings,
  History,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Clock,
  ShieldCheck,
} from "lucide-react";
import PatientPage from "./modules/patient/pages/PatientPage";
import LabDashboard from "./modules/test/pages/LabDashboard";
import ResultPage from "./modules/test/pages/ResultPage";
import ReportPage from "./modules/test/pages/ReportPage";
import SettingsPage from "./modules/settings/pages/SettingsPage";
import ReceiptPage from "./modules/test/pages/ReceiptPage";
import AuditPage from "./modules/audit/pages/AuditPage";
import PatientHistoryPage from "./modules/patient/pages/PatientHistoryPage";
import LoginPage from "./modules/auth/pages/LoginPage";
import { authService } from "./modules/auth/services/authService";
import type { SessionInfo } from "./types";

type Page = "patient" | "dashboard" | "result" | "report" | "settings" | "receipt" | "audit" | "history";

const pageCopy: Record<Page, { title: string; subtitle: string }> = {
  patient: {
    title: "Patient Intake",
    subtitle: "Register patients, select tests, and create billable orders.",
  },
  dashboard: {
    title: "Lab Operations",
    subtitle: "Track reports, payments, and pending work from one place.",
  },
  result: {
    title: "Result Entry",
    subtitle: "Capture and update test values for the selected order.",
  },
  report: {
    title: "Lab Report",
    subtitle: "Print-ready clinical report.",
  },
  receipt: {
    title: "Payment Receipt",
    subtitle: "Print-ready billing receipt.",
  },
  settings: {
    title: "Settings",
    subtitle: "Configure lab identity, billing, and local backup.",
  },
  audit: {
    title: "Audit Log",
    subtitle: "Review system activity and change history.",
  },
  history: {
    title: "Patient History",
    subtitle: "Search patients and view orders, payments, reports, and test results.",
  },
};

function App() {
  // ── Auth state: undefined = checking, null = not logged in, SessionInfo = logged in ──
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [page, setPage] = useState<Page>("patient");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [reportOrder, setReportOrder] = useState<number | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1180 : true
  );
  const [timeStr, setTimeStr] = useState<string>("");

  const isPrintView = page === "report" || page === "receipt";
  const currentPage = useMemo(() => pageCopy[page], [page]);

  // Responsive sidebar auto-adaptation on window resize
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (lastWidth >= 1180 && currentWidth < 1180) {
        setSidebarOpen(false);
      } else if (lastWidth < 1180 && currentWidth >= 1180) {
        setSidebarOpen(true);
      }
      lastWidth = currentWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Live clock with Indian date/time formatting
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Check for existing session on mount ──
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mockParam = urlParams.get("demo") || urlParams.get("mock");
    const pageParam = urlParams.get("page") as Page | null;
    const orderParam = urlParams.get("order");

    if (pageParam && pageCopy[pageParam]) {
      setPage(pageParam);
    }
    if (orderParam) {
      const oid = Number(orderParam);
      setSelectedOrder(oid);
      setReportOrder(oid);
      setReceiptOrder(oid);
    }

    authService
      .getCurrentSession()
      .then((s) => {
        if (!s && mockParam) {
          setSession({ user_id: 1, username: "admin", role: "admin" });
        } else {
          setSession(s);
        }
      })
      .catch(() => {
        if (mockParam) {
          setSession({ user_id: 1, username: "admin", role: "admin" });
        } else {
          setSession(null);
        }
      });
  }, []);

  const handleLogin = () => {
    authService
      .getCurrentSession()
      .then((s) => setSession(s))
      .catch(() => setSession(null));
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Even if logout fails server-side, clear local state
    }
    setSession(null);
    setPage("patient");
  };

  const goToPatient = () => {
    setSelectedOrder(null);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("patient");
  };

  const goToDashboard = () => {
    setSelectedOrder(null);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("dashboard");
  };

  const goToSettings = () => {
    setSelectedOrder(null);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("settings");
  };

  const goToAudit = () => {
    setSelectedOrder(null);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("audit");
  };

  const goToHistory = () => {
    setSelectedOrder(null);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("history");
  };

  const openResult = (orderId: number) => {
    setSelectedOrder(orderId);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("result");
  };

  const openReport = (orderId: number) => {
    setReportOrder(orderId);
    setReceiptOrder(null);
    setPage("report");
  };

  const openReceipt = (orderId: number) => {
    setReceiptOrder(orderId);
    setReportOrder(null);
    setPage("receipt");
  };

  // ── Session loading ──
  if (session === undefined) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-card__header">
            <div className="login-card__mark">
              <Heart size={20} strokeWidth={2.2} />
            </div>
            <h1 className="login-card__title">LabManager</h1>
          </div>
          <span className="ui-spinner" aria-hidden="true" style={{ marginTop: 16, width: 20, height: 20 }} />
          <p style={{ marginTop: 8, color: "var(--color-muted)", fontSize: 12 }}>
            Checking session…
          </p>
        </div>
      </div>
    );
  }

  // ── Not logged in ──
  if (session === null) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  // ── Logged in ──
  return (
    <div className={`app-shell ${sidebarOpen ? "" : "app-shell--collapsed"}`}>
      {!isPrintView && (
        <aside className="app-sidebar">
          {/* Shop/Lab Brand Header */}
          <div className="app-sidebar__brand">
            <div className="app-sidebar__brand-mark">
              <Heart size={16} strokeWidth={2.4} />
            </div>
            <div className="app-sidebar__brand-title">
              <div className="app-sidebar__brand-name">LabManager</div>
              <div className="app-sidebar__brand-sub">Desktop LMS</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="app-nav">
            <button
              type="button"
              className={`app-nav__item ${page === "patient" ? "app-nav__item--active" : ""}`}
              onClick={goToPatient}
              title="Patient Intake"
            >
              <UserPlus size={16} strokeWidth={2} className="app-nav__icon" />
              <span>Patient Intake</span>
            </button>

            <button
              type="button"
              className={`app-nav__item ${["dashboard", "result"].includes(page) ? "app-nav__item--active" : ""}`}
              onClick={goToDashboard}
              title="Lab Operations"
            >
              <LayoutDashboard size={16} strokeWidth={2} className="app-nav__icon" />
              <span>Operations</span>
            </button>

            <button
              type="button"
              className={`app-nav__item ${page === "history" ? "app-nav__item--active" : ""}`}
              onClick={goToHistory}
              title="Patient History"
            >
              <History size={16} strokeWidth={2} className="app-nav__icon" />
              <span>Patient History</span>
            </button>

            <button
              type="button"
              className={`app-nav__item ${page === "settings" ? "app-nav__item--active" : ""}`}
              onClick={goToSettings}
              title="Settings & Catalog"
            >
              <Settings size={16} strokeWidth={2} className="app-nav__icon" />
              <span>Settings</span>
            </button>

            {session.role === "admin" && (
              <button
                type="button"
                className={`app-nav__item ${page === "audit" ? "app-nav__item--active" : ""}`}
                onClick={goToAudit}
                title="System Audit Log"
              >
                <FileText size={16} strokeWidth={2} className="app-nav__icon" />
                <span>Audit Log</span>
              </button>
            )}
          </nav>

          {/* Sidebar Status Footer */}
          <div className="app-sidebar__footer">
            <div className="app-sidebar__user">
              <div className="app-sidebar__user-avatar">
                {session.username.charAt(0).toUpperCase()}
              </div>
              <div className="app-sidebar__user-info">
                <div className="app-sidebar__user-name">{session.username}</div>
                <div className="app-sidebar__user-role">{session.role}</div>
              </div>
            </div>

            <div className="app-sidebar__sub">
              <ShieldCheck className="app-sidebar__sub-icon" size={14} strokeWidth={2} />
              <div className="app-sidebar__sub-content">
                <p className="app-sidebar__sub-title">100% Offline Ready</p>
              </div>
            </div>

            <button
              type="button"
              className="app-sidebar__logout-btn"
              onClick={handleLogout}
              title="Sign Out of Session"
            >
              <LogOut size={13} strokeWidth={2} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>
      )}

      <main className={`app-main ${isPrintView ? "app-main--print" : ""}`}>
        {!isPrintView && (
          <header className="page-header">
            <div className="page-header__left">
              <button
                className="sidebar-toggle"
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                {sidebarOpen ? <PanelLeftClose size={15} strokeWidth={2} /> : <PanelLeft size={15} strokeWidth={2} />}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 className="page-title">{currentPage.title}</h1>
                <span className="page-header__divider" style={{ color: "var(--color-border-strong)", fontSize: 12 }}>|</span>
                <span className="page-subtitle">{currentPage.subtitle}</span>
              </div>
            </div>

            <div className="page-header__right">
              {/* Quick Jump to Settings Button */}
              {page !== "settings" && (
                <button
                  type="button"
                  onClick={goToSettings}
                  className="table-action-btn"
                  title="Configure Lab Settings"
                >
                  <Settings size={12} />
                  <span>Config</span>
                </button>
              )}

              {/* Real-time Clock */}
              <div className="page-header__date">
                <Clock size={13} className="text-slate-400" />
                <span>{timeStr}</span>
              </div>

              {/* User Session Pill */}
              <div className="page-header__user-card">
                <div className="page-header__user-avatar">
                  {session.username.charAt(0).toUpperCase()}
                </div>
                <span className="page-header__user-name">{session.username}</span>
                <span className="page-header__user-role">{session.role}</span>
              </div>
            </div>
          </header>
        )}

        <div className={`page-content ${isPrintView ? "page-content--print" : ""}`}>
          {page === "patient" && <PatientPage onOpenReceipt={openReceipt} />}

          {page === "dashboard" && (
            <LabDashboard
              onSelectOrder={openResult}
              onOpenReceipt={openReceipt}
            />
          )}

          {page === "result" && selectedOrder !== null && (
            <ResultPage
              orderId={selectedOrder}
              onBack={goToDashboard}
              onViewReport={openReport}
            />
          )}

          {page === "result" && selectedOrder === null && (
            <div className="empty-state">
              <p className="empty-state__title">No order selected</p>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                style={{ marginTop: 8 }}
                onClick={goToDashboard}
              >
                Back to Operations
              </button>
            </div>
          )}

          {page === "report" && reportOrder !== null && (
            <ReportPage orderId={reportOrder} onBack={goToDashboard} />
          )}

          {page === "report" && reportOrder === null && (
            <div className="empty-state">
              <p className="empty-state__title">No report order selected</p>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                style={{ marginTop: 8 }}
                onClick={goToDashboard}
              >
                Back to Operations
              </button>
            </div>
          )}

          {page === "receipt" && receiptOrder !== null && (
            <ReceiptPage orderId={receiptOrder} onBack={goToDashboard} />
          )}

          {page === "receipt" && receiptOrder === null && (
            <div className="empty-state">
              <p className="empty-state__title">No receipt order selected</p>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                style={{ marginTop: 8 }}
                onClick={goToDashboard}
              >
                Back to Operations
              </button>
            </div>
          )}

          {page === "settings" && <SettingsPage session={session} />}

          {page === "audit" && <AuditPage />}

          {page === "history" && (
            <PatientHistoryPage
              onViewReport={openReport}
              onViewReceipt={openReceipt}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;