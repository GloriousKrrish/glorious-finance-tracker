export interface DomainGuardCheck {
  isFinanceRelated: boolean;
  blockedCategory?: "coding" | "entertainment" | "politics" | "sports" | "gaming" | "medical" | "general_chat";
  refusalMessage?: string;
}

export class DomainGuard {
  private static NON_FINANCE_PATTERNS: Array<{ category: DomainGuardCheck["blockedCategory"]; regex: RegExp }> = [
    { category: "coding", regex: /\b(python|javascript|typescript|react|html|css|sql|function|code|debug|programming|algorithm|syntax|compile|git|repo)\b/i },
    { category: "movies", regex: /\b(movie|cinema|actor|director|film|hollywood|bollywood|netflix|series|season)\b/i },
    { category: "politics", regex: /\b(election|political|party|president|minister|candidate|vote|parliament)\b/i },
    { category: "sports", regex: /\b(cricket|football|soccer|match|tournament|ipl|world cup|trophy|team|player|score)\b/i },
    { category: "gaming", regex: /\b(game|ps5|xbox|nintendo|playstation|steam|fortnite|pubg|gamer)\b/i },
    { category: "medical", regex: /\b(doctor|symptom|disease|medicine|prescription|hospital|treatment|fever|cough)\b/i },
  ];

  private static FINANCE_WHITELIST_KEYWORDS: RegExp = /\b(finance|budget|money|rupee|inr|account|transaction|bank|loan|emi|credit|card|debt|tax|gst|income|salary|investment|stock|share|mutual fund|sip|swp|stp|etf|gold|ppf|epf|nps|fd|rd|pension|retirement|insurance|policy|wealth|audit|report|forecast|profit|loss|cash flow|balance sheet|accounting|gstin)\b/i;

  public static checkDomain(input: string): DomainGuardCheck {
    const text = input.trim();
    if (!text) {
      return { isFinanceRelated: true };
    }

    // If input explicitly contains finance keywords, allow it
    if (this.FINANCE_WHITELIST_KEYWORDS.test(text)) {
      return { isFinanceRelated: true };
    }

    // Check against non-finance patterns
    for (const item of this.NON_FINANCE_PATTERNS) {
      if (item.regex.test(text)) {
        return {
          isFinanceRelated: false,
          blockedCategory: item.category,
          refusalMessage: "I specialize in finance and financial planning. I can't assist with unrelated topics."
        };
      }
    }

    return { isFinanceRelated: true };
  }
}
