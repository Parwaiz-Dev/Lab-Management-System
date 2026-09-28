import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export type ModalMaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full";

export interface ModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: ModalMaxWidth;
  size?: ModalMaxWidth;
  className?: string;
}

export function Modal({
  isOpen,
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth,
  size = "md",
  className = "",
}: ModalProps) {
  const visible = open ?? isOpen ?? false;
  const effectiveSize = maxWidth || size;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={["modal-dialog", `modal-dialog--${effectiveSize}`, className]
          .filter(Boolean)
          .join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-header__content">
            <h3 className="modal-title">{title}</h3>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
