export function getShopName(record: { shopName?: string | null; customerName?: string | null }): string {
  const shop = (record.shopName || '').toString().trim();
  if (shop) return shop;
  const customer = (record.customerName || '').toString().trim();
  if (customer) return customer;
  return '—';
}

export function getShopNameOrPlaceholder(record: { shopName?: string | null; customerName?: string | null }, placeholder = '[Name]'): string {
  const name = getShopName(record);
  return name === '—' ? placeholder : name;
}
