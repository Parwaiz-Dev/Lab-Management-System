import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function SettingsPage() {
  // ⚙️ Settings state
  const [labName, setLabName] = useState("");
  const [address, setAddress] = useState("");
  const [doctorShare, setDoctorShare] = useState("");
  const [logoPath, setLogoPath] = useState("");

  // 🔄 Load settings on open
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLabName(await invoke("get_setting", { key: "lab_name" }));
    setAddress(await invoke("get_setting", { key: "lab_address" }));
    setDoctorShare(await invoke("get_setting", { key: "doctor_share" }));
    setLogoPath(await invoke("get_setting", { key: "lab_logo" }));
  };

  // 💾 Save settings
  const save = async () => {
    await invoke("set_setting", { key: "lab_name", value: labName });
    await invoke("set_setting", { key: "lab_address", value: address });
    await invoke("set_setting", { key: "doctor_share", value: doctorShare });
    await invoke("set_setting", { key: "lab_logo", value: logoPath });

    alert("Settings saved successfully!");
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <h2>⚙ Settings</h2>

      {/* 🏥 Lab Name */}
      <div style={field}>
        <label>Lab Name</label>
        <input
          value={labName}
          onChange={(e) => setLabName(e.target.value)}
          style={input}
        />
      </div>

      {/* 📍 Address */}
      <div style={field}>
        <label>Address</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={input}
        />
      </div>

      {/* 💰 Doctor Share */}
      <div style={field}>
        <label>Doctor Share (%)</label>
        <input
          value={doctorShare}
          onChange={(e) => setDoctorShare(e.target.value)}
          style={input}
        />
      </div>

      {/* 🖼 Logo Upload */}
      <div style={field}>
        <label>Lab Logo</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            setLogoPath(file.path);
          }}
        />

        {/* 👀 Preview */}
        {logoPath && (
          <div style={{ marginTop: 10 }}>
            <img
              src={`file://${logoPath}`}
              alt="logo"
              style={{ width: 80, height: 80, objectFit: "contain" }}
            />
          </div>
        )}
      </div>

      {/* 💾 Save Button */}
      <button onClick={save} style={{ marginTop: 20 }}>
        Save Settings
      </button>

      {/* =============================== */}
      {/* 💾 BACKUP SECTION (ADDED HERE) */}
      {/* =============================== */}
      <div style={{ marginTop: 40 }}>
        <h3>💾 Backup</h3>

        <button
          onClick={async () => {
            const path = await invoke("export_backup");
            alert("Backup saved at:\n" + path);
          }}
        >
          📤 Export Backup
        </button>

        <button
          onClick={async () => {
            if (!confirm("Are you sure? This will overwrite current data"))
              return;

            await invoke("restore_backup");
            alert("Backup restored. Please restart the app.");
          }}
          style={{ marginLeft: 10 }}
        >
          📥 Restore Backup
        </button>
      </div>
    </div>
  );
}

// 🎨 Styles
const field = {
  marginTop: 10,
  display: "flex",
  flexDirection: "column" as const,
};

const input = {
  padding: 8,
  marginTop: 5,
};