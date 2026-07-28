import api from './axiosConfig';

export const systemConfigApi = {
  getConfig: () => api.get('/config'),
  updateConfig: (data: any) => api.put('/admin/config', data),
};
