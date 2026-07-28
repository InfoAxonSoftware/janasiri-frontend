export const PaymentMethodMap: Record<string, number> = {
  Cash: 1,
  Cheque: 2,
  BankTransfer: 3,
  Card: 4,
  MobilePayment: 5,
};

export const toApiPaymentMethod = (method?: string): number => {
  if (!method) return PaymentMethodMap.Cash;
  return PaymentMethodMap[method] ?? PaymentMethodMap.Cash;
};
