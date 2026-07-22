export class GeminiClient {
  public static getApiKey(): string | undefined {
    // Standard environment keys for Gemini
    if (typeof process !== "undefined" && process.env) {
      return process.env.Glorious_Finance || process.env.LOVABLE_API_KEY || process.env.GEMINI_API_KEY;
    }
    return undefined;
  }

  public static isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }
}
