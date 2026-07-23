export class GeminiClient {
  public static getApiKey(): string | undefined {
    if (typeof process !== "undefined" && process.env) {
      return process.env.GEMINI_API_KEY || process.env.Glorious_Finance;
    }
    return undefined;
  }

  public static isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }
}
