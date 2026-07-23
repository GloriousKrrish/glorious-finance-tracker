export interface DomainGuardCheck {
  isFinanceRelated: boolean;
  isPersonalFinanceDataRequired: boolean;
  isGeneralKnowledge: boolean;
  category?: string;
}

export class DomainGuard {
  private static PERSONAL_DATA_PATTERNS: RegExp =
    /\b(my|mine|i|spent|spend|spending|budget|portfolio|investments?|loans?|emi|balance|income|cash flow|health score|account|transactions?|ledger|net worth|my tax|my salary|my expenses)\b/i;

  private static NON_FINANCE_PATTERNS: Array<{ category: string; regex: RegExp }> = [
    { category: "coding", regex: /\b(python|javascript|typescript|react|html|css|sql|function|code|debug|programming|algorithm|syntax|compile|git|repo)\b/i },
    { category: "entertainment", regex: /\b(movie|cinema|actor|director|film|hollywood|bollywood|netflix|series|season)\b/i },
    { category: "politics", regex: /\b(election|political|party|president|minister|candidate|vote|parliament)\b/i },
    { category: "sports", regex: /\b(cricket|football|soccer|match|tournament|ipl|world cup|trophy|team|player|score)\b/i },
    { category: "gaming", regex: /\b(game|ps5|xbox|nintendo|playstation|steam|fortnite|pubg|gamer)\b/i },
    { category: "medical", regex: /\b(doctor|symptom|disease|medicine|prescription|hospital|treatment|fever|cough)\b/i },
    { category: "general_person", regex: /\b(who is|elon musk|steve jobs|bill gates|taylor swift|sam altman)\b/i },
  ];

  public static checkDomain(input: string): DomainGuardCheck {
    const text = input.trim();
    if (!text) {
      return { isFinanceRelated: true, isPersonalFinanceDataRequired: false, isGeneralKnowledge: false };
    }

    // Check if it asks about general non-finance subjects
    for (const item of this.NON_FINANCE_PATTERNS) {
      if (item.regex.test(text) && !this.PERSONAL_DATA_PATTERNS.test(text)) {
        return {
          isFinanceRelated: false,
          isPersonalFinanceDataRequired: false,
          isGeneralKnowledge: true,
          category: item.category,
        };
      }
    }

    // Check if question requires personal financial data
    const isPersonal = this.PERSONAL_DATA_PATTERNS.test(text);

    return {
      isFinanceRelated: true,
      isPersonalFinanceDataRequired: isPersonal,
      isGeneralKnowledge: false,
    };
  }
}

