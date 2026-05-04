import { useEffect } from "react";
import type { ToastMessage } from "../../types";

type ToastProps = Pick<ToastMessage, "message" | "type"> & {
  onClose: () => void;
};

export default function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        padding: "12px 16px",
        borderRadius: 8,
        color: "white",
        background:
          type === "error" ? "#ef4444" : "#22c55e",
        boxShadow: "0 10px 20px rgba(0,0,0,0.15)",
        zIndex: 999,
      }}
    >
      {message}
    </div>
  );
}
