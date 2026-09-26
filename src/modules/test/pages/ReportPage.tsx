import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Printer } from "lucide-react";
import Button from "../../../components/ui/Button";
import type { ReportPatientInfo, ReportRow } from "../../../types";
import { settingsService } from "../../settings/services/settingsService";
import { getErrorMessage, testService } from "../services/testService";

type ReportPageProps = {
  orderId: number;
  onBack: () => void;
  /**
   * When true, the report automatically triggers the OS print dialog once the
   * data has loaded and the report DOM is rendered. Used by
   * "Print Report Again" so the button actually prints (not just previews).
   */
  autoPrint?: boolean;
};

type GroupedResult = {
  testName: string;
  rows: ReportRow[];
};

type FlagStatus = "High" | "Low" | "";

const LAB_NAME_FALLBACK = "LABORATORY INFORMATION SYSTEM";

export default function ReportPage({ orderId, onBack, autoPrint = false }: ReportPageProps) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [patient, setPatient] = useState<ReportPatientInfo | null>(null);
  const [labName, setLabName] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [logo, setLogo] = useState("");
  const [showHeader, setShowHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const hasAutoPrinted = useRef(false);

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
        setLabName(settings.lab_name || "");
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
      const testName = row.test_name || "LABORATORY TEST";
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

  const displayLabName = labName.trim() || LAB_NAME_FALLBACK;

  const ageSex = `${patient?.age_value || "-"} ${normalizeAgeUnit(
    patient?.age_unit
  )} | ${normalizeGender(patient?.gender)}`;

  // Lab Ref No must never expose the internal DB order id — use the invoice
  // number returned with the patient info, falling back to a neutral placeholder.
  const labRefNo = String(patient?.invoice_no || "").trim() || "-";

  const orderDateTime = formatDateTime(patient?.order_date);
  const reportGeneratedAt = formatDateTime(new Date().toISOString());

  const patientCode = String(patient?.patient_code || "").trim();
  const patientPhone = String(patient?.phone || "").trim();

  const hasResults = groupedResults.length > 0;

  // "Print Report Again": once the report has finished loading and the DOM is
  // rendered, open the OS print dialog. This is the same window.print() used by
  // the toolbar button — preview and print share the same report DOM.
  useEffect(() => {
    if (!autoPrint || hasAutoPrinted.current) return;
    if (loading || error || !hasResults) return;

    hasAutoPrinted.current = true;
    const timer = window.setTimeout(() => {
      window.print();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [autoPrint, loading, error, hasResults]);

  return (
    <div className="lab-report-page">
      <style>{reportCss}</style>

      <div className="lab-report-toolbar no-print">
        <Button onClick={onBack} variant="secondary" icon={<ArrowLeft size={16} />}>
          Back
        </Button>

        <Button
          onClick={() => setShowHeader((current) => !current)}
          variant="secondary"
          icon={showHeader ? <EyeOff size={16} /> : <Eye size={16} />}
        >
          {showHeader ? "Hide Header" : "Show Header"}
        </Button>

        <Button
          onClick={() => window.print()}
          disabled={loading || Boolean(error)}
          icon={<Printer size={16} />}
        >
          Print Report
        </Button>
      </div>

      <article className={`lab-report-paper${showHeader ? "" : " lab-report-paper--no-header"}`}>
        {showHeader && (
          <header className="lab-report-letterhead">
            {logoSrc && (
              <div className="lab-report-letterhead__logo">
                <img src={logoSrc} alt="" />
              </div>
            )}

            <div className="lab-report-letterhead__brand">
              <h1 className="lab-report-letterhead__name">{displayLabName}</h1>
              <p className="lab-report-letterhead__tagline">Laboratory</p>
              {labAddress.trim() && (
                <p className="lab-report-letterhead__address">{labAddress}</p>
              )}
            </div>
          </header>
        )}

        <div className="lab-report-title">
          <h2>Laboratory Report</h2>
          <p>Diagnostic Test Results</p>
        </div>

        <section className="lab-report-patient">
          <div className="lab-report-patient__title">Patient Information</div>
          <div className="lab-report-patient__grid">
            <InfoLine label="Patient Name" value={patient?.patient_name || "-"} />
            <InfoLine label="Age / Sex" value={ageSex} />
            <InfoLine label="Lab Ref No" value={labRefNo} />
            <InfoLine label="Referred By" value={patient?.referred_by || "Self"} />
            {patientCode && <InfoLine label="Patient ID" value={patientCode} />}
            {patientPhone && <InfoLine label="Phone" value={patientPhone} />}
            <InfoLine label="Collection Time" value={orderDateTime} />
            <InfoLine label="Report Generated" value={reportGeneratedAt} />
          </div>
        </section>

        <main className="lab-report-content">
          {loading && <div className="lab-report-state">Loading report...</div>}

          {!loading && error && (
            <div className="lab-report-state lab-report-state--error">{error}</div>
          )}

          {!loading && !error && !hasResults && (
            <div className="lab-report-state">No results entered for this order.</div>
          )}

          {!loading && !error && hasResults && (
            <>
              <table className="lab-report-table">
                <colgroup>
                  <col className="lab-report-col--param" />
                  <col className="lab-report-col--value" />
                  <col className="lab-report-col--unit" />
                  <col className="lab-report-col--range" />
                </colgroup>

                {/* The <thead> MUST contain only the real column header row.
                   Browsers/WebViews repeat the whole <thead> on every printed
                   page, so anything else placed here (e.g. a "Continued"
                   banner) would also render on PAGE 1. Continuation pages
                   therefore reproduce just these four column headings. */}
                <thead>
                  <tr>
                    <th className="lab-report-th--left">Test / Parameter</th>
                    <th>Result</th>
                    <th>Unit</th>
                    <th>Biological Reference Interval</th>
                  </tr>
                </thead>

                <tbody>
                  {groupedResults.map((group) => (
                    <ResultGroup key={group.testName} group={group} />
                  ))}
                </tbody>
              </table>

              <div className="lab-report-end">End of Report</div>
            </>
          )}
        </main>

        <footer className="lab-report-footer">
          <p className="lab-report-footer__note">
            This report is generated from the laboratory information system.
          </p>

          <div className="lab-report-signature">
            <div className="lab-report-signature__space" />
            <div className="lab-report-signature__line" />
            <strong className="lab-report-signature__title">Authorized Signatory</strong>
            <span className="lab-report-signature__hint">Signature</span>
          </div>
        </footer>
      </article>
    </div>
  );
}

function ResultGroup({ group }: { group: GroupedResult }) {
  return (
    <>
      <tr className="lab-report-group-row">
        <td colSpan={4}>{group.testName}</td>
      </tr>

      {group.rows.map((row, index) => {
        const flag = getFlagStatus(row.value, row.normal_range);
        const rowClass =
          flag === "High"
            ? "lab-report-row lab-report-row--high"
            : flag === "Low"
              ? "lab-report-row lab-report-row--low"
              : "lab-report-row";

        return (
          <tr key={`${group.testName}-${row.parameter_name}-${index}`} className={rowClass}>
            <td className="lab-report-cell lab-report-cell--param">
              {row.parameter_name || "-"}
            </td>

            <td className="lab-report-cell lab-report-cell--value">
              <span className="lab-report-value">{formatValue(row.value)}</span>
              {flag && (
                <span
                  className={`lab-report-flag lab-report-flag--${flag.toLowerCase()}`}
                >
                  {flag === "High" ? "▲" : "▼"}&nbsp;{flag.toUpperCase()}
                </span>
              )}
            </td>

            <td className="lab-report-cell lab-report-cell--unit">{row.unit || "-"}</td>

            <td className="lab-report-cell lab-report-cell--range">
              {formatReferenceRange(row.normal_range, row.unit)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="lab-report-info">
      <span className="lab-report-info__label">{label}</span>
      <span className="lab-report-info__value">{value}</span>
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

  if (value.startsWith("year")) return "Year";
  if (value.startsWith("month")) return "Month";
  if (value.startsWith("day")) return "Day";

  return unit || "Year";
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
    if (Number.isNaN(max)) return "";
    return num > max ? "High" : "";
  }

  if (cleanRange.startsWith("<")) {
    const max = Number.parseFloat(cleanRange.replace("<", ""));
    if (Number.isNaN(max)) return "";
    return num >= max ? "High" : "";
  }

  if (cleanRange.startsWith(">=")) {
    const min = Number.parseFloat(cleanRange.replace(">=", ""));
    if (Number.isNaN(min)) return "";
    return num < min ? "Low" : "";
  }

  if (cleanRange.startsWith(">")) {
    const min = Number.parseFloat(cleanRange.replace(">", ""));
    if (Number.isNaN(min)) return "";
    return num <= min ? "Low" : "";
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

  return "";
}

const reportCss = `
  /* ── Screen shell ───────────────────────────────────────── */
  .lab-report-page {
    min-height: 100%;
    padding: 18px;
    background: #eef3f2;
    color: #111827;
  }

  .lab-report-toolbar {
    width: 210mm;
    max-width: 100%;
    margin: 0 auto 12px;
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* ── A4 paper (screen preview) ──────────────────────────── */
  .lab-report-paper {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #dde7e6;
    border-radius: 3px;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.14);
    padding: 12mm 14mm;
    box-sizing: border-box;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: #111827;
  }

  /* ── WITHOUT HEADER: reserved pre-printed letterhead area ───
     When the header is hidden, the report is intended for paper that
     already carries the laboratory's physical letterhead, so clean blank
     space is reserved above the report title.

     Geometry vs. the physical A4 top edge:
       12mm  base paper padding (applies in both header modes)
     + 43mm  reserved band below
     ───────
       55mm  TOTAL from the paper's top edge to "LABORATORY REPORT"

     padding-top (not margin) is used so the reserved band repeats
     naturally at the top of EVERY printed page when the table spans
     multiple pages — exactly like the physical pre-printed letterhead.
     A tall table row cannot carry a band across a page break, so a
     spacer element would only cover page 1. */
  .lab-report-paper--no-header {
    padding-top: 43mm;
  }

  /* ── Letterhead ─────────────────────────────────────────── */
  .lab-report-letterhead {
    display: flex;
    align-items: center;
    gap: 4mm;
    padding-bottom: 3mm;
    border-bottom: 2px solid #0f766e;
    margin-bottom: 3.5mm;
  }

  .lab-report-letterhead__logo {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lab-report-letterhead__logo img {
    width: 18mm;
    height: 18mm;
    object-fit: contain;
  }

  .lab-report-letterhead__brand {
    min-width: 0;
  }

  .lab-report-letterhead__name {
    margin: 0;
    font-size: 21px;
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: 0.02em;
    color: #134e4a;
  }

  .lab-report-letterhead__tagline {
    margin: 0.8mm 0 0;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #0f766e;
  }

  .lab-report-letterhead__address {
    margin: 1.5mm 0 0;
    font-size: 10px;
    line-height: 1.4;
    color: #475569;
  }

  /* ── Report title ───────────────────────────────────────── */
  .lab-report-title {
    text-align: center;
    margin: 0 0 3.5mm;
  }

  .lab-report-title h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #111827;
  }

  .lab-report-title p {
    margin: 1mm 0 0;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
  }

  /* ── Patient information ────────────────────────────────── */
  .lab-report-patient {
    border: 1px solid #d5e7e4;
    border-radius: 1.5mm;
    background: #f0fdfa;
    /* Tighter padding/row-gap offsets the larger label/value text so the
       card stays the same compact height. */
    padding: 2.6mm 4mm 2.8mm;
    margin-bottom: 3.5mm;
  }

  .lab-report-patient__title {
    margin-bottom: 1.4mm;
    padding-bottom: 0.8mm;
    border-bottom: 1px solid #cfe9e5;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #0f766e;
  }

  /* 2-column compact metadata grid: label + value on one line */
  .lab-report-patient__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 8mm;
    row-gap: 1.2mm;
  }

  .lab-report-info {
    display: grid;
    grid-template-columns: 24mm minmax(0, 1fr);
    align-items: baseline;
    column-gap: 2mm;
    min-width: 0;
    line-height: 1.25;
  }

  .lab-report-info__label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #0f766e;
    white-space: nowrap;
  }

  .lab-report-info__value {
    font-size: 12px;
    font-weight: 600;
    color: #111827;
    overflow-wrap: anywhere;
  }

  /* ── Result table ───────────────────────────────────────── */
  .lab-report-content {
    /* No forced min-height: content flows naturally so short reports stay
       compact and long reports paginate without large blank areas. */
  }

  .lab-report-state {
    padding: 10mm;
    border: 1px dashed #dde7e6;
    border-radius: 2mm;
    text-align: center;
    font-size: 11.5px;
    color: #475569;
  }

  .lab-report-state--error {
    border-color: #dc2626;
    color: #dc2626;
  }

  .lab-report-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 12.5px;
    color: #111827;
  }

  .lab-report-col--param {
    width: 44%;
  }
  .lab-report-col--value {
    width: 16%;
  }
  .lab-report-col--unit {
    width: 15%;
  }
  .lab-report-col--range {
    width: 25%;
  }

  .lab-report-table thead th {
    padding: 2.2mm 2.5mm;
    text-align: center;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #134e4a;
    background: #f0fdfa;
    border-top: 1.5px solid #0f766e;
    border-bottom: 1px solid #0f766e;
  }

  .lab-report-table thead th.lab-report-th--left {
    text-align: left;
  }

  .lab-report-table tbody td {
    padding: 2mm 2.5mm;
    vertical-align: top;
    border-bottom: 1px solid #e6efee;
    font-size: 12.5px;
    line-height: 1.4;
  }

  .lab-report-table tbody tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Group heading: keep with the first rows of its group */
  .lab-report-table tbody tr.lab-report-group-row td {
    padding: 3.2mm 2.5mm 1.8mm;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #134e4a;
    background: #f8fbfa;
    border-left: 2.5px solid #14b8a6;
    border-bottom: 1px solid #dde7e6;
    break-after: avoid;
    page-break-after: avoid;
  }

  .lab-report-cell--param {
    text-align: left;
    overflow-wrap: anywhere;
  }

  .lab-report-cell--value,
  .lab-report-cell--unit,
  .lab-report-cell--range {
    text-align: center;
  }

  .lab-report-value {
    font-weight: 700;
  }

  .lab-report-flag {
    display: inline-block;
    margin-left: 1.5mm;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .lab-report-flag--high {
    color: #dc2626;
  }

  .lab-report-flag--low {
    color: #2563eb;
  }

  .lab-report-row--high {
    background: rgba(220, 38, 38, 0.05);
  }

  .lab-report-row--high .lab-report-value {
    color: #dc2626;
    font-weight: 800;
  }

  .lab-report-row--low {
    background: rgba(37, 99, 235, 0.05);
  }

  .lab-report-row--low .lab-report-value {
    color: #2563eb;
    font-weight: 800;
  }

  .lab-report-end {
    margin: 3.5mm 0 0;
    text-align: center;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  /* ── Footer + signature ─────────────────────────────────── */
  .lab-report-footer {
    /* Sits closer to the results so short reports do not leave a large
       gap below the table (visible as blank space on the last page). */
    margin-top: 4mm;
    padding-top: 3mm;
    border-top: 1px solid #dde7e6;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .lab-report-footer__note {
    margin: 0;
    max-width: 62%;
    font-size: 10px;
    line-height: 1.5;
    color: #475569;
  }

  .lab-report-signature {
    margin-left: auto;
    min-width: 45mm;
    text-align: center;
  }

  .lab-report-signature__space {
    height: 10mm;
  }

  .lab-report-signature__line {
    border-top: 1px solid #475569;
  }

  .lab-report-signature__title {
    display: block;
    margin-top: 1.5mm;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #111827;
  }

  .lab-report-signature__hint {
    display: block;
    margin-top: 0.5mm;
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
  }

  /* ── Print: same DOM, chrome stripped ───────────────────── */
  @media print {
    .no-print,
    button {
      display: none !important;
    }

    html,
    body,
    #root {
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: #ffffff !important;
    }

    .app-shell,
    .app-main,
    .page-content,
    .page-content--print,
    .lab-report-page {
      display: block !important;
      width: 210mm !important;
      max-width: none !important;
      height: auto !important;
      max-height: none !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: #ffffff !important;
    }

    /* Override the global.css print-view scaffolding (!important there too) */
    .app-shell:has(.app-main--print) {
      display: block !important;
      width: 210mm !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      background: #ffffff !important;
    }

    .app-main--print {
      display: block !important;
      width: 210mm !important;
      max-width: none !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    .lab-report-paper {
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      padding: 12mm 14mm !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: #ffffff !important;
      /* Preserve the light teal header strip and abnormal-result tints in print */
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* WITHOUT HEADER: keep the reserved letterhead band — 43mm here plus the
       12mm base paper padding above gives the 55mm total offset from the
       physical A4 top edge. The explicit print value re-asserts it at full
       specificity so it cannot be lost, and as paper padding it repeats at the
       top of every printed page. */
    .lab-report-paper.lab-report-paper--no-header {
      padding-top: 43mm !important;
    }

    /* Repeat column headings on every page */
    .lab-report-table thead {
      display: table-header-group;
    }

    .lab-report-table tbody tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .lab-report-table tbody tr.lab-report-group-row {
      break-after: avoid;
      page-break-after: avoid;
    }

    .lab-report-footer {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    @page {
      size: A4;
      margin: 0;
    }
  }
`;
