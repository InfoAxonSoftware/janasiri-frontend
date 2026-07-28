import api from './axiosConfig';
import type { SpecialOfferPayload } from '../../types/offer.types';

export const offersApi = {
  getPublic: () => api.get('/offers'),
  adminGetAll: () => api.get('/admin/offers'),
  adminCreate: (payload: SpecialOfferPayload) => api.post('/admin/offers', payload),
  adminUpdate: (id: string, payload: SpecialOfferPayload) => api.put(`/admin/offers/${id}`, payload),
  adminDelete: (id: string) => api.delete(`/admin/offers/${id}`),
};