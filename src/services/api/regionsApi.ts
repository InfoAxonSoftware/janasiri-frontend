import api from './axiosConfig';
import type { Region, SubRegion, CreateRegionRequest, UpdateRegionRequest, CreateSubRegionRequest, UpdateSubRegionRequest } from '../../types/region.types';

export const regionsApi = {
  // All authenticated users can list
  getAll: () => api.get('/regions').then(r => r.data),
  getById: (id: string) => api.get(`/regions/${id}`).then(r => r.data),
  getSubRegions: (regionId: string) => api.get(`/regions/${regionId}/sub-regions`).then(r => r.data),

  // Admin CRUD
  adminCreate: (data: CreateRegionRequest) => api.post('/admin/regions', data).then(r => r.data),
  adminUpdate: (id: string, data: UpdateRegionRequest) => api.put(`/admin/regions/${id}`, data).then(r => r.data),
  adminDelete: (id: string) => api.delete(`/admin/regions/${id}`).then(r => r.data),

  adminCreateSubRegion: (data: CreateSubRegionRequest) => api.post('/admin/sub-regions', data).then(r => r.data),
  adminUpdateSubRegion: (id: string, data: UpdateSubRegionRequest) => api.put(`/admin/sub-regions/${id}`, data).then(r => r.data),
  adminDeleteSubRegion: (id: string) => api.delete(`/admin/sub-regions/${id}`).then(r => r.data),
};
