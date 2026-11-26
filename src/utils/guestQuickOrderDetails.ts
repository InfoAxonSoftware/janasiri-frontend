export type GuestOrderItem = {
  description: string;
  size: string;
  brand: string;
  quantity: number;
};

export type ParsedGuestOrder = {
  contactPerson: string;
  contactNumber: string;
  submittedVia: string;
  items: GuestOrderItem[];
};

export function parseGuestQuickOrderDetails(details: string): ParsedGuestOrder {
  const lines = (details || '').split(/\r?\n/);
  const readValue = (label: string) => {
    const prefix = label.toLowerCase() + ':';
    const line = lines.find((value) => value.trim().toLowerCase().startsWith(prefix));
    return line ? line.trim().slice(prefix.length).trim() : '';
  };

  const itemsStart = lines.findIndex((line) => line.trim().toUpperCase() === 'ORDER ITEMS');
  const items: GuestOrderItem[] = [];
  const itemPattern = /^\s*\d+\.\s*(.*?)\s*\|\s*Size:\s*(.*?)\s*\|\s*Brand:\s*(.*?)\s*\|\s*Quantity:\s*(\d+)\s*$/i;

  if (itemsStart >= 0) {
    lines.slice(itemsStart + 1).forEach((line) => {
      const match = line.match(itemPattern);
      if (!match) return;

      const cleanOptional = (value: string) =>
        value.trim().toLowerCase() === 'not specified' ? '' : value.trim();

      items.push({
        description: match[1].trim(),
        size: cleanOptional(match[2]),
        brand: cleanOptional(match[3]),
        quantity: Number(match[4]),
      });
    });
  }

  return {
    contactPerson: readValue('Contact person'),
    contactNumber: readValue('Contact number'),
    submittedVia: readValue('Submitted via') || 'Guest Order Form',
    items,
  };
}
