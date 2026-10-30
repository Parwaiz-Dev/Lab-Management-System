use super::state::ActivationRecord;

const TASK_NAME: &str = "LabManagementSystem_AutoUninstall";

/// Registers or updates a Windows scheduled task to trigger the application
/// with `--check-expiration` at the designated expiration timestamp.
/// If user authorization or OS permissions prevent scheduled task creation,
/// it gracefully logs and falls back to next-launch checking.
pub fn register_scheduled_task(record: &ActivationRecord) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        let exe_path = match std::env::current_exe() {
            Ok(p) => p,
            Err(e) => {
                log::warn!("Could not determine executable path for scheduled task: {}", e);
                return Ok(());
            }
        };

        let local_expiry = record.expires_at_datetime().with_timezone(&chrono::Local);
        let time_str = local_expiry.format("%H:%M").to_string();

        // Target command runs with --check-expiration CLI flag
        let task_run = format!("\"{}\" --check-expiration", exe_path.to_string_lossy());

        // Try date formats accepted by various Windows system locales
        let date_candidates = [
            local_expiry.format("%d/%m/%Y").to_string(), // dd/MM/yyyy (common UK/India/EU)
            local_expiry.format("%m/%d/%Y").to_string(), // MM/dd/yyyy (US)
            local_expiry.format("%Y/%m/%d").to_string(), // yyyy/MM/dd (East Asia)
        ];

        let mut created = false;
        for date_str in &date_candidates {
            let mut cmd = std::process::Command::new("schtasks");
            cmd.args([
                "/Create",
                "/SC", "ONCE",
                "/TN", TASK_NAME,
                "/TR", &task_run,
                "/ST", &time_str,
                "/SD", date_str,
                "/F",
            ]);
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

            if let Ok(output) = cmd.output() {
                if output.status.success() {
                    log::info!(
                        "📅 Windows scheduled task '{}' registered for {} {}",
                        TASK_NAME,
                        date_str,
                        time_str
                    );
                    created = true;
                    break;
                }
            }
        }

        if !created {
            log::warn!(
                "⚠️ Could not register Windows scheduled task with current permissions/locale. \
                 Expiration check will reliably execute on the next application launch."
            );
        }

        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = record;
        Ok(())
    }
}

/// Removes the Windows scheduled task if it exists.
pub fn remove_scheduled_task() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        let mut cmd = std::process::Command::new("schtasks");
        cmd.args(["/Delete", "/TN", TASK_NAME, "/F"]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        let _ = cmd.output();
        Ok(())
    }

    #[cfg(not(windows))]
    {
        Ok(())
    }
}
