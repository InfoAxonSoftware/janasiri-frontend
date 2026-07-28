export interface SpecialOffer {
  id: string;
  productName: string;
  offerBrief: string;
  isActive: boolean;
  createdAt: string;
}

export interface SpecialOfferPayload {
  productName: string;
  offerBrief: string;
  isActive: boolean;
}