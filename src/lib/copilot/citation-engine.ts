export interface CitationRef {
  sourceType: "financial_os" | "knowledge_base" | "planning_engine";
  title: string;
  referenceTag: string;
}

export class CitationEngine {
  public static extractCitations(responseText: string, kbTitle?: string): CitationRef[] {
    const citations: CitationRef[] = [];

    // User-friendly reference citations
    if (/\b(net worth|total assets|liabilities|balance)\b/i.test(responseText)) {
      citations.push({
        sourceType: "financial_os",
        title: "Ledger Balance Data",
        referenceTag: "Ledger Data"
      });
    }

    if (/\b(budget|limit|spent|overspending)\b/i.test(responseText)) {
      citations.push({
        sourceType: "financial_os",
        title: "Budget Tracking Metrics",
        referenceTag: "Budget Metrics"
      });
    }

    if (kbTitle) {
      citations.push({
        sourceType: "knowledge_base",
        title: `Financial Knowledge Base: ${kbTitle}`,
        referenceTag: "Knowledge Base"
      });
    }

    return citations;
  }
}
