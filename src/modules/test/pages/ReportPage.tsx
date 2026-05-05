import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Button from "../../../components/ui/Button";
import type { ReportPatientInfo, ReportRow } from "../../../types";

type ReportPageProps = {
  orderId: number;
  onBack: () => void;
};

export default function ReportPage({ orderId, onBack }: ReportPageProps) {
  const [data, setData] = useState<ReportRow[]>([]);
  const [patient, setPatient] = useState<ReportPatientInfo | null>(null);
  const [labName, setLabName] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [logo, setLogo] = useState("");

  useEffect(() => {
    const loadReport = async () => setData((await invoke("get_report", { orderId })) as ReportRow[]);
    const loadPatient = async () => setPatient((await invoke("get_patient_by_order", { orderId })) as ReportPatientInfo);

    const loadSettings = async () => {
      setLabName((await invoke("get_setting", { key: "lab_name" })) as string);
      setLabAddress((await invoke("get_setting", { key: "lab_address" })) as string);
      setLogo((await invoke("get_setting", { key: "lab_logo" })) as string);
    };

    void Promise.all([loadReport(), loadPatient(), loadSettings()]);
  }, [orderId]);

  const groupedResults = useMemo(() => {
    const groups: { testName: string; rows: ReportRow[] }[] = [];
    for (const row of data) {
      const group = groups.find((item) => item.testName === row.test_name);
      if (group) {
        group.rows.push(row);
      } else {
        groups.push({ testName: row.test_name, rows: [row] });
      }
    }
    return groups;
  }, [data]);

  const reportDate = new Date().toLocaleDateString();

  const isAbnormal = (value: string, range: string) => {
    const num = Number.parseFloat(value);
    const [min, max] = range.split("-").map(Number.parseFloat);
    if (Number.isNaN(num) || Number.isNaN(min) || Number.isNaN(max)) return false;
    return num < min || num > max;
  };

  return (
    <div style={page}>
      <style>{printCss}</style>

      <div style={actions} className="no-print">
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
        <Button onClick={() => window.print()}>Print Report</Button>
      </div>

      <article style={paper}>
        <header style={header}>
          <div style={brand}>
            {logo ? <img src={`file://${logo}`} alt="Lab logo" style={logoStyle} /> : <div style={logoFallback}>LM</div>}
            <div>
              <h1 style={labTitle}>{labName || "Your Lab Name"}</h1>
              <p style={address}>{labAddress || "Lab address"}</p>
            </div>
          </div>
          <div style={reportMeta}>
            <strong style={reportTitle}>Laboratory Report</strong>
            <span>Order #{orderId}</span>
            <span>{patient?.invoice_no || `INV-${orderId}`}</span>
          </div>
        </header>

        <section style={infoGrid}>
          <Info label="Patient" value={patient?.patient_name || "-"} />
          <Info label="Patient ID" value={patient?.patient_code || "-"} />
          <Info label="Age / Gender" value={`${patient?.age_value || "-"} ${patient?.age_unit || ""} / ${patient?.gender || "-"}`} />
          <Info label="Phone" value={patient?.phone || "-"} />
          <Info label="Referred By" value={patient?.referred_by || "Self"} />
          <Info label="Order Date" value={formatDate(patient?.order_date)} />
          <Info label="Report Date" value={reportDate} />
        </section>

        <section style={reportBody}>
          {groupedResults.length === 0 && <div style={empty}>No results entered for this order.</div>}

          {groupedResults.map((group) => (
            <section key={group.testName} style={testBlock}>
              <div style={testHead}>{group.testName}</div>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Parameter</th>
                    <th style={th}>Result</th>
                    <th style={th}>Unit</th>
                    <th style={th}>Reference Range</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, index) => {
                    const abnormal = isAbnormal(row.value, row.normal_range);
                    return (
                      <tr key={`${row.parameter_name}-${index}`}>
                        <td style={td}>{row.parameter_name}</td>
                        <td style={{ ...td, ...resultCell, color: abnormal ? "#b42318" : "#14213d" }}>
                          {row.value} {abnormal ? "*" : ""}
                        </td>
                        <td style={td}>{row.unit || "-"}</td>
                        <td style={td}>{row.normal_range || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </section>

        <footer style={footer}>
          <div>
            <div style={note}>* Marked values are outside the reference range.</div>
            <div style={note}>This report should be interpreted with clinical findings.</div>
          </div>
          <div style={signature}>
            <div style={line} />
            <div>Authorized Signature</div>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={infoItem}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value}</div>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

const printCss = `
  @media print {
    .no-print, button { display: none !important; }
    body { background: white; }
    @page { size: A4; margin: 12mm; }
  }
`;

const page = {
  minHeight: "100vh",
  background: "#eef3f8",
  padding: 18,
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  maxWidth: 860,
  margin: "0 auto 12px",
};

const paper = {
  maxWidth: 860,
  margin: "0 auto",
  minHeight: 1060,
  background: "#ffffff",
  border: "1px solid #d9e3ec",
  padding: 28,
  color: "#14213d",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  borderBottom: "2px solid #14213d",
  paddingBottom: 15,
};

const brand = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const logoStyle = {
  width: 58,
  height: 58,
  objectFit: "contain" as const,
};

const logoFallback = {
  width: 58,
  height: 58,
  display: "grid",
  placeItems: "center",
  background: "#e0f2fe",
  color: "#146c94",
  fontWeight: 950,
  borderRadius: 8,
};

const labTitle = {
  fontSize: 26,
  fontWeight: 950,
};

const address = {
  marginTop: 4,
  color: "#66788a",
  fontSize: 12,
};

const reportMeta = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  textAlign: "right" as const,
  fontSize: 12,
};

const reportTitle = {
  fontSize: 15,
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
  gap: 0,
  border: "1px solid #d9e3ec",
  borderRadius: 8,
  overflow: "hidden",
  margin: "18px 0",
};

const infoItem = {
  padding: "9px 11px",
  borderRight: "1px solid #d9e3ec",
  borderBottom: "1px solid #d9e3ec",
  background: "#f7fafc",
};

const infoLabel = {
  color: "#66788a",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase" as const,
};

const infoValue = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 850,
};

const reportBody = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 14,
};

const testBlock = {
  border: "1px solid #d9e3ec",
  borderRadius: 8,
  overflow: "hidden",
};

const testHead = {
  background: "#e0f2fe",
  color: "#14213d",
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 950,
  borderBottom: "1px solid #d9e3ec",
};

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const th = {
  textAlign: "left" as const,
  background: "#14213d",
  color: "white",
  padding: "8px 10px",
  fontSize: 11,
};

const td = {
  borderBottom: "1px solid #d9e3ec",
  padding: "9px 10px",
  fontSize: 12,
};

const resultCell = {
  fontWeight: 900,
};

const footer = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 28,
  marginTop: 58,
};

const note = {
  color: "#66788a",
  fontSize: 11,
  lineHeight: 1.5,
};

const signature = {
  width: 220,
  textAlign: "center" as const,
  fontSize: 12,
  fontWeight: 800,
};

const line = {
  borderTop: "1px solid #14213d",
  marginBottom: 8,
};

const empty = {
  color: "#66788a",
  border: "1px dashed #c5d3e0",
  borderRadius: 8,
  padding: 14,
  fontSize: 13,
};
