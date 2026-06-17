import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Printer } from "lucide-react";
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

type FlagStatus = "High" | "Low" | "";

const KANNADA_NAME_MAP: Record<string, string> = {
  GANI: "ಗಣಿ",
  "GANI LAB": "ಗಣಿ ಲ್ಯಾಬ್",
  "GANI DIAGNOSTIC": "ಗಣಿ ಡಯಾಗ್ನೋಸ್ಟಿಕ್",
  "GANI DIAGNOSTICS": "ಗಣಿ ಡಯಾಗ್ನೋಸ್ಟಿಕ್ಸ್",
  "GANI DIAGNOSTICS LABORATORY": "ಗಣಿ ಡಯಾಗ್ನೋಸ್ಟಿಕ್ಸ್ ಲ್ಯಾಬೊರೇಟರಿ",
};

export default function ReportPage({ orderId, onBack }: ReportPageProps) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [patient, setPatient] = useState<ReportPatientInfo | null>(null);
  const [labName, setLabName] = useState("GANI");
  const [labAddress, setLabAddress] = useState("Your Address");
  const [logo, setLogo] = useState("");
  const [showHeader, setShowHeader] = useState(false);
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
        setLabName(settings.lab_name || "GANI");
        setLabAddress(settings.lab_address || "Your Address");
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

  const kannadaLabName = getKannadaLabName(labName);

  const ageSex = `${patient?.age_value || "-"} ${normalizeAgeUnit(
    patient?.age_unit
  )} | ${normalizeGender(patient?.gender)}`;

  const orderDateTime = formatDateTime(patient?.order_date);
  const reportingDateTime = formatDateTime(new Date().toISOString());

  return (
    <div className="doctor-report-page-v5">
      <style>{reportCss}</style>

      <div className="doctor-report-toolbar-v5 no-print">
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

        <Button onClick={() => window.print()} disabled={loading || Boolean(error)} icon={<Printer size={16} />}>
          Print Report
        </Button>
      </div>

      <article
        className={[
          "doctor-report-paper-v5",
          showHeader ? "doctor-report-paper-v5--with-header" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showHeader && (
          <header className="doctor-report-letterhead-v5">
            <div className="doctor-report-letterhead-v5__logo">
              {logoSrc ? (
                <img src={logoSrc} alt="Lab logo" />
              ) : (
                <div className="doctor-report-logo-fallback-v5">LAB</div>
              )}
            </div>

            <div className="doctor-report-letterhead-v5__center">
              <div className="doctor-report-kannada-v5">{kannadaLabName}</div>
              <p>{labAddress || "Your Address"}</p>
            </div>

            <div className="doctor-report-letterhead-v5__seal">
              <span>LAB</span>
            </div>
          </header>
        )}

        <section className="doctor-report-patient-box-v5">
          <div className="doctor-report-patient-box-v5__left">
            <InfoLine label="Name" value={patient?.patient_name || "-"} />
            <InfoLine label="Age & Sex" value={ageSex} />
            <InfoLine label="Lab Ref No" value={String(orderId)} />
            <InfoLine label="Referred by" value={patient?.referred_by || "Self"} />
          </div>

          <div className="doctor-report-patient-box-v5__right">

            <InfoLine label="Collection Time" value={orderDateTime} />
            <InfoLine label="Receiving Time" value={orderDateTime} />
            <InfoLine label="Reporting Time" value={reportingDateTime} />
          </div>
        </section>

        <main className="doctor-report-content-v5">
          {loading && (
            <div className="doctor-report-state-v5">Loading report...</div>
          )}

          {!loading && error && (
            <div className="doctor-report-state-v5 doctor-report-state-v5--error">
              {error}
            </div>
          )}

          {!loading && !error && groupedResults.length === 0 && (
            <div className="doctor-report-state-v5">
              No results entered for this order.
            </div>
          )}

          {!loading && !error && groupedResults.length > 0 && (
            <>
              <div className="doctor-report-result-head-v5">
                <div>Test Name</div>
                <div>Results</div>
                <div>Units</div>
                <div>
                  Biological Ref.
                  <br />
                  Interval
                </div>
              </div>

              <div className="doctor-report-result-body-v5">
                {groupedResults.map((group) => (
                  <ResultGroup key={group.testName} group={group} />
                ))}
              </div>

              <div className="doctor-report-end-v5">
                <span />
                End of Report
                <span />
              </div>
            </>
          )}
        </main>

        <footer className="doctor-report-footer-v5">
          <div className="doctor-report-note-v5">
            The above results are as per the sample received.
          </div>

          <div className="doctor-report-signature-v5">
            <div />
            <strong>SIGNATURE</strong>
          </div>
        </footer>

        {showHeader && (
          <div className="doctor-report-bottom-strip-v5">
            {labAddress || "Your Address"}
          </div>
        )}
      </article>
    </div>
  );
}

function ResultGroup({ group }: { group: GroupedResult }) {
  return (
    <section className="doctor-report-group-v5">
      <div className="doctor-report-group-title-v5">{group.testName}</div>

      {group.rows.map((row, index) => {
        const flag = getFlagStatus(row.value, row.normal_range);

        return (
          <div
            key={`${group.testName}-${row.parameter_name}-${index}`}
            className={[
              "doctor-report-result-row-v5",
              flag ? "doctor-report-result-row-v5--flagged" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="doctor-report-test-name-v5">
              {row.parameter_name || "-"}
            </div>

            <div className="doctor-report-result-value-v5">
              <span className="doctor-report-result-number-v5">
                {formatValue(row.value)}
              </span>

              <span className="doctor-report-result-flag-v5">{flag}</span>
            </div>

            <div className="doctor-report-unit-v5">{row.unit || "-"}</div>

            <div className="doctor-report-range-v5">
              {formatReferenceRange(row.normal_range, row.unit)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="doctor-report-info-line-v5">
      <span>{label}</span>
      <b>:</b>
      <strong>{value}</strong>
    </div>
  );
}

function getKannadaLabName(name: string) {
  const key = String(name || "").trim().toUpperCase();
  return KANNADA_NAME_MAP[key] || "ಗಣಿ";
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
  .doctor-report-page-v5 {
    min-height: 100%;
    padding: 18px;
    background: #edf3f7;
    color: #000000;
  }

  .doctor-report-toolbar-v5 {
    width: 210mm;
    max-width: 100%;
    margin: 0 auto 12px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .doctor-report-paper-v5 {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #cfcfcf;
    box-shadow: 0 16px 44px rgba(15, 23, 42, 0.16);
    padding: 10mm 12mm;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13.2px;
    line-height: 1.2;
    position: relative;
    box-sizing: border-box;
  }

  .doctor-report-paper-v5--with-header {
    padding-top: 0;
  }

  .doctor-report-letterhead-v5 {
    height: 34mm;
    margin: 0 -12mm 6mm;
    padding: 4mm 12mm;
    background: #2c3d20;
    color: #fff1c8;
    display: grid;
    grid-template-columns: 32mm 1fr 32mm;
    align-items: center;
    box-sizing: border-box;
  }

  .doctor-report-letterhead-v5__logo {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .doctor-report-letterhead-v5__logo img,
  .doctor-report-logo-fallback-v5 {
    width: 25mm;
    height: 25mm;
    background: #ffffff;
    object-fit: contain;
  }

  .doctor-report-logo-fallback-v5 {
    display: grid;
    place-items: center;
    color: #2c3d20;
    font-weight: 900;
  }

  .doctor-report-letterhead-v5__center {
    text-align: center;
    min-width: 0;
  }

  .doctor-report-kannada-v5 {
    font-size: 22px;
    font-weight: 900;
    line-height: 1.1;
    margin-bottom: 2px;
  }

  .doctor-report-letterhead-v5__center h1 {
    margin: 0;
    font-size: 21px;
    line-height: 1.1;
    letter-spacing: 0.08em;
    font-weight: 900;
  }

  .doctor-report-letterhead-v5__center p {
    margin: 4px 0 0;
    font-size: 12px;
    color: #fff8df;
  }

  .doctor-report-letterhead-v5__seal {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .doctor-report-letterhead-v5__seal span {
    width: 24mm;
    height: 24mm;
    border: 1.5px solid #fff1c8;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: 17px;
    font-weight: 900;
  }

  .doctor-report-patient-box-v5 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid #111111;
    min-height: 35mm;
    margin-bottom: 3mm;
  }

  .doctor-report-patient-box-v5__left,
  .doctor-report-patient-box-v5__right {
    padding: 3.6mm 4.5mm;
    box-sizing: border-box;
  }

  .doctor-report-patient-box-v5__left {
    border-right: 1px solid #111111;
  }

  .doctor-report-info-line-v5 {
    display: grid;
    grid-template-columns: 30mm 4mm minmax(0, 1fr);
    gap: 1mm;
    align-items: start;
    margin-bottom: 2.2mm;
    font-size: 13.4px;
    line-height: 1.15;
  }

  .doctor-report-info-line-v5:last-child {
    margin-bottom: 0;
  }

  .doctor-report-info-line-v5 span {
    font-weight: 800;
    white-space: nowrap;
  }

  .doctor-report-info-line-v5 b {
    font-weight: 800;
    text-align: center;
  }

  .doctor-report-info-line-v5 strong {
    font-weight: 700;
    display: block;
    min-width: 0;
    word-break: normal;
    overflow-wrap: anywhere;
  }

  .doctor-report-barcode-v5 {
    height: 7mm;
    margin-bottom: 2mm;
    text-align: center;
    font-family: "Courier New", monospace;
    font-size: 20px;
    line-height: 7mm;
    letter-spacing: 2px;
    white-space: nowrap;
    overflow: hidden;
  }

  .doctor-report-content-v5 {
    min-height: 168mm;
  }

  .doctor-report-state-v5 {
    padding: 22px;
    border: 1px dashed #999999;
    text-align: center;
    font-weight: 700;
  }

  .doctor-report-state-v5--error {
    color: #b91c1c;
    border-color: #b91c1c;
  }

    .doctor-report-result-head-v5 {
    display: grid;
    grid-template-columns: 42% 20% 16% 22%;
    border-top: 1px solid #111111;
    border-bottom: 1px solid #111111;
    padding: 1.6mm 0;
    font-size: 13.8px;
    font-weight: 800;
    line-height: 1.05;
  }

  .doctor-report-result-head-v5 div {
    padding: 0 2mm;
    box-sizing: border-box;
  }

  .doctor-report-result-head-v5 div:nth-child(1) {
    text-align: left;
  }

  .doctor-report-result-head-v5 div:nth-child(2),
  .doctor-report-result-head-v5 div:nth-child(3),
  .doctor-report-result-head-v5 div:nth-child(4) {
    text-align: center;
  }

  .doctor-report-result-body-v5 {
    padding-top: 5mm;
  }

  .doctor-report-group-v5 {
    margin-bottom: 6mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .doctor-report-group-title-v5 {
    font-weight: 800;
    font-size: 13.8px;
    margin-bottom: 1.6mm;
    padding-left: 2mm;
  }

  .doctor-report-result-row-v5 {
    display: grid;
    grid-template-columns: 42% 20% 16% 22%;
    min-height: 5.2mm;
    align-items: baseline;
    font-size: 13.2px;
  }

  .doctor-report-result-row-v5 > div {
    padding: 0.55mm 2mm;
    box-sizing: border-box;
    min-width: 0;
  }

  .doctor-report-test-name-v5 {
    text-align: left;
    font-weight: 400;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .doctor-report-result-value-v5 {
    display: grid;
    grid-template-columns: 18mm 13mm;
    column-gap: 3mm;
    justify-content: center;
    align-items: baseline;
    white-space: nowrap;
  }

  .doctor-report-result-number-v5 {
    display: block;
    width: 18mm;
    text-align: right;
    font-weight: 400;
  }

  .doctor-report-result-flag-v5 {
    display: block;
    width: 13mm;
    text-align: left;
    font-weight: 800;
  }

  .doctor-report-unit-v5 {
    text-align: center;
    font-weight: 400;
    white-space: nowrap;
  }

  .doctor-report-range-v5 {
    text-align: center;
    font-weight: 400;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .doctor-report-result-row-v5--flagged .doctor-report-test-name-v5,
  .doctor-report-result-row-v5--flagged .doctor-report-result-number-v5,
  .doctor-report-result-row-v5--flagged .doctor-report-result-flag-v5,
  .doctor-report-result-row-v5--flagged .doctor-report-unit-v5,
  .doctor-report-result-row-v5--flagged .doctor-report-range-v5 {
    font-weight: 800;
  }

  .doctor-report-result-row-v5--flagged .doctor-report-result-number-v5 {
    text-decoration: underline;
  }

  .doctor-report-unit-v5,
  .doctor-report-range-v5 {
    text-align: center;
    font-weight: 400;
  }

  .doctor-report-end-v5 {
    margin-top: 7mm;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    font-size: 13px;
  }

  .doctor-report-end-v5 span {
    width: 22mm;
    border-top: 1px solid #111111;
  }

  .doctor-report-footer-v5 {
    margin-top: 28mm;
    display: grid;
    grid-template-columns: 1fr 55mm;
    gap: 10mm;
    align-items: end;
  }

  .doctor-report-note-v5 {
    font-size: 13.2px;
  }

  .doctor-report-signature-v5 {
    text-align: center;
    font-size: 13px;
    letter-spacing: 0.08em;
  }

  .doctor-report-signature-v5 div {
    height: 16mm;
  }

  .doctor-report-signature-v5 strong {
    font-weight: 600;
  }

  .doctor-report-bottom-strip-v5 {
    margin: 8mm -12mm -10mm;
    min-height: 11mm;
    background: #2c3d20;
    color: #fff1c8;
    display: grid;
    place-items: center;
    text-align: center;
    font-size: 15px;
    font-weight: 800;
  }

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
    .doctor-report-page-v5 {
      display: block !important;
      width: 210mm !important;
      max-width: none !important;
      min-height: 297mm !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: #ffffff !important;
    }

    .doctor-report-paper-v5 {
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      padding: 10mm 12mm !important;
      border: none !important;
      box-shadow: none !important;
      page-break-after: always;
    }

    .doctor-report-paper-v5--with-header {
      padding-top: 0 !important;
    }

    @page {
      size: A4;
      margin: 0;
    }
  }
`;