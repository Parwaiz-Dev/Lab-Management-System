export type OrderStatus = "Pending" | "Partial" | "Completed";
export type ToastType = "success" | "error" | "warning" | "info";

// ── Auth ────────────────────────────────────────────
export interface LoginResponse {
  user_id: number;
  username: string;
  role: string;
}

// ── Audit ───────────────────────────────────────────
export interface AuditLogEntry {
  id: number;
  user_id: number;
  username: string;
  action: string;
  table_name: string;
  record_id: number | null;
  old_data: string | null;
  new_data: string | null;
  created_at: string;
}

export interface SessionInfo {
  user_id: number;
  username: string;
  role: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Patient {
  id: number;
  patient_code: string;
  name: string;
  age_value: number | null;
  age_unit: "Years" | "Months" | "Days";
  gender: "Male" | "Female" | "Other";
  phone: string | null;
  referred_by: string | null;
  created_at?: string;
}

export interface TestParameter {
  id: number;
  name: string;
  unit: string;
  normal_range: string;
}

export interface Test {
  id: number;
  name: string;
  price: number;
  parameters: TestParameter[];
}

export interface OrderParameter extends TestParameter {
  test_id: number;
  test_name: string;
}

export type DashboardOrderRow = [
  id: number,
  patientName: string,
  tests: string,
  totalAmount: number,
  paidAmount: number,
  paymentStatus: OrderStatus | string,
];

export type FinancialSummaryTuple = [
  totalAmount: number,
  paidAmount: number,
  pendingAmount: number,
];

export interface ReportRow {
  test_name: string;
  parameter_name: string;
  value: string;
  unit: string;
  normal_range: string;
}

export interface ReportPatientInfo {
  patient_name: string;
  patient_code: string;
  age_value: number;
  age_unit: string;
  gender: string;
  phone: string;
  referred_by: string;
  invoice_no: string;
  order_date: string;
}

export interface ReceiptLine {
  test_name: string;
  price: number;
  parameter_names: string[];
}

export type ReceiptData = [
  patient: string,
  invoice: string,
  total: number,
  paid: number,
  discount: number,
  tests: ReceiptLine[],
];

export interface LabSettings {
  lab_name: string;
  lab_address: string;
  doctor_share: string;
  lab_logo: string;
}

export interface ToastMessage {
  message: string;
  type: ToastType;
  duration?: number;
}

export interface ResultValuePayload {
  parameterId: number;
  value: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
}
