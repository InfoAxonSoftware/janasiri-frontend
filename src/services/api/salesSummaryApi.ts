import api from './axiosConfig';

export interface SalesSummaryReportSummary {
  id: string;
  regionId: string;
  regionName: string;
  periodFrom: string | null;
  periodTo: string | null;
  originalFileName: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  rowCount: number;
  totalSalesWithTax: number;
  totalTax: number;
  totalNetSales: number;
  totalDiscount: number;
  totalGrossSales: number;
}

export interface SalesSummaryEntry {
  id: string;
  groupName: string;
  salesWithTax: number;
  tax: number;
  netSales: number;
  discount: number;
  grossSales: number;
  isTotal: boolean;
  sortOrder: number;
}

export interface SalesSummaryReportDetail {
  id: string;
  regionId: string;
  regionName: string;
  periodFrom: string | null;
  periodTo: string | null;
  originalFileName: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  entries: SalesSummaryEntry[];
}

export interface SalesSummaryEntryRequest {
  groupName: string;
  salesWithTax: number;
  tax: number;
  netSales: number;
  discount: number;
  grossSales: number;
  isTotal: boolean;
  sortOrder: number;
}

export interface UploadSalesSummaryPayload {
  regionId: string;
  periodFrom: string | null;
  periodTo: string | null;
  originalFileName: string | null;
  entries: SalesSummaryEntryRequest[];
}

export const salesSummaryApi = {
  // Admin
  upload: (payload: UploadSalesSummaryPayload) =>
    api.post<{ data: SalesSummaryReportSummary }>('/admin/sales-summary/upload', payload),
  getAllReports: () =>
    api.get<{ data: SalesSummaryReportSummary[] }>('/admin/sales-summary'),
  getReportById: (reportId: string) =>
    api.get<{ data: SalesSummaryReportDetail }>(`/admin/sales-summary/${reportId}`),
  deleteReport: (reportId: string) =>
    api.delete(`/admin/sales-summary/${reportId}`),

  // Rep
  getRepReports: () =>
    api.get<{ data: SalesSummaryReportDetail[] }>('/rep/sales-summary'),
};
