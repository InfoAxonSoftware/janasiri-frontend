export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  sellingPrice: number;
  mrp?: number;
  quantity: number;
  // import metadata
  discountPercent?: number;
  discountAmount?: number;
  taxCode?: string;
  taxAmount?: number;
  totalAmount?: number;
  uom?: string;
  imageUrls?: string[];
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  subCategories?: Category[];
}

export interface CreateProductRequest {
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  brand?: string;
  sellingPrice: number;
  mrp?: number;
  quantity: number;
  /**
   * When importing, the caller may supply a main category name.  The backend
   * will create the main (and optionally the sub) category automatically.
   */
  mainCategory?: string;
  /**
   * When importing, supply the specific subcategory name to attach the product
   * to.  This must be used together with (or instead of) mainCategory.
   */
  subCategory?: string;
  // discount/tax metadata from import files
  discountPercent?: number;
  discountAmount?: number;
  taxCode?: string;
  taxAmount?: number;
  totalAmount?: number;
  uom?: string;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}


