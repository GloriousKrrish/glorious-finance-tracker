export interface SecurityEvent {
  id: string;
  timestamp: string;
  eventType: "mfa_challenge" | "device_recognized" | "rate_limit_exceeded" | "sensitive_access" | "secret_rotated";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  result: "allowed" | "blocked";
}

export class SecurityEngine {
  private static STORAGE_KEY = "gf_security_events";

  /**
   * Masks sensitive fields (e.g. Bank Account Numbers, Aadhaar metadata, or API credentials) for UI presentation.
   */
  public static maskSensitiveField(value: string, visibleSuffixLen: number = 4): string {
    if (!value) return "";
    if (value.length <= visibleSuffixLen) return value;
    const maskLen = value.length - visibleSuffixLen;
    return "•".repeat(maskLen) + value.slice(-visibleSuffixLen);
  }

  /**
   * Dummy/Abstract encryption service for local DB storage.
   */
  public static encrypt(value: string): string {
    if (!value) return "";
    return btoa(value); // base64 encoding simulation
  }

  public static decrypt(encryptedValue: string): string {
    if (!encryptedValue) return "";
    try {
      return atob(encryptedValue);
    } catch {
      return encryptedValue;
    }
  }

  public static logSecurityEvent(event: Omit<SecurityEvent, "id" | "timestamp">): SecurityEvent {
    const list = this.getSecurityEvents();
    const newEvent: SecurityEvent = {
      ...event,
      id: `sec_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    list.unshift(newEvent);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    return newEvent;
  }

  public static getSecurityEvents(): SecurityEvent[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const seeds: SecurityEvent[] = [
        {
          id: "sec_s1",
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          eventType: "device_recognized",
          description: "New Chrome browser session authenticated from Maharashtra, IN",
          severity: "low",
          result: "allowed"
        },
        {
          id: "sec_s2",
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
          eventType: "sensitive_access",
          description: "Decryption of HDFC account credential for sync task",
          severity: "medium",
          result: "allowed"
        }
      ];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  }
}
