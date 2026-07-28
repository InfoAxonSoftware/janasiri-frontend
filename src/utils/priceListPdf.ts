import type { Product } from '../types/product.types';

const COMPANY  = 'JANASIRI DISTRIBUTORS (PVT) LTD';
const SUBTITLE = 'JANASIRI FS PRICE LIST';

async function loadImageAsBase64(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportPriceListPdf(
  grouped: Map<string, Product[]>,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // ── Page setup ──────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 210 mm
  const pageH = doc.internal.pageSize.getHeight();  // 297 mm
  const marginX = 8;

  // ── Date/time stamp ─────────────────────────────────────────────
  const now = new Date();
  const exportDateStr = now
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '-');
  const exportTimeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const exportFull = `Export Date and Time ${exportDateStr} ${exportTimeStr}`;

  // ── Logo ─────────────────────────────────────────────────────────
  const logoBase64 = await loadImageAsBase64('/logo.png');
  const LOGO_H = 22;  // mm — height of logo in header
  const LOGO_W = 22;  // mm — width  of logo in header
  const HEADER_H = 33; // mm — total header height before table

  // ── Colours ───────────────────────────────────────────────────────
  const YELLOW: [number, number, number] = [255, 204,   0];
  const GREEN:  [number, number, number] = [ 56, 142,  60];
  const RED:    [number, number, number] = [200,   0,   0];
  const BLACK:  [number, number, number] = [  0,   0,   0];
  const WHITE:  [number, number, number] = [255, 255, 255];
  const LGREY:  [number, number, number] = [250, 250, 250];

  // ── Per-page header ───────────────────────────────────────────────
  const drawPageHeader = () => {
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', marginX, 4, LOGO_W, LOGO_H);
    }
    const cx = pageW / 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text(COMPANY, cx, 11, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...RED);
    doc.text(SUBTITLE, cx, 17, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BLACK);
    doc.text('REPORT DATE RANGE', cx, 22, { align: 'center' });

    doc.setTextColor(...RED);
    doc.setFontSize(7);
    doc.text(exportFull, cx, 27, { align: 'center' });

    doc.setTextColor(...BLACK);
  };

  drawPageHeader();

  // ── Table body ────────────────────────────────────────────────────
  const head = [[
    'GroupName', 'Item', 'Sales Description', 'UOM',
    'Price', 'SalesTax', 'All Inc Price', 'MRP',
  ]];

  const body: any[][] = [];
  let isFirst = true;

  for (const [group, products] of grouped) {
    // Small spacer gap before every group except the first
    if (!isFirst) {
      body.push([{
        content: '',
        colSpan: 8,
        styles: {
          fillColor: WHITE,
          lineWidth: 0,
          lineColor: WHITE,
          cellPadding: { top: 1.8, bottom: 0, left: 0, right: 0 },
          minCellHeight: 1.8,
        },
      }]);
    }
    isFirst = false;

    // Green group header row
    body.push([{
      content: group,
      colSpan: 8,
      styles: {
        fontStyle: 'bold',
        fontSize: 8,
        fillColor: GREEN,
        textColor: WHITE,
        cellPadding: { top: 1.6, bottom: 1.6, left: 3, right: 3 },
      },
    }]);

    for (const p of products) {
      body.push([
        group,
        p.sku || '',
        p.name,
        p.uom ?? '',
        p.sellingPrice != null
          ? p.sellingPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '',
        p.taxCode || '',
        p.totalAmount != null
          ? p.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '',
        p.mrp != null && p.mrp > 0
          ? p.mrp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '0.00',
      ]);
    }
  }

  autoTable(doc, {
    head,
    body,
    startY: HEADER_H + 1,
    margin: { left: marginX, right: marginX, top: HEADER_H + 1, bottom: 10 },
    tableWidth: pageW - marginX * 2,
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
      lineColor: [180, 180, 180],
      lineWidth: 0.15,
      textColor: BLACK,
      fillColor: WHITE,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: YELLOW,
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 },
    },
    alternateRowStyles: { fillColor: LGREY },
    columnStyles: {
      0: { cellWidth: 36, overflow: 'linebreak' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 'auto', overflow: 'linebreak' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 18, halign: 'right' },
    },
    didDrawPage: (hookData: any) => {
      if (hookData.pageNumber > 1) drawPageHeader();
      const pageNum = hookData.pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`${COMPANY}  |  Price List`, marginX, pageH - 4);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageW - marginX, pageH - 4, { align: 'right' });
    },
  });

  doc.save(`Janasiri_Price_List_${exportDateStr}.pdf`);
}
