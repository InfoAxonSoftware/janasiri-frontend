export interface Region {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  subRegionCount: number;
  coordinatorCount: number;
  subRegions: SubRegion[];
}

export interface SubRegion {
  id: string;
  name: string;
  regionId: string;
  regionName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateRegionRequest {
  name: string;
}

export interface UpdateRegionRequest {
  name?: string;
  isActive?: boolean;
}

export interface CreateSubRegionRequest {
  regionId: string;
  name: string;
}

export interface UpdateSubRegionRequest {
  name?: string;
  isActive?: boolean;
}

export interface Rep {
  id: string;
  userId: string;
  fullName: string;
  employeeCode: string;
  hireDate: string;
  regionId?: string;
  regionName?: string;
  subRegionId?: string;
  subRegionName?: string;
  coordinatorId?: string;
  coordinatorName?: string;
  assignedCustomersCount?: number;
  email?: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: string;
}
