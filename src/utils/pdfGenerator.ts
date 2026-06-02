import { jsPDF } from "jspdf";
import autoTable, { applyPlugin } from "jspdf-autotable";
import type { DayExpenses, ManagerProfile } from "../services/dbService";

// Register plugin manually to prevent bundle-stripping under Vite ESM
try {
  applyPlugin(jsPDF);
} catch (e) {
  console.warn("Failed to apply jsPDF plugin:", e);
}

interface PdfReportData {
  manager: ManagerProfile;
  month: string;
  cashCollected: number;
  expenses: DayExpenses[];
  startDate: string;
  endDate: string;
}

export function generateLedgerPdf(data: PdfReportData) {
  try {
    const { manager, month, cashCollected, expenses, startDate, endDate } = data;
    const doc = new jsPDF();
    
    // Setup robust autoTable calling function (monkypatched or direct ESM call)
    // @ts-expect-error: autoTable is injected by jspdf-autotable
    const autoTableFunc = typeof doc.autoTable === "function" ? doc.autoTable.bind(doc) : (opts: any) => autoTable(doc, opts);
  
  // Clean styling constants
  const primaryColor = [187, 28, 62]; // Crimson Velvet default primary
  const textColor = [40, 40, 40];
  const mutedTextColor = [100, 100, 100];
  const gridLineColor = [220, 220, 220];

  // Title section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("HALL MESS MANAGEMENT SYSTEM (HMMS)", 14, 20);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text("Bangladesh University of Engineering & Technology (BUET)", 14, 26);
  
  // Divider
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(14, 29, 196, 29);

  // Metadata Panel
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text("FINANCIAL STATEMENT & LEDGER", 14, 38);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Month of Operations: ${month}`, 14, 44);
  doc.text(`Statement Period: ${startDate} to ${endDate}`, 14, 49);
  doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 14, 54);

  // Manager details
  doc.setFont("helvetica", "bold");
  doc.text("Mess Manager Details:", 120, 38);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${manager.name}`, 120, 44);
  doc.text(`Student ID: ${manager.id} (${manager.dept})`, 120, 49);
  doc.text(`Room: ${manager.room}`, 120, 54);

  // Compute stats
  const totalSpent = expenses.reduce((sum, day) => sum + day.total, 0);
  const remainingBalance = cashCollected - totalSpent;

  // Draw Summary Cards (Grid)
  const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, color: number[]) => {
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    doc.setDrawColor(gridLineColor[0], gridLineColor[1], gridLineColor[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, "D");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(title, x + 4, y + 6);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x + 4, y + 13);
  };

  drawCard(14, 62, 56, 18, "CASH RECEIVED", `${cashCollected.toFixed(2)} BDT`, [40, 150, 80]); // Green
  drawCard(75, 62, 56, 18, "TOTAL EXPENDITURE", `${totalSpent.toFixed(2)} BDT`, primaryColor); // Red
  drawCard(136, 62, 60, 18, "RUNNING BALANCE", `${remainingBalance.toFixed(2)} BDT`, remainingBalance >= 0 ? [30, 120, 200] : [200, 50, 50]); // Blue/Red

  // Expense Table Items
  const tableRows: string[][] = [];
  expenses.forEach(day => {
    day.items.forEach(item => {
      tableRows.push([
        day.date,
        item.name,
        item.category,
        `${item.quantity} ${item.unit}`,
        `${item.unitPrice.toFixed(2)}`,
        `${item.total.toFixed(2)}`
      ]);
    });
  });

  // Render Table
  const tableTop = 88;
  autoTableFunc({
    startY: tableTop,
    head: [["Date", "Item Name", "Category", "Quantity", "Unit Price", "Total (BDT)"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: textColor
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 30, halign: "right" }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // Add page numbers
      const str = "Page " + doc.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
      doc.text(str, 196 - 15, doc.internal.pageSize.height - 10);
    }
  });

  // Get final Y position of table
  // @ts-expect-error: lastAutoTable is injected by jspdf-autotable plugin
  const finalY = doc.lastAutoTable.finalY || 150;
  const pageHeight = doc.internal.pageSize.height;

  // Check if signature fits on page, else add page
  let sigY = finalY + 25;
  if (sigY + 20 > pageHeight) {
    doc.addPage();
    sigY = 40;
  }

  // Draw Signatures lines
  doc.setDrawColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.setLineWidth(0.3);
  
  // Manager Sign Line
  doc.line(14, sigY, 74, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text("Mess Manager Signature", 14, sigY + 5);
  doc.setFontSize(8);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, sigY + 9);

  // Provost Sign Line
  doc.line(136, sigY, 196, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Provost Signature & Seal", 136, sigY + 5);
  doc.setFontSize(8);
  doc.text("Date: _________________", 136, sigY + 9);

  // Auto-Download trigger
  const fileName = `HMMS_Ledger_${month.replace(" ", "_")}_${startDate}_to_${endDate}.pdf`;
  doc.save(fileName);
  } catch (error) {
    console.error("PDF generation failed:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to generate PDF ledger.");
  }
}
