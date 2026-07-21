export type AuthProviderType = "email" | "google" | "microsoft" | "magic_link" | "sso" | "ldap";

export interface IdentityProfile {
  id: string;
  email: string;
  provider: AuthProviderType;
  lastLogin: string;
  mfaEnabled: boolean;
  deviceName?: string;
  location?: string;
}

export class IdentityAccessEngine {
  public static getSupportedProviders(): { name: string; type: AuthProviderType; active: boolean }[] {
    return [
      { name: "Email & Password", type: "email", active: true },
      { name: "Google OAuth 2.0", type: "google", active: true },
      { name: "Microsoft 365 OAuth", type: "microsoft", active: true },
      { name: "Magic Link Passwordless", type: "magic_link", active: true },
      { name: "Enterprise Single Sign-On (SSO)", type: "sso", active: false },
      { name: "LDAP / Active Directory", type: "ldap", active: false }
    ];
  }

  public static getSessionHistory(userId: string): IdentityProfile[] {
    return [
      {
        id: "sess_1",
        email: "testuser_stabilized@example.com",
        provider: "email",
        lastLogin: new Date().toISOString(),
        mfaEnabled: true,
        deviceName: "Chrome 124.0 (Windows 11)",
        location: "Mumbai, IN"
      },
      {
        id: "sess_2",
        email: "testuser_stabilized@example.com",
        provider: "google",
        lastLogin: new Date(Date.now() - 86400000 * 2).toISOString(),
        mfaEnabled: true,
        deviceName: "Safari Mobile (iOS 17)",
        location: "Pune, IN"
      }
    ];
  }

  public static triggerMultiFactorChallenge(email: string): boolean {
    console.log(`[IdentityAccessEngine] Triggering MFA TOTP/SMS validation challenge for ${email}`);
    return true;
  }
}
