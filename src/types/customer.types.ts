export interface Customer {
  id: string;
  userId: string;
  username: string;
  shopName: string;
  customerType?: string;
  businessRegistrationNumber?: string;
  regionId?: string;
  regionName?: string;
  subRegionId?: string;
  subRegionName?: string;
  assignedRepId?: string;
  assignedRepName?: string;
  assignedCoordinatorId?: string;
  assignedCoordinatorName?: string;
  approvalStatus?: string;
  approvalRejectionReason?: string;
  email?: string;
  phoneNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  mustChangePassword: boolean;
  temporaryPassword?: string;
  isActive: boolean;
  createdAt: string;
  lastOrderDate?: string;
  totalOrders?: number;
  totalOrderValue?: number;
}

export interface PriceDetail {
  productId: string;
  productName: string;
  specialPrice?: number;
  discountPercent?: number;
}

export interface PriceSpecialRequest {
  productId: string;
  specialPrice?: number;
  discountPercent?: number;
}

export interface CustomerSummary {
  customer: Customer;
  totalPurchases: number;
  totalOrders: number;
  lastOrderDate?: string;
  frequentProducts: string[];
  registrationRequest?: RegistrationSummary;
}

export interface RegistrationSummary {
  customerType: string;
  customerName: string;
  businessRegistrationNumber?: string;
  registeredAddress?: string;
  incorporateDate?: string;
  businessName?: string;
  businessLocation?: string;
  telephone?: string;
  email?: string;
  bankBranch?: string;
  province?: string;
  town?: string;
  proprietorName?: string;
  proprietorTp?: string;
  proprietorEmail?: string;
  managerName?: string;
  managerTp?: string;
  managerEmail?: string;
  chefName?: string;
  chefTp?: string;
  chefEmail?: string;
  purchasingName?: string;
  purchasingTp?: string;
  purchasingEmail?: string;
  accountantName?: string;
  accountantTp?: string;
  accountantEmail?: string;
  businessRegDocPath?: string;
  businessAddressDocPath?: string;
  vatDocPath?: string;
}

export interface CustomerFilterOptions {
  assignedReps: RepOption[];
  coordinators: CoordinatorOption[];
  regions: RegionOption[];
  subRegions: SubRegionOption[];
}

export interface RepOption {
  id: string;
  name: string;
}

export interface CoordinatorOption {
  id: string;
  name: string;
}

export interface RegionOption {
  id: string;
  name: string;
}

export interface SubRegionOption {
  id: string;
  name: string;
  regionId: string;
}
