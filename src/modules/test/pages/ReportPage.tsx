import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, EyeOff, CheckSquare, Square } from "lucide-react";
import Button from "../../../components/ui/Button";
import type { ReportPatientInfo, ReportRow } from "../../../types";
import { getErrorMessage, testService } from "../services/testService";
import { getFlagStatus } from "../../../utils/clinicalRange";
import {
  calculateEag,
  isEagParam,
  isHbA1cParam,
  isHbA1cTest,
} from "../utils/resultTypeConfig";
import sanjeeviniHeaderImg from "../../../assets/letterhead/sanjeevini-header.png";
import sanjeeviniWatermarkImg from "../../../assets/letterhead/sanjeevini-watermark.png";
import sanjeeviniFooterImg from "../../../assets/letterhead/sanjeevini-footer-full.png";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hideHeaderFooter, setHideHeaderFooter] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);
        setError("");

        const [reportRows, patientInfo] = await Promise.all([
          testService.getReport(orderId),
          testService.getPatientByOrder(orderId),
        ]);

        setRows(reportRows || []);
        setPatient(patientInfo);
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

    // Check groups for HbA1c to ensure eAG is derived if not already present
    groups.forEach((group) => {
      if (isHbA1cTest(group.testName)) {
        const hasEag = group.rows.some((r) => isEagParam(r.parameter_name));
        if (!hasEag) {
          const hba1cRow = group.rows.find((r) => isHbA1cParam(r.parameter_name)) || group.rows[0];
          const eagVal = calculateEag(hba1cRow?.value);
          const eagStr = eagVal !== null ? String(eagVal) : "—";
          const eagRow: ReportRow = {
            test_name: group.testName,
            parameter_name: "Estimated average glucose (eAG)",
            value: eagStr,
            unit: "mg/dL",
            normal_range: "90 - 120",
          };
          group.rows.push(eagRow);
        }
      }
    });

    return groups;
  }, [rows]);

  const isSingleHbA1c = useMemo(
    () => groupedResults.length === 1 && isHbA1cTest(groupedResults[0].testName),
    [groupedResults]
  );

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

    // Capture current scroll positions and document title
    const scrollContainer = document.querySelector(".page-content");
    const previousScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    const previousWindowTop = window.scrollY || window.pageYOffset || 0;
    const previousTitle = document.title;

    let restored = false;
    const restoreState = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
      if (scrollContainer) {
        scrollContainer.scrollTop = previousScrollTop;
      }
      window.scrollTo(0, previousWindowTop);
    };

    // Lifecycle hook: restore title and scroll positions ONLY after the print dialog is closed.
    // The 100 ms buffer ensures the browser print spooler thread has completely finished
    // before the DOM state is reverted.
    const handleAfterPrint = () => {
      setTimeout(restoreState, 100);
    };

    window.addEventListener("afterprint", handleAfterPrint, { once: true });

    // Reset scroll positions to top so print rendering captures Page 1 without clipping
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);

    // Suppress browser header title ('LabManager') during print
    document.title = "";

    try {
      window.print();
    } catch (err) {
      console.error("Print dialog launch failed:", err);
      // If window.print throws synchronously, restore state immediately
      restoreState();
    }
  };

  const reportStyles = useMemo(
    () => getReportStyles(hideHeaderFooter),
    [hideHeaderFooter]
  );

  const reportMainContent = (
    <main className="sanjeevini-report-body">
      <table className="sanjeevini-table">
        <colgroup>
          <col style={{ width: isSingleHbA1c ? "34%" : "38%" }} />
          <col style={{ width: isSingleHbA1c ? "18%" : "22%" }} />
          <col style={{ width: isSingleHbA1c ? "12%" : "15%" }} />
          <col style={{ width: isSingleHbA1c ? "36%" : "25%" }} />
        </colgroup>
        <thead>
          {/* Patient Card in thead: repeats cleanly at the top of every printed page */}
          <tr className="sanjeevini-patient-header-row">
            <th colSpan={4} className="sanjeevini-patient-header-cell">
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
                    <span className="sanjeevini-info-label">Patient ID</span>
                    <span className="sanjeevini-info-colon">:</span>
                    <span className="sanjeevini-info-val">{patient?.patient_code || "—"}</span>
                  </div>

                  <div className="sanjeevini-info-row">
                    <span className="sanjeevini-info-label">Age &amp; Sex</span>
                    <span className="sanjeevini-info-colon">:</span>
                    <span className="sanjeevini-info-val">{ageSex}</span>
                  </div>

                  <div className="sanjeevini-info-row">
                    <span className="sanjeevini-info-label">Lab Ref No</span>
                    <span className="sanjeevini-info-colon">:</span>
                    <span className="sanjeevini-info-val">{patient?.order_number || `LAB-${orderId}`}</span>
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

                  <div className="sanjeevini-info-row">
                    <span className="sanjeevini-info-label">Referred By</span>
                    <span className="sanjeevini-info-colon">:</span>
                    <span className="sanjeevini-info-val sanjeevini-referred-val">
                      {patient?.referred_by || "Direct / Self"}
                    </span>
                  </div>
                </div>
              </section>
            </th>
          </tr>

          {/* Column Header Row: repeats cleanly right below patient card on every printed page */}
          <tr className="sanjeevini-th-row">
            <th style={{ width: isSingleHbA1c ? "34%" : "38%", textAlign: "left", paddingLeft: "2mm" }}>Test Name</th>
            <th style={{ width: isSingleHbA1c ? "18%" : "22%", textAlign: isSingleHbA1c ? "left" : "center", paddingLeft: isSingleHbA1c ? "2mm" : undefined }}>Results</th>
            <th style={{ width: isSingleHbA1c ? "12%" : "15%", textAlign: isSingleHbA1c ? "left" : "center", paddingLeft: isSingleHbA1c ? "2mm" : undefined }}>Units</th>
            <th style={{ width: isSingleHbA1c ? "36%" : "25%", textAlign: isSingleHbA1c ? "left" : "center" }}>Biological Ref. Interval</th>
          </tr>
        </thead>

        {loading ? (
          <tbody>
            <tr>
              <td colSpan={4}>
                <div className="sanjeevini-state-box">
                  <span className="ui-spinner" style={{ marginRight: 8 }} />
                  Loading verified lab report findings…
                </div>
              </td>
            </tr>
          </tbody>
        ) : error ? (
          <tbody>
            <tr>
              <td colSpan={4}>
                <div className="sanjeevini-state-box sanjeevini-state-box--error">
                  {error}
                </div>
              </td>
            </tr>
          </tbody>
        ) : groupedResults.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={4}>
                <div className="sanjeevini-state-box">
                  No laboratory results recorded for this order.
                </div>
              </td>
            </tr>
          </tbody>
        ) : (
          groupedResults.map((group) => {
            const isHbA1c = isHbA1cTest(group.testName);

            if (isHbA1c) {
              return (
                <HbA1cReportGroup
                  key={group.testName}
                  group={group}
                  formatValue={formatValue}
                  formatReferenceRange={formatReferenceRange}
                />
              );
            }

            return (
              <tbody key={group.testName} className="sanjeevini-panel-group">
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
                  const isHigh = flag === "High";
                  const isLow = flag === "Low";
                  const isAbnormal = isHigh || isLow;

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

                      {/* Result Value - ONLY HIGH is bold */}
                      <td className="sanjeevini-cell-result" style={{ width: "22%" }}>
                        <div className="sanjeevini-result-flex">
                          <span
                            className={`sanjeevini-result-value ${
                              isHigh
                                ? "sanjeevini-result-value--high"
                                : isLow
                                ? "sanjeevini-result-value--low"
                                : "sanjeevini-result-value--normal"
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
              </tbody>
            );
          })
        )}
      </table>
    </main>
  );

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
            <strong>Pre-printed Letterhead Mode:</strong> Top 47 mm (company header) and bottom 45 mm (company footer/signature) are reserved on every page. In the print dialog, uncheck <strong>Headers and footers</strong> under <em>More settings</em> (WebView2 remembers this choice).
          </span>
        </div>
      )}

      {/* ── SCREEN & PRINT MAIN DOCUMENT CONTAINER ── */}
      <div className={`sanjeevini-report-paper ${hideHeaderFooter ? "sanjeevini-report-paper--no-letterhead" : ""}`}>
        {/* Authentic Stationery Watermark (Only in With Header & Footer mode) */}
        {!hideHeaderFooter && (
          <div className="sanjeevini-watermark" aria-hidden="true">
            <img
              src={sanjeeviniWatermarkImg}
              alt=""
              className="sanjeevini-watermark-img"
            />
          </div>
        )}

        {/* ── APPLICATION HEADER (With Header & Footer prints authentic Sanjeevini banner) ── */}
        {!hideHeaderFooter ? (
          <header className="sanjeevini-header">
            <img
              src={sanjeeviniHeaderImg}
              alt="Sanjeevini Scans & Diagnostics"
              className="sanjeevini-header-banner-img"
            />
          </header>
        ) : (
          /* On screen only: shows visual 47 mm reserved header indicator */
          <div className="sanjeevini-preprinted-header-spacer no-print" />
        )}

        {/* ── TABLE WITH PATIENT INFO & TEST RESULTS ── */}
        {!hideHeaderFooter ? (
          <table className="sanjeevini-outer-table">
            <thead>
              <tr className="sanjeevini-outer-header-spacer">
                <td />
              </tr>
            </thead>
            <tfoot>
              <tr className="sanjeevini-outer-footer-spacer">
                <td />
              </tr>
            </tfoot>
            <tbody>
              <tr>
                <td className="sanjeevini-outer-content-td">
                  {reportMainContent}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          reportMainContent
        )}

        {/* ── FOOTER: Authentic Stationery Footer (With Header & Footer) OR Reserved Spacer (Screen only) ── */}
        {!hideHeaderFooter ? (
          <footer className="sanjeevini-footer">
            <img
              src={sanjeeviniFooterImg}
              alt="Sanjeevini Stationery Footer"
              className="sanjeevini-footer-banner-img"
            />
          </footer>
        ) : (
          /* On screen only: shows visual 45 mm reserved footer indicator */
          <div className="sanjeevini-screen-footer no-print">
            <div className="sanjeevini-preprinted-footer-spacer" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── HbA1c SPECIAL CLINICAL REPORT GROUP (Matches Client Reference Screenshot) ──

function HbA1cReportGroup({
  group,
  formatValue,
  formatReferenceRange,
}: {
  group: GroupedResult;
  formatValue: (val: string | null | undefined) => string;
  formatReferenceRange: (range?: string | null, unit?: string | null) => string;
}) {
  const hba1cRow =
    group.rows.find((r) => isHbA1cParam(r.parameter_name)) || group.rows[0];

  const eagRow = group.rows.find((r) => isEagParam(r.parameter_name));
  const rawEag =
    eagRow?.value && eagRow.value !== "—"
      ? eagRow.value
      : calculateEag(hba1cRow?.value);
  const eagStr =
    rawEag !== null && rawEag !== undefined ? String(rawEag) : "—";

  const flag = getFlagStatus(
    hba1cRow?.value,
    hba1cRow?.normal_range || "4.0 - 5.6"
  );
  const isHigh = flag === "High";
  const isLow = flag === "Low";
  const isAbnormal = isHigh || isLow;

  const displayTitle = group.testName.toUpperCase().includes("GLYCO")
    ? group.testName.toUpperCase()
    : "HBA1C (GLYCOSYLATED HEMOGLOBIN)";

  const otherRows = group.rows.filter(
    (r) =>
      r !== hba1cRow &&
      r !== eagRow &&
      !isHbA1cParam(r.parameter_name) &&
      !isEagParam(r.parameter_name)
  );

  return (
    <tbody className="sanjeevini-panel-group sanjeevini-hba1c-panel-group">
      {/* 1. Investigation Title: HBA1C (GLYCOSYLATED HEMOGLOBIN) */}
      <tr className="sanjeevini-hba1c-title-row">
        <td colSpan={4} className="sanjeevini-hba1c-title-cell">
          <div className="sanjeevini-hba1c-main-title">{displayTitle}</div>
        </td>
      </tr>

      {/* 2. Row 1: HbA1c Parameter + Multi-line Biological Ref. Interval */}
      <tr className="sanjeevini-hba1c-data-row">
        {/* Test Name */}
        <td className="sanjeevini-hba1c-cell-name">
          <span className="sanjeevini-hba1c-param-name">
            {hba1cRow?.parameter_name || "HbA1c"}
          </span>
        </td>

        {/* Results: 7.2 High */}
        <td className="sanjeevini-hba1c-cell-result">
          <div className="sanjeevini-hba1c-result-wrap">
            <span
              className={`sanjeevini-hba1c-value ${
                isHigh
                  ? "sanjeevini-hba1c-value--high"
                  : isLow
                  ? "sanjeevini-hba1c-value--low"
                  : "sanjeevini-hba1c-value--normal"
              }`}
            >
              {formatValue(hba1cRow?.value)}
            </span>
            {isAbnormal && flag && (
              <span
                className={`sanjeevini-hba1c-flag sanjeevini-hba1c-flag--${flag.toLowerCase()}`}
              >
                {flag}
              </span>
            )}
          </div>
        </td>

        {/* Units: % */}
        <td className="sanjeevini-hba1c-cell-unit">
          {hba1cRow?.unit || "%"}
        </td>

        {/* Biological Ref. Interval: Aligned Multi-line List */}
        <td className="sanjeevini-hba1c-cell-ref">
          <div className="sanjeevini-hba1c-ref-list">
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-label">Non Diabetics</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-val">below 5.6</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-label">Diabetics</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-val">above 6.5</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-label">Excellent Control</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-val">6–7</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-label">Good Control</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-val">7–8</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-label">Poor Control</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-val">8–10</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-label">Very Poor Control</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-val">above 10</span>
            </div>
          </div>
        </td>
      </tr>

      {/* 3. Row 2: Estimated average glucose (eAG) + Multi-line Biological Ref. Interval */}
      <tr className="sanjeevini-hba1c-data-row">
        {/* Test Name */}
        <td className="sanjeevini-hba1c-cell-name">
          <span className="sanjeevini-hba1c-param-name">
            Estimated average glucose (eAG)
          </span>
        </td>

        {/* Results: 161 (normal weight) */}
        <td className="sanjeevini-hba1c-cell-result">
          <div className="sanjeevini-hba1c-result-wrap">
            <span className="sanjeevini-hba1c-value sanjeevini-hba1c-value--normal">
              {eagStr}
            </span>
          </div>
        </td>

        {/* Units: mg/dL */}
        <td className="sanjeevini-hba1c-cell-unit">mg/dL</td>

        {/* Biological Ref. Interval: Aligned Multi-line List */}
        <td className="sanjeevini-hba1c-cell-ref">
          <div className="sanjeevini-hba1c-ref-list">
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-range">90–120</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-status">Excellent Control</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-range">121–150</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-status">Good Control</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-range">151–180</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-status">Average Control</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-range">181–210</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-status">Action Suggested</span>
            </div>
            <div className="sanjeevini-hba1c-ref-row">
              <span className="sanjeevini-hba1c-ref-range">Above 211</span>
              <span className="sanjeevini-hba1c-ref-colon">:</span>
              <span className="sanjeevini-hba1c-ref-status">Panic Value</span>
            </div>
          </div>
        </td>
      </tr>

      {/* Any other parameters in this group (safety fallback) */}
      {otherRows.map((row, idx) => {
        const rowFlag = getFlagStatus(row.value, row.normal_range);
        const rowHigh = rowFlag === "High";
        const rowLow = rowFlag === "Low";
        const rowAbnormal = rowHigh || rowLow;

        return (
          <tr key={idx} className="sanjeevini-hba1c-data-row">
            <td className="sanjeevini-hba1c-cell-name">
              <span className="sanjeevini-hba1c-param-name">
                {row.parameter_name || "—"}
              </span>
            </td>
            <td className="sanjeevini-hba1c-cell-result">
              <div className="sanjeevini-hba1c-result-wrap">
                <span
                  className={`sanjeevini-hba1c-value ${
                    rowHigh
                      ? "sanjeevini-hba1c-value--high"
                      : rowLow
                      ? "sanjeevini-hba1c-value--low"
                      : "sanjeevini-hba1c-value--normal"
                  }`}
                >
                  {formatValue(row.value)}
                </span>
                {rowAbnormal && rowFlag && (
                  <span
                    className={`sanjeevini-hba1c-flag sanjeevini-hba1c-flag--${rowFlag.toLowerCase()}`}
                  >
                    {rowFlag}
                  </span>
                )}
              </div>
            </td>
            <td className="sanjeevini-hba1c-cell-unit">{row.unit || "—"}</td>
            <td className="sanjeevini-hba1c-cell-ref">
              {formatReferenceRange(row.normal_range, row.unit)}
            </td>
          </tr>
        );
      })}

      {/* 4. Full-Width Explanatory Clinical Notes (Matches Client Reference Verbatim) */}
      <tr className="sanjeevini-hba1c-notes-tr">
        <td colSpan={4} className="sanjeevini-hba1c-notes-td">
          <div className="sanjeevini-hba1c-notes-container">
            {/* Clinical interpretation */}
            <div className="sanjeevini-hba1c-note-para">
              HbA1c result is suggestive of Diabetes/ Higher than glycemic goal in a known Diabetic patient.
            </div>

            {/* Glycemic goal note */}
            <div className="sanjeevini-hba1c-note-para">
              Please note, Glycemic goal should be individualized based on duration of diabetes, age/life expectancy, comorbid conditions, known CVD or advanced microvascular complications, hypoglycaemia unawareness, and individual patient considerations.
            </div>

            {/* Result status */}
            <div className="sanjeevini-hba1c-note-para">
              Result Rechecked,
            </div>

            {/* Clinical correlation */}
            <div className="sanjeevini-hba1c-note-para">
              Please Correlate Clinically.
            </div>

            {/* Important Note */}
            <div className="sanjeevini-hba1c-note-para">
              Note: Presence of Hemoglobin variants and/or conditions that affect red cell turnover must be considered, particularly when the HbA1C result does not correlate with the patient's blood glucose levels.
            </div>

            {/* FACTORS THAT INTERFERE WITH HbA1C MEASUREMENT :- */}
            <div className="sanjeevini-hba1c-factor-group">
              <div className="sanjeevini-hba1c-factor-title">
                FACTORS THAT INTERFERE WITH HbA1C MEASUREMENT :-
              </div>
              <div className="sanjeevini-hba1c-factor-text">
                Hemoglobin variants, elevated fetal hemoglobin (HbF) and chemically modified derivatives of hemoglobin (e.g. carbamylated Hb in patients with renal failure) can affect the accuracy of HbA1c measurements.
              </div>
            </div>

            {/* FACTORS THAT AFFECT INTERPRETATION OF HbA1C RESULTS:- */}
            <div className="sanjeevini-hba1c-factor-group">
              <div className="sanjeevini-hba1c-factor-title">
                FACTORS THAT AFFECT INTERPRETATION OF HbA1C RESULTS:-
              </div>
              <div className="sanjeevini-hba1c-factor-text">
                Any condition that shortens erythrocyte survival or decreases mean erythrocyte age (e.g., recovery from acute blood loss, hemolytic anemia, HbSS, HbCC, and HbSC) will falsely lower HbA1c test results regardless of the assay method used. Iron deficiency anemia is associated with higher HbA1c.
              </div>
            </div>

            {/* End of Report Marker */}
            <div className="sanjeevini-hba1c-end-marker-line">
              —— End of Report ——
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  );
}

// ── UTILITY HELPERS ──

function formatValue(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || "-";
}

function formatReferenceRange(range?: string | null, unit?: string | null) {
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

// ── COMPREHENSIVE STYLES: FULL SCREEN PREVIEW & SINGLE-SOURCE A4 PAGINATION ──

function getReportStyles(hideHeaderFooter: boolean) {
  return `
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
  }

  .sanjeevini-report-paper--no-letterhead {
    border-top: 2px dashed #cbd5e1;
  }

  /* Watermark */
  .sanjeevini-watermark {
    position: absolute;
    top: 79mm;
    left: 0;
    width: 210mm;
    height: 172mm;
    pointer-events: none;
    z-index: 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .sanjeevini-watermark-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }

  /* Header Banner */
  .sanjeevini-header {
    width: 100%;
    display: block;
    margin: 0;
    padding: 0;
    flex-shrink: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sanjeevini-header-banner-img {
    width: 100%;
    display: block;
    height: auto;
  }

  /* Footer Banner */
  .sanjeevini-footer {
    width: 100%;
    margin-top: auto;
    display: block;
    position: relative;
    z-index: 2;
    flex-shrink: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sanjeevini-footer-banner-img {
    width: 100%;
    display: block;
    height: auto;
  }

  /* Outer Layout Table for repeating page spacing */
  .sanjeevini-outer-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .sanjeevini-outer-header-spacer,
  .sanjeevini-outer-footer-spacer {
    display: none;
  }

  .sanjeevini-outer-content-td {
    padding: 0;
    vertical-align: top;
  }

  /* Reserved 47 mm header spacer on screen in Without Header mode */
  .sanjeevini-preprinted-header-spacer {
    height: 47mm;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 10px,
      rgba(241, 245, 249, 0.6) 10px,
      rgba(241, 245, 249, 0.6) 20px
    );
    border-bottom: 1px dashed #cbd5e1;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* Reserved 45 mm footer spacer on screen in both modes */
  .sanjeevini-preprinted-footer-spacer {
    height: 45mm;
    width: 100%;
    margin-top: auto;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 10px,
      rgba(241, 245, 249, 0.6) 10px,
      rgba(241, 245, 249, 0.6) 20px
    );
    border-top: 1px dashed #cbd5e1;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* Patient Demographics Card inside thead */
  .sanjeevini-patient-header-cell {
    padding: 0 !important;
    border: none !important;
    background: transparent !important;
    font-weight: normal !important;
    text-align: left !important;
  }

  .sanjeevini-patient-card {
    margin: 2mm 0 2.5mm;
    border: 1px solid #475569;
    border-radius: 2px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 2mm 4mm;
    font-size: 10pt;
    line-height: 1.35;
    background: #ffffff;
    column-gap: 8mm;
    box-sizing: border-box;
    width: 100%;
  }

  .sanjeevini-patient-left,
  .sanjeevini-patient-right {
    display: flex;
    flex-direction: column;
    gap: 0.8mm;
  }

  .sanjeevini-info-row {
    display: flex;
    align-items: baseline;
  }

  .sanjeevini-info-label {
    width: 28mm;
    font-weight: 600;
    color: #334155;
    font-size: 10pt;
    flex-shrink: 0;
  }

  .sanjeevini-info-colon {
    width: 3.5mm;
    font-weight: 600;
    color: #334155;
    font-size: 10pt;
    flex-shrink: 0;
  }

  .sanjeevini-info-val {
    flex: 1;
    color: #0f172a;
    font-weight: 500;
    font-size: 10pt;
    word-break: break-word;
  }

  .sanjeevini-patient-name {
    font-size: 11pt;
    font-weight: 700;
    color: #0f172a;
  }

  .sanjeevini-referred-val {
    font-weight: 600;
    color: #0f172a;
    font-size: 10.5pt;
  }

  /* Table Body */
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
    font-size: 10.5pt;
    line-height: 1.35;
  }

  .sanjeevini-th-row th {
    border-top: 1.5px solid #1e293b;
    border-bottom: 1.5px solid #1e293b;
    padding: 2mm 2mm;
    font-size: 10.5pt;
    font-weight: 700;
    color: #0f172a;
    background: #f8fafc;
    letter-spacing: 0.02em;
  }

  .sanjeevini-panel-row td {
    padding: 3mm 2mm 1.2mm;
    background: transparent;
  }

  .sanjeevini-panel-title {
    font-size: 11.5pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .sanjeevini-data-row td {
    padding: 1.5mm 2mm;
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
    font-size: 11pt;
  }

  .sanjeevini-cell-result {
    text-align: center;
  }

  .sanjeevini-result-flex {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }

  /* Result Value: 11pt. Only HIGH is bold. NORMAL and LOW are regular. */
  .sanjeevini-result-value {
    font-size: 11pt;
    font-weight: 400;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }

  .sanjeevini-result-value--normal {
    font-weight: 400;
    color: #0f172a;
  }

  .sanjeevini-result-value--low {
    font-weight: 400;
    color: #dc2626;
    text-decoration: underline;
  }

  .sanjeevini-result-value--high {
    font-weight: 700;
    color: #dc2626;
    text-decoration: underline;
  }

  .sanjeevini-flag-pill {
    font-size: 9.5pt;
    color: #dc2626;
    text-decoration: underline;
    background: transparent;
    border: none;
    padding: 0;
    letter-spacing: 0.01em;
  }

  .sanjeevini-flag-pill--high {
    font-weight: 700;
  }

  .sanjeevini-flag-pill--low {
    font-weight: 400;
  }

  .sanjeevini-cell-unit {
    text-align: center;
    font-size: 11pt;
    color: #334155;
  }

  .sanjeevini-cell-ref {
    text-align: center;
    font-size: 11pt;
    color: #334155;
    font-variant-numeric: tabular-nums;
  }

  /* ── HbA1c SPECIAL REPORT PRESENTATION (Exact Replica of Client's Original Software Report) ── */
  .sanjeevini-hba1c-panel-group {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .sanjeevini-hba1c-title-row td {
    padding: 3mm 0 1.5mm 0;
    border: none !important;
    background: transparent !important;
  }

  .sanjeevini-hba1c-main-title {
    font-size: 11.5pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .sanjeevini-hba1c-data-row td {
    padding: 1.5mm 0 2mm 0 !important;
    border-bottom: none !important;
    vertical-align: top !important;
    background: transparent !important;
  }

  .sanjeevini-hba1c-cell-name {
    text-align: left;
    font-size: 11pt;
    font-weight: 500;
    color: #0f172a;
    padding-left: 0 !important;
  }

  .sanjeevini-hba1c-param-name {
    display: inline-block;
  }

  .sanjeevini-hba1c-cell-result {
    text-align: left;
    padding-left: 2mm !important;
  }

  .sanjeevini-hba1c-result-wrap {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
  }

  .sanjeevini-hba1c-value {
    font-size: 11pt;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }

  .sanjeevini-hba1c-value--high {
    font-weight: 700;
    text-decoration: underline;
    color: #dc2626;
  }

  .sanjeevini-hba1c-value--low {
    font-weight: 700;
    text-decoration: underline;
    color: #dc2626;
  }

  .sanjeevini-hba1c-value--normal {
    font-weight: 400;
    color: #0f172a;
    text-decoration: none;
  }

  .sanjeevini-hba1c-flag {
    font-size: 10pt;
    font-weight: 600;
    color: #dc2626;
  }

  .sanjeevini-hba1c-cell-unit {
    text-align: left;
    font-size: 11pt;
    color: #0f172a;
    padding-left: 2mm !important;
  }

  .sanjeevini-hba1c-cell-ref {
    text-align: left;
    padding-left: 0 !important;
  }

  .sanjeevini-hba1c-ref-list {
    display: flex;
    flex-direction: column;
    gap: 0.6mm;
    font-size: 9.5pt;
    line-height: 1.32;
    color: #0f172a;
  }

  .sanjeevini-hba1c-ref-row {
    display: flex;
    align-items: baseline;
    white-space: nowrap;
  }

  .sanjeevini-hba1c-ref-label {
    width: 33mm;
    flex-shrink: 0;
    color: #0f172a;
    font-weight: 500;
  }

  .sanjeevini-hba1c-ref-colon {
    width: 3.5mm;
    text-align: center;
    flex-shrink: 0;
    color: #0f172a;
  }

  .sanjeevini-hba1c-ref-val {
    color: #0f172a;
    font-weight: 600;
  }

  .sanjeevini-hba1c-ref-range {
    width: 24mm;
    flex-shrink: 0;
    color: #0f172a;
    font-weight: 500;
  }

  .sanjeevini-hba1c-ref-status {
    color: #0f172a;
    font-weight: 600;
  }

  .sanjeevini-hba1c-notes-td {
    padding: 3.5mm 0 0 0 !important;
    border: none !important;
    background: transparent !important;
  }

  .sanjeevini-hba1c-notes-container {
    display: flex;
    flex-direction: column;
    gap: 2.6mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .sanjeevini-hba1c-note-para {
    font-size: 9.5pt;
    line-height: 1.35;
    color: #0f172a;
    margin: 0;
    text-align: left;
  }

  .sanjeevini-hba1c-factor-group {
    display: flex;
    flex-direction: column;
    gap: 0.6mm;
  }

  .sanjeevini-hba1c-factor-title {
    font-size: 9.5pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.01em;
  }

  .sanjeevini-hba1c-factor-text {
    font-size: 9pt;
    line-height: 1.35;
    color: #1e293b;
    margin: 0;
  }

  .sanjeevini-hba1c-end-marker-line {
    margin-top: 4.5mm;
    margin-bottom: 2mm;
    text-align: center;
    font-size: 9.5pt;
    font-weight: 600;
    color: #475569;
    letter-spacing: 1.5px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .sanjeevini-screen-footer {
    margin-top: auto;
    position: relative;
    z-index: 1;
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

  /* ── PRINT MEDIA RULES: Clean Single-Source A4 Pagination ── */
  @media print {
    .no-print,
    .sanjeevini-report-toolbar,
    .sanjeevini-hidden-banner,
    .sanjeevini-screen-footer,
    .sanjeevini-preprinted-header-spacer,
    .sanjeevini-preprinted-footer-spacer,
    button {
      display: none !important;
    }

    html,
    body,
    #root {
      width: 100% !important;
      min-width: 0 !important;
      height: auto !important;
      overflow: visible !important;
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
      max-width: none !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      position: static !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    .sanjeevini-report-paper {
      width: ${hideHeaderFooter ? "100%" : "210mm"} !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      position: relative !important;
      display: block !important;
      background: #ffffff !important;
      overflow: visible !important;
    }

    .sanjeevini-report-paper--no-letterhead {
      border: none !important;
    }

    /* With Header mode prints authentic stationery banner on every page */
    .sanjeevini-header {
      display: ${hideHeaderFooter ? "none" : "block"} !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 100 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .sanjeevini-header-banner-img {
      width: 100% !important;
      display: block !important;
    }

    /* With Header mode prints authentic watermark on every page */
    .sanjeevini-watermark {
      display: ${hideHeaderFooter ? "none" : "flex"} !important;
      position: fixed !important;
      top: 79mm !important;
      left: 0 !important;
      width: 210mm !important;
      height: 172mm !important;
      pointer-events: none !important;
      z-index: 0 !important;
      justify-content: center !important;
      align-items: center !important;
    }

    .sanjeevini-watermark-img {
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
      pointer-events: none !important;
    }

    /* With Header mode prints authentic stationery footer pinned to bottom of every page */
    .sanjeevini-footer {
      display: ${hideHeaderFooter ? "none" : "block"} !important;
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 100 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .sanjeevini-footer-banner-img {
      width: 100% !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Outer Layout Table for repeating page spacing in With Header mode */
    .sanjeevini-outer-table {
      width: 210mm !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
    }
    .sanjeevini-outer-table thead {
      display: table-header-group !important;
    }
    .sanjeevini-outer-table tfoot {
      display: table-footer-group !important;
    }
    .sanjeevini-outer-header-spacer {
      display: table-row !important;
      height: 46.5mm !important;
    }
    .sanjeevini-outer-header-spacer td {
      height: 46.5mm !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
    }
    .sanjeevini-outer-footer-spacer {
      display: table-row !important;
      height: 32mm !important;
    }
    .sanjeevini-outer-footer-spacer td {
      height: 32mm !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
    }
    .sanjeevini-outer-content-td {
      padding: 1.5mm 8mm 0 !important;
      vertical-align: top !important;
      position: relative !important;
      z-index: 10 !important;
    }

    .sanjeevini-report-body {
      position: relative !important;
      z-index: 10 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      display: block !important;
    }

    .sanjeevini-table {
      width: 100% !important;
      border-collapse: collapse !important;
    }

    .sanjeevini-table thead {
      display: table-header-group !important;
    }

    .sanjeevini-table tbody {
      display: table-row-group !important;
    }

    .sanjeevini-patient-card {
      margin: 0 0 2mm 0 !important;
      padding: 1.5mm 3.5mm !important;
      font-size: 10pt !important;
      line-height: 1.32 !important;
      border: 1px solid #475569 !important;
      background: #ffffff !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .sanjeevini-patient-left,
    .sanjeevini-patient-right {
      gap: 0.6mm !important;
    }

    .sanjeevini-th-row th {
      padding: 1.8mm 2mm !important;
      font-size: 10.5pt !important;
      font-weight: 700 !important;
      background: #f8fafc !important;
      border-top: 1.5px solid #1e293b !important;
      border-bottom: 1.5px solid #1e293b !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .sanjeevini-panel-group {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }

    .sanjeevini-table tbody tr,
    .sanjeevini-panel-row,
    .sanjeevini-data-row {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .sanjeevini-panel-row {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    .sanjeevini-panel-title {
      font-size: 11.5pt !important;
      font-weight: 700 !important;
    }

    .sanjeevini-test-name {
      font-size: 11pt !important;
      font-weight: 500 !important;
    }

    .sanjeevini-result-value {
      font-size: 11pt !important;
    }

    .sanjeevini-result-value--normal {
      font-weight: 400 !important;
      color: #0f172a !important;
      text-decoration: none !important;
    }

    .sanjeevini-result-value--low {
      font-weight: 400 !important;
      color: #dc2626 !important;
      text-decoration: underline !important;
    }

    .sanjeevini-result-value--high {
      font-weight: 700 !important;
      color: #dc2626 !important;
      text-decoration: underline !important;
    }

    .sanjeevini-flag-pill {
      font-size: 9.5pt !important;
    }

    .sanjeevini-flag-pill--high {
      font-weight: 700 !important;
      color: #dc2626 !important;
      text-decoration: underline !important;
    }

    .sanjeevini-flag-pill--low {
      font-weight: 400 !important;
      color: #dc2626 !important;
      text-decoration: underline !important;
    }

    .sanjeevini-cell-unit {
      font-size: 11pt !important;
    }

    .sanjeevini-cell-ref {
      font-size: 11pt !important;
    }

    /* HbA1c Special Report Print Formatting */
    .sanjeevini-hba1c-panel-group,
    .sanjeevini-hba1c-notes-container,
    .sanjeevini-hba1c-end-marker-line {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .sanjeevini-hba1c-data-row td {
      border: none !important;
      vertical-align: top !important;
    }

    .sanjeevini-hba1c-notes-td {
      border: none !important;
      padding-top: 3.5mm !important;
    }

    /* Single Coherent @page Boundary: 
       - Without Header & Footer mode (Pre-printed paper): 47mm top, 45mm bottom, 8mm left/right
       - With Header & Footer mode (Plain paper): 0mm margin so edge-to-edge stationery prints authentically
    */
    @page {
      size: A4 portrait;
      ${
        hideHeaderFooter
          ? `margin-top: 47mm;
      margin-bottom: 45mm;
      margin-left: 8mm;
      margin-right: 8mm;`
          : `margin: 0;`
      }
    }
  }
`;
}
