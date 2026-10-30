import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, EyeOff, CheckSquare, Square } from "lucide-react";
import Button from "../../../components/ui/Button";
import type { ReportPatientInfo, ReportRow } from "../../../types";
import { settingsService } from "../../settings/services/settingsService";
import { getErrorMessage, testService } from "../services/testService";
import { getFlagStatus } from "../../../utils/clinicalRange";

type ReportPageProps = {
  orderId: number;
  onBack: () => void;
};

type GroupedResult = {
  testName: string;
  rows: ReportRow[];
};

export default function ReportPage({ orderId, onBack }: ReportPageProps) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [patient, setPatient] = useState<ReportPatientInfo | null>(null);
  const [labName, setLabName] = useState("SANJEEVINI DIAGNOSTICS LABORATORY");
  const [labAddress, setLabAddress] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hideHeaderFooter, setHideHeaderFooter] = useState(false);

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
        if (
          settings.lab_name &&
          settings.lab_name !== "Your Lab" &&
          settings.lab_name !== "Laboratory" &&
          settings.lab_name !== "SWEET HOME"
        ) {
          setLabName(settings.lab_name);
        } else {
          setLabName("SANJEEVINI DIAGNOSTICS LABORATORY");
        }
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

  const ageSex =
    patient?.age_sex ||
    `${patient?.age_value || "-"} ${normalizeAgeUnit(
      patient?.age_unit
    )} | ${normalizeGender(patient?.gender)}`;

  const collectionDateTime =
    patient?.collection_time || formatDateTime(patient?.order_date);
  const reportingDateTime =
    patient?.reporting_time || formatDateTime(new Date().toISOString());

  const printReport = async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => undefined)),
    );
    window.print();
  };

  return (
    <div className="sanjeevini-report-page">
      <style>{reportStyles}</style>

      {/* Toolbar for preview, hide option & print */}
      <div className="sanjeevini-report-toolbar no-print">
        <Button onClick={onBack} variant="secondary" icon={<ArrowLeft size={15} />}>
          Back to Worklist
        </Button>

        <div className="sanjeevini-toolbar-actions">
          {/* Hide Header & Footer Toggle Button */}
          <button
            type="button"
            className={`sanjeevini-toggle-btn ${hideHeaderFooter ? "sanjeevini-toggle-btn--active" : ""}`}
            onClick={() => setHideHeaderFooter((prev) => !prev)}
            title="Toggle header & footer visibility for pre-printed letterhead stationary"
          >
            {hideHeaderFooter ? (
              <CheckSquare size={16} className="text-amber-600" />
            ) : (
              <Square size={16} className="text-slate-400" />
            )}
            <span className="sanjeevini-toggle-label">
              {hideHeaderFooter ? "Hide Header & Footer (Active)" : "Hide Header & Footer"}
            </span>
            {hideHeaderFooter && (
              <span className="sanjeevini-toggle-tag">Pre-printed Paper</span>
            )}
          </button>

          {/* Print Button */}
          <Button
            onClick={() => void printReport()}
            disabled={loading || Boolean(error)}
            variant="primary"
            icon={<Printer size={15} />}
          >
            Print Report
          </Button>
        </div>
      </div>

      {/* Visual Notice when Header & Footer is hidden */}
      {hideHeaderFooter && (
        <div className="sanjeevini-hidden-banner no-print">
          <EyeOff size={14} />
          <span>
            <strong>Pre-printed Letterhead Mode:</strong> Header banner, watermark, and footer strip are hidden for printing on pre-printed stationary across all pages.
          </span>
        </div>
      )}

      {/* ── PRINT-ONLY FIXED HEADER (Repeated at top of every printed page) ── */}
      <div className="sanjeevini-print-only-header">
        {!hideHeaderFooter ? (
          <header className="sanjeevini-header">
            <div className="sanjeevini-header-inner">
              <div className="sanjeevini-header-left">
                {logoSrc ? (
                  <img src={logoSrc} alt="Lab Logo" className="sanjeevini-custom-logo" />
                ) : (
                  <AyurvedaLogo />
                )}
              </div>

              <div className="sanjeevini-header-center">
                <div className="sanjeevini-kannada-sub">ಶ್ರೀ ಕೃಷ್ಣ ಯೋಗಾಶ್ರಮ</div>
                <div className="sanjeevini-kannada-main">ಸಂಜೀವಿನಿ ಚಿಕಿತ್ಸಾಲಯ</div>
                <div className="sanjeevini-contact-line">
                  {labAddress ? (
                    labAddress
                  ) : (
                    <>ಮೊನಂ. 8088113455, 7483324754, &nbsp; ಗುಳೇದಗುಡ್ಡ -587 203</>
                  )}
                </div>
                <h1 className="sanjeevini-english-title">{labName}</h1>
              </div>

              <div className="sanjeevini-header-right">
                <DiagnosticsSeal />
              </div>
            </div>
            <div className="sanjeevini-header-stripe" />
          </header>
        ) : (
          <div className="sanjeevini-preprinted-header-spacer" />
        )}

        {/* Patient Card in Print Header */}
        <section className="sanjeevini-patient-card">
          <div className="sanjeevini-patient-left">
            <div className="sanjeevini-info-row">
              <span className="sanjeevini-info-label">Name</span>
              <span className="sanjeevini-info-colon">:</span>
              <strong className="sanjeevini-info-val sanjeevini-patient-name">
                {patient?.patient_name || "—"}
              </strong>
            </div>

            <div className="sanjeevini-info-row">
              <span className="sanjeevini-info-label">Age &amp; Sex</span>
              <span className="sanjeevini-info-colon">:</span>
              <span className="sanjeevini-info-val">{ageSex}</span>
            </div>

            <div className="sanjeevini-info-row">
              <span className="sanjeevini-info-label">Lab Ref No</span>
              <span className="sanjeevini-info-colon">:</span>
              <span className="sanjeevini-info-val">{orderId}</span>
            </div>

            <div className="sanjeevini-info-row">
              <span className="sanjeevini-info-label">Referred by</span>
              <span className="sanjeevini-info-colon">:</span>
              <span className="sanjeevini-info-val sanjeevini-referred-val">
                {patient?.referred_by || "Direct / Self"}
              </span>
            </div>
          </div>

          <div className="sanjeevini-patient-right">
            <div className="sanjeevini-info-row">
              <span className="sanjeevini-info-label">Collection Time</span>
              <span className="sanjeevini-info-colon">:</span>
              <span className="sanjeevini-info-val">{collectionDateTime}</span>
            </div>

            <div className="sanjeevini-info-row">
              <span className="sanjeevini-info-label">Receiving Time</span>
              <span className="sanjeevini-info-colon">:</span>
              <span className="sanjeevini-info-val">{collectionDateTime}</span>
            </div>

            <div className="sanjeevini-info-row">
              <span className="sanjeevini-info-label">Reporting Time</span>
              <span className="sanjeevini-info-colon">:</span>
              <span className="sanjeevini-info-val">{reportingDateTime}</span>
            </div>
          </div>
        </section>

        {/* Column Headers in Print Header */}
        <div className="sanjeevini-th-bar">
          <div style={{ width: "38%", textAlign: "left", paddingLeft: "2mm" }}>Test Name</div>
          <div style={{ width: "22%", textAlign: "center" }}>Results</div>
          <div style={{ width: "15%", textAlign: "center" }}>Units</div>
          <div style={{ width: "25%", textAlign: "center" }}>Biological Ref. Interval</div>
        </div>
      </div>

      {/* ── PRINT-ONLY FIXED FOOTER (Repeated at absolute bottom of every printed page) ── */}
      <div className="sanjeevini-print-only-footer">
        {!hideHeaderFooter ? (
          <>
            <section className="sanjeevini-footer-section">
              <div className="sanjeevini-footer-top">
                <div className="sanjeevini-disclaimer">
                  The above results are as per the sample received.
                </div>

                <div className="sanjeevini-signature-box">
                  <div className="sanjeevini-signature-title">SIGNATURE</div>
                  <div className="sanjeevini-home-service">HOME SERVICE AVAILABLE</div>
                </div>
              </div>
            </section>

            <footer className="sanjeevini-bottom-strip">
              <div className="sanjeevini-bottom-kannada">
                ಶ್ರೀ ಕೃಷ್ಣಯೋಗಾಶ್ರಮ, ಬಸವೇಶ್ವರ ನಗರ, ಗುಳೇದಗುಡ್ಡ-587203, ಜ-ಬಾಗಲಕೋಟ
              </div>
            </footer>
          </>
        ) : (
          <div className="sanjeevini-preprinted-footer-spacer" />
        )}
      </div>

      {/* ── SCREEN & PRINT MAIN DOCUMENT CONTAINER ── */}
      <div className={`sanjeevini-report-paper ${hideHeaderFooter ? "sanjeevini-report-paper--no-letterhead" : ""}`}>
        {/* Fixed Watermark */}
        {!hideHeaderFooter && (
          <div className="sanjeevini-watermark" aria-hidden="true">
            <MicroscopeWatermark />
            <div className="sanjeevini-watermark-text">SANJEEVINI DIAGNOSTICS LABORATORY</div>
          </div>
        )}

        {/* ── SCREEN VIEW: HEADER (Visible on screen) ── */}
        <div className="sanjeevini-screen-header">
          {!hideHeaderFooter ? (
            <header className="sanjeevini-header">
              <div className="sanjeevini-header-inner">
                <div className="sanjeevini-header-left">
                  {logoSrc ? (
                    <img src={logoSrc} alt="Lab Logo" className="sanjeevini-custom-logo" />
                  ) : (
                    <AyurvedaLogo />
                  )}
                </div>

                <div className="sanjeevini-header-center">
                  <div className="sanjeevini-kannada-sub">ಶ್ರೀ ಕೃಷ್ಣ ಯೋಗಾಶ್ರಮ</div>
                  <div className="sanjeevini-kannada-main">ಸಂಜೀವಿನಿ ಚಿಕಿತ್ಸಾಲಯ</div>
                  <div className="sanjeevini-contact-line">
                    {labAddress ? (
                      labAddress
                    ) : (
                      <>ಮೊನಂ. 8088113455, 7483324754, &nbsp; ಗುಳೇದಗುಡ್ಡ -587 203</>
                    )}
                  </div>
                  <h1 className="sanjeevini-english-title">{labName}</h1>
                </div>

                <div className="sanjeevini-header-right">
                  <DiagnosticsSeal />
                </div>
              </div>
              <div className="sanjeevini-header-stripe" />
            </header>
          ) : (
            <div className="sanjeevini-preprinted-header-spacer" />
          )}

          {/* Patient Demographic Card on Screen */}
          <section className="sanjeevini-patient-card">
            <div className="sanjeevini-patient-left">
              <div className="sanjeevini-info-row">
                <span className="sanjeevini-info-label">Name</span>
                <span className="sanjeevini-info-colon">:</span>
                <strong className="sanjeevini-info-val sanjeevini-patient-name">
                  {patient?.patient_name || "—"}
                </strong>
              </div>

              <div className="sanjeevini-info-row">
                <span className="sanjeevini-info-label">Age &amp; Sex</span>
                <span className="sanjeevini-info-colon">:</span>
                <span className="sanjeevini-info-val">{ageSex}</span>
              </div>

              <div className="sanjeevini-info-row">
                <span className="sanjeevini-info-label">Lab Ref No</span>
                <span className="sanjeevini-info-colon">:</span>
                <span className="sanjeevini-info-val">{orderId}</span>
              </div>

              <div className="sanjeevini-info-row">
                <span className="sanjeevini-info-label">Referred by</span>
                <span className="sanjeevini-info-colon">:</span>
                <span className="sanjeevini-info-val sanjeevini-referred-val">
                  {patient?.referred_by || "Direct / Self"}
                </span>
              </div>
            </div>

            <div className="sanjeevini-patient-right">
              <div className="sanjeevini-info-row">
                <span className="sanjeevini-info-label">Collection Time</span>
                <span className="sanjeevini-info-colon">:</span>
                <span className="sanjeevini-info-val">{collectionDateTime}</span>
              </div>

              <div className="sanjeevini-info-row">
                <span className="sanjeevini-info-label">Receiving Time</span>
                <span className="sanjeevini-info-colon">:</span>
                <span className="sanjeevini-info-val">{collectionDateTime}</span>
              </div>

              <div className="sanjeevini-info-row">
                <span className="sanjeevini-info-label">Reporting Time</span>
                <span className="sanjeevini-info-colon">:</span>
                <span className="sanjeevini-info-val">{reportingDateTime}</span>
              </div>
            </div>
          </section>
        </div>

        {/* ── TABLE WITH TEST RESULTS ── */}
        <main className="sanjeevini-report-body">
          <table className="sanjeevini-table">
            <thead>
              {/* Invisible spacer in print to push content below the fixed header */}
              <tr className="sanjeevini-print-spacer-row">
                <th colSpan={4} className="sanjeevini-thead-spacer-cell">
                  <div className={`sanjeevini-thead-spacer ${hideHeaderFooter ? "sanjeevini-thead-spacer--no-letterhead" : ""}`} />
                </th>
              </tr>

              {/* Column Header Row */}
              <tr className="sanjeevini-th-row">
                <th style={{ width: "38%", textAlign: "left", paddingLeft: "2mm" }}>Test Name</th>
                <th style={{ width: "22%", textAlign: "center" }}>Results</th>
                <th style={{ width: "15%", textAlign: "center" }}>Units</th>
                <th style={{ width: "25%", textAlign: "center" }}>Biological Ref. Interval</th>
              </tr>
            </thead>

            <tfoot>
              {/* Invisible spacer in print to prevent content overlapping the fixed footer */}
              <tr className="sanjeevini-print-spacer-row">
                <td colSpan={4} className="sanjeevini-tfoot-spacer-cell">
                  <div className={`sanjeevini-tfoot-spacer ${hideHeaderFooter ? "sanjeevini-tfoot-spacer--no-letterhead" : ""}`} />
                </td>
              </tr>
            </tfoot>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>
                    <div className="sanjeevini-state-box">
                      <span className="ui-spinner" style={{ marginRight: 8 }} />
                      Loading verified lab report findings…
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4}>
                    <div className="sanjeevini-state-box sanjeevini-state-box--error">
                      {error}
                    </div>
                  </td>
                </tr>
              ) : groupedResults.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="sanjeevini-state-box">
                      No laboratory results recorded for this order.
                    </div>
                  </td>
                </tr>
              ) : (
                groupedResults.map((group) => (
                  <React.Fragment key={group.testName}>
                    {/* Panel / Investigation Header */}
                    <tr className="sanjeevini-panel-row">
                      <td colSpan={4}>
                        <div className="sanjeevini-panel-title">
                          {group.testName.toUpperCase()}
                        </div>
                      </td>
                    </tr>

                    {/* Parameter Rows */}
                    {group.rows.map((row, idx) => {
                      const flag = getFlagStatus(row.value, row.normal_range);
                      const isAbnormal = flag === "High" || flag === "Low";

                      return (
                        <tr
                          key={idx}
                          className={`sanjeevini-data-row ${
                            isAbnormal ? "sanjeevini-data-row--flagged" : ""
                          }`}
                        >
                          {/* Test / Parameter Name */}
                          <td className="sanjeevini-cell-test" style={{ width: "38%" }}>
                            <span className="sanjeevini-test-name">
                              {row.parameter_name || "—"}
                            </span>
                          </td>

                          {/* Result Value */}
                          <td className="sanjeevini-cell-result" style={{ width: "22%" }}>
                            <div className="sanjeevini-result-flex">
                              <span
                                className={`sanjeevini-result-value ${
                                  isAbnormal ? "sanjeevini-result-value--flagged" : ""
                                }`}
                              >
                                {formatValue(row.value)}
                              </span>
                              {isAbnormal && flag && (
                                <span
                                  className={`sanjeevini-flag-pill sanjeevini-flag-pill--${flag.toLowerCase()}`}
                                >
                                  {flag}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Units */}
                          <td className="sanjeevini-cell-unit" style={{ width: "15%" }}>
                            {row.unit || "—"}
                          </td>

                          {/* Biological Ref. Interval */}
                          <td className="sanjeevini-cell-ref" style={{ width: "25%" }}>
                            {formatReferenceRange(row.normal_range, row.unit)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </main>

        {/* ── SCREEN VIEW: FOOTER (Visible at the bottom of screen preview) ── */}
        <div className="sanjeevini-screen-footer">
          {!hideHeaderFooter ? (
            <>
              <section className="sanjeevini-footer-section">
                <div className="sanjeevini-footer-top">
                  <div className="sanjeevini-disclaimer">
                    The above results are as per the sample received.
                  </div>

                  <div className="sanjeevini-signature-box">
                    <div className="sanjeevini-signature-title">SIGNATURE</div>
                    <div className="sanjeevini-home-service">HOME SERVICE AVAILABLE</div>
                  </div>
                </div>
              </section>

              <footer className="sanjeevini-bottom-strip">
                <div className="sanjeevini-bottom-kannada">
                  ಶ್ರೀ ಕೃಷ್ಣಯೋಗಾಶ್ರಮ, ಬಸವೇಶ್ವರ ನಗರ, ಗುಳೇದಗುಡ್ಡ-587203, ಜ-ಬಾಗಲಕೋಟ
                </div>
              </footer>
            </>
          ) : (
            <div className="sanjeevini-preprinted-footer-spacer" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── ACCURATE SVG LOGOS & EMBLEMS (Matching Attached Letterhead) ──

function AyurvedaLogo() {
  return (
    <div className="sanjeevini-ayurveda-card">
      <svg width="44" height="34" viewBox="0 0 60 46" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Left Mortar & Pestle */}
        <path d="M12 12L20 22" stroke="#136336" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M7 20C7 26 11 30 16 30C21 30 25 26 25 20H7Z" fill="#136336" />
        <ellipse cx="16" cy="20" rx="9" ry="2" fill="#22c55e" />

        {/* Right 6 Dots / Grains stack (3 rows of 2) */}
        <circle cx="36" cy="14" r="2.5" fill="#136336" />
        <circle cx="44" cy="14" r="2.5" fill="#136336" />
        <circle cx="36" cy="21" r="2.5" fill="#136336" />
        <circle cx="44" cy="21" r="2.5" fill="#136336" />
        <circle cx="36" cy="28" r="2.5" fill="#136336" />
        <circle cx="44" cy="28" r="2.5" fill="#136336" />

        {/* Bottom Curved Leaves */}
        <path
          d="M12 36C20 34 26 40 26 40C26 40 32 34 40 36C34 43 26 42 26 42C26 42 18 43 12 36Z"
          fill="#136336"
        />
      </svg>
      <div className="sanjeevini-ayurveda-text">
        <span>Sanjeevini Ayurveda</span>
        <span>and Holistic Centre</span>
      </div>
    </div>
  );
}

function DiagnosticsSeal() {
  return (
    <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer maroon circle */}
      <circle cx="50" cy="50" r="47" fill="#881337" stroke="#ffffff" strokeWidth="2" />
      <circle cx="50" cy="50" r="42" fill="#9f1239" />
      <circle cx="50" cy="50" r="33" fill="#ffffff" />

      {/* Circular Text Top & Bottom */}
      <path id="sealTop" d="M 18 50 A 32 32 0 0 1 82 50" fill="none" />
      <text fill="#ffffff" fontSize="7.8" fontWeight="800" letterSpacing="0.4">
        <textPath href="#sealTop" startOffset="50%" textAnchor="middle">
          SANJEEVINI DIAGNOSTICS
        </textPath>
      </text>

      <path id="sealBottom" d="M 82 50 A 32 32 0 0 1 18 50" fill="none" />
      <text fill="#ffffff" fontSize="7.8" fontWeight="800" letterSpacing="0.8">
        <textPath href="#sealBottom" startOffset="50%" textAnchor="middle">
          GULEDAGUDD
        </textPath>
      </text>

      {/* Microscope Illustration */}
      <g transform="translate(35, 30) scale(0.75)">
        {/* Eyepiece / Head */}
        <path d="M18 4L26 12L21 17L13 9L18 4Z" fill="#1e293b" />
        <path d="M23 15L20 22" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        {/* Curved Arm */}
        <path d="M12 12C8 16 8 28 14 32C18 34 24 32 24 32" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* Focus Knob */}
        <circle cx="12" cy="24" r="3.5" fill="#881337" />
        {/* Stage */}
        <line x1="16" y1="26" x2="34" y2="26" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        {/* Base */}
        <path d="M6 36H32C32 36 30 40 20 40C10 40 6 36 6 36Z" fill="#881337" />
      </g>
    </svg>
  );
}

function MicroscopeWatermark() {
  return (
    <svg width="280" height="280" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M38 12L52 20L44 34L30 26L38 12Z"
        stroke="#165b32"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M48 27L58 33L54 40L44 34L48 27Z"
        stroke="#165b32"
        strokeWidth="2"
      />
      <path
        d="M30 38C30 38 25 45 25 58C25 72 36 78 48 78C60 78 68 70 68 58"
        stroke="#165b32"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="48" cy="56" r="6" stroke="#165b32" strokeWidth="2.5" />
      <line x1="28" y1="62" x2="68" y2="62" stroke="#165b32" strokeWidth="3" strokeLinecap="round" />
      <rect x="22" y="80" width="56" height="8" rx="2" stroke="#165b32" strokeWidth="3" />
    </svg>
  );
}

// ── UTILITY HELPERS ──

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

  return cleanRange;
}

function formatDateTime(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, "0");

  return `${day}-${month}-${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
}

function normalizeAgeUnit(unit?: string) {
  const value = String(unit || "").toLowerCase();
  if (value.startsWith("year")) return "Year";
  if (value.startsWith("month")) return "Month";
  if (value.startsWith("day")) return "Days";
  return unit || "Year";
}

function normalizeGender(gender?: string) {
  const value = String(gender || "").toLowerCase();
  if (value.startsWith("male")) return "Male";
  if (value.startsWith("female")) return "Female";
  if (value.startsWith("other")) return "Other";
  return "-";
}

// ── COMPREHENSIVE STYLES: FULL SCREEN PREVIEW & MULTI-PAGE PRINT PINNING ──

const reportStyles = `
  .sanjeevini-report-page {
    min-height: 100%;
    padding: 16px 20px 40px;
    background: #e2e8f0;
    color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }

  /* Toolbar */
  .sanjeevini-report-toolbar {
    width: 210mm;
    max-width: 100%;
    margin: 0 auto 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .sanjeevini-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Toggle button */
  .sanjeevini-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12.5px;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .sanjeevini-toggle-btn:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #0f172a;
  }

  .sanjeevini-toggle-btn--active {
    background: #fefce8;
    border-color: #eab308;
    color: #854d0e;
    box-shadow: 0 0 0 1px #eab308;
  }

  .sanjeevini-toggle-label {
    user-select: none;
  }

  .sanjeevini-toggle-tag {
    font-size: 10.5px;
    background: #fef08a;
    color: #713f12;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  /* Notice Banner */
  .sanjeevini-hidden-banner {
    width: 210mm;
    max-width: 100%;
    margin: 0 auto 10px;
    padding: 8px 14px;
    background: #fffbeb;
    border: 1px dashed #f59e0b;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #92400e;
  }

  /* ── A4 PRINTABLE SHEET CONTAINER (Screen view) ── */
  .sanjeevini-report-paper {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    box-shadow: 0 12px 36px rgba(15, 23, 42, 0.14);
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .sanjeevini-report-paper--no-letterhead {
    border-top: 2px dashed #e2e8f0;
  }

  /* Hidden on screen, enabled during print */
  .sanjeevini-print-only-header,
  .sanjeevini-print-only-footer,
  .sanjeevini-print-spacer-row {
    display: none;
  }

  /* Watermark */
  .sanjeevini-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 0;
    opacity: 0.045;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .sanjeevini-watermark-text {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 3px;
    color: #165b32;
    margin-top: 10px;
    text-align: center;
  }

  /* Header Banner */
  .sanjeevini-header {
    background: #136336;
    color: #ffffff;
    position: relative;
    box-sizing: border-box;
    padding: 6mm 8mm 4mm;
  }

  .sanjeevini-header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .sanjeevini-header-left {
    flex: 0 0 45mm;
    display: flex;
    align-items: center;
  }

  .sanjeevini-custom-logo {
    height: 18mm;
    max-width: 40mm;
    object-fit: contain;
    background: #ffffff;
    border-radius: 4px;
    padding: 2px;
  }

  .sanjeevini-ayurveda-card {
    background: #ffffff;
    border: 1.5px solid #136336;
    border-radius: 3px;
    padding: 3px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }

  .sanjeevini-ayurveda-text {
    font-size: 7px;
    font-weight: 800;
    color: #136336;
    text-align: center;
    line-height: 1.1;
    margin-top: 2px;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif;
  }

  .sanjeevini-header-center {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5px;
  }

  .sanjeevini-kannada-sub {
    font-size: 14px;
    font-weight: 700;
    color: #fde047;
    line-height: 1.2;
    letter-spacing: 0.02em;
    font-family: 'Segoe UI', Tahoma, 'Noto Sans Kannada', sans-serif;
  }

  .sanjeevini-kannada-main {
    font-size: 20px;
    font-weight: 800;
    color: #fde047;
    line-height: 1.2;
    letter-spacing: 0.03em;
    font-family: 'Segoe UI', Tahoma, 'Noto Sans Kannada', sans-serif;
  }

  .sanjeevini-contact-line {
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.02em;
    margin: 1px 0;
  }

  .sanjeevini-english-title {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    color: #fde047;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-family: 'Times New Roman', Georgia, serif;
  }

  .sanjeevini-header-right {
    flex: 0 0 45mm;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .sanjeevini-header-stripe {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: #ffffff;
    border-bottom: 2px solid #136336;
  }

  .sanjeevini-preprinted-header-spacer {
    height: 30mm;
    width: 100%;
  }

  .sanjeevini-preprinted-footer-spacer {
    height: 28mm;
    width: 100%;
  }

  /* Patient Demographics Card */
  .sanjeevini-patient-card {
    margin: 2.5mm 8mm 2.5mm;
    border: 1.5px solid #1e293b;
    border-radius: 2px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 2.5mm 4mm;
    font-size: 11px;
    line-height: 1.45;
    background: #ffffff;
    column-gap: 8mm;
  }

  .sanjeevini-patient-left,
  .sanjeevini-patient-right {
    display: flex;
    flex-direction: column;
    gap: 1.5mm;
  }

  .sanjeevini-info-row {
    display: flex;
    align-items: baseline;
  }

  .sanjeevini-info-label {
    width: 30mm;
    font-weight: 600;
    color: #1e293b;
    flex-shrink: 0;
  }

  .sanjeevini-info-colon {
    width: 4mm;
    font-weight: 700;
    color: #1e293b;
    flex-shrink: 0;
  }

  .sanjeevini-info-val {
    flex: 1;
    color: #0f172a;
    font-weight: 600;
    word-break: break-word;
  }

  .sanjeevini-patient-name {
    font-size: 11.5px;
    font-weight: 700;
    color: #0f172a;
  }

  .sanjeevini-referred-val {
    font-weight: 600;
    color: #0f172a;
  }

  /* Table Header Bar for Screen */
  .sanjeevini-report-body {
    flex: 1;
    padding: 0 8mm;
    position: relative;
    z-index: 1;
  }

  .sanjeevini-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 11px;
    line-height: 1.35;
  }

  .sanjeevini-th-row th,
  .sanjeevini-th-bar {
    border-top: 1.5px solid #1e293b;
    border-bottom: 1.5px solid #1e293b;
    padding: 1.8mm 2mm;
    font-size: 11px;
    font-weight: 800;
    color: #0f172a;
    background: #f8fafc;
    letter-spacing: 0.02em;
  }

  .sanjeevini-th-bar {
    display: flex;
    align-items: center;
    margin: 0 8mm;
    box-sizing: border-box;
  }

  .sanjeevini-panel-row td {
    padding: 3.5mm 2mm 1mm;
    background: transparent;
  }

  .sanjeevini-panel-title {
    font-size: 11.5px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .sanjeevini-data-row td {
    padding: 1.6mm 2mm;
    border-bottom: 1px solid #f1f5f9;
    color: #1e293b;
    vertical-align: middle;
  }

  .sanjeevini-cell-test {
    text-align: left;
    padding-left: 2mm;
  }

  .sanjeevini-test-name {
    font-weight: 500;
    color: #0f172a;
    font-size: 11px;
  }

  .sanjeevini-cell-result {
    text-align: center;
  }

  .sanjeevini-result-flex {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .sanjeevini-result-value {
    font-weight: 700;
    font-size: 11.5px;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }

  .sanjeevini-result-value--flagged {
    color: #b91c1c;
    font-weight: 800;
  }

  .sanjeevini-flag-pill {
    font-size: 9px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 2px;
    letter-spacing: 0.02em;
  }

  .sanjeevini-flag-pill--high {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
  }

  .sanjeevini-flag-pill--low {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  .sanjeevini-cell-unit {
    text-align: center;
    font-size: 11px;
    color: #334155;
  }

  .sanjeevini-cell-ref {
    text-align: center;
    font-size: 11px;
    color: #334155;
    font-variant-numeric: tabular-nums;
  }

  /* Footer disclaimer & signatures on Screen */
  .sanjeevini-screen-footer {
    margin-top: auto;
    position: relative;
    z-index: 1;
  }

  .sanjeevini-footer-section {
    padding: 3mm 8mm 2mm;
    background: #ffffff;
  }

  .sanjeevini-footer-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-bottom: 2mm;
  }

  .sanjeevini-disclaimer {
    font-size: 10px;
    color: #334155;
    font-style: italic;
  }

  .sanjeevini-signature-box {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .sanjeevini-signature-title {
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.05em;
  }

  .sanjeevini-home-service {
    font-size: 9.5px;
    font-weight: 600;
    color: #334155;
    letter-spacing: 0.03em;
  }

  /* Bottom Green Strip */
  .sanjeevini-bottom-strip {
    background: #136336;
    color: #ffffff;
    text-align: center;
    padding: 2.5mm 4mm;
    margin-top: 0;
  }

  .sanjeevini-bottom-kannada {
    font-size: 11.5px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.02em;
    font-family: 'Segoe UI', Tahoma, 'Noto Sans Kannada', sans-serif;
  }

  .sanjeevini-state-box {
    padding: 24px;
    text-align: center;
    border: 1px dashed #cbd5e1;
    color: #64748b;
    border-radius: 4px;
    margin: 8mm 0;
  }

  .sanjeevini-state-box--error {
    color: #b91c1c;
    border-color: #fca5a5;
    background: #fef2f2;
  }

  /* ── PRINT RULES (Multi-Page Running Headers & Footers) ── */
  @media print {
    .no-print,
    .sanjeevini-report-toolbar,
    .sanjeevini-hidden-banner,
    .sanjeevini-screen-header,
    .sanjeevini-screen-footer,
    button {
      display: none !important;
    }

    /* Enable print-only fixed running header and running footer */
    .sanjeevini-print-only-header {
      display: block !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      z-index: 100 !important;
      background: #ffffff !important;
    }

    .sanjeevini-print-only-footer {
      display: block !important;
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      z-index: 100 !important;
      background: #ffffff !important;
    }

    .sanjeevini-print-spacer-row {
      display: table-row !important;
    }

    .sanjeevini-th-row {
      display: none !important; /* already in fixed print header */
    }

    html,
    body,
    #root {
      width: 100% !important;
      min-width: 0 !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .app-shell,
    .app-main,
    .page-content,
    .sanjeevini-report-page {
      display: block !important;
      width: 100% !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    .sanjeevini-report-paper {
      width: 100% !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      display: block !important;
    }

    .sanjeevini-report-paper--no-letterhead {
      border: none !important;
    }

    /* Fixed Watermark across all pages */
    .sanjeevini-watermark {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      z-index: 0 !important;
    }

    .sanjeevini-report-body {
      padding: 0 8mm !important;
    }

    .sanjeevini-table {
      width: 100% !important;
      border-collapse: collapse !important;
    }

    .sanjeevini-table thead {
      display: table-header-group !important;
    }

    .sanjeevini-table tfoot {
      display: table-footer-group !important;
    }

    .sanjeevini-table tbody {
      display: table-row-group !important;
    }

    /* Spacers reserve height for fixed running header and fixed running footer */
    .sanjeevini-thead-spacer-cell,
    .sanjeevini-tfoot-spacer-cell {
      padding: 0 !important;
      border: none !important;
    }

    .sanjeevini-thead-spacer {
      display: block !important;
      height: 78mm !important;
    }

    .sanjeevini-thead-spacer--no-letterhead {
      height: 70mm !important;
    }

    .sanjeevini-tfoot-spacer {
      display: block !important;
      height: 25mm !important;
    }

    .sanjeevini-tfoot-spacer--no-letterhead {
      height: 28mm !important;
    }

    .sanjeevini-table tbody tr,
    .sanjeevini-panel-row,
    .sanjeevini-data-row {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .sanjeevini-panel-row {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }
  }
`;