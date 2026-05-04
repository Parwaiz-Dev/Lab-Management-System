/// 📝 Form Validation Utilities
/// Client-side validation for all user inputs
/// Provides immediate user feedback before sending to backend

/**
 * Validate patient name
 * - Required, non-empty
 * - 2-100 characters
 * - Letters, spaces, hyphens, apostrophes only
 */
export const validateName = (name: string): string | null => {
  if (!name || !name.trim()) {
    return "Name is required";
  }
  if (name.length < 2) {
    return "Name must be at least 2 characters";
  }
  if (name.length > 100) {
    return "Name must be less than 100 characters";
  }
  if (!/^[a-zA-Z\s'-]+$/.test(name)) {
    return "Name can only contain letters, spaces, hyphens, and apostrophes";
  }
  return null;
};

/**
 * Validate age value
 * - Required
 * - Between 0-150
 * - Whole number
 */
export const validateAge = (age: number | null): string | null => {
  if (age === null || age === undefined) {
    return "Age is required";
  }
  if (!Number.isInteger(age)) {
    return "Age must be a whole number";
  }
  if (age < 0 || age > 150) {
    return "Age must be between 0 and 150";
  }
  return null;
};

/**
 * Validate phone number (basic)
 * - Optional field
 * - If provided: 10-15 digits/valid format
 */
export const validatePhone = (phone: string): string | null => {
  if (!phone) {
    return null; // Optional
  }
  if (phone.length < 10) {
    return "Phone must be at least 10 characters";
  }
  if (phone.length > 15) {
    return "Phone must be less than 15 characters";
  }
  if (!/^[0-9\s+\-()]+$/.test(phone)) {
    return "Phone contains invalid characters";
  }
  return null;
};

/**
 * Validate gender selection
 */
export const validateGender = (gender: string): string | null => {
  const validGenders = ["Male", "Female", "Other"];
  if (!validGenders.includes(gender)) {
    return "Please select a valid gender";
  }
  return null;
};

/**
 * Validate age unit
 */
export const validateAgeUnit = (unit: string): string | null => {
  const validUnits = ["Years", "Months", "Days"];
  if (!validUnits.includes(unit)) {
    return "Please select a valid age unit";
  }
  return null;
};

/**
 * Validate doctor name
 * - Required, non-empty
 * - 2-100 characters
 */
export const validateDoctorName = (name: string): string | null => {
  if (!name || !name.trim()) {
    return "Doctor name is required";
  }
  if (name.length < 2) {
    return "Doctor name must be at least 2 characters";
  }
  if (name.length > 100) {
    return "Doctor name must be less than 100 characters";
  }
  return null;
};

/**
 * Validate currency amount
 * - Required
 * - Non-negative
 * - Valid number
 */
export const validateAmount = (amount: number): string | null => {
  if (amount === null || amount === undefined) {
    return "Amount is required";
  }
  if (typeof amount !== "number" || isNaN(amount)) {
    return "Amount must be a valid number";
  }
  if (amount < 0) {
    return "Amount cannot be negative";
  }
  if (amount > 10_000_000) {
    return "Amount exceeds maximum allowed value";
  }
  return null;
};

/**
 * Validate test selection
 * - At least one test must be selected
 */
export const validateTestSelection = (testIds: number[]): string | null => {
  if (!testIds || testIds.length === 0) {
    return "Please select at least one test";
  }
  if (testIds.length > 100) {
    return "Too many tests selected (max 100)";
  }
  return null;
};

/**
 * Validate parameter value
 * - Required, non-empty
 * - Less than 500 characters
 */
export const validateParameterValue = (value: string): string | null => {
  if (!value || !value.trim()) {
    return "Value is required";
  }
  if (value.length > 500) {
    return "Value must be less than 500 characters";
  }
  return null;
};

/**
 * Entire patient form validation
 * Returns an object with field-level errors
 */
export const validatePatientForm = (
  name: string,
  age: number | null,
  ageUnit: string,
  gender: string,
  phone: string
): Record<string, string> => {
  const errors: Record<string, string> = {};

  const nameError = validateName(name);
  if (nameError) errors.name = nameError;

  const ageError = validateAge(age);
  if (ageError) errors.age = ageError;

  const unitError = validateAgeUnit(ageUnit);
  if (unitError) errors.ageUnit = unitError;

  const genderError = validateGender(gender);
  if (genderError) errors.gender = genderError;

  const phoneError = validatePhone(phone);
  if (phoneError) errors.phone = phoneError;

  return errors;
};

/**
 * Check if form has any errors
 */
export const hasErrors = (errors: Record<string, string>): boolean => {
  return Object.values(errors).some((error) => error !== "");
};

/**
 * Get first error message from errors object
 * Useful for displaying a single error message
 */
export const getFirstError = (errors: Record<string, string>): string | null => {
  const firstKey = Object.keys(errors).find((key) => errors[key]);
  return firstKey ? errors[firstKey] : null;
};
