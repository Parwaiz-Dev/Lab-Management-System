export type FlagStatus = "" | "Low" | "High" | "Normal";

/**
 * Evaluates clinical lab result against reference interval according to standard Indian diagnostic laboratory criteria.
 * Handles numeric intervals (min-max, <x, >x), qualitative tests (Positive/Negative, Reactive/Non-reactive),
 * and special clinical cases (e.g. Urine Protein/Sugar numeric values against Negative expectation).
 */
export function getFlagStatus(value: string | undefined | null, range: string | undefined | null): FlagStatus {
  if (value === undefined || value === null || range === undefined || range === null) {
    return "";
  }

  const v = String(value).trim();
  const r = String(range).trim();
  if (!v || !r) return "";

  const vLower = v.toLowerCase();
  const rLower = r.toLowerCase();

  // 1. Exact textual match (e.g. "Pale yellow" === "Pale yellow", "Clear" === "Clear")
  if (vLower === rLower) {
    return "Normal";
  }

  // 2. Qualitative ranges expecting Negative / Nil / Absent / Non-reactive
  const isNegativeExpected =
    rLower.includes("negative") ||
    rLower.includes("non-reactive") ||
    rLower.includes("non reactive") ||
    rLower.includes("nonreactive") ||
    rLower.includes("nil") ||
    rLower.includes("absent") ||
    rLower.includes("not detected") ||
    rLower.includes("not seen") ||
    rLower.includes("no growth");

  if (isNegativeExpected) {
    const isNormalValue =
      vLower === "negative" ||
      vLower === "neg" ||
      vLower === "non-reactive" ||
      vLower === "non reactive" ||
      vLower === "nonreactive" ||
      vLower === "nil" ||
      vLower === "absent" ||
      vLower === "not detected" ||
      vLower === "not seen" ||
      vLower === "no growth" ||
      vLower === "-" ||
      vLower === "0" ||
      vLower === "none";

    if (isNormalValue) {
      return "Normal";
    }

    const isAbnormalValue =
      vLower === "positive" ||
      vLower === "pos" ||
      vLower === "reactive" ||
      vLower === "present" ||
      vLower === "detected" ||
      vLower === "seen" ||
      vLower.startsWith("+") ||
      vLower.includes("trace") ||
      vLower.includes("1+") ||
      vLower.includes("2+") ||
      vLower.includes("3+") ||
      vLower.includes("4+");

    if (isAbnormalValue) {
      return "High";
    }

    // Quantitative number entered for test with Negative reference range (e.g. Urine Protein: 20 mg/dL, Sugar: 10)
    const num = Number.parseFloat(v.replace(/,/g, ""));
    if (!Number.isNaN(num)) {
      if (num === 0) return "Normal";
      if (num > 0) return "High";
    }

    // Any other text different from normal expectation
    return "High";
  }

  // 3. Descriptive categorical options (e.g. Blood Group "A/B/AB/O", Rh "Positive/Negative")
  if (rLower.includes("a/b/ab/o") || (rLower.includes("positive/negative") && !vLower.includes("test"))) {
    return "Normal";
  }

  // 4. Urine Colour / Appearance checks
  if (rLower.includes("pale yellow") || rLower.includes("straw")) {
    if (vLower.includes("pale yellow") || vLower.includes("straw") || vLower === "yellow") {
      return "Normal";
    }
    if (vLower.includes("red") || vLower.includes("brown") || vLower.includes("turbid") || vLower.includes("cloudy")) {
      return "High";
    }
  }

  if (rLower.includes("clear")) {
    if (vLower === "clear") return "Normal";
    if (vLower.includes("hazy") || vLower.includes("turbid") || vLower.includes("cloudy")) {
      return "High";
    }
  }

  // 5. Titre tests (e.g. Widal "<1:80")
  if (rLower.includes("<1:") || rLower.includes("1:")) {
    if (vLower.includes("negative") || vLower === "<1:80" || vLower === "1:20" || vLower === "1:40") {
      return "Normal";
    }
    if (vLower.includes("positive") || vLower.includes("reactive") || vLower === "1:160" || vLower === "1:320") {
      return "High";
    }
  }

  // 6. Numeric evaluations
  const num = Number.parseFloat(v.replace(/,/g, ""));
  if (Number.isNaN(num)) {
    // Result is text for a test that had a numeric range
    if (vLower === "positive" || vLower === "reactive" || vLower === "detected" || vLower === "present") {
      return "High";
    }
    if (vLower === "negative" || vLower === "non-reactive" || vLower === "nil" || vLower === "absent") {
      return "Normal";
    }
    return "";
  }

  // Upper bound only: < 200, <= 150
  if (rLower.startsWith("<=")) {
    const max = Number.parseFloat(rLower.replace("<=", ""));
    if (!Number.isNaN(max)) return num > max ? "High" : "Normal";
  }
  if (rLower.startsWith("<")) {
    const max = Number.parseFloat(rLower.replace("<", ""));
    if (!Number.isNaN(max)) return num >= max ? "High" : "Normal";
  }

  // Lower bound only: > 40, >= 60
  if (rLower.startsWith(">=")) {
    const min = Number.parseFloat(rLower.replace(">=", ""));
    if (!Number.isNaN(min)) return num < min ? "Low" : "Normal";
  }
  if (rLower.startsWith(">")) {
    const min = Number.parseFloat(rLower.replace(">", ""));
    if (!Number.isNaN(min)) return num <= min ? "Low" : "Normal";
  }

  // Range interval: "min - max" or "min to max"
  const match = rLower.match(/(-?\d+(\.\d+)?)\s*(?:-|to)\s*(-?\d+(\.\d+)?)/);
  if (match) {
    const min = Number.parseFloat(match[1]);
    const max = Number.parseFloat(match[3]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      if (num < min) return "Low";
      if (num > max) return "High";
      return "Normal";
    }
  }

  return "";
}

export function isAbnormalFlag(flag: FlagStatus): boolean {
  return flag === "High" || flag === "Low";
}
