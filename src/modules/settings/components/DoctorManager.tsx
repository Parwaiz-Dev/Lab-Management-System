import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Edit2,
  Plus,
  RefreshCw,
  Search,
  Star,
  Stethoscope,
  UserCheck,
  UserX,
} from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import ConfirmationDialog from "../../../components/ui/ConfirmationDialog";
import type { Doctor, ToastMessage } from "../../../types";
import { patientService } from "../../patient/services/patientService";

interface DoctorManagerProps {
  showToast: (message: string, type: ToastMessage["type"]) => void;
}

export default function DoctorManager({ showToast }: DoctorManagerProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add doctor modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [makeDefaultImmediately, setMakeDefaultImmediately] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  // Edit doctor modal state
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Deactivate confirmation for default doctor
  const [deactivatingDoctor, setDeactivatingDoctor] = useState<Doctor | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const data = await patientService.getAllDoctors();
      setDoctors(data);
    } catch (err) {
      console.error("Failed to load doctors:", err);
      showToast(
        err instanceof Error ? err.message : "Failed to load doctors",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);

  const defaultDoctor = useMemo(
    () => doctors.find((d) => d.is_default && d.is_active) || null,
    [doctors]
  );

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => d.name.toLowerCase().includes(q));
  }, [doctors, searchQuery]);

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newDoctorName.trim();
    if (!cleanName) {
      showToast("Doctor name is required", "warning");
      return;
    }

    try {
      setAddSaving(true);
      await patientService.addDoctor(cleanName);

      if (makeDefaultImmediately) {
        // Reload list to get newly assigned ID, then set as default
        const refreshed = await patientService.getAllDoctors();
        const created = refreshed.find(
          (d) => d.name.toLowerCase() === cleanName.toLowerCase()
        );
        if (created) {
          await patientService.setDefaultDoctor(created.id);
        }
      }

      showToast(`Doctor "${cleanName}" added successfully`, "success");
      setNewDoctorName("");
      setMakeDefaultImmediately(false);
      setIsAddOpen(false);
      await loadDoctors();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add doctor",
        "error"
      );
    } finally {
      setAddSaving(false);
    }
  };

  const handleEditDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      showToast("Doctor name cannot be empty", "warning");
      return;
    }

    try {
      setEditSaving(true);
      await patientService.updateDoctor(editingDoctor.id, cleanName);
      showToast(`Doctor updated to "${cleanName}"`, "success");
      setEditingDoctor(null);
      await loadDoctors();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update doctor",
        "error"
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleSetDefault = async (doctor: Doctor) => {
    if (!doctor.is_active) {
      showToast("Cannot set an inactive doctor as default", "warning");
      return;
    }

    try {
      setActionLoading(true);
      await patientService.setDefaultDoctor(doctor.id);
      showToast(`"${doctor.name}" is now the default referring doctor`, "success");
      await loadDoctors();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to set default doctor",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActiveClick = (doctor: Doctor) => {
    if (doctor.is_active && doctor.is_default) {
      // Prompt warning that deactivating default doctor will clear default status
      setDeactivatingDoctor(doctor);
    } else {
      void confirmToggleActive(doctor);
    }
  };

  const confirmToggleActive = async (doctor: Doctor) => {
    try {
      setActionLoading(true);
      const nextActive = !doctor.is_active;
      await patientService.setDoctorActive(doctor.id, nextActive);

      showToast(
        nextActive
          ? `Doctor "${doctor.name}" reactivated`
          : `Doctor "${doctor.name}" deactivated`,
        "success"
      );
      setDeactivatingDoctor(null);
      await loadDoctors();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to change doctor status",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Card
      icon={<Stethoscope size={18} />}
      title="Referring Doctors & Default Assignment"
      eyebrow="Manage doctor directory, referrals, and default doctor for patient intake"
      right={
        <div className="flex items-center gap-2">
          <Button
            onClick={loadDoctors}
            variant="outline"
            size="sm"
            disabled={loading || actionLoading}
            icon={<RefreshCw size={14} />}
          >
            {loading ? "Loading..." : "Reload"}
          </Button>
          <Button
            onClick={() => {
              setNewDoctorName("");
              setMakeDefaultImmediately(false);
              setIsAddOpen(true);
            }}
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
          >
            Add Doctor
          </Button>
        </div>
      }
      className="settings-card-v2"
    >
      {/* ── CURRENT DEFAULT DOCTOR BANNER ── */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "6px",
          background: defaultDoctor ? "#fefce8" : "#f1f5f9",
          border: `1px solid ${defaultDoctor ? "#facc15" : "#cbd5e1"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: defaultDoctor ? "#ca8a04" : "#94a3b8",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Star size={17} fill={defaultDoctor ? "#ffffff" : "none"} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
              {defaultDoctor ? (
                <>
                  Default Referring Doctor:{" "}
                  <span style={{ color: "#854d0e" }}>{defaultDoctor.name}</span>
                </>
              ) : (
                "No Default Doctor Configured"
              )}
            </div>
            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1 }}>
              {defaultDoctor
                ? "Automatically pre-selected on all new patient registrations and orders. Lab staff can change the selection at intake if needed."
                : "New patient registrations will default to 'Self (Direct Patient)' until a default doctor is designated."}
            </div>
          </div>
        </div>

        {defaultDoctor && (
          <Badge tone="warning" size="sm">
            ★ Active Default
          </Badge>
        )}
      </div>

      {/* ── SEARCH FILTER ── */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search doctors by name..."
            sizeVariant="sm"
          />
          <Search
            size={14}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* ── DOCTORS TABLE ── */}
      {filteredDoctors.length === 0 ? (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "#64748b",
            background: "#f8fafc",
            borderRadius: "6px",
            border: "1px dashed #cbd5e1",
          }}
        >
          {searchQuery
            ? "No doctors match your search query."
            : "No registered doctors yet. Click 'Add Doctor' above to register referring doctors."}
        </div>
      ) : (
        <div className="table-responsive" style={{ border: "1px solid var(--color-border-light)", borderRadius: 6, overflow: "hidden" }}>
          <table className="data-table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", width: "45%" }}>Doctor Name</th>
                <th style={{ textAlign: "center", padding: "8px 12px", width: "18%" }}>Status</th>
                <th style={{ textAlign: "right", padding: "8px 12px", width: "37%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map((doc) => {
                const isDefault = doc.is_default && doc.is_active;

                return (
                  <tr
                    key={doc.id}
                    style={{
                      background: isDefault ? "#fefce8" : undefined,
                      borderBottom: "1px solid var(--color-border-light)",
                    }}
                  >
                    {/* Doctor Name & Default Tag */}
                    <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: doc.is_active ? "#0f172a" : "#64748b" }}>
                          {doc.name}
                        </span>
                        {isDefault && (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              background: "#fef08a",
                              color: "#854d0e",
                              padding: "1px 6px",
                              borderRadius: 4,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              border: "1px solid #facc15",
                            }}
                          >
                            <Star size={10} fill="#854d0e" />
                            Default Doctor
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ textAlign: "center", padding: "8px 12px", verticalAlign: "middle" }}>
                      {doc.is_active ? (
                        <Badge tone="success" size="sm">
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">
                          Inactive
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right", padding: "8px 12px", verticalAlign: "middle" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {/* Set as Default button */}
                        {isDefault ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled
                            icon={<Check size={12} />}
                            style={{ background: "#fef9c3", borderColor: "#fde047", color: "#854d0e" }}
                          >
                            Default
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!doc.is_active || actionLoading}
                            onClick={() => void handleSetDefault(doc)}
                            icon={<Star size={12} />}
                            title={
                              doc.is_active
                                ? "Set as the default referring doctor"
                                : "Activate this doctor to enable setting as default"
                            }
                          >
                            Set Default
                          </Button>
                        )}

                        {/* Edit button */}
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => {
                            setEditingDoctor(doc);
                            setEditName(doc.name);
                          }}
                          icon={<Edit2 size={12} />}
                          title="Edit doctor name"
                        >
                          Edit
                        </Button>

                        {/* Deactivate / Reactivate button */}
                        {doc.is_active ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => handleToggleActiveClick(doc)}
                            icon={<UserX size={12} />}
                            title="Deactivate doctor"
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => void confirmToggleActive(doc)}
                            icon={<UserCheck size={12} />}
                            title="Reactivate doctor"
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADD DOCTOR MODAL ── */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register New Referring Doctor"
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddOpen(false)}
              disabled={addSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddDoctor}
              loading={addSaving}
              disabled={!newDoctorName.trim()}
            >
              Save Doctor
            </Button>
          </div>
        }
      >
        <form onSubmit={handleAddDoctor} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
              Doctor Name &amp; Degrees *
            </label>
            <Input
              value={newDoctorName}
              onChange={(e) => setNewDoctorName(e.target.value)}
              placeholder="e.g. Dr. Sneha Kulkarni (MBBS, DGO)"
              autoFocus
              disabled={addSaving}
            />
            <small style={{ color: "#64748b", fontSize: 11, marginTop: 4, display: "block" }}>
              Include degree and titles so they appear accurately on patient reports.
            </small>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              userSelect: "none",
              padding: "6px 8px",
              background: "#f8fafc",
              borderRadius: 4,
              border: "1px solid #e2e8f0",
            }}
          >
            <input
              type="checkbox"
              checked={makeDefaultImmediately}
              onChange={(e) => setMakeDefaultImmediately(e.target.checked)}
              disabled={addSaving}
            />
            <span>Set as Default Referring Doctor immediately</span>
          </label>
        </form>
      </Modal>

      {/* ── EDIT DOCTOR MODAL ── */}
      <Modal
        isOpen={editingDoctor !== null}
        onClose={() => setEditingDoctor(null)}
        title="Edit Doctor Details"
        subtitle="Renaming updates the current directory name. Historical patient records, invoices, and reports preserve their original recorded name."
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditingDoctor(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditDoctor}
              loading={editSaving}
              disabled={!editName.trim()}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <form onSubmit={handleEditDoctor} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
              Doctor Name &amp; Degrees *
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Doctor full name"
              autoFocus
              disabled={editSaving}
            />
          </div>
        </form>
      </Modal>

      {/* ── CONFIRMATION DIALOG: DEACTIVATING DEFAULT DOCTOR ── */}
      <ConfirmationDialog
        open={deactivatingDoctor !== null}
        title="Deactivate Default Referring Doctor?"
        description={`"${deactivatingDoctor?.name}" is currently configured as the Default Referring Doctor. Deactivating them will automatically remove their default status, and new patient registrations will fall back to "Self (Direct Patient)". Are you sure?`}
        confirmLabel="Deactivate Doctor"
        cancelLabel="Keep Active"
        danger
        loading={actionLoading}
        onConfirm={() => {
          if (deactivatingDoctor) {
            void confirmToggleActive(deactivatingDoctor);
          }
        }}
        onCancel={() => setDeactivatingDoctor(null)}
      />
    </Card>
  );
}
