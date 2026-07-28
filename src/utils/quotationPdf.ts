import { formatCurrency, formatDate } from './formatters';
import { getShopNameOrPlaceholder } from './shopName';
import { taxCodeToRate } from './calculations';
import type { Quotation } from '../types/quotation.types';
import * as XLSX from 'xlsx';

// Table එක ඇතුලේ LKR කියන කෑල්ල නැතුව ලස්සනට ඉලක්කම් පෙන්නන්න හදපු function එක
const formatNumber = (num: number) => {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function isTaxQuotation(quotation: Quotation) {
  return (quotation.items || []).some((item) => {
    const taxAmount = item.taxAmount || 0;
    return taxAmount > 0 || !!item.taxCode;
  }) || (quotation.taxAmount || 0) > 0;
}

function renderQuotationPage(doc: any, autoTable: any, quotation: Quotation, isTaxCustomer?: boolean) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const DARK: [number, number, number] = [0, 0, 0];
  
  const isTax = isTaxCustomer !== undefined ? isTaxCustomer : isTaxQuotation(quotation);
  const title = isTax ? 'TAX QUOTATION' : 'QUOTATION';

  // --- HEADER SECTION ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', 14, 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Reg Address: No 205 Wattarantenna Passage, Kandy.', 14, 21);
  doc.text('TP: 0814 950206 / Hotline: 0777 675322', 14, 25);
  doc.text('Email: janasiridistributors@yahoo.com / Vat 114608394-7000', 14, 29);
  doc.text('Bank AC: Sampath Bank PLC / Kandy Super Grade Branch / AC: 0007 1002 3131', 14, 33);

  // --- Top Right Info Grid ---
  const gridX = 135; 
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, gridX + 15, 15, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  
  // Draw simple grid for Date / Quotation No / Department
  doc.rect(gridX, 17, 25, 6); 
  doc.text('Date', gridX + 2, 21); 
  doc.rect(gridX + 25, 17, 36, 6); 
  doc.text(formatDate(quotation.createdAt), gridX + 27, 21);
  
  doc.rect(gridX, 23, 25, 6); 
  doc.text('Quotation No', gridX + 2, 27); 
  doc.rect(gridX + 25, 23, 36, 6); 
  
  doc.setFontSize(7); 
  doc.text(String(quotation.quotationNumber || ''), gridX + 27, 27, { maxWidth: 34 });
  doc.setFontSize(8); 
  
  doc.rect(gridX, 29, 25, 6); 
  doc.text('Department', gridX + 2, 33); 
  doc.rect(gridX + 25, 29, 36, 6); 
  doc.text('CENTRAL', gridX + 27, 33);

  // --- CUSTOMER SECTION ---
  const sectionY = 40;
  const colWidth = pageWidth - 28;
  
  doc.rect(14, sectionY, colWidth, 6);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer', 16, sectionY + 4);
  
  doc.rect(14, sectionY + 6, colWidth, 12);
  doc.setFont('helvetica', 'normal');
  
  const shopName = getShopNameOrPlaceholder(quotation);
  const custName = doc.splitTextToSize(shopName, colWidth - 4);
  doc.text(custName, 16, sectionY + 11);

  // --- TABLE SECTION ---
  const tableStartY = sectionY + 22;
  
  const baseCols = ['No', 'Item Code', 'Item Description', 'Qty', 'Rate', 'Disc %', 'Disc Amt'];
  const cols = isTax 
    ? [...baseCols, 'Tax', 'Line Gross', 'Req. Price'] 
    : [...baseCols, 'Line Gross', 'Req. Price'];

  let totalGross = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  const taxCodes = new Set<string>();

  const rows = (quotation.items || []).map((item, index) => {
    const rate = item.unitPrice || 0;
    const qty = item.quantity || 0;
    const discPct = item.discountPercent || 0;
    
    const rowTaxRate = taxCodeToRate(item.taxCode);
    const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
    const rowGrossBase = rate * qty;
    const discAmt = isTax ? (rowGrossBase * discPct) / 100 : (allIncRate * qty * discPct) / 100;
    const rowNet = rowGrossBase - rowGrossBase * (discPct / 100);
    const taxAmt = rowNet * rowTaxRate;
    
    const grossAmount = isTax ? rowGrossBase : allIncRate * qty;
    const displayRate = isTax ? rate : allIncRate;

    totalGross += grossAmount;
    totalDiscount += discAmt;
    totalTax += isTax ? taxAmt : 0;
    if (isTax && item.taxCode) taxCodes.add(item.taxCode);

    const reqPrice = item.expectedPrice != null && item.expectedPrice > 0 
        ? formatNumber(item.expectedPrice) 
        : '-';

    const rowData = [
      (index + 1).toString(),
      item.productSKU || '',
      item.productName || '',
      qty.toString(),
      formatNumber(displayRate),
      discPct ? `${discPct}%` : '—',
      discAmt ? formatNumber(discAmt) : '—'
    ];

    if (isTax) {
      rowData.push(item.taxCode || '—');
    }

    rowData.push(formatNumber(grossAmount));
    rowData.push(reqPrice); // Request Price

    return rowData;
  });

  // Fill empty rows to maintain grid structure (minimum 5 rows)
  while (rows.length < 5) rows.push(cols.map(() => ''));

  autoTable(doc, {
    head: [cols],
    body: rows,
    startY: tableStartY,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18 },
      2: { cellWidth: 'auto' }, 
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 12, halign: 'right' },
      6: { cellWidth: 16, halign: 'right' },
      ...(isTax ? { 
        7: { cellWidth: 14, halign: 'center' }, 
        8: { cellWidth: 22, halign: 'right' },
        9: { cellWidth: 22, halign: 'right' }
      } : { 
        7: { cellWidth: 24, halign: 'right' },
        8: { cellWidth: 24, halign: 'right' }
      })
    }
  });

  // --- FOOTER & TOTALS SECTION ---
  const afterTableY = (doc as any).lastAutoTable.finalY;
  const totalsX = pageWidth - 76;
  const boxW = 62;
  const rowH = 6;

  // Totals Grid
  if (isTax) {
    const netAmount = totalGross - totalDiscount;
    const finalAmount = netAmount + totalTax;
    const vatLabel = 'Total Tax Amount';

    const totalsRows = [
      ['Gross Amount', formatNumber(totalGross)],
      ['Discount Amount', formatNumber(totalDiscount)],
      ['Net Amount', formatNumber(netAmount)],
      [vatLabel, formatNumber(totalTax)],
      ['Total Invoice Value', formatCurrency(finalAmount)],
    ];

    totalsRows.forEach(([label, val], i) => {
      const y = afterTableY + (i * rowH);
      doc.rect(totalsX, y, boxW * 0.55, rowH);
      doc.rect(totalsX + (boxW * 0.55), y, boxW * 0.45, rowH);
      doc.setFont('helvetica', i === totalsRows.length - 1 ? 'bold' : 'normal');
      doc.text(label, totalsX + 2, y + 4);
      doc.text(val, totalsX + boxW - 2, y + 4, { align: 'right' });
    });
  } else {
    const finalAmount = totalGross - totalDiscount;

    const totalsRows = [
      ['Gross Amount', formatNumber(totalGross)],
      ['Discount Amount', formatNumber(totalDiscount)],
      ['Total Invoice Value', formatCurrency(finalAmount)],
    ];

    totalsRows.forEach(([label, val], i) => {
      const y = afterTableY + (i * rowH);
      doc.rect(totalsX, y, boxW * 0.55, rowH);
      doc.rect(totalsX + (boxW * 0.55), y, boxW * 0.45, rowH);
      doc.setFont('helvetica', i === totalsRows.length - 1 ? 'bold' : 'normal');
      doc.text(label, totalsX + 2, y + 4);
      doc.text(val, totalsX + boxW - 2, y + 4, { align: 'right' });
    });
  }

  // --- PAGE FOOTER ---
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 18, pageWidth - 14, pageH - 18);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'italic');
  doc.text('This is a computer-generated quotation issued by Janasiri Distributors (Pvt) Ltd. No signature or stamp is required.', pageWidth / 2, pageH - 13, { align: 'center' });
  doc.text('For queries, contact us at 0777 675322 or janasiridistributors@yahoo.com', pageWidth / 2, pageH - 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
}

export async function downloadQuotationPdf(quotation: Quotation, isTaxCustomer?: boolean) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || (autoTableModule as any);

  const doc = new jsPDF();
  renderQuotationPage(doc, autoTable, quotation, isTaxCustomer);
  doc.save(`${quotation.quotationNumber}.pdf`);
}

export async function downloadQuotationsPdf(quotations: Quotation[], customerTaxMap?: Map<string, boolean>) {
  if (!quotations.length) return;

  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || (autoTableModule as any);

  const doc = new jsPDF();

  quotations.forEach((quotation, index) => {
    if (index > 0) doc.addPage();
    const isTax = customerTaxMap?.get(quotation.customerId);
    renderQuotationPage(doc, autoTable, quotation, isTax);
  });

  doc.save(`quotations-${Date.now()}.pdf`);
}

// Excel Download remains mostly the same, ensuring it maps the Request Price 
export function downloadQuotationsExcel(quotations: Quotation[], customerTaxMap?: Map<string, boolean>) {
  if (!quotations.length) return;

  const wb = XLSX.utils.book_new();

  quotations.forEach((q) => {
    const rows: (string | number)[][] = [];
    const withTax = customerTaxMap?.has(q.customerId) ? (customerTaxMap.get(q.customerId) === true) : isTaxQuotation(q);

    rows.push(['QUOTATION', q.quotationNumber]);
    rows.push(['Status', q.status]);
    rows.push(['Type', withTax ? 'Tax' : 'Non-Tax']);
    rows.push(['Customer', q.customerName || q.shopName || '-']);
    rows.push(['Rep', q.repName || '-']);
    rows.push(['Created', formatDate(q.createdAt)]);
    rows.push(['Valid Until', q.validUntil ? formatDate(q.validUntil) : '-']);
    rows.push([]);

    rows.push(withTax
      ? ['No', 'Item Code', 'Item Description', 'Qty', 'Rate', 'Disc %', 'Disc Amt', 'Tax', 'Line Gross', 'Req. Price']
      : ['No', 'Item Code', 'Item Description', 'Qty', 'Rate', 'Disc %', 'Disc Amt', 'Line Gross', 'Req. Price']);

    (q.items || []).forEach((item, index) => {
      const rate = item.unitPrice || 0;
      const qty = item.quantity || 0;
      const discPct = item.discountPercent || 0;
      
      const rowGrossBase = rate * qty;
      const discAmt = (rowGrossBase * discPct) / 100;
      const taxAmt = item.taxAmount || 0;
      const taxPerUnit = qty ? taxAmt / qty : 0;
      
      const grossAmount = withTax ? rowGrossBase : (rowGrossBase + taxAmt);
      const displayRate = withTax ? rate : (rate + taxPerUnit);

      const rowWithTax = [
        index + 1,
        item.productSKU || '-',
        item.productName || '-',
        qty,
        rate,
        discPct,
        discAmt,
        taxAmt,
        grossAmount,
        item.expectedPrice ?? 0,
      ];

      if (withTax) {
        rows.push(rowWithTax);
      } else {
        rows.push([
          rowWithTax[0],
          rowWithTax[1],
          rowWithTax[2],
          rowWithTax[3],
          displayRate,
          rowWithTax[5],
          rowWithTax[6],
          rowWithTax[8],
          rowWithTax[9],
        ]);
      }
    });

    rows.push([]);
    let excelTotalGross = 0, excelTotalDiscount = 0, excelTotalTax = 0;
    (q.items || []).forEach((item) => {
      const rate = item.unitPrice || 0;
      const qty = item.quantity || 0;
      const discPct = item.discountPercent || 0;
      const rowGrossBase = rate * qty;
      const discAmt = (rowGrossBase * discPct) / 100;
      const taxAmt = item.taxAmount || 0;
      const grossAmount = withTax ? rowGrossBase : (rowGrossBase + taxAmt);
      excelTotalGross += grossAmount;
      excelTotalDiscount += discAmt;
      if (withTax) excelTotalTax += taxAmt;
    });
    if (withTax) {
      const excelNetAmt = excelTotalGross - excelTotalDiscount;
      const excelFinal = excelNetAmt + excelTotalTax;
      rows.push(['', '', '', '', '', '', '', 'Gross Amount', excelTotalGross]);
      rows.push(['', '', '', '', '', '', '', 'Discount Amount', excelTotalDiscount]);
      rows.push(['', '', '', '', '', '', '', 'Net Amount', excelNetAmt]);
      rows.push(['', '', '', '', '', '', '', 'Total Tax Amount', excelTotalTax]);
      rows.push(['', '', '', '', '', '', '', 'Total Invoice Value', excelFinal]);
    } else {
      rows.push(['', '', '', '', '', '', 'Gross Amount', excelTotalGross]);
      rows.push(['', '', '', '', '', '', 'Discount Amount', excelTotalDiscount]);
      rows.push(['', '', '', '', '', '', 'Total Invoice Value', excelTotalGross - excelTotalDiscount]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = withTax
      ? [
          { wch: 6 },
          { wch: 16 },
          { wch: 40 },
          { wch: 8 },
          { wch: 12 },
          { wch: 10 },
          { wch: 12 },
          { wch: 12 },
          { wch: 14 },
          { wch: 14 },
        ]
      : [
          { wch: 8 },
          { wch: 18 },
          { wch: 45 },
          { wch: 10 },
          { wch: 14 },
          { wch: 10 },
          { wch: 14 },
          { wch: 16 },
          { wch: 16 },
        ];

    const safeName = (q.quotationNumber || 'Quotation').replace(/[:/\\?*\[\]]/g, '-').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  XLSX.writeFile(wb, `quotations-${Date.now()}.xlsx`);
}