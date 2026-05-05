import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import { colors } from "../../../components/ui/styles";
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

  useEffect(() => {
    const loadSettings = async () => {
      setLabName((await invoke("get_setting", { key: "lab_name" })) as string);
      setAddress((await invoke("get_setting", { key: "lab_address" })) as string);
      setDoctorShare((await invoke("get_setting", { key: "doctor_share" })) as string);
      setLogoPath((await invoke("get_setting", { key: "lab_logo" })) as string);
    };

    loadSettings();
  }, []);

  const save = async () => {
    await invoke("set_setting", { key: "lab_name", value: labName });
    await invoke("set_setting", { key: "lab_address", value: address });
    await invoke("set_setting", { key: "doctor_share", value: doctorShare });
    await invoke("set_setting", { key: "lab_logo", value: logoPath });
    setToast({ message: "Settings saved successfully", type: "success" });
  };

  const exportBackup = async () => {
    const path = await invoke("export_backup");
    setToast({ message: `Backup saved at ${path}`, type: "success" });
  };

  const restoreBackup = async () => {
    if (!confirm("This will overwrite current data. Continue?")) return;
    await invoke("restore_backup");
    setToast({ message: "Backup restored. Restart the app to reload data.", type: "info" });
  };

  return (
    <div style={page}>
      <div style={layout}>
        <Card title="Lab Identity" eyebrow="Branding" right={<Button onClick={save}>Save Settings</Button>}>
          <div style={formGrid}>
            <Field label="Lab Name">
              <Input value={labName} onChange={(e) => setLabName(e.target.value)} />
            </Field>
            <Field label="Doctor Share">
              <Input value={doctorShare} onChange={(e) => setDoctorShare(e.target.value)} placeholder="0.4" />
            </Field>
            <Field label="Address">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Logo Path">
              <Input value={logoPath} onChange={(e) => setLogoPath(e.target.value)} placeholder="Choose file below or paste path" />
            </Field>
          </div>

          <div style={logoArea}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] as TauriFile | undefined;
                if (file?.path) setLogoPath(file.path);
              }}
            />
            {logoPath && (
              <div style={logoPreview}>
                <img src={`file://${logoPath}`} alt="Lab logo" style={{ width: 86, height: 86, objectFit: "contain" }} />
              </div>
            )}
          </div>
        </Card>

        <Card title="Local Data Backup" eyebrow="SQLite" compact>
          <p style={description}>
            Export a local database copy before updates or migration. Restore only from a trusted backup file.
          </p>
          <div style={backupActions}>
            <Button onClick={exportBackup} variant="secondary">
              Export Backup
            </Button>
            <Button onClick={restoreBackup} variant="danger">
              Restore Backup
            </Button>
          </div>
        </Card>
      </div>

      <TestCatalogManager />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const page = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
};

const layout = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 360px",
  gap: 16,
  alignItems: "start",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 180px",
  gap: 13,
};

const labelStyle = {
  display: "block",
  color: colors.text,
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 7,
};

const logoArea = {
  marginTop: 16,
  padding: 14,
  borderRadius: 8,
  border: `1px dashed ${colors.borderStrong}`,
  background: colors.surfaceSoft,
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const logoPreview = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  background: colors.surface,
  padding: 8,
};

const description = {
  color: colors.muted,
  fontSize: 13,
  lineHeight: 1.45,
};

const backupActions = {
  display: "flex",
  gap: 8,
  marginTop: 16,
};
