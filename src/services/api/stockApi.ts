import api from './axiosConfig';

export type StockReportRowType = 'GroupHeader' | 'Item' | 'GroupSubtotal' | 'GrandTotal' | 'Blank';

export interface StockReportSummary {
  id: string;
  regionId: string;
  regionName: string;
  companyName: string;
  reportTitle: string;
  dateAsOf: string | null;
  exportedAt: string | null;
  rowCount: number;
  totalOnHand: number;
  totalAmount: number;
  uploadedAt: string;
  uploadedBy: string | null;
}

export interface StockReportRow {
  id: string;
  rowType: StockReportRowType;
  sortOrder: number;
  groupName: string | null;
  item: string | null;
  salesDescription: string | null;
  costExVat: number | null;
  onHand: number | null;
  amount: number | null;
}

export interface StockReportDetail extends StockReportSummary {
  rows: StockReportRow[];
}

export const stockApi = {
  // Admin
  uploadReport: (regionId: string, file: File) => {
    const form = new FormData();
    form.append('regionId', regionId);
    form.append('file', file);
    return api.post<{ data: StockReportSummary }>('/admin/stock-reports/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAllReports: () =>
    api.get<{ data: StockReportSummary[] }>('/admin/stock-reports'),
  getReportByRegion: (regionId: string) =>
    api.get<{ data: StockReportDetail }>(`/admin/stock-reports/${regionId}`),
  deleteReport: (regionId: string) =>
    api.delete(`/admin/stock-reports/${regionId}`),

  // Rep
  getRepReports: () =>
    api.get<{ data: StockReportSummary[] }>('/rep/stock-reports'),
  getRepReportByRegion: (regionId: string) =>
    api.get<{ data: StockReportDetail }>(`/rep/stock-reports/${regionId}`),
};
