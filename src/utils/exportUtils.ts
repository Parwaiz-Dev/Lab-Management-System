import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { DashboardOrderRow, DoctorRevenueRow } from "../types";

/**
 * Save a generated jsPDF document either through Tauri native save dialog & filesystem,
 * or browser fallback.
 */
async function savePdfDocument(
  doc: jsPDF,
  defaultFilename: string
): Promise<string> {
  const arrayBuffer = doc.output("arraybuffer");
  const bytes = Array.from(new Uint8Array(arrayBuffer));

  const isTauri =
    typeof window !== "undefined" &&
    Boolean((window as any).__TAURI_INTERNALS__);

  if (isTauri) {
    try {
      // 1. Try native File Save dialog
      const chosenPath = await save({
        defaultPath: defaultFilename,
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
      });

      if (!chosenPath) {
        // User cancelled save dialog
        return "";
      }

      const saved = await invoke<string>("save_export_file", {
        filename: defaultFilename,
        content: bytes,
        targetPath: chosenPath,
      });
      return saved;
    } catch {
      // 2. Fallback: Save directly to OS Downloads folder
      try {
        const saved = await invoke<string>("save_export_file", {
          filename: defaultFilename,
          content: bytes,
          targetPath: null,
        });
        return saved;
      } catch (err) {
        console.error("Tauri save_export_file failed:", err);
      }
    }
  }

  // Browser fallback
  doc.save(defaultFilename);
  return defaultFilename;
}

/**
 * Export Orders Worklist directly to a downloadable PDF file saved on local disk.
 */
export async function exportOrdersToPdf(
  orders: DashboardOrderRow[],
  dateRangeText = "All Time"
): Promise<string> {
  if (orders.length === 0) return "";

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Lab Title & Header
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("LAB MANAGEMENT SYSTEM", 14, 15);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Operational Orders Worklist & Billing Statement", 14, 21);

  // Metadata
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${dateRangeText}`, 283, 15, { align: "right" });
  doc.text(
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    283,
    20,
    { align: "right" }
  );

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, 24, 283, 24);

  // Summary Metrics
  const totalRev = orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const totalPaid = orders.reduce((s, o) => s + Number(o.paidAmount || 0), 0);
  const totalDue = Math.max(totalRev - totalPaid, 0);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Total Orders: ${orders.length}   |   Total Billed: Rs. ${totalRev.toLocaleString(
      "en-IN",
      { minimumFractionDigits: 2 }
    )}   |   Collected: Rs. ${totalPaid.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}   |   Due Balance: Rs. ${totalDue.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`,
    14,
    30
  );

  const tableData = orders.map((o) => {
    const total = Number(o.totalAmount || 0);
    const paid = Number(o.paidAmount || 0);
    const due = Math.max(total - paid, 0);
    return [
      `#${o.id}`,
      o.patientName || "Unknown",
      o.tests || "-",
      o.reportStatus || "Pending",
      `Rs. ${total.toFixed(2)}`,
      `Rs. ${paid.toFixed(2)}`,
      `Rs. ${due.toFixed(2)}`,
      o.paymentStatus || "Pending",
    ];
  });

  tableData.push([
    "TOTAL",
    `${orders.length} Orders`,
    "-",
    "-",
    `Rs. ${totalRev.toFixed(2)}`,
    `Rs. ${totalPaid.toFixed(2)}`,
    `Rs. ${totalDue.toFixed(2)}`,
    "-",
  ]);

  autoTable(doc, {
    startY: 33,
    head: [
      [
        "Order #",
        "Patient Name",
        "Tests Ordered",
        "Report Status",
        "Billed (INR)",
        "Paid (INR)",
        "Due (INR)",
        "Payment",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 45 },
      2: { cellWidth: 70 },
      3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
      7: { cellWidth: 22, halign: "center" },
    },
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  return await savePdfDocument(doc, `lab_orders_${dateStr}.pdf`);
}

/**
 * Export Doctor Revenue directly to a downloadable PDF file saved on local disk.
 */
export async function exportDoctorRevenueToPdf(
  revenueList: DoctorRevenueRow[],
  dateRangeText = "All Time"
): Promise<string> {
  if (revenueList.length === 0) return "";

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Lab Title & Header
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("LAB MANAGEMENT SYSTEM", 14, 15);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Doctor Revenue & Referral Commission Statement", 14, 21);

  // Metadata
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${dateRangeText}`, 283, 15, { align: "right" });
  doc.text(
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    283,
    20,
    { align: "right" }
  );

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, 24, 283, 24);

  const sumReferrals = revenueList.reduce(
    (s, d) => s + Number(d.referral_count ?? d.order_count ?? 0),
    0
  );
  const sumRevenue = revenueList.reduce(
    (s, d) => s + Number(d.eligible_amount ?? d.total_amount ?? 0),
    0
  );
  const sumPaid = revenueList.reduce(
    (s, d) => s + Number(d.paid_amount ?? d.commission_paid ?? 0),
    0
  );
  const sumPending = revenueList.reduce(
    (s, d) =>
      s +
      Number(
        d.pending_amount ??
          Math.max(
            (d.eligible_amount ?? d.total_amount ?? 0) -
              (d.paid_amount ?? d.commission_paid ?? 0),
            0
          )
      ),
    0
  );
  const sumCommission = revenueList.reduce(
    (s, d) => s + Number(d.commission_earned ?? d.share_amount ?? 0),
    0
  );

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Total Doctors: ${revenueList.length}   |   Total Referrals: ${sumReferrals}   |   Total Billed: Rs. ${sumRevenue.toLocaleString(
      "en-IN",
      { minimumFractionDigits: 2 }
    )}   |   Doctor Commission Due: Rs. ${sumCommission.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`,
    14,
    30
  );

  const tableData = revenueList.map((docRow) => {
    const refCount = Number(docRow.referral_count ?? docRow.order_count ?? 0);
    const totalRev = Number(docRow.eligible_amount ?? docRow.total_amount ?? 0);
    const paid = Number(docRow.paid_amount ?? docRow.commission_paid ?? 0);
    const pending = Number(
      docRow.pending_amount ?? Math.max(totalRev - paid, 0)
    );
    const sharePct = Number(docRow.share_percentage ?? 0);
    const commission = Number(
      docRow.commission_earned ??
        docRow.share_amount ??
        (totalRev * sharePct) / 100
    );

    return [
      docRow.doctor_name || "Self / Walk-in",
      String(refCount),
      `Rs. ${totalRev.toFixed(2)}`,
      `Rs. ${paid.toFixed(2)}`,
      `Rs. ${pending.toFixed(2)}`,
      `${sharePct}%`,
      `Rs. ${commission.toFixed(2)}`,
    ];
  });

  tableData.push([
    "TOTAL",
    String(sumReferrals),
    `Rs. ${sumRevenue.toFixed(2)}`,
    `Rs. ${sumPaid.toFixed(2)}`,
    `Rs. ${sumPending.toFixed(2)}`,
    "-",
    `Rs. ${sumCommission.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 33,
    head: [
      [
        "Doctor / Referring Clinic",
        "Referrals",
        "Billed (INR)",
        "Paid (INR)",
        "Pending (INR)",
        "Share %",
        "Commission (INR)",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 25, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
      5: { cellWidth: 25, halign: "center" },
      6: { cellWidth: 44, halign: "right" },
    },
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  return await savePdfDocument(doc, `doctor_revenue_${dateStr}.pdf`);
}
