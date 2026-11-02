/**
 * 🧪 Result Type & Clinical Calculation Registry
 * Handles result classifications (numeric, qualitative, semi-quantitative, text, calculated)
 * and laboratory calculation rules (e.g., traditional Friedewald Lipid Profile).
 */

export type ResultType =
  | "numeric"
  | "qualitative"
  | "semi_quantitative"
  | "text"
  | "calculated";

export interface ParameterConfig {
  type: ResultType;
  options?: string[];
  placeholder?: string;
  isCalculated?: boolean;
}

export interface LipidCalculationInputs {
  totalCholesterol?: number | string | null;
  triglycerides?: number | string | null;
  hdl?: number | string | null;
}

export interface LipidCalculationOutputs {
  vldl: string;
  ldl: string;
  ratio: string;
  ldlWarning?: string;
}

export const FRIEDEWALD_TG_LIMIT = 400;
export const FRIEDEWALD_WARNING =
  "Friedewald calculation unavailable – direct LDL measurement or an approved alternative method required.";

/**
 * Safely parses a number from input, removing commas and whitespace.
 * Returns null if missing, NaN, non-finite, or empty.
 */
export function parseClinicalNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(/,/g, "");
  if (!str) return null;
  const num = Number(str);
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;
  return num;
}

/**
 * Calculates VLDL, LDL, and TC/HDL Ratio using the traditional Friedewald formula.
 *
 * Rules:
 * - VLDL = TG / 5 (rounded to 1 decimal place)
 * - LDL = TC - HDL - VLDL (rounded to 1 decimal place)
 * - If TG >= 400 mg/dL: LDL is left blank and a clinical warning is returned.
 * - TC / HDL Ratio = TC / HDL (rounded to 2 decimal places)
 * - If HDL is 0 or missing: Ratio is left blank.
 * - If inputs are missing or invalid: Calculated values are left blank.
 */
export function calculateLipidProfile(
  inputs: LipidCalculationInputs
): LipidCalculationOutputs {
  const tc = parseClinicalNumber(inputs.totalCholesterol);
  const tg = parseClinicalNumber(inputs.triglycerides);
  const hdl = parseClinicalNumber(inputs.hdl);

  let vldl = "";
  let ldl = "";
  let ratio = "";
  let ldlWarning: string | undefined = undefined;

  // 1. Calculate VLDL = TG / 5
  if (tg !== null && tg >= 0) {
    const rawVldl = tg / 5;
    vldl = (Math.round(rawVldl * 10) / 10).toFixed(1);
  }

  // 2. Calculate LDL = TC - HDL - VLDL
  if (tg !== null && tg >= FRIEDEWALD_TG_LIMIT) {
    // Triglycerides too high for Friedewald
    ldl = "";
    ldlWarning = FRIEDEWALD_WARNING;
  } else if (
    tc !== null &&
    tc > 0 &&
    tg !== null &&
    tg >= 0 &&
    hdl !== null &&
    hdl > 0
  ) {
    const rawVldl = tg / 5;
    const rawLdl = tc - hdl - rawVldl;
    ldl = (Math.round(rawLdl * 10) / 10).toFixed(1);
  }

  // 3. Calculate Total Cholesterol / HDL Ratio = TC / HDL
  if (tc !== null && tc > 0 && hdl !== null && hdl > 0) {
    const rawRatio = tc / hdl;
    ratio = (Math.round(rawRatio * 100) / 100).toFixed(2);
  }

  return { vldl, ldl, ratio, ldlWarning };
}

// ── Standard Clinical Parameter Dictionaries ──────────────────────────────────

export const QUALITATIVE_OPTIONS = {
  negative_positive: ["Negative", "Positive"],
  dengue_ns1: ["Negative", "Positive", "Equivocal"],
  dengue_ab: ["Negative", "Positive"],
  reactive_nonreactive: ["Non-reactive", "Reactive"],
  detected_not_detected: ["Not detected", "Detected"],
  blood_group: ["A", "B", "AB", "O"],
  rh_type: ["Positive", "Negative"],
  stool_occult_blood: ["Negative", "Positive"],
  urine_protein_sugar: ["Negative", "Trace", "1+", "2+", "3+", "4+"],
  urine_ketone: ["Negative", "Trace", "1+", "2+", "3+"],
  urine_colour: [
    "Pale yellow",
    "Straw",
    "Yellow",
    "Dark yellow",
    "Amber",
    "Reddish",
    "Turbid",
  ],
  urine_appearance: [
    "Clear",
    "Slightly hazy",
    "Hazy",
    "Turbid",
    "Cloudy",
  ],
  urine_casts_crystals: ["Nil", "Present", "Few", "Moderate", "Many"],
  widal: ["<1:80", "1:80", "1:160", "1:320", "Negative"],
  stool_ova_cyst: ["Not seen", "Seen"],
  peripheral_smear: [
    "Normal morphology",
    "Normocytic normochromic",
    "Microcytic hypochromic",
    "Macrocytic",
  ],
};

// ── Parameter Matchers ────────────────────────────────────────────────────────

export function isLipidTest(testName: string): boolean {
  return (testName || "").toLowerCase().includes("lipid");
}

export function isTcParam(paramName: string): boolean {
  const norm = (paramName || "").toLowerCase();
  return (
    norm.includes("total cholesterol") ||
    (norm.includes("cholesterol") &&
      !norm.includes("hdl") &&
      !norm.includes("ldl") &&
      !norm.includes("vldl") &&
      !norm.includes("ratio"))
  );
}

export function isTgParam(paramName: string): boolean {
  return (paramName || "").toLowerCase().includes("triglyceride");
}

export function isHdlParam(paramName: string): boolean {
  const norm = (paramName || "").toLowerCase();
  return (
    norm.includes("hdl") &&
    !norm.includes("ratio") &&
    !norm.includes("vldl") &&
    !norm.includes("ldl") &&
    !norm.includes("total chol")
  );
}

export function isLdlParam(paramName: string): boolean {
  const norm = (paramName || "").toLowerCase();
  return (
    norm.includes("ldl") &&
    !norm.includes("vldl") &&
    !norm.includes("hdl") &&
    !norm.includes("ratio")
  );
}

export function isVldlParam(paramName: string): boolean {
  return (paramName || "").toLowerCase().includes("vldl");
}

export function isRatioParam(paramName: string): boolean {
  const norm = (paramName || "").toLowerCase();
  return norm.includes("ratio");
}

/**
 * Returns the result configuration (type, dropdown options, calculation status)
 * for any laboratory test parameter.
 */
export function getParameterConfig(
  testName: string,
  paramName: string,
  normalRange?: string
): ParameterConfig {
  const tNorm = (testName || "").toLowerCase();
  const pNorm = (paramName || "").toLowerCase();
  const rNorm = (normalRange || "").toLowerCase();

  // 1. Check for Lipid Profile fields
  if (isLipidTest(tNorm)) {
    // Three manual input parameters
    if (isTcParam(pNorm) || isTgParam(pNorm) || isHdlParam(pNorm)) {
      return {
        type: "numeric",
        placeholder: "Enter value (mg/dL)...",
      };
    }
    // Three calculated parameters (with manual override support)
    if (isLdlParam(pNorm) || isVldlParam(pNorm) || isRatioParam(pNorm)) {
      return {
        type: "calculated",
        isCalculated: true,
        placeholder: "Auto or manual...",
      };
    }
  }

  // 2. Urine Routine Tests
  if (tNorm.includes("urine")) {
    if (pNorm.includes("protein") || pNorm.includes("albumin")) {
      return {
        type: "semi_quantitative",
        options: QUALITATIVE_OPTIONS.urine_protein_sugar,
      };
    }
    if (pNorm.includes("sugar") || pNorm.includes("glucose")) {
      return {
        type: "semi_quantitative",
        options: QUALITATIVE_OPTIONS.urine_protein_sugar,
      };
    }
    if (pNorm.includes("ketone")) {
      return {
        type: "semi_quantitative",
        options: QUALITATIVE_OPTIONS.urine_ketone,
      };
    }
    if (pNorm.includes("colour") || pNorm.includes("color")) {
      return {
        type: "text",
        options: QUALITATIVE_OPTIONS.urine_colour,
      };
    }
    if (pNorm.includes("appearance")) {
      return {
        type: "text",
        options: QUALITATIVE_OPTIONS.urine_appearance,
      };
    }
    if (pNorm.includes("bile salt") || pNorm.includes("bile pigment")) {
      return {
        type: "qualitative",
        options: QUALITATIVE_OPTIONS.negative_positive,
      };
    }
    if (pNorm.includes("cast") || pNorm.includes("crystal")) {
      return {
        type: "text",
        options: QUALITATIVE_OPTIONS.urine_casts_crystals,
      };
    }
  }

  // 3. Dengue Tests
  if (tNorm.includes("dengue") || pNorm.includes("dengue")) {
    if (pNorm.includes("ns1")) {
      return {
        type: "qualitative",
        options: QUALITATIVE_OPTIONS.dengue_ns1,
      };
    }
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.dengue_ab,
    };
  }

  // 4. Infectious & Serology
  if (
    pNorm.includes("hiv") ||
    pNorm.includes("hbsag") ||
    pNorm.includes("hcv") ||
    pNorm.includes("vdrl")
  ) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.reactive_nonreactive,
    };
  }

  if (pNorm.includes("malaria")) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.detected_not_detected,
    };
  }

  if (pNorm.includes("pregnancy")) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.negative_positive,
    };
  }

  if (pNorm.includes("blood group")) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.blood_group,
    };
  }

  if (pNorm.includes("rh type") || pNorm.includes("rh factor") || pNorm === "rh") {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.rh_type,
    };
  }

  if (pNorm.includes("widal")) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.widal,
    };
  }

  if (pNorm.includes("typhidot") || pNorm.includes("chikungunya")) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.negative_positive,
    };
  }

  if (pNorm.includes("occult blood")) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.stool_occult_blood,
    };
  }

  if (pNorm.includes("ova") || pNorm.includes("cyst")) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.stool_ova_cyst,
    };
  }

  if (pNorm.includes("peripheral smear")) {
    return {
      type: "text",
      options: QUALITATIVE_OPTIONS.peripheral_smear,
    };
  }

  // 5. Fallback inference based on normal_range text
  if (
    rNorm.includes("non-reactive") ||
    rNorm.includes("non reactive") ||
    rNorm.includes("nonreactive")
  ) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.reactive_nonreactive,
    };
  }

  if (rNorm.includes("not detected")) {
    return {
      type: "qualitative",
      options: QUALITATIVE_OPTIONS.detected_not_detected,
    };
  }

  if (rNorm === "negative" || rNorm === "negative/positive" || rNorm.includes("negative")) {
    // Only classify as qualitative if name is not a quantitative test (like CBC or FBS)
    if (!rNorm.includes("-") && !rNorm.includes("<") && !rNorm.includes(">")) {
      return {
        type: "qualitative",
        options: QUALITATIVE_OPTIONS.negative_positive,
      };
    }
  }

  // Default: Numeric entry
  return {
    type: "numeric",
    placeholder: "Value...",
  };
}
