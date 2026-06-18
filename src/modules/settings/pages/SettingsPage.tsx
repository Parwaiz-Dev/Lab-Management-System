import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Building2, Database, Download, Image, RefreshCw, Save, Upload, X } from "lucide-react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import Badge from "../../../components/ui/Badge";
import TestCatalogManager from "./TestCatalogManager";
import UserManagement from "../../auth/components/UserManagement";
import type { LabSettings, ToastMessage, SessionInfo } from "../../../types";
import { settingsService } from "../services/settingsService";

const emptySettings: LabSettings = {
  lab_name: "",
  lab_address: "",
  doctor_share: "",
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
  const [choosingLogo, setChoosingLogo] = useState(false);

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

  const doctorSharePreview = useMemo(() => {
    const value = Number(settings.doctor_share);

    if (Number.isNaN(value) || settings.doctor_share.trim() === "") {
      return "Not configured";
    }

    if (value <= 1) return `${Math.round(value * 100)}%`;

    return `${value}%`;
  }, [settings.doctor_share]);

  const logoSrc = useMemo(() => {
    return settingsService.getLogoSrc(settings.lab_logo);
  }, [settings.lab_logo]);

  const validateSettings = () => {
    if (!settings.lab_name.trim()) {
      showToast("Lab name is required", "warning");
      return false;
    }

    if (settings.doctor_share.trim()) {
      const share = Number(settings.doctor_share);

      if (Number.isNaN(share) || share < 0 || share > 100) {
        showToast("Doctor share must be between 0 and 100", "warning");
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

  const chooseLogo = async () => {
    try {
      setChoosingLogo(true);

      const selectedPath = await settingsService.chooseLogo();

      if (!selectedPath) {
        showToast("Logo selection cancelled", "info");
        return;
      }

      updateField("lab_logo", selectedPath);
      showToast("Logo selected. Click Save to store it.", "success");
    } catch (err) {
      console.error("Failed to choose logo:", err);
      showToast("Failed to choose logo", "error");
    } finally {
      setChoosingLogo(false);
    }
  };

  const clearLogo = () => {
    updateField("lab_logo", "");
    showToast("Logo cleared. Click Save to confirm.", "info");
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
          <Button onClick={loadSettings} variant="secondary" disabled={loading || saving} icon={<RefreshCw size={16} />}>
            {loading ? "Loading..." : "Reload"}
          </Button>

          <Button onClick={save} disabled={saving || loading} icon={<Save size={16} />}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </section>

      <div className="settings-overview-v2">
        <OverviewItem label="Lab Name" value={settings.lab_name || "Not configured"} />
        <OverviewItem label="Doctor Share" value={doctorSharePreview} />
        <OverviewItem label="Logo" value={settings.lab_logo ? "Configured" : "Not configured"} />
        <OverviewItem label="Storage" value="Local SQLite" />
      </div>

      <div className="settings-page-v2__layout">
        <Card
          icon={<Building2 size={18} />}
          title="Lab Identity"
          eyebrow="Branding and report details"
          right={
            <Button onClick={save} disabled={saving || loading} icon={<Save size={16} />}>
              {saving ? "Saving..." : "Save"}
            </Button>
          }
          className="settings-card-v2"
        >
          <div className="settings-form-v2">
            <Field label="Lab Name" hint="Shown on receipts and reports.">
              <Input
                value={settings.lab_name}
                onChange={(e) => updateField("lab_name", e.target.value)}
                placeholder="Enter lab name"
                disabled={loading || saving}
              />
            </Field>

            <Field label="Doctor Share" hint="Use 0.4 for 40%, or 40 for 40%.">
              <Input
                value={settings.doctor_share}
                onChange={(e) => updateField("doctor_share", e.target.value)}
                placeholder="0.4"
                disabled={loading || saving}
              />
            </Field>

            <Field label="Lab Address" hint="Printed on laboratory reports.">
              <Input
                value={settings.lab_address}
                onChange={(e) => updateField("lab_address", e.target.value)}
                placeholder="Enter lab address"
                disabled={loading || saving}
              />
            </Field>

            <Field label="Logo Path" hint="Stored locally and used in report header.">
              <Input
                value={settings.lab_logo}
                onChange={(e) => updateField("lab_logo", e.target.value)}
                placeholder="Choose logo from this machine"
                disabled={loading || saving}
              />
            </Field>
          </div>

          <div className="settings-logo-panel-v2">
            <div className="settings-logo-panel-v2__preview">
              {logoSrc ? (
                <img src={logoSrc} alt="Lab logo" />
              ) : (
                <div className="settings-logo-panel-v2__empty">LM</div>
              )}
            </div>

            <div className="settings-logo-panel-v2__content">
              <div className="settings-logo-panel-v2__title-row">
                <strong>Lab Logo</strong>
                <Badge tone={settings.lab_logo ? "success" : "neutral"}>
                  {settings.lab_logo ? "Selected" : "Empty"}
                </Badge>
              </div>

              <p>
                Select a logo image from this machine. Click Save after choosing
                the image so it appears in reports, receipts, and branding areas.
              </p>

              <div className="settings-logo-panel-v2__actions">
                <Button
                  onClick={chooseLogo}
                  variant="secondary"
                  disabled={loading || saving || choosingLogo}
                  icon={<Image size={16} />}
                >
                  {choosingLogo ? "Opening..." : "Choose Logo"}
                </Button>

                <Button
                  onClick={clearLogo}
                  variant="ghost"
                  disabled={loading || saving || !settings.lab_logo}
                  icon={<X size={16} />}
                >
                  Clear
                </Button>
              </div>
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

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-overview-v2__item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}