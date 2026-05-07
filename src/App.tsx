import { useMemo, useState } from "react";
import PatientPage from "./modules/patient/pages/PatientPage";
import LabDashboard from "./modules/test/pages/LabDashboard";
import ResultPage from "./modules/test/pages/ResultPage";
import ReportPage from "./modules/test/pages/ReportPage";
import SettingsPage from "./modules/settings/pages/SettingsPage";
import ReceiptPage from "./modules/test/pages/ReceiptPage";

type Page = "patient" | "dashboard" | "result" | "report" | "settings" | "receipt";

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
};

function App() {
  const [page, setPage] = useState<Page>("patient");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [reportOrder, setReportOrder] = useState<number | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isPrintView = page === "report" || page === "receipt";
  const currentPage = useMemo(() => pageCopy[page], [page]);

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

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "app-shell--collapsed"}`}>
      {!isPrintView && (
        <aside className="app-sidebar">
          <div className="app-sidebar__brand">
            <div className="app-sidebar__brand-mark">LM</div>
            <div className="app-sidebar__brand-title">
              <div className="app-sidebar__brand-name">LabManager</div>
              <div className="app-sidebar__brand-sub">Desktop LMS</div>
            </div>
          </div>

          <nav className="app-nav">
            <button
              type="button"
              className={`app-nav__item ${page === "patient" ? "app-nav__item--active" : ""}`}
              onClick={goToPatient}
            >
              Patient Intake
            </button>

            <button
              type="button"
              className={`app-nav__item ${["dashboard", "result"].includes(page) ? "app-nav__item--active" : ""}`}
              onClick={goToDashboard}
            >
              Operations
            </button>

            <button
              type="button"
              className={`app-nav__item ${page === "settings" ? "app-nav__item--active" : ""}`}
              onClick={goToSettings}
            >
              Settings
            </button>
          </nav>

          <div className="app-sidebar__footer">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Offline Ready</div>
            <div>Data is stored locally in SQLite for fast day-to-day lab work.</div>
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
              >
                <span className="sidebar-toggle__icon">
                  {sidebarOpen ? "❮" : "❯"}
                </span>
                <span className="sidebar-toggle__label">
                  {sidebarOpen ? "Hide menu" : "Show menu"}
                </span>
              </button>

              <div>
                <h1 className="page-title">{currentPage.title}</h1>
                <p className="page-subtitle">{currentPage.subtitle}</p>
              </div>
            </div>

            <div className="status-pill">
              <span className="status-dot" />
              System Ready
            </div>
          </header>
        )}

        <div className={`page-content ${isPrintView ? "page-content--print" : ""}`}>
          {page === "patient" && <PatientPage onOpenReceipt={openReceipt} />}

          {page === "dashboard" && (
            <LabDashboard onSelectOrder={openResult} onOpenReceipt={openReceipt} />
          )}

          {page === "result" && selectedOrder !== null && (
            <ResultPage
              orderId={selectedOrder}
              onBack={goToDashboard}
              onViewReport={openReport}
            />
          )}

          {page === "result" && selectedOrder === null && (
            <div className="route-empty-state">
              <strong>No order selected.</strong>
              <button type="button" onClick={goToDashboard}>
                Back to Operations
              </button>
            </div>
          )}

          {page === "report" && reportOrder !== null && (
            <ReportPage orderId={reportOrder} onBack={goToDashboard} />
          )}

          {page === "report" && reportOrder === null && (
            <div className="route-empty-state">
              <strong>No report order selected.</strong>
              <button type="button" onClick={goToDashboard}>
                Back to Operations
              </button>
            </div>
          )}

          {page === "receipt" && receiptOrder !== null && (
            <ReceiptPage orderId={receiptOrder} onBack={goToDashboard} />
          )}

          {page === "receipt" && receiptOrder === null && (
            <div className="route-empty-state">
              <strong>No receipt order selected.</strong>
              <button type="button" onClick={goToDashboard}>
                Back to Operations
              </button>
            </div>
          )}

          {page === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

export default App;