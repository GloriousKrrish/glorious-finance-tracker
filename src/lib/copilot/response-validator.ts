export interface ValidationResult {
  isValid: boolean;
  sanitizedResponse: string;
  violationsDetected: string[];
}

export class ResponseValidator {
  public static validateResponse(responseText: string): ValidationResult {
    let sanitized = responseText;
    const violations: string[] = [];

    // 1. Mandatory Disclaimer check
    const disclaimer = "\n\n*Educational Guidance Disclaimer: GloriousFinance Copilot provides informational explanations grounded in your Financial OS ledger. It does not provide regulated financial or legal tax advice.*";

    if (!sanitized.includes("Educational Guidance Disclaimer")) {
      sanitized += disclaimer;
    }

    return {
      isValid: violations.length === 0,
      sanitizedResponse: sanitized,
      violationsDetected: violations
    };
  }
}
