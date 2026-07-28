import type { Order } from '../types/order.types';
import { formatCurrency } from './formatters';
import { taxCodeToRate } from './calculations';import { getShopNameOrPlaceholder } from './shopName';
// Table එක ඇතුලේ LKR කියන කෑල්ල නැතුව ලස්සනට ඉලක්කම් පෙන්නන්න හදපු function එකක්
const formatNumber = (num: number) => {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getShopName = (data: any) => {
  const raw = (data.shopName || '').toString().trim();
  if (raw) return raw;
  const fromCust = (data.customerName || '').toString().trim();
  if (fromCust) return fromCust;
  return '[Name]';
};

export async function downloadPurchaseOrderPdf(order: Order & { isTaxCustomer?: boolean }): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || (autoTableModule as any);
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const DARK: [number, number, number] = [0, 0, 0];
  
  const isTax = order.isTaxCustomer === true;
  const invoiceTitle = 'PURCHASE ORDER';

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

  // Top Right Info Grid
  const gridX = 135; 
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceTitle, gridX + 15, 15, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  
  // Draw simple grid for Date/Inv No/Department
  doc.rect(gridX, 17, 25, 6); 
  doc.text('Date', gridX + 2, 21); 
  doc.rect(gridX + 25, 17, 36, 6); 
  doc.text(new Date(order.orderDate).toLocaleDateString(), gridX + 27, 21);
  
  doc.rect(gridX, 23, 25, 6); 
  doc.text('Inv No', gridX + 2, 27); 
  doc.rect(gridX + 25, 23, 36, 6); 
  
  // ඉන්වොයිස් අංකයේ අකුරු පොඩි කර කොටුවෙන් එලියට නොයන ලෙස සීමා කිරීම
  doc.setFontSize(7); 
  doc.text(String(order.orderNumber || order.id || ''), gridX + 27, 27, { maxWidth: 34 });
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

  const shopName = getShopNameOrPlaceholder(order);
  const custName = doc.splitTextToSize(shopName, colWidth - 4);

  doc.text(custName, 16, sectionY + 11);

  // --- TABLE SECTION ---
  const tableStartY = sectionY + 22;
  
  const baseCols = ['No', 'Item Code', 'Item Description', 'Qty', 'Rate', 'Disc %', 'Disc Amt'];
  const cols = isTax ? [...baseCols, 'Tax', 'Line Gross'] : [...baseCols, 'Line Gross'];

  let totalGross = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  const taxCodes = new Set<string>();

  const rows = order.items.map((item: any, index: number) => {
    const rate = item.unitPrice || 0;
    const qty = item.quantity || 0;
    const discPct = item.discountPercent || 0;

    const rowTaxRate = taxCodeToRate((item as any).taxCode);
    const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
    const rowGrossBase = rate * qty;
    const rowDiscountAmt = isTax ? rowGrossBase * (discPct / 100) : allIncRate * qty * (discPct / 100);
    const rowNet = rowGrossBase - rowGrossBase * (discPct / 100);
    const rowTax = rowNet * rowTaxRate;
    const rowGross = isTax ? rowGrossBase : allIncRate * qty;

    totalGross += rowGross;
    totalDiscount += rowDiscountAmt;
    totalTax += isTax ? rowTax : 0;
    if (isTax && (item as any).taxCode) taxCodes.add((item as any).taxCode);

    const displayRate = isTax ? rate : allIncRate;

    const rowData = [
      (index + 1).toString(),
      item.productSKU || '',
      item.productName || '',
      qty.toString(),
      formatNumber(displayRate),
      discPct ? `${discPct.toFixed(2)}%` : '—',
      discPct ? formatNumber(rowDiscountAmt) : '—'
    ];

    if (isTax) {
      rowData.push((item as any).taxCode || '—');
    }

    rowData.push(formatNumber(rowGross));

    return rowData;
  });

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
      1: { cellWidth: 20 },
      2: { cellWidth: 'auto' }, 
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 12, halign: 'right' },
      6: { cellWidth: 18, halign: 'right' },
      // isTax: 9 cols (Tax + Line Gross); non-tax: 8 cols (Line Gross)
      ...(isTax ? { 
        7: { cellWidth: 20, halign: 'right' }, 
        8: { cellWidth: 22, halign: 'right' } 
      } : { 
        7: { cellWidth: 28, halign: 'right' } 
      })
    }
  });

  // --- FOOTER & TOTALS SECTION ---
  const afterTableY = (doc as any).lastAutoTable.finalY;
  const totalsX = pageWidth - 76;
  const boxW = 62;
  const rowH = 6;

  doc.setFontSize(8);
  doc.setDrawColor(0, 0, 0);

  // Right side Totals Box
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
      doc.setFont('helvetica', i === 4 ? 'bold' : 'normal');
      doc.text(label, totalsX + 2, y + 4);
      doc.text(val, totalsX + boxW - 2, y + 4, { align: 'right' });
    });
  } else {
    // Non-Tax Layout
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
      doc.setFont('helvetica', i === 2 ? 'bold' : 'normal');
      doc.text(label, totalsX + 2, y + 4);
      doc.text(val, totalsX + boxW - 2, y + 4, { align: 'right' });
    });
  }

  doc.save(`invoice-${order.orderNumber || order.id}.pdf`);
}

export { downloadPurchaseOrderPdf as downloadInvoicePdf };