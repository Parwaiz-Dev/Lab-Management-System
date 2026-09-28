import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={title}
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="confirm-dialog-content">
        <div
          className={`confirm-dialog-icon ${
            danger
              ? "confirm-dialog-icon--danger"
              : "confirm-dialog-icon--warning"
          }`}
        >
          <AlertTriangle size={20} />
        </div>
        <p className="confirm-dialog-message">{description}</p>
      </div>
    </Modal>
  );
}