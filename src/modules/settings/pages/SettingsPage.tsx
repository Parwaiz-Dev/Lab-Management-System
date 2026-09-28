import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Building2, Database, Download, RefreshCw, Save, Upload } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import TestCatalogManager from "./TestCatalogManager";
import UserManagement from "../../auth/components/UserManagement";
import type { LabSettings, ToastMessage, SessionInfo } from "../../../types";
import { settingsService } from "../services/settingsService";

const emptySettings: LabSettings = {
  lab_name: "",
  lab_address: "",
  doctor_share: "40",
  lab_logo: "",
};

export default function SettingsPage({ session }: { session: SessionInfo }) {
  const [settings, setSettings] = useState<LabSettings>(emptySettings);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [backupBusy, setBackupBusy] = useState<"export" | "restore" | null>(
    null
  );

  const showToast = useCallback((message: string, type: ToastMessage["type"]) => {
    setToast({ message, type });
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await settingsService.getLabSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
      showToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateField = useCallback(
    (key: keyof LabSettings, value: string) => {
      setSettings((current) => ({
        ...current,
        [key]: value,
      }));
    },
    []
  );

  const validateSettings = () => {
    if (!settings.lab_name.trim()) {
      showToast("Lab name is required", "warning");
      return false;
    }

    if (settings.doctor_share.trim()) {
      const cleaned = settings.doctor_share.trim().replace(/%$/, "");
      const share = Number(cleaned);

      if (Number.isNaN(share) || share < 0 || share > 100) {
        showToast("Doctor share must be a percentage between 1 and 100% (e.g. 20 or 40%)", "warning");
        return false;
      }
    }

    return true;
  };

  const save = async () => {
    if (!validateSettings()) return;

    try {
      setSaving(true);
      await settingsService.saveLabSettings(settings);
      showToast("Settings saved successfully", "success");
    } catch (err) {
      console.error("Failed to save settings:", err);
      showToast(typeof err === "string" ? err : "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const exportBackup = async () => {
    try {
      setBackupBusy("export");

      const path = await settingsService.exportBackup();

      showToast(`Backup saved at ${path}`, "success");
    } catch (err) {
      console.error("Failed to export backup:", err);
      showToast("Failed to export backup", "error");
    } finally {
      setBackupBusy(null);
    }
  };

  const restoreBackup = async () => {
    if (!confirm("This will overwrite current data. Continue?")) return;

    try {
      setBackupBusy("restore");

      const message = await settingsService.restoreBackup();

      showToast(message || "Backup restored. Restart the app to reload data.", "info");
    } catch (err) {
      console.error("Failed to restore backup:", err);
      showToast(typeof err === "string" ? err : "Failed to restore backup", "error");
    } finally {
      setBackupBusy(null);
    }
  };

  return (
    <div className="settings-page-v2">
      <div className="settings-page-v2__layout">
        <Card
          icon={<Building2 size={18} />}
          title="Lab Identity"
          eyebrow="Branding and report details"
          right={
            <div className="flex items-center gap-2">
              <Button onClick={loadSettings} variant="outline" size="sm" disabled={loading || saving} icon={<RefreshCw size={14} />}>
                {loading ? "Loading..." : "Reload"}
              </Button>
              <Button onClick={save} disabled={saving || loading} variant="primary" size="sm" icon={<Save size={14} />}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          }
          className="settings-card-v2"
        >
          <div className="settings-form-v2">
            <Field label="Lab Name" hint="Shown on receipts and printed reports.">
              <Input
                value={settings.lab_name}
                onChange={(e) => updateField("lab_name", e.target.value)}
                placeholder="Enter lab name"
                disabled={loading || saving}
              />
            </Field>

            <Field label="Doctor Share (%)" hint="Default referral percentage (e.g. 10%, 20%, 40%).">
              <Input
                value={settings.doctor_share}
                onChange={(e) => updateField("doctor_share", e.target.value)}
                placeholder="40"
                disabled={loading || saving}
              />
            </Field>

            <div className="settings-form-v2__full">
              <Field label="Lab Address & Contact" hint="Printed in header and footer of laboratory test reports.">
                <Input
                  value={settings.lab_address}
                  onChange={(e) => updateField("lab_address", e.target.value)}
                  placeholder="Enter lab address, phone, and registration details"
                  disabled={loading || saving}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card
          icon={<Database size={18} />}
          title="Local Data Backup"
          eyebrow="SQLite database"
          compact
          className="settings-backup-card-v2"
        >
          <div className="settings-backup-v2">
            <div className="settings-backup-v2__icon">
              <Database size={20} className="text-indigo-600" />
            </div>

            <p>
              Export a local database copy before app updates, migration, or
              system changes. Restore only from a trusted backup file.
            </p>

            <div className="settings-backup-v2__actions">
              <Button
                onClick={exportBackup}
                variant="secondary"
                disabled={backupBusy !== null}
                icon={<Download size={16} />}
              >
                {backupBusy === "export" ? "Exporting..." : "Export Backup"}
              </Button>

              <Button
                onClick={restoreBackup}
                variant="danger"
                disabled={backupBusy !== null}
                icon={<Upload size={16} />}
              >
                {backupBusy === "restore" ? "Restoring..." : "Restore Backup"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <TestCatalogManager />

      {session.role === "admin" && <UserManagement showToast={showToast} />}

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