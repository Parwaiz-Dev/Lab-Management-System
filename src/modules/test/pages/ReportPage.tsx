import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
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

export default function ReportPage({ orderId, onBack }: ReportPageProps) {
  const [data, setData] = useState<ReportRow[]>([]);
  const [patient, setPatient] = useState<ReportPatientInfo | null>(null);
  const [labName, setLabName] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        setError("");

        const [rows, patientInfo, settings] = await Promise.all([
          testService.getReport(orderId),
          testService.getPatientByOrder(orderId),
          settingsService.getLabSettings(),
        ]);

        setData(rows);
        setPatient(patientInfo);
        setLabName(settings.lab_name || "Your Lab Name");
        setLabAddress(settings.lab_address || "Lab address");
        setLogo(settings.lab_logo || "");
      } catch (err) {
        console.error("Report load failed:", err);
        setError(getErrorMessage(err, "Failed to load report"));
      } finally {
        setLoading(false);
      }
    };

    void loadAll();
  }, [orderId]);

  const groupedResults = useMemo<GroupedResult[]>(() => {
    const groups: GroupedResult[] = [];

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

  const abnormalCount = useMemo(() => {
    return data.filter((row) => isAbnormal(row.value, row.normal_range)).length;
  }, [data]);

  const logoSrc = useMemo(() => settingsService.getLogoSrc(logo), [logo]);

  return (
    <div className="report-page">
      <style>{printCss}</style>

      <div className="report-page__actions no-print">
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>

        <Button onClick={() => window.print()} disabled={loading || Boolean(error)}>
          Print Report
        </Button>
      </div>

      <article className="report-paper">
        <header className="report-paper__header">
          <div className="report-paper__brand">
            {logoSrc ? (
              <img src={logoSrc} alt="Lab logo" />
            ) : (
              <div className="report-paper__logo-fallback">LM</div>
            )}

            <div>
              <h1>{labName || "Your Lab Name"}</h1>
              <p>{labAddress || "Lab address"}</p>
            </div>
          </div>

          <div className="report-paper__meta">
            <strong>Laboratory Report</strong>
            <span>Order #{orderId}</span>
            <span>{patient?.invoice_no || `INV-${orderId}`}</span>
            <Badge tone={abnormalCount > 0 ? "warning" : "success"}>
              {abnormalCount > 0 ? `${abnormalCount} Flagged` : "Normal Review"}
            </Badge>
          </div>
        </header>

        <section className="report-paper__info-grid">
          <Info label="Patient" value={patient?.patient_name || "-"} />
          <Info label="Patient ID" value={patient?.patient_code || "-"} />
          <Info
            label="Age / Gender"
            value={`${patient?.age_value || "-"} ${patient?.age_unit || ""} / ${
              patient?.gender || "-"
            }`}
          />
          <Info label="Phone" value={patient?.phone || "-"} />
          <Info label="Referred By" value={patient?.referred_by || "Self"} />
          <Info label="Order Date" value={formatDate(patient?.order_date)} />
          <Info label="Report Date" value={reportDate} />
        </section>

        <section className="report-paper__body">
          {loading && <div className="report-paper__empty">Loading report...</div>}

          {!loading && error && (
            <div className="report-paper__empty report-paper__empty--error">
              {error}
            </div>
          )}

          {!loading && !error && groupedResults.length === 0 && (
            <div className="report-paper__empty">
              No results entered for this order.
            </div>
          )}

          {!loading &&
            !error &&
            groupedResults.map((group) => (
              <section key={group.testName} className="report-paper__test-block">
                <div className="report-paper__test-head">{group.testName}</div>

                <table className="report-paper__table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Result</th>
                      <th>Unit</th>
                      <th>Reference Range</th>
                    </tr>
                  </thead>

                  <tbody>
                    {group.rows.map((row, index) => {
                      const abnormal = isAbnormal(row.value, row.normal_range);

                      return (
                        <tr key={`${row.parameter_name}-${index}`}>
                          <td>{row.parameter_name}</td>
                          <td className={abnormal ? "abnormal" : ""}>
                            {row.value}
                            {abnormal ? " *" : ""}
                          </td>
                          <td>{row.unit || "-"}</td>
                          <td>{row.normal_range || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}
        </section>

        <footer className="report-paper__footer">
          <div>
            <p>* Marked values are outside the reference range.</p>
            <p>This report should be interpreted with clinical findings.</p>
          </div>

          <div className="report-paper__signature">
            <div />
            <span>Authorized Signature</span>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="report-paper__info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function isAbnormal(value: string, range: string) {
  const num = Number.parseFloat(value);

  if (Number.isNaN(num) || !range) return false;

  const cleanRange = range.trim();

  if (cleanRange.startsWith("<")) {
    const max = Number.parseFloat(cleanRange.replace("<", ""));
    return !Number.isNaN(max) && num >= max;
  }

  if (cleanRange.startsWith(">")) {
    const min = Number.parseFloat(cleanRange.replace(">", ""));
    return !Number.isNaN(min) && num <= min;
  }

  const match = cleanRange.match(/(-?\d+(\.\d+)?)\s*-\s*(-?\d+(\.\d+)?)/);

  if (!match) return false;

  const min = Number.parseFloat(match[1]);
  const max = Number.parseFloat(match[3]);

  if (Number.isNaN(min) || Number.isNaN(max)) return false;

  return num < min || num > max;
}

const printCss = `
  @media print {
    .no-print,
    button {
      display: none !important;
    }

    body {
      background: white !important;
    }

    .report-page {
      background: white !important;
      padding: 0 !important;
    }

    .report-paper {
      box-shadow: none !important;
      border: none !important;
      max-width: 100% !important;
      min-height: auto !important;
    }

    @page {
      size: A4;
      margin: 12mm;
    }
  }
`;