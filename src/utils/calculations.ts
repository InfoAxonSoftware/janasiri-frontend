// helper functions for calculating gross, discount, tax and totals based on
// product metadata.  All of these are computed dynamically at the time of an
// order rather than relying on any pre‑calculated values that may have come
// from an imported spreadsheet.  The spreadsheet fields are stored as-is so
// that inventory can be reviewed, but we never trust `totalAmount`,
// `discountAmount` or the pre‑computed `taxAmount` when doing an actual sale.

export interface LineCalcInput {
  rate: number;                  // selling price per unit
  qty: number;
  discountPercent?: number;      // static value from product (0 if missing)
  taxAmount?: number;           // static per‑unit tax value (after discount)
}

export interface LineCalcResult {
  gross: number;                // rate * qty
  discount: number;             // gross * (discountPercent / 100)
  taxableBase: number;          // gross - discount
  taxRate: number;              // derived from taxAmount/basePerUnit
  tax: number;                  // taxableBase * taxRate
  total: number;                // taxableBase + tax
}

export function calculateLine(input: LineCalcInput): LineCalcResult {
  const { rate, qty, discountPercent = 0, taxAmount } = input;
  const gross = rate * qty;
  const discount = gross * (discountPercent / 100);
  const taxableBase = gross - discount;

  let taxRate = 0;
  if (taxAmount != null && rate > 0) {
    // taxAmount coming from the sheet is the per‑unit tax after discount has
    // been applied.  To extract the underlying rate we divide by the base
    // price per unit (rate * (1 - discPct/100)).  Zero discount is handled
    // naturally.
    const basePerUnit = rate * (1 - discountPercent / 100);
    if (basePerUnit > 0) {
      taxRate = taxAmount / basePerUnit;
    }
  }

  const tax = taxableBase * taxRate;
  const total = taxableBase + tax;

  return { gross, discount, taxableBase, taxRate, tax, total };
}

/**
 * Derives the decimal tax rate from a tax code string.
 * Examples: "V18" → 0.18, "V15" → 0.15, "NV" → 0, "V5" → 0.05
 */
export function taxCodeToRate(taxCode: string | undefined | null): number {
  if (!taxCode) return 0;
  const digits = taxCode.match(/\d+/)?.[0];
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}
