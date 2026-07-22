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
    const disclaimer = "\n\n*Disclaimer: GloriousFinance Copilot provides educational financial guidance and analysis based on your ledger parameters. For legally binding tax filing or regulated financial advice, please consult a certified professional.*";

    if (!sanitized.includes("Disclaimer:")) {
      sanitized += disclaimer;
    }

    return {
      isValid: violations.length === 0,
      sanitizedResponse: sanitized,
      violationsDetected: violations
    };
  }
}
