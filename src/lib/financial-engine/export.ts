import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportPayload } from "./reports";
import { formatINR } from "../format";

export class ExportEngine {
  /**
   * Generates and downloads a beautifully styled PDF representation of the report payload.
   */
  public static exportToPdf(payload: ReportPayload): void {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const margin = 40;
    
    // Header Banner
    doc.setFillColor(26, 54, 93); // Sleek deep navy
    doc.rect(0, 0, w, 95, "F");
    
    // Gold Accent bar
    doc.setFillColor(212, 175, 55); // Rich gold
    doc.rect(0, 95, w, 4, "F");

    // Title & Metadata
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(payload.title, margin, 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(payload.subtitle, margin, 60);

    doc.setTextColor(230, 230, 230);
    doc.text(`Reporting Period: ${payload.dateRange.from}  to  ${payload.dateRange.to}`, margin, 78);

    let y = 130;

    // Render Metrics Summary Card
    doc.setTextColor(26, 54, 93);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("EXECUTIVE METRICS", margin, y);
    y += 15;

    const metricEntries = Object.entries(payload.metrics);
    const metricRows = metricEntries.map(([label, val]) => [label, String(val)]);

    autoTable(doc, {
      startY: y,
      head: [["KPI Metric", "Value"]],
      body: metricRows,
      theme: "plain",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [245, 240, 232], textColor: [80, 80, 80], fontStyle: "bold" },
      bodyStyles: { textColor: [30, 30, 30] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });

    y = (doc as any).lastAutoTable.finalY + 25;

    // Render Sections
    payload.sections.forEach((section) => {
      // Check for page overflow
      if (y > 720) {
        doc.addPage();
        y = 50;
      }

      doc.setTextColor(26, 54, 93);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(section.title.toUpperCase(), margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [section.headers],
        body: section.rows,
        theme: "striped",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [26, 54, 93], textColor: 255 },
        styles: { fontSize: 9 },
      });

      y = (doc as any).lastAutoTable.finalY + 25;
    });

    // Add page numbers and footer decoration to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      
      // Footer text
      doc.text(
        `GloriousFinance Console · Generated ${new Date().toLocaleDateString("en-IN")} ${new Date().toLocaleTimeString("en-IN")}`,
        margin,
        doc.internal.pageSize.getHeight() - 20
      );
      
      doc.text(
        `Page ${i} of ${pageCount}`,
        w - margin,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" }
      );
    }

    doc.save(`GloriousFinance-${payload.title.replace(/\s+/g, "-")}-${payload.dateRange.from}_to_${payload.dateRange.to}.pdf`);
  }

  /**
   * Generates and downloads a clean CSV file representing the report payload data.
   */
  public static exportToCsv(payload: ReportPayload): void {
    let csvContent = "";

    // 1. Report Metadata
    csvContent += `Report,${payload.title}\n`;
    csvContent += `Subtitle,${payload.subtitle}\n`;
    csvContent += `Period,${payload.dateRange.from} to ${payload.dateRange.to}\n\n`;

    // 2. Metrics Summary
    csvContent += `SUMMARY METRICS\n`;
    Object.entries(payload.metrics).forEach(([key, val]) => {
      csvContent += `"${key}","${String(val).replace(/"/g, '""')}"\n`;
    });
    csvContent += `\n`;

    // 3. Sections Data
    payload.sections.forEach((section) => {
      csvContent += `"${section.title.toUpperCase()}"\n`;
      // Headers
      csvContent += section.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
      // Rows
      section.rows.forEach((row) => {
        csvContent += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
      });
      csvContent += `\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `GloriousFinance-${payload.title.replace(/\s+/g, "-")}-${payload.dateRange.from}_to_${payload.dateRange.to}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Downloads raw JSON payload representing the report context.
   */
  public static exportToJson(payload: ReportPayload): void {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `GloriousFinance-${payload.title.replace(/\s+/g, "-")}-${payload.dateRange.from}_to_${payload.dateRange.to}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Mock/architecture ready Excel export format.
   */
  public static exportToExcel(payload: ReportPayload): void {
    // For production-grade architectures, this triggers a download similar to CSV, 
    // styled with XML elements or spreadsheets parser, but defaults to CSV for absolute reliability.
    this.exportToCsv(payload);
  }
}
