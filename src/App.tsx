import { useMemo, useState } from "react";
import PatientPage from "./modules/patient/pages/PatientPage";
import LabDashboard from "./modules/test/pages/LabDashboard";
import ResultPage from "./modules/test/pages/ResultPage";
import ReportPage from "./modules/test/pages/ReportPage";
import SettingsPage from "./modules/settings/pages/SettingsPage";
import ReceiptPage from "./modules/test/pages/ReceiptPage";
import { colors, shadowSm } from "./components/ui/styles";

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
  const isPrintView = page === "report" || page === "receipt";

  const currentPage = useMemo(() => pageCopy[page], [page]);

  const goToDashboard = () => {
    setSelectedOrder(null);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("dashboard");
  };

  const goToPatient = () => {
    setSelectedOrder(null);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("patient");
  };

  return (
    <div style={app}>
      {!isPrintView && (
        <aside style={sidebar}>
          <div style={brand}>
            <div style={brandMark}>LM</div>
            <div>
              <div style={brandName}>LabManager</div>
              <div style={brandSub}>Desktop LMS</div>
            </div>
          </div>

          <nav style={nav}>
            <MenuItem label="Patient Intake" active={page === "patient"} onClick={goToPatient} />
            <MenuItem label="Operations" active={page === "dashboard"} onClick={goToDashboard} />
            <MenuItem label="Settings" active={page === "settings"} onClick={() => setPage("settings")} />
          </nav>

          <div style={sidebarCard}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>Offline Ready</div>
            <div style={{ fontSize: 12, color: "#c9d7e3", lineHeight: 1.45 }}>
              Data is stored locally in SQLite for fast day-to-day lab work.
            </div>
          </div>
        </aside>
      )}

      <main style={isPrintView ? printMain : main}>
        {!isPrintView && (
          <header style={topbar}>
            <div>
              <h1 style={pageTitle}>{currentPage.title}</h1>
              <p style={pageSubtitle}>{currentPage.subtitle}</p>
            </div>
            <div style={statusPill}>
              <span style={statusDot} />
              System Ready
            </div>
          </header>
        )}

        <div style={isPrintView ? printContent : content}>
          {page === "patient" && (
            <PatientPage
              onOpenReceipt={(id: number) => {
                setReceiptOrder(id);
                setPage("receipt");
              }}
            />
          )}

          {page === "dashboard" && (
            <LabDashboard
              onSelectOrder={(id: number) => {
                setSelectedOrder(id);
                setPage("result");
              }}
              onOpenReceipt={(id: number) => {
                setReceiptOrder(id);
                setPage("receipt");
              }}
            />
          )}

          {page === "result" && selectedOrder !== null && (
            <ResultPage
              orderId={selectedOrder}
              onBack={goToDashboard}
              onViewReport={(id: number) => {
                setReportOrder(id);
                setPage("report");
              }}
            />
          )}

          {page === "report" && reportOrder !== null && (
            <ReportPage orderId={reportOrder} onBack={goToDashboard} />
          )}

          {page === "receipt" && receiptOrder !== null && (
            <ReceiptPage orderId={receiptOrder} onBack={goToDashboard} />
          )}

          {page === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

function MenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 42,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: active ? "#ffffff" : "#cbd7e2",
        fontSize: 13,
        fontWeight: active ? 800 : 650,
      }}
    >
      {label}
    </button>
  );
}

const app = {
  display: "flex",
  minHeight: "100vh",
  background: colors.bg,
};

const sidebar = {
  width: 248,
  minWidth: 248,
  background: "#102235",
  color: "#eef6fb",
  padding: 18,
  display: "flex",
  flexDirection: "column" as const,
  gap: 22,
};

const brand = {
  display: "flex",
  alignItems: "center",
  gap: 11,
};

const brandMark = {
  width: 40,
  height: 40,
  borderRadius: 8,
  background: "#e0f2fe",
  color: colors.primary,
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  fontSize: 14,
};

const brandName = {
  fontSize: 16,
  fontWeight: 900,
};

const brandSub = {
  fontSize: 12,
  color: "#a9bdcd",
};

const nav = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 5,
};

const sidebarCard = {
  marginTop: "auto",
  padding: 13,
  borderRadius: 8,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 5,
};

const main = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column" as const,
};

const printMain = {
  flex: 1,
  background: "#ffffff",
};

const topbar = {
  height: 76,
  background: colors.surface,
  borderBottom: `1px solid ${colors.border}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 24px",
  boxShadow: shadowSm,
  zIndex: 1,
};

const pageTitle = {
  fontSize: 22,
  fontWeight: 900,
  color: colors.text,
};

const pageSubtitle = {
  color: colors.muted,
  fontSize: 13,
  marginTop: 4,
};

const statusPill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 34,
  padding: "7px 11px",
  borderRadius: 999,
  background: colors.successSoft,
  color: colors.success,
  fontSize: 12,
  fontWeight: 800,
};

const statusDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: colors.success,
};

const content = {
  flex: 1,
  overflow: "auto" as const,
  padding: 20,
};

const printContent = {
  minHeight: "100vh",
};

export default App;
