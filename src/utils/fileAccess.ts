import api from '../services/api/axiosConfig';

/**
 * Centralized helpers for reading files served by the backend's file storage abstraction.
 *
 * Public files (gallery/product images) are served by static-file middleware under a plain URL
 * and can be linked directly. Private files (KYC documents, payment evidence, quick-request
 * attachments) are served by authenticated API endpoints and MUST be fetched with the app's
 * Bearer token — never as a plain <a href>/<img src>, and never with the token in a query
 * string. This module is the only place that should build those URLs or do that fetch.
 */

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

/**
 * Resolves a PUBLIC file reference (gallery/product image) returned by the backend into an
 * absolute URL, normalizing both legacy absolute URLs and the current relative "/uploads/..." form.
 */
export function resolvePublicFileUrl(url: string): string {
  if (!url) return url;
  return url.startsWith('/') ? `${API_ORIGIN}${url}` : url.replace(/^https?:\/\/[^/]+/, API_ORIGIN);
}

/**
 * Fetches a PRIVATE file from an authenticated backend endpoint (e.g.
 * "/customer-registrations/{id}/documents/business-reg") and returns a local Blob URL for it.
 * Callers are responsible for revoking the URL (via URL.revokeObjectURL) once no longer needed —
 * openPrivateFile/downloadPrivateFile below do this automatically.
 */
async function fetchPrivateFileBlobUrl(apiPath: string): Promise<string> {
  // The backend returns these paths with a leading "/api" (e.g. "/api/rep-payments/{id}/evidence"),
  // but the shared axios instance's baseURL already includes "/api" — strip it to avoid "/api/api/...".
  const relativePath = apiPath.replace(/^\/api(?=\/)/, '');
  const response = await api.get(relativePath, { responseType: 'blob' });
  return URL.createObjectURL(response.data as Blob);
}

/** Opens a private file in a new tab (e.g. viewing a KYC document or payment evidence image). */
export async function openPrivateFile(apiPath: string): Promise<void> {
  const blobUrl = await fetchPrivateFileBlobUrl(apiPath);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  // The new tab has already loaded the blob by the time this fires; just free the memory.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/** Downloads a private file to disk with the given filename. */
export async function downloadPrivateFile(apiPath: string, downloadName: string): Promise<void> {
  const blobUrl = await fetchPrivateFileBlobUrl(apiPath);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
