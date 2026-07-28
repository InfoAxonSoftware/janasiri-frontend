import api from './axiosConfig';
import type { ApiResponse } from '../../types/api.types';

export interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  extraImageUrls: string[];
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const galleryApi = {
  // Admin
  adminGetAll: () =>
    api.get<ApiResponse<GalleryItem[]>>('/admin/gallery'),

  adminCreate: (formData: FormData) =>
    api.post<ApiResponse<GalleryItem>>('/admin/gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  adminUpdate: (id: string, data: { title: string; description?: string; displayOrder: number; isActive: boolean }) =>
    api.put<ApiResponse<GalleryItem>>(`/admin/gallery/${id}`, data),

  adminDelete: (id: string) =>
    api.delete<ApiResponse<string>>(`/admin/gallery/${id}`),

  adminAddExtraImage: (id: string, formData: FormData) =>
    api.post<ApiResponse<GalleryItem>>(`/admin/gallery/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  adminRemoveExtraImage: (id: string, index: number) =>
    api.delete<ApiResponse<GalleryItem>>(`/admin/gallery/${id}/images/${index}`),

  // Customer / Rep / Coordinator
  customerGetAll: () =>
    api.get<ApiResponse<GalleryItem[]>>('/customer/gallery'),
};
