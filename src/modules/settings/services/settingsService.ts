import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { LabSettings } from "../../../types";

const defaultSettings: LabSettings = {
  lab_name: "Your Lab",
  lab_address: "",
  doctor_share: "0.4",
  lab_logo: "",
};

export const settingsService = {
  async getSetting(key: keyof LabSettings | string): Promise<string> {
    return invoke<string>("get_setting", { key });
  },

  async setSetting(
    key: keyof LabSettings | string,
    value: string,
  ): Promise<void> {
    await invoke("set_setting", {
      key,
      value: value.trim(),
    });
  },

  async getLabSettings(): Promise<LabSettings> {
    try {
      const settings = await invoke<LabSettings>("get_all_settings");

      return {
        lab_name: settings.lab_name || defaultSettings.lab_name,
        lab_address: settings.lab_address || defaultSettings.lab_address,
        doctor_share: settings.doctor_share || defaultSettings.doctor_share,
        lab_logo: settings.lab_logo || defaultSettings.lab_logo,
      };
    } catch {
      const [labName, labAddress, doctorShare, labLogo] = await Promise.all([
        this.getSetting("lab_name"),
        this.getSetting("lab_address"),
        this.getSetting("doctor_share"),
        this.getSetting("lab_logo"),
      ]);

      return {
        lab_name: labName || defaultSettings.lab_name,
        lab_address: labAddress || defaultSettings.lab_address,
        doctor_share: doctorShare || defaultSettings.doctor_share,
        lab_logo: labLogo || defaultSettings.lab_logo,
      };
    }
  },

  async saveLabSettings(settings: LabSettings): Promise<void> {
    const payload: LabSettings = {
      lab_name: settings.lab_name.trim(),
      lab_address: settings.lab_address.trim(),
      doctor_share: settings.doctor_share.trim(),
      lab_logo: settings.lab_logo.trim(),
    };

    try {
      await invoke("save_lab_settings", {
        labName: payload.lab_name,
        labAddress: payload.lab_address,
        doctorShare: payload.doctor_share,
        labLogo: payload.lab_logo,
      });
    } catch {
      await Promise.all([
        this.setSetting("lab_name", payload.lab_name),
        this.setSetting("lab_address", payload.lab_address),
        this.setSetting("doctor_share", payload.doctor_share),
        this.setSetting("lab_logo", payload.lab_logo),
      ]);
    }
  },

  async chooseLogo(): Promise<string | null> {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico"],
        },
      ],
    });

    if (!selected || Array.isArray(selected)) return null;

    return selected;
  },

  exportBackup(): Promise<string> {
    return invoke<string>("export_backup");
  },

  restoreBackup(): Promise<string> {
    return invoke<string>("restore_backup");
  },

  getLogoSrc(path: string): string {
    const cleaned = path.trim();

    if (!cleaned) return "";

    if (
      cleaned.startsWith("asset:") ||
      cleaned.startsWith("http://asset.localhost")
    ) {
      return cleaned;
    }

    return convertFileSrc(cleaned);
  },
};
