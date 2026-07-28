import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { Product, Category, CreateProductRequest } from '../../types/product.types';

// Batch size per request. This is NOT a product cap; we keep requesting pages
// until the API indicates there are no more pages.
const SELECTION_BATCH_SIZE = 500;

async function fetchAllPagedProducts(
  fetchPage: (page: number, pageSize: number) => Promise<{ data: ApiResponse<PagedResult<Product>> }>
): Promise<Product[]> {
  const items: Product[] = [];
  let page = 1;

  while (true) {
    const response = await fetchPage(page, SELECTION_BATCH_SIZE);
    const data = response.data.data;
    const pageItems = data.items || [];

    items.push(...pageItems);

    if (pageItems.length === 0 || page >= data.totalPages) {
      break;
    }

    page += 1;
  }

  return items;
}

export const productsApi = {
  // Admin
  getAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Product>>>('/admin/products', { params }),

  getAllForSelection: () =>
    fetchAllPagedProducts((page, pageSize) =>
      api.get<ApiResponse<PagedResult<Product>>>('/admin/products', { params: { page, pageSize } })
    ),

  getById: (id: string) =>
    api.get<ApiResponse<Product>>(`/admin/products/${id}`),

  create: (data: CreateProductRequest) =>
    api.post<ApiResponse<Product>>('/admin/products', data),

  // bulk import - wrapper object containing requests array
  importMultiple: (data: { requests: CreateProductRequest[] }) =>
    api.post<ApiResponse<Product[]>>('/admin/products/import', data, { timeout: 120000 }),

  update: (id: string, data: Partial<CreateProductRequest>) =>
    api.put<ApiResponse<Product>>(`/admin/products/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<string>>(`/admin/products/${id}`),

  bulkDelete: (ids: string[]) =>
    api.post<ApiResponse<{ deleted: number; missing: number }>>('/admin/products/bulk-delete', { ids }),
  cleanupOrphans: () =>
    api.post<ApiResponse<number>>('/admin/categories/cleanup-orphans'),
  fullReplaceImport: (data: { requests: CreateProductRequest[] }) =>
    api.post<ApiResponse<Product[]>>('/admin/products/import/full-replace', data, { timeout: 180000 }),

  getCategories: () =>
    api.get<ApiResponse<Category[]>>('/categories'),

  createCategory: (data: { name: string; description?: string; parentCategoryId?: string; sortOrder?: number }) =>
    api.post<ApiResponse<Category>>('/admin/categories', data),

  // Rep catalog
  repCatalog: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Product>>>('/rep/products/catalog', { params }),

  repCatalogAll: () =>
    fetchAllPagedProducts((page, pageSize) =>
      api.get<ApiResponse<PagedResult<Product>>>('/rep/products/catalog', { params: { page, pageSize } })
    ),

  // Customer catalog
  customerCatalog: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Product>>>('/customer/products', { params }),

  customerCatalogAll: (params?: Record<string, unknown>) =>
    fetchAllPagedProducts((page, pageSize) =>
      api.get<ApiResponse<PagedResult<Product>>>('/customer/products', {
        params: { ...(params || {}), page, pageSize },
      })
    ),

  customerGetById: (id: string) =>
    api.get<ApiResponse<Product>>(`/customer/products/${id}`),

  customerTopSelling: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<Product[]>>('/customer/products/best-selling', { params }),

  customerCategories: () =>
    api.get<ApiResponse<Category[]>>('/categories'),

  customerSearch: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Product>>>('/customer/products/search', { params }),

  customerGetFavorites: () =>
    api.get<ApiResponse<Product[]>>('/customer/products/favorites'),

  customerToggleFavorite: (id: string) =>
    api.post<ApiResponse<string>>(`/customer/products/${id}/favorite`),

  // Product images (admin)
  addImage: (id: string, formData: FormData) =>
    api.post<ApiResponse<Product>>(`/admin/products/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  removeImage: (id: string, index: number) =>
    api.delete<ApiResponse<Product>>(`/admin/products/${id}/images/${index}`),
};
