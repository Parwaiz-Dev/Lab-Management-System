import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import Button from "../../../components/ui/Button";
import type { ReportPatientInfo, ReportRow } from "../../../types";
import { settingsService } from "../../settings/services/settingsService";
import { getErrorMessage, testService } from "../services/testService";

type ReportPageProps = {
  orderId: number;
  onBack: () => void;
};

type GroupedResult = {
  testName: string;
  rows: ReportRow[];
};

type FlagStatus = "High" | "Low" | "Normal" | "";

export default function ReportPage({ orderId, onBack }: ReportPageProps) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [patient, setPatient] = useState<ReportPatientInfo | null>(null);
  const [labName, setLabName] = useState("Laboratory");
  const [labAddress, setLabAddress] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);
        setError("");

        const [reportRows, patientInfo, settings] = await Promise.all([
          testService.getReport(orderId),
          testService.getPatientByOrder(orderId),
          settingsService.getLabSettings(),
        ]);

        setRows(reportRows || []);
        setPatient(patientInfo);
        setLabName(settings.lab_name || "Laboratory");
        setLabAddress(settings.lab_address || "");
        setLogo(settings.lab_logo || "");
      } catch (err) {
        console.error("Report load failed:", err);
        setError(getErrorMessage(err, "Failed to load report"));
      } finally {
        setLoading(false);
      }
    };

    void loadReport();
  }, [orderId]);

  const groupedResults = useMemo<GroupedResult[]>(() => {
    const groups: GroupedResult[] = [];

    rows.forEach((row) => {
      const testName = row.test_name || "LABORATORY INVESTIGATION";
      const existing = groups.find((group) => group.testName === testName);

      if (existing) {
        existing.rows.push(row);
      } else {
        groups.push({ testName, rows: [row] });
      }
    });

    return groups;
  }, [rows]);

  const logoSrc = useMemo(() => settingsService.getLogoSrc(logo), [logo]);

  const ageSex = `${patient?.age_value || "-"} ${normalizeAgeUnit(
    patient?.age_unit
  )} / ${normalizeGender(patient?.gender)}`;

  const orderDateTime = formatDateTime(patient?.order_date);
  const reportingDateTime = formatDateTime(new Date().toISOString());

  const printReport = async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => undefined)),
    );
    window.print();
  };

  return (
    <div className="clinical-report-page">
      <style>{reportCss}</style>

      {/* Toolbar for preview & print */}
      <div className="clinical-report-toolbar no-print">
        <Button onClick={onBack} variant="secondary" icon={<ArrowLeft size={15} />}>
          Back to Worklist
        </Button>

        <Button
          onClick={() => void printReport()}
          disabled={loading || Boolean(error)}
          variant="primary"
          icon={<Printer size={15} />}
        >
          Print Report
        </Button>
      </div>

      {/* Main Printable A4 Report Paper */}
      <article
        className={[
          "clinical-report-paper",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Header Letterhead */}
        <header className="clinical-report-header">
            <div className="clinical-report-header__left">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="Lab Logo"
                  className="clinical-report-logo-img"
                />
              ) : (
                <div className="clinical-report-emblem">
                  <div className="clinical-report-emblem__shield">
                    <span className="clinical-report-emblem__cross">✚</span>
                  </div>
                </div>
              )}

              <div className="clinical-report-brand">
                <h1 className="clinical-report-title">{labName || "Laboratory"}</h1>
                {labAddress && <div className="clinical-report-address">{labAddress}</div>}
              </div>
            </div>

            {/* <div className="clinical-report-header__right">
              <div className="clinical-report-barcode">
                *{String(orderId).padStart(6, "0")}*
              </div>
            </div> */}
          </header>

        {/* Patient Demographic & Specimen Information */}
        <section className="clinical-patient-card">
          <div className="clinical-patient-grid">
            <div className="clinical-patient-cell">
              <span className="clinical-field-label">Patient Name</span>
              <span className="clinical-field-value clinical-field-value--bold">
                {patient?.patient_name || "—"}
              </span>
            </div>

            <div className="clinical-patient-cell">
              <span className="clinical-field-label">Lab Reference #</span>
              <span className="clinical-field-value font-mono">
                ORD-{String(orderId).padStart(5, "0")}
              </span>
            </div>

            <div className="clinical-patient-cell">
              <span className="clinical-field-label">Age / Gender</span>
              <span className="clinical-field-value">{ageSex}</span>
            </div>

            <div className="clinical-patient-cell">
              <span className="clinical-field-label">Order Date</span>
              <span className="clinical-field-value font-mono">{orderDateTime}</span>
            </div>

            <div className="clinical-patient-cell">
              <span className="clinical-field-label">Patient ID / UHID</span>
              <span className="clinical-field-value font-mono">
                {patient?.patient_code || `P-${orderId}`}
              </span>
            </div>

            <div className="clinical-patient-cell">
              <span className="clinical-field-label">Referred By</span>
              <span className="clinical-field-value clinical-field-value--bold">
                {patient?.referred_by || "Self / Direct Walk-in"}
              </span>
            </div>

            <div className="clinical-patient-cell">
              <span className="clinical-field-label">Report Generated</span>
              <span className="clinical-field-value font-mono">{reportingDateTime}</span>
            </div>
          </div>
        </section>

        {/* Clinical Report Investigation Content */}
        <main className="clinical-report-content">
          {loading && (
            <div className="clinical-report-state">
              Loading verified lab report findings…
            </div>
          )}

          {!loading && error && (
            <div className="clinical-report-state clinical-report-state--error">
              {error}
            </div>
          )}

          {!loading && !error && groupedResults.length === 0 && (
            <div className="clinical-report-state">
              No results recorded for this laboratory order.
            </div>
          )}

          {!loading && !error && groupedResults.length > 0 && (
            <div className="clinical-table-container">
              <table className="clinical-report-table">
                <thead>
                  <tr>
                    <th style={{ width: "36%" }}>TEST / PARAMETER</th>
                    <th style={{ width: "18%", textAlign: "center" }}>OBSERVED VALUE</th>
                    <th style={{ width: "12%", textAlign: "center" }}>FLAG</th>
                    <th style={{ width: "14%", textAlign: "center" }}>UNITS</th>
                    <th style={{ width: "20%", textAlign: "center" }}>REFERENCE INTERVAL</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedResults.map((group) => (
                    <React.Fragment key={group.testName}>
                      <tr className="clinical-panel-header-row">
                        <td colSpan={5}>
                          <div className="clinical-panel-name">
                            {group.testName.toUpperCase()}
                          </div>
                        </td>
                      </tr>
                      {group.rows.map((row, idx) => {
                        const flag = getFlagStatus(row.value, row.normal_range);
                        return (
                          <tr
                            key={idx}
                            className={`clinical-data-row ${
                              flag === "High" || flag === "Low"
                                ? "clinical-data-row--flagged"
                                : ""
                            }`}
                          >
                            <td className="clinical-test-title">
                              {row.parameter_name || "—"}
                            </td>

                            <td
                              className="clinical-observed-val"
                              style={{ textAlign: "center" }}
                            >
                              <span
                                className={
                                  flag === "High" || flag === "Low"
                                    ? "clinical-val--flagged font-mono"
                                    : "font-mono"
                                }
                              >
                                {formatValue(row.value)}
                              </span>
                            </td>

                            <td style={{ textAlign: "center" }}>
                              {flag === "High" ? (
                                <span className="clinical-flag clinical-flag--high">
                                  HIGH
                                </span>
                              ) : flag === "Low" ? (
                                <span className="clinical-flag clinical-flag--low">
                                  LOW
                                </span>
                              ) : flag === "Normal" ? (
                                <span className="clinical-flag clinical-flag--normal">
                                  NORMAL
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>—</span>
                              )}
                            </td>

                            <td
                              style={{
                                textAlign: "center",
                                fontFamily: "var(--font-mono)",
                                fontSize: "11px",
                              }}
                            >
                              {row.unit || "—"}
                            </td>

                            <td
                              style={{
                                textAlign: "center",
                                fontFamily: "var(--font-mono)",
                                fontSize: "11px",
                              }}
                            >
                              {formatReferenceRange(row.normal_range, row.unit)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* <div className="clinical-report-end">
                <span className="clinical-end-line" />
                <span>*** End of Examination Report ***</span>
                <span className="clinical-end-line" />
              </div> */}
            </div>
          )}
        </main>

        {/* Clinical Interpretation Disclaimer Notes */}
        {/* Signatures Block */}
        {/* <footer className="clinical-report-footer">
          <div className="clinical-signature-col">
            <div className="clinical-signature-space" />
            <div className="clinical-signature-line" />
            <div className="clinical-signatory-name">Authorized Signatory</div>
          </div>
        </footer> */}

        {/* Bottom Strip */}
        {/* <div className="clinical-report-strip">Computer-generated laboratory report</div> */}
      </article>
    </div>
  );
}

function formatValue(value: string) {
  const clean = String(value || "").trim();
  return clean || "-";
}

function formatReferenceRange(range: string, unit: string) {
  const cleanRange = String(range || "").trim();
  const cleanUnit = String(unit || "").trim();

  if (!cleanRange) return "-";
  if (!cleanUnit) return cleanRange;

  if (cleanRange.toLowerCase().includes(cleanUnit.toLowerCase())) {
    return cleanRange;
  }

  return `${cleanRange} ${cleanUnit}`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const datePart = date
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");

  const timePart = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart} ${timePart.toLowerCase()}`;
}

function normalizeAgeUnit(unit?: string) {
  const value = String(unit || "").toLowerCase();

  if (value.startsWith("year")) return "Yrs";
  if (value.startsWith("month")) return "Mo";
  if (value.startsWith("day")) return "Days";

  return unit || "Yrs";
}

function normalizeGender(gender?: string) {
  const value = String(gender || "").toLowerCase();

  if (value.startsWith("male")) return "Male";
  if (value.startsWith("female")) return "Female";
  if (value.startsWith("other")) return "Other";

  return "-";
}

function getFlagStatus(value: string, range: string): FlagStatus {
  const num = Number.parseFloat(String(value || "").replace(/,/g, ""));
  if (Number.isNaN(num) || !range) return "";

  const cleanRange = String(range || "").trim().toLowerCase();
  if (!cleanRange) return "";

  if (cleanRange.startsWith("<=")) {
    const max = Number.parseFloat(cleanRange.replace("<=", ""));
    if (!Number.isNaN(max)) return num > max ? "High" : "Normal";
  }

  if (cleanRange.startsWith("<")) {
    const max = Number.parseFloat(cleanRange.replace("<", ""));
    if (!Number.isNaN(max)) return num >= max ? "High" : "Normal";
  }

  if (cleanRange.startsWith(">=")) {
    const min = Number.parseFloat(cleanRange.replace(">=", ""));
    if (!Number.isNaN(min)) return num < min ? "Low" : "Normal";
  }

  if (cleanRange.startsWith(">")) {
    const min = Number.parseFloat(cleanRange.replace(">", ""));
    if (!Number.isNaN(min)) return num <= min ? "Low" : "Normal";
  }

  const match = cleanRange.match(
    /(-?\d+(\.\d+)?)\s*(?:-|to)\s*(-?\d+(\.\d+)?)/
  );

  if (!match) return "";

  const min = Number.parseFloat(match[1]);
  const max = Number.parseFloat(match[3]);

  if (Number.isNaN(min) || Number.isNaN(max)) return "";

  if (num < min) return "Low";
  if (num > max) return "High";

  return "Normal";
}

const reportCss = `
  .clinical-report-page {
    min-height: 100%;
    padding: 16px;
    background: #edf2f7;
    color: #0f172a;
  }

  .clinical-report-toolbar {
    width: 210mm;
    max-width: 100%;
    margin: 0 auto 12px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .clinical-report-paper {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    padding: 8mm 10mm;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 11.5px;
    line-height: 1.3;
    position: relative;
    box-sizing: border-box;
  }

  .clinical-report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 3.5mm;
    border-bottom: 2px solid #0f172a;
    margin-bottom: 3mm;
  }

  .clinical-report-header__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .clinical-report-logo-img {
    height: 16mm;
    max-width: 32mm;
    object-fit: contain;
  }

  .clinical-report-emblem {
    width: 13mm;
    height: 13mm;
    border-radius: 4px;
    background: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
  }

  .clinical-report-emblem__shield {
    font-size: 18px;
    font-weight: 900;
    color: #ffffff;
  }

  .clinical-report-brand {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .clinical-report-title {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #0f172a;
    text-transform: uppercase;
  }

  .clinical-report-address {
    font-size: 10px;
    color: #475569;
  }

  .clinical-report-header__right {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
  }

  .clinical-report-barcode {
    font-family: "Courier New", Courier, monospace;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #0f172a;
    background: #f1f5f9;
    padding: 1px 6px;
    border-radius: 2px;
  }

  /* Patient Card Box */
  .clinical-patient-card {
    border: 1px solid #0f172a;
    border-radius: 2px;
    margin-bottom: 3.5mm;
    background: #fafafa;
  }

  .clinical-patient-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: 1.5mm;
    column-gap: 4mm;
    padding: 2.5mm 3.5mm;
  }

  .clinical-patient-cell {
    display: grid;
    grid-template-columns: 28mm 1fr;
    font-size: 11px;
    line-height: 1.25;
  }

  .clinical-field-label {
    font-weight: 700;
    color: #475569;
  }

  .clinical-field-value {
    color: #0f172a;
    word-break: break-word;
  }

  .clinical-field-value--bold {
    font-weight: 700;
    color: #0f172a;
  }

  /* Main Table */
  .clinical-report-state {
    padding: 20px;
    text-align: center;
    border: 1px dashed #cbd5e1;
    color: #64748b;
  }

  .clinical-report-state--error {
    color: #b91c1c;
    border-color: #fca5a5;
  }

  .clinical-table-container {
    width: 100%;
  }

  .clinical-report-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .clinical-report-table thead th {
    border-top: 1.5px solid #0f172a;
    border-bottom: 1.5px solid #0f172a;
    padding: 1.8mm 1.5mm;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.03em;
    color: #0f172a;
    background: #f8fafc;
  }

  .clinical-panel-header-row td {
    padding: 2mm 1.5mm 1mm;
    background: transparent;
  }

  .clinical-panel-name {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #1e293b;
    border-bottom: 1px solid #94a3b8;
    padding-bottom: 1px;
    display: inline-block;
  }

  .clinical-data-row td {
    padding: 1.4mm 1.5mm;
    border-bottom: 1px solid #e2e8f0;
    color: #1e293b;
  }

  .clinical-data-row--flagged td {
    background: rgba(254, 242, 242, 0.4);
  }

  .clinical-test-title {
    font-weight: 500;
  }

  .clinical-val--flagged {
    font-weight: 800;
    color: #b91c1c;
    text-decoration: underline;
  }

  .clinical-flag {
    display: inline-block;
    padding: 0 4px;
    font-size: 9px;
    font-weight: 800;
    border-radius: 2px;
  }

  .clinical-flag--high {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
  }

  .clinical-flag--low {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  .clinical-flag--normal {
    color: #15803d;
    font-weight: 600;
  }

  .clinical-report-end {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3mm;
    margin: 4mm 0 2mm;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
  }

  .clinical-end-line {
    width: 25mm;
    border-top: 1px solid #cbd5e1;
  }

  /* Signatures */
  .clinical-report-footer {
    display: flex;
    justify-content: center;
    margin-top: 8mm;
    padding: 0 4mm;
  }

  .clinical-signature-col {
    width: 55mm;
    text-align: center;
  }

  .clinical-signature-space {
    height: 12mm;
  }

  .clinical-signature-line {
    border-top: 1px solid #0f172a;
    margin-bottom: 1.5mm;
  }

  .clinical-signatory-name {
    font-weight: 700;
    font-size: 11px;
    color: #0f172a;
  }

  .clinical-signatory-title {
    font-size: 9.5px;
    color: #64748b;
  }

  /* Bottom Strip */
  .clinical-report-strip {
    border-top: 1px solid #e2e8f0;
    margin-top: 4mm;
    padding-top: 1.5mm;
    display: flex;
    justify-content: center;
    gap: 6px;
    font-size: 9px;
    color: #94a3b8;
  }

  /* Print Isolation */
  @media print {
    .no-print,
    button {
      display: none !important;
    }

    html,
    body,
    #root {
      width: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      overflow: visible !important;
    }

    .app-shell,
    .app-main,
    .page-content,
    .clinical-report-page {
      display: block !important;
      width: auto !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      overflow: visible !important;
    }

    .clinical-report-paper {
      width: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }

    .clinical-report-header,
    .clinical-patient-card,
    .clinical-panel-header-row,
    .clinical-data-row,
    .clinical-report-end,
    .clinical-report-footer {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .clinical-panel-header-row {
      break-after: avoid;
      page-break-after: avoid;
    }

    .clinical-report-table thead {
      display: table-header-group;
    }

    @page {
      size: A4 portrait;
      margin: 10mm;
    }
  }
`;