import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import TestCatalogManager from "./TestCatalogManager";
import type { ToastMessage } from "../../../types";

type TauriFile = File & {
  path?: string;
};

export default function SettingsPage() {
  const [labName, setLabName] = useState("");
  const [address, setAddress] = useState("");
  const [doctorShare, setDoctorShare] = useState("");
  const [logoPath, setLogoPath] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backupBusy, setBackupBusy] = useState<"export" | "restore" | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        const [name, labAddress, share, logo] = await Promise.all([
          invoke("get_setting", { key: "lab_name" }),
          invoke("get_setting", { key: "lab_address" }),
          invoke("get_setting", { key: "doctor_share" }),
          invoke("get_setting", { key: "lab_logo" }),
        ]);

        setLabName((name as string) || "");
        setAddress((labAddress as string) || "");
        setDoctorShare((share as string) || "");
        setLogoPath((logo as string) || "");
      } catch (err) {
        console.error("Failed to load settings:", err);
        setToast({ message: "Failed to load settings", type: "error" });
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const doctorSharePreview = useMemo(() => {
    const value = Number(doctorShare);

    if (Number.isNaN(value) || doctorShare.trim() === "") {
      return "Not configured";
    }

    if (value <= 1) {
      return `${Math.round(value * 100)}%`;
    }

    return `${value}%`;
  }, [doctorShare]);

  const save = async () => {
    try {
      setSaving(true);

      await Promise.all([
        invoke("set_setting", { key: "lab_name", value: labName.trim() }),
        invoke("set_setting", { key: "lab_address", value: address.trim() }),
        invoke("set_setting", { key: "doctor_share", value: doctorShare.trim() }),
        invoke("set_setting", { key: "lab_logo", value: logoPath.trim() }),
      ]);

      setToast({ message: "Settings saved successfully", type: "success" });
    } catch (err) {
      console.error("Failed to save settings:", err);
      setToast({ message: "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const exportBackup = async () => {
    try {
      setBackupBusy("export");

      const path = await invoke("export_backup");

      setToast({
        message: `Backup saved at ${path}`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to export backup:", err);
      setToast({ message: "Failed to export backup", type: "error" });
    } finally {
      setBackupBusy(null);
    }
  };

  const restoreBackup = async () => {
    if (!confirm("This will overwrite current data. Continue?")) return;

    try {
      setBackupBusy("restore");

      await invoke("restore_backup");

      setToast({
        message: "Backup restored. Restart the app to reload data.",
        type: "info",
      });
    } catch (err) {
      console.error("Failed to restore backup:", err);
      setToast({ message: "Failed to restore backup", type: "error" });
    } finally {
      setBackupBusy(null);
    }
  };

  return (
    <div className="settings-page-v2">
      <section className="settings-hero-v2">
        <div>
          <div className="settings-hero-v2__eyebrow">System Settings</div>
          <h2>Lab identity, billing defaults, backup, and test catalog.</h2>
          <p>
            Configure the local lab profile used in receipts, reports, billing,
            and day-to-day desktop operations.
          </p>
        </div>

        <div className="settings-hero-v2__actions">
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </section>

      <div className="settings-overview-v2">
        <OverviewItem label="Lab Name" value={labName || "Not configured"} />
        <OverviewItem label="Doctor Share" value={doctorSharePreview} />
        <OverviewItem label="Logo" value={logoPath ? "Configured" : "Not configured"} />
        <OverviewItem label="Storage" value="Local SQLite" />
      </div>

      <div className="settings-page-v2__layout">
        <Card
          title="Lab Identity"
          eyebrow="Branding and report details"
          right={
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "Saving..." : "Save"}
            </Button>
          }
          className="settings-card-v2"
        >
          <div className="settings-form-v2">
            <Field label="Lab Name" hint="Shown on receipts and reports.">
              <Input
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="Enter lab name"
                disabled={loading || saving}
              />
            </Field>

            <Field label="Doctor Share" hint="Use 0.4 for 40%, or 40 for 40%.">
              <Input
                value={doctorShare}
                onChange={(e) => setDoctorShare(e.target.value)}
                placeholder="0.4"
                disabled={loading || saving}
              />
            </Field>

            <Field label="Lab Address" hint="Printed on laboratory reports.">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter lab address"
                disabled={loading || saving}
              />
            </Field>

            <Field label="Logo Path" hint="Used in report header when available.">
              <Input
                value={logoPath}
                onChange={(e) => setLogoPath(e.target.value)}
                placeholder="Choose file below or paste path"
                disabled={loading || saving}
              />
            </Field>
          </div>

          <div className="settings-logo-panel-v2">
            <div className="settings-logo-panel-v2__preview">
              {logoPath ? (
                <img src={`file://${logoPath}`} alt="Lab logo" />
              ) : (
                <div className="settings-logo-panel-v2__empty">LM</div>
              )}
            </div>

            <div className="settings-logo-panel-v2__content">
              <strong>Lab Logo</strong>
              <p>
                Select a logo image from this machine. The path will be stored
                locally and used while printing reports.
              </p>

              <label className="settings-file-button-v2">
                Choose Logo
                <input
                  type="file"
                  accept="image/*"
                  disabled={loading || saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0] as TauriFile | undefined;
                    if (file?.path) setLogoPath(file.path);
                  }}
                />
              </label>
            </div>
          </div>
        </Card>

        <Card
          title="Local Data Backup"
          eyebrow="SQLite database"
          compact
          className="settings-backup-card-v2"
        >
          <div className="settings-backup-v2">
            <div className="settings-backup-v2__icon">DB</div>

            <p>
              Export a local database copy before app updates, migration, or
              system changes. Restore only from a trusted backup file.
            </p>

            <div className="settings-backup-v2__actions">
              <Button
                onClick={exportBackup}
                variant="secondary"
                disabled={backupBusy !== null}
              >
                {backupBusy === "export" ? "Exporting..." : "Export Backup"}
              </Button>

              <Button
                onClick={restoreBackup}
                variant="danger"
                disabled={backupBusy !== null}
              >
                {backupBusy === "restore" ? "Restoring..." : "Restore Backup"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <TestCatalogManager />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-field-v2">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-overview-v2__item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}