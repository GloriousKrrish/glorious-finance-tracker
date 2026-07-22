export interface CitationRef {
  sourceType: "financial_os" | "knowledge_base" | "planning_engine";
  title: string;
  referenceTag: string;
}

export class CitationEngine {
  public static extractCitations(responseText: string, kbTitle?: string): CitationRef[] {
    const citations: CitationRef[] = [];

    // Financial OS Metric citations
    if (/\b(net worth|total assets|liabilities|balance)\b/i.test(responseText)) {
      citations.push({
        sourceType: "financial_os",
        title: "Financial OS Ledger & Accounts Selector",
        referenceTag: "FOS:StateSelector"
      });
    }

    if (/\b(budget|limit|spent|overspending)\b/i.test(responseText)) {
      citations.push({
        sourceType: "financial_os",
        title: "Financial OS Budget Engine & Utilization Metrics",
        referenceTag: "FOS:BudgetMetrics"
      });
    }

    if (kbTitle) {
      citations.push({
        sourceType: "knowledge_base",
        title: `Finance Knowledge Base: ${kbTitle}`,
        referenceTag: "KB:LocalArticle"
      });
    }

    return citations;
  }
}
