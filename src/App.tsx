import { useState } from "react";

// 📄 Pages
import PatientPage from "./modules/patient/pages/PatientPage";
import LabDashboard from "./modules/test/pages/LabDashboard";
import ResultPage from "./modules/test/pages/ResultPage";
import ReportPage from "./modules/test/pages/ReportPage";
import SettingsPage from "./modules/settings/pages/SettingsPage";
import ReceiptPage from "./modules/test/pages/ReceiptPage";

function App() {
  const [page, setPage] = useState<
    "patient" | "dashboard" | "result" | "report" | "settings" | "receipt"
  >("patient");

  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [reportOrder, setReportOrder] = useState<number | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<number | null>(null);

  const [menuOpen, setMenuOpen] = useState(true);

  const goToDashboard = () => {
    setSelectedOrder(null);
    setReportOrder(null);
    setReceiptOrder(null);
    setPage("dashboard");
  };

  return (
    <div style={app}>
      
      {/* 🧭 SIDEBAR */}
      {menuOpen && page !== "report" && page !== "receipt" && (
        <div style={sidebar}>
          <div style={logo}>🧪 Lab System</div>

          <div style={menu}>
            <MenuItem
              label="Patient Entry"
              icon="🧾"
              active={page === "patient"}
              onClick={() => setPage("patient")}
            />

            <MenuItem
              label="Dashboard"
              icon="📊"
              active={page === "dashboard"}
              onClick={goToDashboard}
            />

            <MenuItem
              label="Settings"
              icon="⚙"
              active={page === "settings"}
              onClick={() => setPage("settings")}
            />
          </div>
        </div>
      )}

      {/* 👉 MAIN */}
      <div style={main}>
        
        {/* 🔝 TOPBAR */}
        {page !== "report" && page !== "receipt" && (
          <div style={topbar}>
            <div style={topLeft}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={menuBtn}
              >
                ☰
              </button>

              <div>
                <div style={title}>Lab Management System</div>
                <div style={subtitle}>Offline Mode</div>
              </div>
            </div>

            <div style={topRight}>
              <div style={statusDot}></div>
              <span style={{ fontSize: 12 }}>System Ready</span>
            </div>
          </div>
        )}

        {/* 📄 CONTENT */}
        <div style={content}>
          {page === "patient" && <PatientPage />}

          {page === "dashboard" && (
            <LabDashboard
              onSelectOrder={(id: number) => {
                setSelectedOrder(id);
                setPage("result");
              }}
              onOpenReceipt={(id: number) => {
                setReceiptOrder(id);
                setPage("receipt"); // ✅ FIXED (no timeout)
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
            <ReportPage
              orderId={reportOrder}
              onBack={goToDashboard}
            />
          )}

          {page === "receipt" && receiptOrder !== null && (
            <ReceiptPage
              orderId={receiptOrder}
              onBack={goToDashboard}
            />
          )}

          {page === "settings" && <SettingsPage />}
        </div>
      </div>
    </div>
  );
}

//
// 🧩 MENU ITEM
//
function MenuItem({ label, icon, active, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        cursor: "pointer",
        background: active ? "#1e293b" : "transparent",
        color: active ? "#fff" : "#cbd5e1",
        transition: "0.2s",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

//
// 🎨 STYLES (PREMIUM)
//

const app = {
  display: "flex",
  height: "100vh",
  background: "#f1f5f9",
};

const sidebar = {
  width: 220,
  background: "#0f172a",
  color: "#e2e8f0",
  padding: 16,
  display: "flex",
  flexDirection: "column" as const,
  gap: 20,
};

const logo = {
  fontSize: 18,
  fontWeight: "bold",
};

const menu = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const main = {
  flex: 1,
  display: "flex",
  flexDirection: "column" as const,
};

const topbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 16px",
  background: "#ffffff",
  borderBottom: "1px solid #e5e7eb",
};

const topLeft = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const topRight = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const title = {
  fontSize: 14,
  fontWeight: 600,
};

const subtitle = {
  fontSize: 11,
  color: "#64748b",
};

const menuBtn = {
  fontSize: 16,
  padding: "4px 8px",
  cursor: "pointer",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  background: "#f8fafc",
};

const statusDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#22c55e",
};

const content = {
  flex: 1,
  padding: 16,
  overflow: "auto" as const,
};

export default App;