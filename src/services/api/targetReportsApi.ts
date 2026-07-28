import api from './axiosConfig';

export interface TargetReportSummary {
  id: string;
  targetId: string;
  originalFileName: string | null;
  fromDate: string;
  asAtDate: string;
  actualSales: number;
  distinctOrderCount: number;
  distinctCustomerCount: number;
  isCurrent: boolean;
  uploadedAt: string;
  uploadedBy: string | null;
}

export type TargetReportSourceRowType =
  | 'Invoice'
  | 'DailyTotal'
  | 'Spacer'
  | 'TotalLabel'
  | 'GrandTotal'
  | 'Other';

export interface TargetReportSourceRow {
  rowType: TargetReportSourceRowType;
  txnType: string | null;
  txnDate: string | null;
  refNo: string | null;
  customerName: string | null;
  itemDescription: string | null;
  qty: number | null;
  discount: number | null;
  salesWithTax: number | null;
  sortOrder: number;
}

export interface TargetReportEntry {
  id: string;
  txnDate: string;
  refNo: string | null;
  customerName: string | null;
  itemDescription: string | null;
  qty: number;
  discount: number;
  salesWithTax: number;
  sortOrder: number;
}

export interface TargetReportDetail {
  id: string;
  targetId: string;
  repId: string;
  repName: string;
  targetPeriod: string;
  targetStartDate: string;
  targetEndDate: string;
  targetAmount: number;
  originalFileName: string | null;
  fromDate: string;
  asAtDate: string;
  actualSales: number;
  distinctOrderCount: number;
  distinctCustomerCount: number;
  isCurrent: boolean;
  uploadedAt: string;
  uploadedBy: string | null;
  entries: TargetReportEntry[];
  sourceRows: TargetReportSourceRow[];
}

export interface TargetReportEntryRequest {
  txnDate: string;
  refNo: string | null;
  customerName: string | null;
  itemDescription: string | null;
  qty: number;
  discount: number;
  salesWithTax: number;
  sortOrder: number;
}

export interface UploadTargetReportPayload {
  originalFileName: string | null;
  entries: TargetReportEntryRequest[];
  sourceRows: TargetReportSourceRow[];
  force?: boolean;
}

export const targetReportsApi = {
  // Admin
  upload: (targetId: string, payload: UploadTargetReportPayload) =>
    api.post<{ data: TargetReportSummary }>(`/admin/targets/${targetId}/reports/upload`, payload),
  getHistory: (targetId: string) =>
    api.get<{ data: TargetReportSummary[] }>(`/admin/targets/${targetId}/reports`),
  getCurrent: (targetId: string) =>
    api.get<{ data: TargetReportDetail }>(`/admin/targets/${targetId}/reports/current`),
  getById: (reportId: string) =>
    api.get<{ data: TargetReportDetail }>(`/admin/target-reports/${reportId}`),

  // Rep
  repGetCurrent: (targetId: string) =>
    api.get<{ data: TargetReportDetail }>(`/rep/targets/${targetId}/report`),
};
