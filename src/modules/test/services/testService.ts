import { invoke } from "@tauri-apps/api/core";
import type {
  DashboardOrderRow,
  DoctorRevenueRow,
  FinancialSummary,
  OrderParameter,
  PaymentHistoryEntry,
  ReceiptData,
  ReceiptLine,
  ReportPatientInfo,
  ReportRow,
  ResultValuePayload,
  Test,
  UpdateOrderPayload,
} from "../../../types";

interface ExistingResultRow {
  parameterId: number;
  value: string;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

function normalizeDashboardOrder(row: unknown): DashboardOrderRow {
  if (Array.isArray(row)) {
    return {
      id: toNumber(row[0]),
      patientName: toText(row[1]),
      tests: toText(row[2]),
      totalAmount: toNumber(row[3]),
      paidAmount: toNumber(row[4]),
      paymentStatus: toText(row[5] || "Pending"),
      reportStatus: toText(row[6] || "Pending"),
    };
  }

  const item = asRecord(row);

  return {
    id: toNumber(item.id ?? item.orderId ?? item.order_id),
    patientName: toText(item.patientName ?? item.patient_name ?? item.patient),
    tests: toText(item.tests ?? item.testNames ?? item.test_names),
    totalAmount: toNumber(item.totalAmount ?? item.total_amount ?? item.total),
    paidAmount: toNumber(item.paidAmount ?? item.paid_amount ?? item.paid),
    paymentStatus: toText(
      item.paymentStatus ?? item.payment_status ?? item.status ?? "Pending",
    ),
    reportStatus: toText(
      item.reportStatus ?? item.report_status ?? "Pending",
    ),
  };
}

function normalizeSummary(row: unknown): FinancialSummary {
  if (Array.isArray(row)) {
    return {
      totalAmount: toNumber(row[0]),
      paidAmount: toNumber(row[1]),
      pendingAmount: toNumber(row[2]),
    };
  }

  const item = asRecord(row);

  return {
    totalAmount: toNumber(item.totalAmount ?? item.total_amount ?? item.total),
    paidAmount: toNumber(item.paidAmount ?? item.paid_amount ?? item.paid),
    pendingAmount: toNumber(item.pendingAmount ?? item.pending_amount ?? item.pending),
  };
}

function normalizeReceiptLine(row: unknown): ReceiptLine {
  if (Array.isArray(row)) {
    return {
      test_name: toText(row[0]),
      price: toNumber(row[1]),
      parameter_names: Array.isArray(row[2]) ? row[2].map(toText) : [],
    };
  }

  const item = asRecord(row);
  const rawParameters =
    item.parameter_names ?? item.parameterNames ?? item.parameters ?? [];

  return {
    test_name: toText(item.test_name ?? item.testName ?? item.name),
    price: toNumber(item.price ?? item.amount),
    parameter_names: Array.isArray(rawParameters)
      ? rawParameters.map(toText)
      : toText(rawParameters)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
  };
}

function normalizeReceipt(row: unknown): ReceiptData {
  if (Array.isArray(row)) {
    const tests = Array.isArray(row[5]) ? row[5].map(normalizeReceiptLine) : [];

    return {
      patient: toText(row[0]),
      invoice: toText(row[1]),
      total: toNumber(row[2]),
      paid: toNumber(row[3]),
      discount: toNumber(row[4]),
      tests,
    };
  }

  const item = asRecord(row);
  const rawTests = item.tests ?? item.test_lines ?? item.testLines ?? [];

  return {
    patient: toText(item.patient ?? item.patient_name ?? item.patientName),
    invoice: toText(item.invoice ?? item.invoice_no ?? item.invoiceNo),
    total: toNumber(item.total ?? item.total_amount ?? item.totalAmount),
    paid: toNumber(item.paid ?? item.paid_amount ?? item.paidAmount),
    discount: toNumber(item.discount ?? item.discount_amount ?? item.discountAmount),
    tests: Array.isArray(rawTests) ? rawTests.map(normalizeReceiptLine) : [],
  };
}

function normalizeOrderParameter(row: unknown): OrderParameter | null {
  if (Array.isArray(row)) {
    const id = toNumber(row[0]);
    if (!id) return null;

    return {
      id,
      name: toText(row[1]),
      unit: toText(row[2]),
      normal_range: toText(row[3]),
      test_id: toNumber(row[4]),
      test_name: toText(row[5]),
    };
  }

  const item = asRecord(row);
  const id = toNumber(item.id ?? item.parameterId ?? item.parameter_id);

  if (!id) return null;

  return {
    id,
    name: toText(item.name ?? item.parameter_name ?? item.parameterName),
    unit: toText(item.unit),
    normal_range: toText(item.normal_range ?? item.normalRange),
    test_id: toNumber(item.test_id ?? item.testId),
    test_name: toText(item.test_name ?? item.testName),
  };
}

function normalizeExistingResult(row: unknown): ExistingResultRow | null {
  if (Array.isArray(row)) {
    const parameterId = toNumber(row[0]);
    if (!parameterId) return null;

    return { parameterId, value: toText(row[1]) };
  }

  const item = asRecord(row);
  const parameterId = toNumber(
    item.parameterId ?? item.parameter_id ?? item.id,
  );

  if (!parameterId) return null;

  return { parameterId, value: toText(item.value ?? item.result) };
}

function normalizeReportRow(row: unknown): ReportRow | null {
  if (Array.isArray(row)) {
    return {
      test_name: toText(row[0]),
      parameter_name: toText(row[1]),
      value: toText(row[2]),
      unit: toText(row[3]),
      normal_range: toText(row[4]),
    };
  }

  const item = asRecord(row);

  return {
    test_name: toText(item.test_name ?? item.testName),
    parameter_name: toText(
      item.parameter_name ?? item.parameterName ?? item.name,
    ),
    value: toText(item.value ?? item.result),
    unit: toText(item.unit),
    normal_range: toText(item.normal_range ?? item.normalRange),
  };
}

function normalizePatientInfo(row: unknown): ReportPatientInfo {
  const item = asRecord(row);

  return {
    patient_name: toText(item.patient_name ?? item.patientName ?? item.name),
    patient_code: toText(item.patient_code ?? item.patientCode),
    age_value: toNumber(item.age_value ?? item.ageValue),
    age_unit: toText(item.age_unit ?? item.ageUnit),
    gender: toText(item.gender),
    phone: toText(item.phone),
    referred_by: toText(item.referred_by ?? item.referredBy),
    invoice_no: toText(item.invoice_no ?? item.invoiceNo),
    order_date: toText(item.order_date ?? item.orderDate),
  };
}

export const money = (value: number) => `Rs ${Number(value || 0).toFixed(0)}`;

export const getErrorMessage = (err: unknown, fallback: string) => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return fallback;
};

const hasDesktopBridge = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MOCK_TESTS: Test[] = [
  {
    id: 1,
    name: "CBC (Complete Blood Count)",
    price: 300,
    parameters: [
      { id: 101, name: "Hemoglobin", unit: "g/dL", normal_range: "12-16" },
      { id: 102, name: "Total WBC Count", unit: "/uL", normal_range: "4000-11000" },
      { id: 103, name: "RBC Count", unit: "million/uL", normal_range: "4.2-5.9" },
      { id: 104, name: "Platelet Count", unit: "/uL", normal_range: "150000-450000" },
      { id: 105, name: "Packed Cell Volume (PCV)", unit: "%", normal_range: "36-46" },
      { id: 106, name: "Mean Corpuscular Volume (MCV)", unit: "fL", normal_range: "80-100" },
      { id: 107, name: "MCH", unit: "pg", normal_range: "27-32" },
      { id: 108, name: "MCHC", unit: "g/dL", normal_range: "32-36" },
      { id: 109, name: "Neutrophils", unit: "%", normal_range: "40-70" },
      { id: 110, name: "Lymphocytes", unit: "%", normal_range: "20-40" },
      { id: 111, name: "Eosinophils", unit: "%", normal_range: "1-6" },
      { id: 112, name: "Monocytes", unit: "%", normal_range: "2-8" },
      { id: 113, name: "Basophils", unit: "%", normal_range: "0-1" },
    ],
  },
  {
    id: 9,
    name: "Lipid Profile",
    price: 700,
    parameters: [
      { id: 901, name: "Total Cholesterol", unit: "mg/dL", normal_range: "<200" },
      { id: 902, name: "Triglycerides", unit: "mg/dL", normal_range: "<150" },
      { id: 903, name: "HDL Cholesterol", unit: "mg/dL", normal_range: ">40" },
      { id: 904, name: "LDL Cholesterol", unit: "mg/dL", normal_range: "<100" },
      { id: 905, name: "VLDL Cholesterol", unit: "mg/dL", normal_range: "5-30" },
      { id: 906, name: "Total / HDL Ratio", unit: "", normal_range: "<4.5" },
    ],
  },
  {
    id: 10,
    name: "Liver Function Test (LFT)",
    price: 700,
    parameters: [
      { id: 1001, name: "Bilirubin Total", unit: "mg/dL", normal_range: "0.3-1.2" },
      { id: 1002, name: "Bilirubin Direct", unit: "mg/dL", normal_range: "0.0-0.3" },
      { id: 1003, name: "SGOT/AST", unit: "U/L", normal_range: "0-40" },
      { id: 1004, name: "SGPT/ALT", unit: "U/L", normal_range: "0-45" },
      { id: 1005, name: "Alkaline Phosphatase", unit: "U/L", normal_range: "44-147" },
      { id: 1006, name: "Total Protein", unit: "g/dL", normal_range: "6.0-8.3" },
      { id: 1007, name: "Albumin", unit: "g/dL", normal_range: "3.5-5.2" },
    ],
  },
  {
    id: 11,
    name: "Kidney Function Test (KFT)",
    price: 650,
    parameters: [
      { id: 1101, name: "Urea", unit: "mg/dL", normal_range: "15-45" },
      { id: 1102, name: "Creatinine", unit: "mg/dL", normal_range: "0.6-1.3" },
      { id: 1103, name: "Uric Acid", unit: "mg/dL", normal_range: "3.5-7.2" },
      { id: 1104, name: "Blood Urea Nitrogen (BUN)", unit: "mg/dL", normal_range: "7-20" },
    ],
  },
  {
    id: 12,
    name: "Thyroid Profile T3 T4 TSH",
    price: 650,
    parameters: [
      { id: 1201, name: "T3 (Total Triiodothyronine)", unit: "ng/dL", normal_range: "80-200" },
      { id: 1202, name: "T4 (Total Thyroxine)", unit: "ug/dL", normal_range: "5.1-14.1" },
      { id: 1203, name: "TSH (Thyroid Stimulating Hormone)", unit: "uIU/mL", normal_range: "0.4-4.0" },
    ],
  },
  {
    id: 5,
    name: "Fasting Blood Sugar",
    price: 100,
    parameters: [
      { id: 501, name: "Glucose Fasting", unit: "mg/dL", normal_range: "70-100" },
    ],
  },
  {
    id: 8,
    name: "HbA1c",
    price: 450,
    parameters: [
      { id: 801, name: "HbA1c (Glycated Hemoglobin)", unit: "%", normal_range: "4.0-5.6" },
      { id: 802, name: "Estimated Average Glucose (eAG)", unit: "mg/dL", normal_range: "70-126" },
    ],
  },
  {
    id: 14,
    name: "Urine Routine",
    price: 150,
    parameters: [
      { id: 1401, name: "Colour", unit: "", normal_range: "Pale yellow" },
      { id: 1402, name: "Appearance", unit: "", normal_range: "Clear" },
      { id: 1403, name: "Protein", unit: "", normal_range: "Negative" },
      { id: 1404, name: "Sugar", unit: "", normal_range: "Negative" },
      { id: 1405, name: "Pus Cells", unit: "/HPF", normal_range: "0-5" },
      { id: 1406, name: "RBC", unit: "/HPF", normal_range: "0-2" },
      { id: 1407, name: "Epithelial Cells", unit: "/HPF", normal_range: "2-4" },
    ],
  },
  {
    id: 18,
    name: "Dengue NS1",
    price: 700,
    parameters: [
      { id: 1801, name: "Dengue NS1 Antigen", unit: "", normal_range: "Negative" },
    ],
  },
  {
    id: 20,
    name: "Widal Test",
    price: 250,
    parameters: [
      { id: 2001, name: "Widal O Antigen", unit: "titre", normal_range: "<1:80" },
      { id: 2002, name: "Widal H Antigen", unit: "titre", normal_range: "<1:80" },
    ],
  },
];

export const testService = {
  getTests(): Promise<Test[]> {
    if (!hasDesktopBridge()) {
      return Promise.resolve([...MOCK_TESTS]);
    }
    return invoke<Test[]>("get_tests");
  },

  createOrder(payload: {
    patientId: number;
    testIds: number[];
    parameterIds: number[];
    totalAmount: number;
    discountAmount: number;
  }): Promise<number> {
    if (!hasDesktopBridge()) {
      return Promise.resolve(Math.floor(Date.now() / 1000) % 1000 || 1);
    }
    return invoke<number>("create_order", payload);
  },

  async getOrders(): Promise<DashboardOrderRow[]> {
    const rows = await invoke<unknown>("get_orders");
    const list = Array.isArray(rows) ? rows : [];

    return list.map(normalizeDashboardOrder).filter((row) => row.id > 0);
  },

  async getOrdersByDateRange(
    dateFrom: string,
    dateTo: string,
  ): Promise<DashboardOrderRow[]> {
    const rows = await invoke<unknown>("get_orders_by_date_range", {
      dateFrom,
      dateTo,
    });
    const list = Array.isArray(rows) ? rows : [];
    return list.map(normalizeDashboardOrder).filter((row) => row.id > 0);
  },

  async getDoctorRevenue(
    dateFrom: string,
    dateTo: string,
  ): Promise<DoctorRevenueRow[]> {
    if (!hasDesktopBridge()) {
      return [
        {
          doctor_name: "Dr. Patil (MBBS, MD)",
          order_count: 5,
          total_amount: 4500,
          paid_amount: 3500,
          pending_amount: 1000,
          share_percentage: 20,
          share_amount: 900,
        },
        {
          doctor_name: "Dr. Chavan",
          order_count: 3,
          total_amount: 2800,
          paid_amount: 2800,
          pending_amount: 0,
          share_percentage: 20,
          share_amount: 560,
        },
        {
          doctor_name: "Dr. A. Sharma",
          order_count: 2,
          total_amount: 1500,
          paid_amount: 1000,
          pending_amount: 500,
          share_percentage: 20,
          share_amount: 300,
        },
        {
          doctor_name: "Dr. Sneha Kulkarni",
          order_count: 0,
          total_amount: 0,
          paid_amount: 0,
          pending_amount: 0,
          share_percentage: 20,
          share_amount: 0,
        },
        {
          doctor_name: "Self / Walk-in",
          order_count: 4,
          total_amount: 3200,
          paid_amount: 3200,
          pending_amount: 0,
          share_percentage: 0,
          share_amount: 0,
        },
      ];
    }
    const rows = await invoke<unknown>("get_doctor_revenue", {
      dateFrom,
      dateTo,
    });
    const list = Array.isArray(rows) ? rows : [];
    return list.map((row) => {
      if (Array.isArray(row)) {
        return {
          doctor_name: toText(row[0]),
          order_count: toNumber(row[1]),
          total_amount: toNumber(row[2]),
          paid_amount: toNumber(row[3]),
          pending_amount: toNumber(row[4]),
          share_percentage: toNumber(row[5] ?? 20),
          share_amount: toNumber(row[6] ?? 0),
        };
      }
      const item = row as Record<string, unknown>;
      return {
        doctor_id: item.doctor_id == null ? null : toNumber(item.doctor_id),
        doctor_name: toText(item.doctor_name ?? item.doctorName),
        order_count: toNumber(item.order_count ?? item.orderCount),
        total_amount: toNumber(item.total_amount ?? item.totalAmount),
        paid_amount: toNumber(item.paid_amount ?? item.paidAmount),
        pending_amount: toNumber(item.pending_amount ?? item.pendingAmount),
        referral_count: toNumber(item.referral_count ?? item.referralCount ?? item.order_count ?? item.orderCount),
        eligible_amount: toNumber(item.eligible_amount ?? item.eligibleAmount ?? item.total_amount ?? item.totalAmount),
        share_percentage: toNumber(item.share_percentage ?? item.sharePercentage ?? 20),
        share_amount: toNumber(item.share_amount ?? item.shareAmount ?? 0),
        commission_earned: toNumber(item.commission_earned ?? item.commissionEarned ?? item.share_amount ?? item.shareAmount),
        commission_paid: toNumber(item.commission_paid ?? item.commissionPaid),
        commission_outstanding: toNumber(item.commission_outstanding ?? item.commissionOutstanding ?? item.pending_amount ?? item.pendingAmount),
        last_referral: toText(item.last_referral ?? item.lastReferral),
        legacy_order_count: toNumber(item.legacy_order_count ?? item.legacyOrderCount),
      };
    });
  },

  updatePayment(orderId: number, paidAmount: number): Promise<string> {
    if (!hasDesktopBridge()) {
      return Promise.resolve("Payment updated");
    }
    return invoke<string>("update_payment", {
      orderId,
      paidAmount,
    });
  },

  cancelOrder(orderId: number): Promise<void> {
    return invoke<void>("cancel_order", { orderId });
  },

  updateOrder(orderId: number, payload: UpdateOrderPayload): Promise<void> {
    return invoke<void>("update_order", { orderId, payload });
  },

  updateOrderStatus(orderId: number, newStatus: string): Promise<void> {
    return invoke<void>("update_order_status", { orderId, newStatus });
  },

  async getDailySummary(): Promise<FinancialSummary> {
    const row = await invoke<unknown>("get_daily_summary");
    return normalizeSummary(row);
  },

  async getOverallSummary(): Promise<FinancialSummary> {
    const row = await invoke<unknown>("get_overall_summary");
    return normalizeSummary(row);
  },

  async getPaymentHistory(orderId: number): Promise<PaymentHistoryEntry[]> {
    const rows = await invoke<unknown>("get_payment_history", { orderId });
    const list = Array.isArray(rows) ? rows : [];
    return list.map((row) => {
      if (Array.isArray(row)) {
        return {
          id: toNumber(row[0]),
          order_id: toNumber(row[1]),
          previous_paid: toNumber(row[2]),
          new_paid: toNumber(row[3]),
          total_amount: toNumber(row[4]),
          created_at: toText(row[5]),
        };
      }
      const item = row as Record<string, unknown>;
      return {
        id: toNumber(item.id),
        order_id: toNumber(item.order_id ?? item.orderId),
        previous_paid: toNumber(item.previous_paid ?? item.previousPaid),
        new_paid: toNumber(item.new_paid ?? item.newPaid),
        total_amount: toNumber(item.total_amount ?? item.totalAmount),
        created_at: toText(item.created_at ?? item.createdAt),
      };
    });
  },

  async getParametersByOrder(orderId: number): Promise<OrderParameter[]> {
    const rows = await invoke<unknown>("get_parameters_by_order", { orderId });
    const list = Array.isArray(rows) ? rows : [];

    return list
      .map(normalizeOrderParameter)
      .filter((row): row is OrderParameter => Boolean(row));
  },

  async getResultsByOrder(orderId: number): Promise<ExistingResultRow[]> {
    const rows = await invoke<unknown>("get_results_by_order", { orderId });
    const list = Array.isArray(rows) ? rows : [];

    return list
      .map(normalizeExistingResult)
      .filter((row): row is ExistingResultRow => Boolean(row));
  },

  saveResult(
    orderId: number,
    parameterId: number,
    value: string,
  ): Promise<string> {
    return invoke<string>("save_result", {
      orderId,
      parameterId,
      value: value.trim(),
    });
  },

  async saveResults(
    orderId: number,
    results: ResultValuePayload[],
  ): Promise<void> {
    const cleanResults = results
      .map((row) => ({
        parameterId: row.parameterId,
        value: row.value.trim(),
      }))
      .filter((row) => row.value);

    if (cleanResults.length === 0) return;

    try {
      await invoke("save_results", {
        orderId,
        results: cleanResults,
      });
    } catch {
      for (const row of cleanResults) {
        await this.saveResult(orderId, row.parameterId, row.value);
      }
    }
  },

  async getReport(orderId: number): Promise<ReportRow[]> {
    const rows = await invoke<unknown>("get_report", { orderId });
    const list = Array.isArray(rows) ? rows : [];

    return list
      .map(normalizeReportRow)
      .filter((row): row is ReportRow => Boolean(row));
  },

  async getPatientByOrder(orderId: number): Promise<ReportPatientInfo> {
    const row = await invoke<unknown>("get_patient_by_order", { orderId });
    return normalizePatientInfo(row);
  },

  async getReceipt(orderId: number): Promise<ReceiptData> {
    const row = await invoke<unknown>("get_receipt", { orderId });
    return normalizeReceipt(row);
  },
};
