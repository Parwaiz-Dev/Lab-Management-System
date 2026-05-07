import { invoke } from "@tauri-apps/api/core";
import type {
  DashboardOrderRow,
  FinancialSummaryTuple,
  OrderParameter,
  ReceiptData,
  ReceiptLine,
  ReportPatientInfo,
  ReportRow,
  ResultValuePayload,
  Test,
} from "../../../types";

type ExistingResultRow = [parameterId: number, value: string];

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
    return [
      toNumber(row[0]),
      toText(row[1]),
      toText(row[2]),
      toNumber(row[3]),
      toNumber(row[4]),
      toText(row[5] || "Pending"),
    ];
  }

  const item = asRecord(row);

  return [
    toNumber(item.id ?? item.orderId ?? item.order_id),
    toText(item.patientName ?? item.patient_name ?? item.patient),
    toText(item.tests ?? item.testNames ?? item.test_names),
    toNumber(item.totalAmount ?? item.total_amount ?? item.total),
    toNumber(item.paidAmount ?? item.paid_amount ?? item.paid),
    toText(
      item.paymentStatus ?? item.payment_status ?? item.status ?? "Pending",
    ),
  ];
}

function normalizeSummary(row: unknown): FinancialSummaryTuple {
  if (Array.isArray(row)) {
    return [toNumber(row[0]), toNumber(row[1]), toNumber(row[2])];
  }

  const item = asRecord(row);

  return [
    toNumber(item.totalAmount ?? item.total_amount ?? item.total),
    toNumber(item.paidAmount ?? item.paid_amount ?? item.paid),
    toNumber(item.pendingAmount ?? item.pending_amount ?? item.pending),
  ];
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

    return [
      toText(row[0]),
      toText(row[1]),
      toNumber(row[2]),
      toNumber(row[3]),
      toNumber(row[4]),
      tests,
    ];
  }

  const item = asRecord(row);
  const rawTests = item.tests ?? item.test_lines ?? item.testLines ?? [];

  return [
    toText(item.patient ?? item.patient_name ?? item.patientName),
    toText(item.invoice ?? item.invoice_no ?? item.invoiceNo),
    toNumber(item.total ?? item.total_amount ?? item.totalAmount),
    toNumber(item.paid ?? item.paid_amount ?? item.paidAmount),
    toNumber(item.discount ?? item.discount_amount ?? item.discountAmount),
    Array.isArray(rawTests) ? rawTests.map(normalizeReceiptLine) : [],
  ];
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

    return [parameterId, toText(row[1])];
  }

  const item = asRecord(row);
  const parameterId = toNumber(
    item.parameterId ?? item.parameter_id ?? item.id,
  );

  if (!parameterId) return null;

  return [parameterId, toText(item.value ?? item.result)];
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

export const testService = {
  getTests(): Promise<Test[]> {
    return invoke<Test[]>("get_tests");
  },

  createOrder(payload: {
    patientId: number;
    testIds: number[];
    parameterIds: number[];
    totalAmount: number;
    discountAmount: number;
  }): Promise<number> {
    return invoke<number>("create_order", payload);
  },

  async getOrders(): Promise<DashboardOrderRow[]> {
    const rows = await invoke<unknown>("get_orders");
    const list = Array.isArray(rows) ? rows : [];

    return list.map(normalizeDashboardOrder).filter((row) => row[0] > 0);
  },

  getOrderStatus(orderId: number): Promise<string> {
    return invoke<string>("get_order_status", { orderId });
  },

  updatePayment(orderId: number, paidAmount: number): Promise<string> {
    return invoke<string>("update_payment", {
      orderId,
      paidAmount,
    });
  },

  async getDailySummary(): Promise<FinancialSummaryTuple> {
    const row = await invoke<unknown>("get_daily_summary");
    return normalizeSummary(row);
  },

  async getOverallSummary(): Promise<FinancialSummaryTuple> {
    const row = await invoke<unknown>("get_overall_summary");
    return normalizeSummary(row);
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
