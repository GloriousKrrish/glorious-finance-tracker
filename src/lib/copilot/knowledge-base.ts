export interface KnowledgeArticle {
  id: string;
  topic: string;
  keywords: string[];
  title: string;
  summary: string;
  details: string;
  category: "personal_finance" | "taxation" | "investments" | "loans" | "retirement" | "business" | "banking";
}

export class FinanceKnowledgeBase {
  private static ARTICLES: KnowledgeArticle[] = [
    {
      id: "kb_sip_vs_lump",
      topic: "SIP vs Lumpsum Investment",
      keywords: ["sip", "lumpsum", "systematic investment plan", "mutual fund"],
      title: "Systematic Investment Plan (SIP) vs Lumpsum",
      summary: "SIPs average cost via Rupee Cost Averaging, while lumpsum works best when markets offer value valuations.",
      details: `• **SIP (Systematic Investment Plan):** Invest a fixed amount regularly (monthly/quarterly). Helps mitigate volatility through Rupee Cost Averaging without timing the market.
• **Lumpsum:** One-time bulk investment. Highly effective when valuation metrics (P/E, P/B) are low or during market corrections.
• **Recommendation:** Maintain monthly SIPs for core wealth goals, reserving extra lumpsums for major market pullbacks.`,
      category: "investments"
    },
    {
      id: "kb_ppf_rules",
      topic: "Public Provident Fund (PPF) Rules & Tax Benefits",
      keywords: ["ppf", "public provident fund", "section 80c", "tax free", "eee"],
      title: "PPF Investment Rules, Interest Rates & EEE Tax Status",
      summary: "PPF carries Exempt-Exempt-Exempt (EEE) status with a 15-year tenure and up to ₹1.5 Lakh 80C deduction.",
      details: `• **Tenure:** 15 lock-in years (extendable in 5-year blocks).
• **Tax Benefit:** Qualified under Section 80C up to ₹1,50,000 per financial year.
• **Tax Status:** EEE (Exempt-Exempt-Exempt) — Principal deposit, accumulated interest, and maturity withdrawal are 100% tax-free.
• **Limit:** Minimum ₹500/year, Maximum ₹1,50,000/year. Deposits before 5th of the month earn interest for that month.`,
      category: "taxation"
    },
    {
      id: "kb_tax_regimes_comparison",
      topic: "Old vs New Income Tax Regime in India",
      keywords: ["tax regime", "old regime", "new regime", "income tax", "section 80c", "slab"],
      title: "Old vs New Income Tax Regime Breakdown (FY 2024-25 / AY 2025-26)",
      summary: "The New Tax Regime offers lower slab rates without deductions, while the Old Regime allows deductions under 80C, 80D, and HRA.",
      details: `• **New Tax Regime (Default):** Lower tax slab rates. Standard deduction of ₹75,000 applicable. No deductions allowed for 80C, 80D, HRA, or Home Loan interest (self-occupied).
• **Old Tax Regime:** Allows deductions under Section 80C (up to ₹1.5L), Section 80D (Health Insurance up to ₹25k-₹50k), HRA exemption, and Home Loan interest (Section 24b up to ₹2L).
• **Rule of Thumb:** If total deductions exceed ₹3.75 Lakhs to ₹4 Lakhs, the Old Regime is usually more tax-efficient. Otherwise, the New Regime yields higher net home pay.`,
      category: "taxation"
    },
    {
      id: "kb_emergency_fund",
      topic: "Emergency Fund Sizing & Allocation",
      keywords: ["emergency fund", "liquidity", "contingency", "fd", "liquid fund"],
      title: "How to Build and Size Your Emergency Fund",
      summary: "Keep 3 to 6 months of essential living expenses in high-liquidity instruments like Bank FDs or Savings.",
      details: `• **Target Size:** 3 to 6 months of fixed monthly expenses (rent, EMIs, groceries, insurance premiums).
• **Placement:** Split 50% in instant Savings Account / Sweep-in FD, and 50% in Liquid Mutual Funds for emergency accessibility.
• **Purpose:** Protection against job loss, sudden medical emergencies, or urgent vehicle/home repairs without breaking equity investments.`,
      category: "personal_finance"
    },
    {
      id: "kb_nps_tier1_tier2",
      topic: "National Pension System (NPS) Tier 1 & Tier 2",
      keywords: ["nps", "national pension system", "tier 1", "tier 2", "section 80ccd", "pension"],
      title: "National Pension System (NPS) Tier 1 vs Tier 2 Guide",
      summary: "NPS Tier-1 provides an extra ₹50,000 tax deduction under Section 80CCD(1B) beyond the ₹1.5L 80C limit.",
      details: `• **NPS Tier 1 (Pension Account):** Mandatory retirement lock-in until age 60. Additional tax deduction up to ₹50,000 under Section 80CCD(1B). At age 60, up to 60% lump sum is tax-free; 40% is converted to annuity.
• **NPS Tier 2 (Investment Account):** Voluntary liquid account without lock-in (unless under Tier-2 80C for Central Govt employees). No special tax benefit.`,
      category: "retirement"
    },
    {
      id: "kb_home_loan_prepayment",
      topic: "Home Loan Prepayment Strategy",
      keywords: ["home loan", "prepayment", "emi", "interest savings", "tenure reduction"],
      title: "Home Loan Prepayment vs Equity Investment Strategy",
      summary: "Prepaying home loans early in the tenure significantly reduces total interest outgo.",
      details: `• **Tenure Reduction vs EMI Reduction:** Opt for 'Tenure Reduction' when making prepayments to maximize compounding interest savings.
• **Comparison:** If your home loan interest rate is 8.5% p.a., prepaying yields a guaranteed tax-free return of 8.5%. If expected equity SIP return is 12%, a balanced 50:50 allocation between loan prepayment and equity SIP is recommended.`,
      category: "loans"
    }
  ];

  public static searchKnowledgeBase(queryText: string): KnowledgeArticle | null {
    const q = queryText.toLowerCase();
    for (const article of this.ARTICLES) {
      if (article.keywords.some(k => q.includes(k))) {
        return article;
      }
    }
    return null;
  }

  public static getArticles(): KnowledgeArticle[] {
    return [...this.ARTICLES];
  }
}
