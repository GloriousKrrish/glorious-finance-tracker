export interface ValidationResult {
  isValid: boolean;
  sanitizedResponse: string;
  violationsDetected: string[];
}

export class ResponseValidator {
  private static INTERNAL_TERMS: RegExp[] = [
    /\bFinancial OS\b/gi,
    /\bMetrics Registry\b/gi,
    /\bSelector Engine\b/gi,
    /\bPlanning Engine\b/gi,
    /\bForecast Engine\b/gi,
    /\bCache Engine\b/gi,
    /\bGemini\b/gi,
    /\bLLM\b/gi,
    /\bProvider\b/gi,
    /\bInternal Architecture\b/gi,
  ];

  public static validateResponse(responseText: string): ValidationResult {
    let sanitized = responseText || "";
    const violations: string[] = [];

    // Strip/replace any leaked internal system terminology
    for (const pattern of this.INTERNAL_TERMS) {
      if (pattern.test(sanitized)) {
        violations.push(`Leaked internal term matching ${pattern}`);
        sanitized = sanitized.replace(pattern, "financial advisor system");
      }
    }

    return {
      isValid: violations.length === 0,
      sanitizedResponse: sanitized.trim(),
      violationsDetected: violations,
    };
  }
}

