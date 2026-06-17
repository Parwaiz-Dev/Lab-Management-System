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

export interface AuditSummary {
  totalEvents: number;
  usersActive: number;
  createActions: number;
  updateDeleteActions: number;
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

export interface DashboardOrderRow {
  id: number;
  patientName: string;
  tests: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: OrderStatus | string;
  reportStatus: string;
}

export interface FinancialSummary {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}

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

export interface ReceiptData {
  patient: string;
  invoice: string;
  total: number;
  paid: number;
  discount: number;
  tests: ReceiptLine[];
}

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

export interface PaymentHistoryEntry {
  id: number;
  order_id: number;
  previous_paid: number;
  new_paid: number;
  total_amount: number;
  created_at: string;
}

export interface ResultValuePayload {
  parameterId: number;
  value: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface DoctorRevenueRow {
  doctor_name: string;
  order_count: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
}

export interface UpdateOrderPayload {
  test_ids: number[];
  parameter_ids: number[];
  total_amount: number;
  discount_amount: number;
}

export interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
}

// ── Patient History ──────────────────────────────────
export interface PatientHistoryResponse {
  patient: PatientHistoryProfile;
  orders: PatientHistoryOrder[];
  payments: PatientHistoryPayment[];
  reports: PatientHistoryReport[];
  previous_results: PatientHistoryResultGroup[];
  timeline: PatientHistoryTimelineEntry[];
}

export interface PatientHistoryProfile {
  id: number;
  patient_code: string;
  name: string;
  age_value: number | null;
  age_unit: string | null;
  gender: string | null;
  phone: string | null;
  referred_by: string | null;
  created_at: string;
}

export interface PatientHistoryOrder {
  id: number;
  invoice_no: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: string;
  created_at: string;
  test_names: string;
}

export interface PatientHistoryPayment {
  id: number;
  order_id: number;
  invoice_no: string;
  previous_paid: number;
  new_paid: number;
  total_amount: number;
  created_at: string;
}

export interface PatientHistoryReport {
  order_id: number;
  invoice_no: string;
  test_name: string;
  parameter_name: string;
  value: string;
  unit: string;
  normal_range: string;
  created_at: string;
}

export interface PatientHistoryResultGroup {
  parameter_name: string;
  test_name: string;
  unit: string;
  normal_range: string;
  entries: PatientHistoryResultEntry[];
}

export interface PatientHistoryResultEntry {
  order_id: number;
  invoice_no: string;
  order_date: string;
  value: string;
}

export interface PatientHistoryTimelineEntry {
  event_type: string;
  description: string;
  timestamp: string;
  order_id: number | null;
}
