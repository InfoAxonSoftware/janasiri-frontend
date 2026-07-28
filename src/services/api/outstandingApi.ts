import api from './axiosConfig';

export interface OutstandingReportSummary {
  id: string;
  regionId: string;
  regionName: string;
  reportDate: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  customerCount: number;
  entryCount: number;
}

export interface OutstandingEntry {
  id: string;
  customerName: string;
  txnType: string | null;
  refNo: string | null;
  txnDate: string | null;
  ageDays: number | null;
  current: number;
  bucket1_15: number;
  bucket16_30: number;
  bucket31_45: number;
  above45: number;
  balance: number;
  isTotal: boolean;
  sortOrder: number;
}

export interface OutstandingReportDetail {
  id: string;
  regionId: string;
  regionName: string;
  reportDate: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  entries: OutstandingEntry[];
}

export interface OutstandingEntryRequest {
  customerName: string;
  txnType: string | null;
  refNo: string | null;
  txnDate: string | null;
  ageDays: number | null;
  current: number;
  bucket1_15: number;
  bucket16_30: number;
  bucket31_45: number;
  above45: number;
  balance: number;
  isTotal: boolean;
  sortOrder: number;
}

export const outstandingApi = {
  // Admin — legacy file upload (kept)
  uploadReport: (regionId: string, reportDate: string | null, file: File) => {
    const form = new FormData();
    form.append('regionId', regionId);
    if (reportDate) form.append('reportDate', reportDate);
    form.append('file', file);
    return api.post<{ data: OutstandingReportSummary }>('/admin/outstanding-reports/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Admin — chunk upload (client-side parse)
  startUpload: (regionId: string, reportDate: string | null) =>
    api.post<{ data: { reportId: string } }>('/admin/outstanding-reports/start-upload', {
      regionId,
      reportDate: reportDate || null,
    }),
  appendEntries: (reportId: string, entries: OutstandingEntryRequest[]) =>
    api.post(`/admin/outstanding-reports/${reportId}/entries`, { entries }),

  getAllReports: () =>
    api.get<{ data: OutstandingReportSummary[] }>('/admin/outstanding-reports'),
  getReportByRegion: (regionId: string) =>
    api.get<{ data: OutstandingReportDetail }>(`/admin/outstanding-reports/${regionId}`),
  deleteReport: (regionId: string) =>
    api.delete(`/admin/outstanding-reports/${regionId}`),

  // Rep
  getRepReports: () =>
    api.get<{ data: OutstandingReportDetail[] }>('/rep/outstanding-reports'),
};
