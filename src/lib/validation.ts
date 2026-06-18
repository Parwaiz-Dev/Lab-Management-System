export const validateName = (name: string): string | null => {
  const cleaned = name.trim();

  if (!cleaned) return "Name is required";
  if (cleaned.length < 2) return "Name must be at least 2 characters";
  if (cleaned.length > 100) return "Name must be less than 100 characters";

  if (!/^[\p{L}\p{N} .'\-/()]+$/u.test(cleaned)) {
    return "Name contains invalid characters";
  }

  return null;
};

export const validateAge = (age: number | null): string | null => {
  if (age === null || age === undefined) return "Age is required";
  if (!Number.isInteger(age)) return "Age must be a whole number";
  if (age < 0 || age > 150) return "Age must be between 0 and 150";
  return null;
};

export const validatePhone = (phone: string): string | null => {
  const cleaned = phone.trim();

  if (!cleaned) return null;
  if (cleaned.length < 10) return "Phone must be at least 10 characters";
  if (cleaned.length > 15) return "Phone must be less than 15 characters";

  if (!/^[0-9+\-() ]+$/.test(cleaned)) {
    return "Phone contains invalid characters";
  }

  return null;
};

export const validateGender = (gender: string): string | null => {
  if (!["Male", "Female", "Other"].includes(gender)) {
    return "Please select a valid gender";
  }

  return null;
};

export const validateAgeUnit = (unit: string): string | null => {
  if (!["Years", "Months", "Days"].includes(unit)) {
    return "Please select a valid age unit";
  }

  return null;
};

export const validateDoctorName = (name: string): string | null => {
  const cleaned = name.trim();

  if (!cleaned) return "Doctor name is required";
  if (cleaned.length < 2) return "Doctor name must be at least 2 characters";
  if (cleaned.length > 100)
    return "Doctor name must be less than 100 characters";

  return null;
};

export const validateAmount = (amount: number): string | null => {
  if (amount === null || amount === undefined) return "Amount is required";
  if (Number.isNaN(amount) || !Number.isFinite(amount))
    return "Amount must be valid";
  if (amount < 0) return "Amount cannot be negative";
  if (amount > 10_000_000) return "Amount exceeds maximum allowed value";

  const decimalPart = amount.toString().split(".")[1];

  if (decimalPart && decimalPart.length > 2) {
    return "Amount can have maximum 2 decimal places";
  }

  return null;
};

export const validateTestSelection = (testIds: number[]): string | null => {
  if (!testIds.length) return "Please select at least one test";
  if (testIds.length > 100) return "Too many tests selected";
  if (testIds.some((id) => id <= 0)) return "Invalid test selected";
  return null;
};

export const validateParameterValue = (value: string): string | null => {
  const cleaned = value.trim();

  if (!cleaned) return "Value is required";
  if (cleaned.length > 500) return "Value must be less than 500 characters";

  return null;
};

export const validatePatientForm = (
  name: string,
  age: number | null,
  ageUnit: string,
  gender: string,
  phone: string,
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

export const hasErrors = (errors: Record<string, string>): boolean => {
  return Object.values(errors).some(Boolean);
};

export const getFirstError = (
  errors: Record<string, string>,
): string | null => {
  const firstKey = Object.keys(errors).find((key) => errors[key]);
  return firstKey ? errors[firstKey] : null;
};
