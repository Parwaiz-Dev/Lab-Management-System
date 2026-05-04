/// 📋 Type Definitions Module
/// Central location for all TypeScript interfaces and types used across the frontend
/// This provides type safety and better IDE autocompletion

/**
 * Patient Record
 * Represents a patient in the system
 */
export interface Patient {
  id: number;
  patient_code: string; // Unique identifier format: PID-YYYY-NNNN
  name: string;
  age_value: number | null;
  age_unit: "Years" | "Months" | "Days";
  gender: "Male" | "Female" | "Other";
  phone: string | null;
  referred_by: string | null;
  created_at?: string;
}

/**
 * Test Definition
 * Represents an available lab test
 */
export interface Test {
  id: number;
  name: string;
  price: number; // Amount in INR or local currency
  parameters: TestParameter[];
}

/**
 * Test Parameter
 * A single parameter/measurement within a test
 * Example: Hemoglobin, RBC count, etc.
 */
export interface TestParameter {
  id: number;
  name: string;
  unit: string; // e.g., "g/dL", "cells/μL"
  normal_range: string; // e.g., "12-16"
}

/**
 * Order (Test Order)
 * Represents a test order for a patient
 */
export interface Order {
  id: number;
  patient_id: number;
  patient_name: string;
  tests: string; // Comma-separated test names
  total_amount: number;
  paid_amount: number;
  status: "Pending" | "Partial" | "Completed";
  created_at?: string;
}

/**
 * Order Status
 * Status of a specific order's results entry
 */
export type OrderStatus = "Pending" | "Partial" | "Completed";

/**
 * Test Result
 * A single result value for a parameter in an order
 */
export interface TestResult {
  id: number;
  parameter_id: number;
  parameter_name: string;
  value: string;
  unit: string;
  normal_range: string;
}

export interface OrderParameter extends TestParameter {
  test_id: number;
  test_name: string;
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

/**
 * Payment Record
 * Payment information for an order
 */
export interface Payment {
  order_id: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: "Pending" | "Partial" | "Completed";
}

/**
 * Daily Summary
 * Financial summary for daily dashboard
 */
export interface DailySummary {
  total_revenue: number; // Total amount across all orders
  paid_amount: number; // Total paid
  pending_amount: number; // Total pending
}

/**
 * Toast Notification
 * In-app notification for user feedback
 */
export interface ToastMessage {
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number; // ms, default 3000
}

/**
 * Doctor Reference
 * Represents a referring doctor
 */
export interface Doctor {
  id?: number;
  name: string;
}

/**
 * API Response for batch operations
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Validation Error
 * Form validation error for a specific field
 */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Form State Helper
 * Generic form state for any entity
 */
export interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
}
