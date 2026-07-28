import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../services/api/productsApi';
import { systemConfigApi } from '../../services/api/systemConfigApi';
import { galleryApi } from '../../services/api/galleryApi';
import type { GalleryItem } from '../../services/api/galleryApi';
import * as XLSX from 'xlsx';
import { exportPriceListPdf } from '../../utils/priceListPdf';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Plus, Search, Trash2, X, Layers, Package, Check, SlidersHorizontal, FileSpreadsheet, FileText, Upload, Info, ArrowUpDown, ChevronDown, Zap, Images, ImagePlus, Pencil, Eye, EyeOff } from 'lucide-react';
import type { Product, Category, CreateProductRequest } from '../../types/product.types';
import toast from 'react-hot-toast';


export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  // Main tab: products or gallery
  const [mainTab, setMainTab] = useState<'products' | 'gallery'>('products');
  // Gallery state
  const [galleryForm, setGalleryForm] = useState<{ title: string; description: string; displayOrder: number; imageFiles: File[]; imagePreviews: string[] }>({ title: '', description: '', displayOrder: 0, imageFiles: [], imagePreviews: [] });
  const [editingGallery, setEditingGallery] = useState<GalleryItem | null>(null);
  const [editGalleryForm, setEditGalleryForm] = useState<{ title: string; description: string; displayOrder: number; isActive: boolean }>({ title: '', description: '', displayOrder: 0, isActive: true });
  const galleryFileRef = useRef<HTMLInputElement>(null);
  // new two‑level filters — multi-select Sets
  const [mainFilters, setMainFilters] = useState<Set<string>>(new Set());
  const [subFilters, setSubFilters] = useState<Set<string>>(new Set());
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');

  // inline editing state (desktop only)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [editValue, setEditValue] = useState('');
  // when adding new product inline (desktop only)
  const [newProduct, setNewProduct] = useState<Partial<Product> | null>(null);

  // selection mode: off by default; double-click a row to activate
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // sort state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // toolbar panel: which expandable row is open
  const [toolbarPanel, setToolbarPanel] = useState<'filter' | 'sort' | 'action' | 'more' | null>(null);
  const [showAllFilterChips, setShowAllFilterChips] = useState(false);
  // filter sub-panel: which filter type is expanded
  const [filterSubPanel, setFilterSubPanel] = useState<'category' | 'price' | 'tax' | 'stock' | null>(null);
  // tax filter — multi-select
  const [taxFilters, setTaxFilters] = useState<Set<string>>(new Set());
  // stock filter
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'lowStock' | 'outOfStock'>('all');

  const togglePanel = (panel: 'filter' | 'sort' | 'action' | 'more') => {
    setToolbarPanel(p => p === panel ? null : panel);
    if (panel !== 'filter') setFilterSubPanel(null);
  };
  const toggleFilterSub = (sub: 'category' | 'price' | 'tax' | 'stock') => {
    setFilterSubPanel(p => p === sub ? null : sub);
  };

  const MAX_FILTER_CHIPS = 10;
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [importProgress, setImportProgress] = useState({ active: false, total: 0, processed: 0 });
  const [showImportModal, setShowImportModal] = useState(false);
  // single-product delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // inline row editing (Edit btn in Action panel)
  const [inlineEditProduct, setInlineEditProduct] = useState<Partial<Product> | null>(null);

  // close the export dropdown when entering or leaving selection mode so it can't linger
  // no selectionMode effect needed

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

  // will declare file-input helpers after categories query

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', page, search, minPriceFilter, maxPriceFilter],
    queryFn: () => productsApi.getAll({
      page: 1,
      pageSize: 100000,
      search: search || undefined,
      minPrice: minPriceFilter ? parseFloat(minPriceFilter) : undefined,
      maxPrice: maxPriceFilter ? parseFloat(maxPriceFilter) : undefined,
    }).then(r => r.data.data),
  });

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => productsApi.getCategories().then(r => r.data.data) });

  // Gallery queries & mutations
  const { data: galleryItems, isLoading: galleryLoading } = useQuery({
    queryKey: ['admin-gallery'],
    queryFn: () => galleryApi.adminGetAll().then(r => r.data.data),
    enabled: mainTab === 'gallery',
  });
  const createGalleryMut = useMutation({
    mutationFn: (fd: FormData) => galleryApi.adminCreate(fd),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] });
      // Upload remaining images (index 1+) as extras
      const extras = pendingExtraImagesRef.current;
      const newId = res.data?.data?.id;
      if (extras.length > 0 && newId) {
        for (const file of extras) {
          const fd = new FormData();
          fd.append('image', file);
          try { await galleryApi.adminAddExtraImage(newId, fd); } catch {}
        }
        queryClient.invalidateQueries({ queryKey: ['admin-gallery'] });
      }
      pendingExtraImagesRef.current = [];
      setGalleryForm({ title: '', description: '', displayOrder: 0, imageFiles: [], imagePreviews: [] });
      toast.success('Gallery item added');
    },
    onError: () => { pendingExtraImagesRef.current = []; toast.error('Failed to add gallery item'); },
  });
  const updateGalleryMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => galleryApi.adminUpdate(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-gallery'] }); setEditingGallery(null); toast.success('Gallery item updated'); },
    onError: () => toast.error('Failed to update gallery item'),
  });
  const deleteGalleryMut = useMutation({
    mutationFn: (id: string) => galleryApi.adminDelete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-gallery'] }); toast.success('Gallery item deleted'); },
    onError: () => toast.error('Failed to delete gallery item'),
  });
  const addExtraImageMut = useMutation({
    mutationFn: ({ id, fd }: { id: string; fd: FormData }) => galleryApi.adminAddExtraImage(id, fd),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-gallery'] }); toast.success('Image added'); },
    onError: () => toast.error('Failed to add image'),
  });
  const removeExtraImageMut = useMutation({
    mutationFn: ({ id, index }: { id: string; index: number }) => galleryApi.adminRemoveExtraImage(id, index),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-gallery'] }); toast.success('Image removed'); },
    onError: () => toast.error('Failed to remove image'),
  });
  const extraImageFileRef = useRef<HTMLInputElement>(null);
  const [extraImageTargetId, setExtraImageTargetId] = useState<string | null>(null);
  const pendingExtraImagesRef = useRef<File[]>([]);

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    // 1. Category filter
      let allowedIds: Set<string> | null = null;
      if (mainFilters.size > 0 || subFilters.size > 0) {
        allowedIds = new Set<string>();
        mainFilters.forEach(mainId => {
          const cat = (categories as any[])?.find((c: any) => c.id === mainId);
          if (cat) {
            const relevantSubs = (cat.subCategories || []).filter((sc: any) => subFilters.has(sc.id));
            if (relevantSubs.length > 0) {
              relevantSubs.forEach((sc: any) => allowedIds!.add(sc.id));
            } else {
              allowedIds!.add(mainId);
              (cat.subCategories || []).forEach((sc: any) => allowedIds!.add(sc.id));
            }
          }
        });
        subFilters.forEach(subId => allowedIds!.add(subId));
      }
      let filtered = allowedIds
        ? data.items.filter((p: Product) => p.categoryId && allowedIds!.has(p.categoryId))
        : data.items;

      // 2. Tax filter
      if (taxFilters.size > 0) {
        filtered = filtered.filter((p: Product) => p.taxCode && taxFilters.has(p.taxCode));
      }

      // 3. Stock filter
      if (stockFilter !== 'all') {
        filtered = filtered.filter((p: Product) => {
          if (stockFilter === 'outOfStock') return p.quantity === 0;
          if (stockFilter === 'lowStock')   return p.quantity > 0 && p.quantity <= 10;
          if (stockFilter === 'inStock')    return p.quantity > 10;
          return true;
        });
      }

      return [...filtered].sort((a: Product, b: Product) => {
        let av: any, bv: any;
        switch (sortField) {
          case 'sku':           av = a.sku;              bv = b.sku;              break;
          case 'sellingPrice': av = a.sellingPrice;      bv = b.sellingPrice;    break;
          case 'totalAmount':  av = a.totalAmount ?? 0;  bv = b.totalAmount ?? 0; break;
          case 'mrp':          av = a.mrp ?? 0;          bv = b.mrp ?? 0;        break;
          case 'quantity':     av = a.quantity;          bv = b.quantity;        break;
          case 'taxCode':      av = a.taxCode ?? '';     bv = b.taxCode ?? '';   break;
          case 'uom':          av = (a as any).uom ?? ''; bv = (b as any).uom ?? ''; break;
          default:             av = a.name;              bv = b.name;            break;
        }
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [data?.items, sortField, sortDir, mainFilters, subFilters, categories, taxFilters, stockFilter]);

  const adminCatMap = useMemo(() => {
    const m = new Map<string, string>();
    if (categories) {
      for (const main of (categories as Category[])) {
        if (!main.subCategories?.length) {
          m.set(main.id, main.name);
        } else {
          for (const sub of main.subCategories) {
            m.set(sub.id, `${main.name} - ${sub.name}`);
          }
        }
      }
    }
    return m;
  }, [categories]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of sortedItems) {
      const group = (p.categoryId && adminCatMap.get(p.categoryId)) || p.categoryName || 'Uncategorized';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(p);
    }
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [sortedItems, adminCatMap]);

  // whenever the loaded list changes clear any stray selections
  useEffect(() => {
    setSelectedIds(new Set());
  }, [data?.items]);

  // Escape key exits selection mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectionMode) {
        setSelectionMode(false);
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectionMode]);


  const createMut = useMutation({ mutationFn: (d: CreateProductRequest) => productsApi.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); setShowForm(false); toast.success('Product created'); }, onError: () => toast.error('Failed to create product') });

  // delete multiple helper (will run in parallel)
  const deleteMultiple = async (ids: string[]) => {
    if (!ids.length) return false;

    const chunkSize = 100;
    let totalDeleted = 0;
    let totalMissing = 0;

    setIsBulkDeleting(true);
    setImportProgress({ active: true, total: ids.length, processed: 0 });

    try {
      for (let start = 0; start < ids.length; start += chunkSize) {
        const chunk = ids.slice(start, start + chunkSize);

        try {
          const res = await productsApi.bulkDelete(chunk);
          const payload = res.data.data;
          totalDeleted += payload?.deleted ?? 0;
          totalMissing += payload?.missing ?? 0;
        } catch (err) {
          console.warn('Chunk delete failed; falling back to individual deletes', err);
          for (const id of chunk) {
            try {
              await productsApi.delete(id);
              totalDeleted += 1;
            } catch (innerErr: any) {
              if (innerErr?.response?.status === 404) {
                totalMissing += 1;
              } else {
                console.error('Deleting single product failed', id, innerErr);
              }
            }
          }
        }

        setImportProgress({ active: true, total: ids.length, processed: Math.min(start + chunk.length, ids.length) });
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success(`${totalDeleted} products deleted (${totalMissing} not found)`);
      return true;
    } catch (err) {
      console.error('bulk delete failed', err);
      toast.error('Failed to delete selected products');
      return false;
    } finally {
      setIsBulkDeleting(false);
      setImportProgress({ active: false, total: 0, processed: 0 });
    }
  };

  const handleDeleteSelected = () => {
    // open confirmation modal instead of deleting immediately
    if (selectedIds.size === 0 || isBulkDeleting || deleteMut.isPending) return;
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    if (isBulkDeleting || deleteMut.isPending) return;
    const ids = Array.from(selectedIds);
    // close confirm immediately so user sees only one modal step
    setShowBulkDeleteConfirm(false);
    const ok = await deleteMultiple(ids);
    if (ok) setSelectedIds(new Set());
  };

  const confirmSingleDelete = async () => {
    if (!pendingDeleteId || deleteMut.isPending || isBulkDeleting) return;
    try {
      await deleteMut.mutateAsync(pendingDeleteId);
      setPendingDeleteId(null);
    } catch {
      // keep the confirmation modal open so user can retry/cancel
    }
  };
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<CreateProductRequest> }) => productsApi.update(id, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); setEditProduct(null); setShowForm(false); setInlineEditProduct(null); toast.success('Product updated'); }, onError: () => toast.error('Failed to update product') });
  const deleteMut = useMutation({ mutationFn: (id: string) => productsApi.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); toast.success('Product deleted'); } });

  // handlers for inline edit
  const startEdit = (id: string, field: string, value: string) => {
    if (!isDesktop()) return;
    if (selectionMode) return; // don't start inline editing while in selection mode
    // if user was editing draft and moves to another column, save previous input
    if (newProduct && editing && editing.id === 'new' && editing.field !== field) {
      setNewProduct(prev => {
        if (!prev) return prev;
        const numFields = ['quantity','sellingPrice','mrp','discountPercent','discountAmount','taxAmount','totalAmount'];
        return { ...prev, [editing.field]: numFields.includes(editing.field) ? parseFloat(editValue) || 0 : editValue };
      });
    }
    setEditing({ id, field });
    setEditValue(value);
  };

  const commitEdit = (productId: string, field: string) => {
    if (!editing || editing.id !== productId || editing.field !== field) return;
    let data: any = {};
    switch (field) {
      case 'quantity':
        data[field] = parseInt(editValue, 10) || 0;
        break;
      case 'sellingPrice':
      case 'discountPercent':
      case 'discountAmount':
      case 'taxAmount':
      case 'totalAmount':
        data[field] = parseFloat(editValue) || 0;
        break;
      default:
        data[field] = editValue;
        break;
    }
    if (productId === 'new' && newProduct) {
      // update draft product
      setNewProduct(prev => ({ ...(prev || {}), [field]: data[field] }));
    } else {
      updateMut.mutate({ id: productId, data });
    }
    setEditing(null);
  };

  const handleKeyDownEdit = (e: React.KeyboardEvent, productId: string, field: string) => {
    if (e.key === 'Enter') {
      (e.target as HTMLElement).blur();
    }
  };
  const categoryMut = useMutation({ mutationFn: (d: { name: string; description?: string; parentCategoryId?: string }) => productsApi.createCategory(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setShowCategoryForm(false); toast.success('Category created'); } });

  // import helpers (must be defined before JSX uses them)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = importProgress.active || deleteMut.isPending || isBulkDeleting;
  const busyTitle = importProgress.active ? 'Importing products...' : 'Deleting products...';
  const busySubtitle = importProgress.active ? 'Please wait while we process your file.' : 'Please wait while we remove selected products.';

  // helper that handles percentage values coming from Excel
  const parsePercentValue = (v: any): number | undefined => {
    if (v == null || v === '') return undefined;
    if (typeof v === 'string') {
      // remove any trailing % and trim
      const cleaned = v.replace('%', '').trim();
      const num = parseFloat(cleaned);
      if (isNaN(num)) return undefined;
      return num;
    }
    if (typeof v === 'number') {
      // Excel often stores 5% as 0.05
      if (v <= 1) return v * 100;
      return v;
    }
    return undefined;
  };

  const importInChunks = async (items: CreateProductRequest[]) => {
    if (!items.length) {
      toast.error('No products found in file');
      return;
    }

    const chunkSize = 100;
    let processed = 0;
    setImportProgress({ active: true, total: items.length, processed: 0 });

    const postChunkWithRetry = async (chunk: CreateProductRequest[], retries = 2) => {
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          await productsApi.importMultiple({ requests: chunk });
          return;
        } catch (err) {
          lastError = err;
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
          }
        }
      }
      throw lastError;
    };

    try {
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await postChunkWithRetry(chunk);
        processed += chunk.length;
        setImportProgress({ active: true, total: items.length, processed });
      }

      toast.success(`Products imported (${processed}/${items.length})`);

      // refresh UI after successful import; failures here should not mark import as failed
      try {
        await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
        await queryClient.refetchQueries({ queryKey: ['categories'] });
        setMainFilters(new Set());
        setSubFilters(new Set());
      } catch (refreshErr) {
        console.warn('Post-import refresh failed', refreshErr);
        toast('Imported successfully, but list refresh failed. Please reload the page.');
      }
    } catch (err) {
      console.error('import failed', err);
      toast.error(`Import failed after ${processed}/${items.length} products`);
    } finally {
      setImportProgress(p => ({ ...p, active: false }));
    }
  };

  const clearAndImport = async (items: CreateProductRequest[]) => {
    setImportProgress({ active: true, total: items.length, processed: 0 });

    try {
      const existingProducts = await productsApi.getAllForSelection();
      const existingIds = existingProducts.map(p => p.id);
      if (existingIds.length) {
        const chunkSize = 100;
        let deleted = 0;
        for (let i = 0; i < existingIds.length; i += chunkSize) {
          const chunk = existingIds.slice(i, i + chunkSize);
          const result = await productsApi.bulkDelete(chunk);
          deleted += result.data.data?.deleted ?? 0;
          setImportProgress({ active: true, total: items.length, processed: deleted });
        }
        toast.success(`Existing products removed: ${deleted}`);
      }

      const orphanResult = await productsApi.cleanupOrphans();
      toast.success(`Orphan categories removed: ${orphanResult.data.data}`);

      await importInChunks(items);
    } catch (err) {
      console.error('clear and import failed', err);
      toast.error('Clear and import failed. Please retry.');
    } finally {
      setImportProgress({ active: false, total: 0, processed: 0 });
    }
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = evt => {
      const data = evt.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: 'binary' });

      // Exact columns: GroupName | Item | Sales Description | UOM | Price | SalesTax | All Inc Price | MRP
      // QOH and all other columns are ignored.
      const items: CreateProductRequest[] = [];

      workbook.SheetNames.forEach(sheetName => {
        const ws = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];

        rows.forEach(r => {
          const sku = (r['Item'] ?? '').toString().trim();
          const name = (r['Sales Description'] ?? '').toString().trim();

          // Skip section-header rows, subtotal rows, and blank rows
          if (!sku || !name) return;

          // Parse category from GroupName: "Main - Sub" format
          const groupName = (r['GroupName'] ?? '').toString().trim();
          let mainName = '';
          let subName = '';
          if (groupName) {
            const dashIdx = groupName.search(/\s*-\s*/);
            if (dashIdx !== -1) {
              mainName = groupName.substring(0, dashIdx).trim();
              subName = groupName.substring(dashIdx).replace(/^\s*-\s*/, '').trim();
            } else {
              mainName = groupName;
            }
          }

          // Match against existing categories
          let cat: Category | undefined;
          if (subName && categories) {
            for (const c of categories) {
              const sc = (c.subCategories || []).find((x: Category) => x.name.toLowerCase() === subName.toLowerCase());
              if (sc) { cat = sc; break; }
            }
          }
          if (!cat && mainName && categories) {
            cat = categories.find(c => c.name.toLowerCase() === mainName.toLowerCase());
          }

          const priceRaw   = (r['Price'] ?? '').toString().trim();
          const allIncRaw  = (r['All Inc Price'] ?? '').toString().trim();
          const mrpRaw     = (r['MRP'] ?? '').toString().trim();
          const taxCodeRaw = (r['SalesTax'] ?? '').toString().trim();
          const uomRaw     = (r['UOM'] ?? '').toString().trim();

          items.push({
            name,
            sku,
            categoryId: cat?.id,
            mainCategory: mainName || undefined,
            subCategory: subName || undefined,
            sellingPrice: parseFloat(priceRaw) || 0,
            mrp: mrpRaw !== '' ? (parseFloat(mrpRaw) || undefined) : undefined,
            quantity: 0,
            uom: uomRaw || undefined,
            taxCode: taxCodeRaw || undefined,
            totalAmount: allIncRaw !== '' ? (parseFloat(allIncRaw) || undefined) : undefined,
          } as CreateProductRequest);
        });
      });

      clearAndImport(items);
    };
    reader.readAsBinaryString(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowImportModal(false);
    parseFile(file);
    e.target.value = '';
  };

  // export helper (defined before return)
  const exportProducts = async (format: 'excel' | 'pdf', onlySelected = false) => {
    try {
      // Fetch items
      let items: Product[] = [];
      if (onlySelected && selectedIds.size > 0 && data?.items) {
        items = data.items.filter(p => selectedIds.has(p.id));
      } else {
        const resp = await productsApi.getAll({ page: 1, pageSize: 10000, search: search || undefined, minPrice: minPriceFilter ? parseFloat(minPriceFilter) : undefined, maxPrice: maxPriceFilter ? parseFloat(maxPriceFilter) : undefined });
        items = resp.data.data.items;
      }

      // Fetch company config (for company name only; addresses are fixed per business)
      const cfgResp = await systemConfigApi.getConfig();
      const cfg = cfgResp.data.data || cfgResp.data;
      const companyName = cfg.companyName || 'Janasiri';

      // Fixed company details
      const registeredOffice = 'No. 205, Wattarantenna Passage, Kandy.';
      const warehouseCentral = 'No. 02, Mawilmada Road, Kandy.';
      const warehouseWest    = 'No. 41A, Gnanathilaka Road, Mount Lavinia.';
      const contactVat       = '+94 81 495 0206  |  TP / Hotline  |  VAT: 114608394-7000';

      const exportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      // Build categoryId → full "Main - Sub" GroupName from the loaded categories tree
      const catMap = new Map<string, string>();
      if (categories) {
        for (const main of categories as Category[]) {
          if (!main.subCategories?.length) {
            catMap.set(main.id, main.name);
          } else {
            for (const sub of main.subCategories) {
              catMap.set(sub.id, `${main.name} - ${sub.name}`);
            }
          }
        }
      }

      // Group items — use full GroupName; sort products A-Z by name within each group
      const grouped = new Map<string, Product[]>();
      for (const p of items) {
        const group = (p.categoryId && catMap.get(p.categoryId)) || p.categoryName || 'Uncategorized';
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group)!.push(p);
      }
      // Sort groups A-Z, products A-Z within each group
      const sortedGrouped = new Map(
        [...grouped.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, prods]) => [key, prods.slice().sort((a, b) => a.name.localeCompare(b.name))] as [string, Product[]])
      );

      if (format === 'excel') {
        const wb = XLSX.utils.book_new();

        // Build rows array manually: company header + data
        const aoa: (string | number)[][] = [];

        // Company header block
        aoa.push([companyName]);
        aoa.push([`Registered Office: ${registeredOffice}   |   Warehouse Central: ${warehouseCentral}   |   Warehouse West: ${warehouseWest}`]);
        aoa.push([contactVat]);
        aoa.push([`Product Price List  —  ${exportDate}`]);
        aoa.push([]);  // blank spacer

        // Column headers — exact import format
        aoa.push(['GroupName', 'Item', 'Sales Description', 'UOM', 'Price', 'SalesTax', 'All Inc Price', 'MRP']);

        // Track which row indices (0-based) are group header rows → bold
        const boldRows = new Set<number>();

        // Data rows grouped by category
        let isFirst = true;
        for (const [group, products] of sortedGrouped) {
          // Blank spacer between groups (not before the first)
          if (!isFirst) aoa.push([]);
          isFirst = false;

          // Category section header row — bold
          boldRows.add(aoa.length);
          aoa.push([group, '', '', '', '', '', '', '']);

          for (const p of products) {
            aoa.push([
              group,
              p.sku,
              p.name,
              p.uom ?? '',
              p.sellingPrice,
              p.taxCode || '',
              p.totalAmount ?? '',
              p.mrp ?? '',
            ]);
          }
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Apply bold to group header rows across all 8 columns
        const colLetters = ['A','B','C','D','E','F','G','H'];
        boldRows.forEach(rowIdx => {
          colLetters.forEach(col => {
            const addr = `${col}${rowIdx + 1}`;
            if (!ws[addr]) ws[addr] = { t: 's', v: '' };
            ws[addr].s = { font: { bold: true } };
          });
        });

        // Column widths
        ws['!cols'] = [
          { wch: 30 }, // GroupName
          { wch: 12 }, // Item
          { wch: 40 }, // Sales Description
          { wch: 10 }, // UOM
          { wch: 12 }, // Price
          { wch: 10 }, // SalesTax
          { wch: 14 }, // All Inc Price
          { wch: 12 }, // MRP
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Price List');
        const filename = `${companyName.replace(/\s+/g, '_')}_Price_List_${exportDate.replace(/\s/g, '_')}.xlsx`;
        const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
        const blob = new Blob([wbOut], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);

      } else {
        await exportPriceListPdf(sortedGrouped);
      }
    } catch (err) {
      console.error('export failed', err);
      toast.error('Export failed');
    }
  };

  // --- Confirmation modal (slides in from top) ---
  const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmLabel = 'Delete', confirmClass = 'bg-red-600 hover:bg-red-700 text-white' }: { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string; confirmClass?: string }) => {
    if (!open) return null;
    return createPortal(
      <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ pointerEvents: 'auto' }}>
        {/* dark overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
        {/* dialog slides down from top */}
        <div
          className="relative mt-16 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 animate-[slideDown_0.25s_ease-out]"
          style={{ animation: 'slideDown 0.25s ease-out both' }}
        >
          <div className="flex items-start gap-4 p-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 pb-5">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={onConfirm} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${confirmClass}`}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // Gallery handlers
  const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const previews = files.map(f => URL.createObjectURL(f));
    setGalleryForm(f => ({ ...f, imageFiles: [...f.imageFiles, ...files], imagePreviews: [...f.imagePreviews, ...previews] }));
    e.target.value = '';
  };
  const handleGalleryRemoveImage = (idx: number) => {
    setGalleryForm(f => {
      URL.revokeObjectURL(f.imagePreviews[idx]);
      return { ...f, imageFiles: f.imageFiles.filter((_, i) => i !== idx), imagePreviews: f.imagePreviews.filter((_, i) => i !== idx) };
    });
  };
  const handleGallerySubmit = () => {
    if (!galleryForm.title.trim()) { toast.error('Title is required'); return; }
    if (!galleryForm.imageFiles.length) { toast.error('Please select at least one image'); return; }
    const [cover, ...extras] = galleryForm.imageFiles;
    pendingExtraImagesRef.current = extras;
    const fd = new FormData();
    fd.append('title', galleryForm.title.trim());
    fd.append('description', galleryForm.description.trim());
    fd.append('displayOrder', String(galleryForm.displayOrder));
    fd.append('image', cover);
    createGalleryMut.mutate(fd);
  };

  // sort helper
  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="ml-1 opacity-30 text-[10px]">↕</span>;
    return <span className="ml-1 text-indigo-500 text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleRowDoubleClick = (productId: string) => {
    if (newProduct) return;
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set([productId]));
    }
  };

  // computed
  const activeFilterCount = mainFilters.size + subFilters.size + taxFilters.size
    + (minPriceFilter ? 1 : 0) + (maxPriceFilter ? 1 : 0)
    + (stockFilter !== 'all' ? 1 : 0);
  // unique tax codes from ALL loaded products for tax filter chips
  const allTaxCodes = useMemo(() => {
    if (!data?.items) return [];
    const codes = new Set<string>();
    data.items.forEach((p: Product) => { if (p.taxCode) codes.add(p.taxCode); });
    return Array.from(codes).sort();
  }, [data?.items]);
  const visibleCategories = showAllFilterChips
    ? (categories || [])
    : (categories || []).slice(0, MAX_FILTER_CHIPS);

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* Page title + Tab switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500 text-sm mt-1">{mainTab === 'products' ? 'Manage your product catalog' : 'Manage showcase gallery for customers'}</p>
        </div>
        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setMainTab('products')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mainTab === 'products' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Package className="w-4 h-4" /> Price List
          </button>
          <button
            onClick={() => setMainTab('gallery')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mainTab === 'gallery' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Images className="w-4 h-4" /> Gallery
          </button>
        </div>
      </div>

      {/* ── GALLERY TAB ─────────────────────────────────────────────────── */}
      {mainTab === 'gallery' && (
        <div className="flex flex-col gap-5">
          {/* Upload form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><ImagePlus className="w-5 h-5 text-indigo-500" /> Add Gallery Item</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Title *</label>
                  <input
                    type="text"
                    value={galleryForm.title}
                    onChange={e => setGalleryForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. New Arrivals"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
                  <textarea
                    value={galleryForm.description}
                    onChange={e => setGalleryForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional caption or details..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Display Order</label>
                  <input
                    type="number"
                    value={galleryForm.displayOrder}
                    onChange={e => setGalleryForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                    className="w-32 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600">Images * <span className="font-normal text-slate-400">(first = cover)</span></label>
                  <button
                    type="button"
                    onClick={() => galleryFileRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition"
                  ><ImagePlus className="w-3.5 h-3.5" /> Add images</button>
                </div>
                <input ref={galleryFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryFileChange} />
                {galleryForm.imagePreviews.length === 0 ? (
                  <div
                    onClick={() => galleryFileRef.current?.click()}
                    className="flex-1 border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/30 hover:bg-indigo-50 cursor-pointer transition flex items-center justify-center min-h-[160px]"
                  >
                    <div className="text-center p-6">
                      <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                      <p className="text-sm text-indigo-600 font-medium">Click to upload images</p>
                      <p className="text-xs text-slate-400 mt-1">Select multiple — JPEG, PNG, WebP · max 10 MB each</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {galleryForm.imagePreviews.map((src, idx) => (
                      <div key={idx} className="relative group/prev aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded font-bold">cover</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleGalleryRemoveImage(idx)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold items-center justify-center hidden group-hover/prev:flex shadow"
                        >×</button>
                      </div>
                    ))}
                    {/* Add more tile */}
                    <div
                      onClick={() => galleryFileRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 cursor-pointer flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-indigo-500 transition"
                    >
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[10px] font-semibold">Add more</span>
                    </div>
                  </div>
                )}
                {galleryForm.imagePreviews.length > 0 && (
                  <p className="text-[11px] text-slate-400">{galleryForm.imagePreviews.length} image{galleryForm.imagePreviews.length !== 1 ? 's' : ''} selected · hover to remove</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleGallerySubmit}
                disabled={createGalleryMut.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60"
              >
                <ImagePlus className="w-4 h-4" /> {createGalleryMut.isPending ? 'Uploading…' : 'Add to Gallery'}
              </button>
            </div>
          </div>

          {/* Gallery grid */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Images className="w-5 h-5 text-indigo-500" /> Gallery Items ({galleryItems?.length ?? 0})</h2>
            {/* hidden input for adding extra images */}
            <input
              ref={extraImageFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file || !extraImageTargetId) return;
                const fd = new FormData();
                fd.append('image', file);
                addExtraImageMut.mutate({ id: extraImageTargetId, fd });
                e.target.value = '';
                setExtraImageTargetId(null);
              }}
            />
            {galleryLoading ? (
              <p className="text-slate-400 text-sm text-center py-10">Loading gallery…</p>
            ) : !galleryItems?.length ? (
              <div className="text-center py-14">
                <Images className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">No gallery items yet. Add one above.</p>
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                {galleryItems.map((item: GalleryItem) => {
                  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
                  const allImages = [item.imageUrl, ...(item.extraImageUrls || [])];
                  return (
                    <div key={item.id} className={`relative rounded-2xl overflow-hidden border shadow-sm group flex flex-col ${item.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
                      {/* Cover image */}
                      <div className="aspect-square bg-slate-100 overflow-hidden relative">
                        <img
                          src={`${apiBase}${item.imageUrl}`}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Image'; }}
                        />
                        {allImages.length > 1 && (
                          <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">+{allImages.length - 1}</span>
                        )}
                      </div>
                      {/* Extra image thumbnails row */}
                      {(item.extraImageUrls || []).length > 0 && (
                        <div className="flex gap-1 px-2 pt-1.5 overflow-x-auto pb-1">
                          {(item.extraImageUrls || []).map((url, idx) => (
                            <div key={idx} className="relative flex-shrink-0 group/thumb">
                              <img
                                src={`${apiBase}${url}`}
                                alt=""
                                className="w-9 h-9 object-cover rounded-lg border border-slate-200"
                                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/80x80?text=X'; }}
                              />
                              <button
                                onClick={() => removeExtraImageMut.mutate({ id: item.id, index: idx })}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] items-center justify-center hidden group-hover/thumb:flex"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-2.5 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate leading-tight">{item.title}</p>
                        {item.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-snug">{item.description}</p>}
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {item.isActive ? 'Visible' : 'Hidden'}
                          </span>
                          <span className="text-[10px] text-slate-400">#{item.displayOrder}</span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setExtraImageTargetId(item.id); extraImageFileRef.current?.click(); }}
                          className="p-1 rounded-lg bg-white/90 shadow text-emerald-600 hover:bg-emerald-50 transition"
                          title="Add more images"
                        ><ImagePlus className="w-3 h-3" /></button>
                        <button
                          onClick={() => { setEditingGallery(item); setEditGalleryForm({ title: item.title, description: item.description || '', displayOrder: item.displayOrder, isActive: item.isActive }); }}
                          className="p-1 rounded-lg bg-white/90 shadow text-indigo-600 hover:bg-indigo-50 transition"
                          title="Edit"
                        ><Pencil className="w-3 h-3" /></button>
                        <button
                          onClick={() => updateGalleryMut.mutate({ id: item.id, data: { title: item.title, description: item.description, displayOrder: item.displayOrder, isActive: !item.isActive } })}
                          className="p-1 rounded-lg bg-white/90 shadow text-slate-600 hover:bg-slate-100 transition"
                          title={item.isActive ? 'Hide' : 'Show'}
                        >{item.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
                        <button
                          onClick={() => { if (confirm('Delete this gallery item?')) deleteGalleryMut.mutate(item.id); }}
                          className="p-1 rounded-lg bg-white/90 shadow text-red-500 hover:bg-red-50 transition"
                          title="Delete"
                        ><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit gallery item modal */}
      {editingGallery && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setEditingGallery(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6" style={{ animation: 'slideDown 0.2s ease-out both' }}>
            <h3 className="text-base font-bold text-slate-900 mb-4">Edit Gallery Item</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Title *</label>
                <input type="text" value={editGalleryForm.title} onChange={e => setEditGalleryForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
                <textarea value={editGalleryForm.description} onChange={e => setEditGalleryForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Display Order</label>
                  <input type="number" value={editGalleryForm.displayOrder} onChange={e => setEditGalleryForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))} className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="gallery-active" checked={editGalleryForm.isActive} onChange={e => setEditGalleryForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                  <label htmlFor="gallery-active" className="text-sm font-medium text-slate-700">Visible to customers</label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEditingGallery(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={() => updateGalleryMut.mutate({ id: editingGallery.id, data: editGalleryForm })}
                disabled={updateGalleryMut.isPending}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60"
              >{updateGalleryMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── PRODUCTS TAB ─────────────────────────────────────────────────── */}
      {mainTab === 'products' && <>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/70 rounded-2xl shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden">

          {/* ── Row 1: Search + Import + Add ──────────────────────────────── */}
          <div className="px-4 pt-3 pb-3 flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[180px] group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search by name or SKU…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="hidden sm:block h-7 w-px bg-slate-200" />
            {data?.items && (
              <span className="hidden sm:inline text-xs text-slate-400 select-none">
                {sortedItems.length} product{sortedItems.length !== 1 ? 's' : ''}
              </span>
            )}
            <div className="hidden sm:block h-7 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowImportModal(true)}
                disabled={importProgress.active}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-sm font-medium transition-all disabled:opacity-50"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={() => {
                  setNewProduct({ id: 'new', name: '', sku: '', sellingPrice: 0, mrp: 0, quantity: 0 });
                  if (!isDesktop()) { setEditProduct(null); setShowForm(true); }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm shadow-indigo-200"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Product</span>
              </button>
            </div>
          </div>

          {/* ── Row 2: Control bar ────────────────────────────────────────── */}
          <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center">

            {/* Filter */}
            <button
              onClick={() => togglePanel('filter')}
              className={`flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${toolbarPanel === 'filter' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold leading-none px-1">{activeFilterCount}</span>
              )}
            </button>

            <div className="w-px h-5 bg-slate-200" />

            {/* Sort */}
            <button
              onClick={() => togglePanel('sort')}
              className={`flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${toolbarPanel === 'sort' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Sort</span>
            </button>

            <div className="w-px h-5 bg-slate-200" />

            {/* Action */}
            <button
              onClick={() => togglePanel('action')}
              className={`flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${toolbarPanel === 'action' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Action</span>
              {selectedIds.size > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold leading-none px-1">{selectedIds.size}</span>
              )}
            </button>

            <div className="w-px h-5 bg-slate-200" />

            {/* More */}
            <button
              onClick={() => togglePanel('more')}
              className={`flex-1 inline-flex items-center justify-center gap-1 px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${toolbarPanel === 'more' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="hidden xs:inline sm:inline">More</span>
              <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${toolbarPanel === 'more' ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* ── Filter Panel ──────────────────────────────────────────────── */}
          {toolbarPanel === 'filter' && (
            <div className="border-t border-slate-100 bg-slate-50/60">

              {/* Sub-tab row — full width, 4 equal buttons */}
              <div className="flex border-b border-slate-100">
                {([
                  { key: 'category', label: 'Category', short: 'Cat.',  count: mainFilters.size + subFilters.size },
                  { key: 'price',    label: 'Price',    short: 'Price', count: (minPriceFilter || maxPriceFilter) ? 1 : 0 },
                  { key: 'tax',      label: 'Tax',      short: 'Tax',   count: taxFilters.size },
                  { key: 'stock',    label: 'Stock',    short: 'Stock', count: stockFilter !== 'all' ? 1 : 0 },
                ] as { key: 'category'|'price'|'tax'|'stock'; label: string; short: string; count: number }[]).map(({ key, label, short, count }) => (
                  <button
                    key={key}
                    onClick={() => toggleFilterSub(key)}
                    className={`flex-1 inline-flex items-center justify-center gap-1 py-2 text-[11px] sm:text-xs font-medium border-b-2 transition-all ${
                      filterSubPanel === key
                        ? 'border-indigo-500 text-indigo-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    <span className="sm:hidden">{short}</span>
                    <span className="hidden sm:inline">{label}</span>
                    {count > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] sm:min-w-[16px] sm:h-4 rounded-full bg-indigo-600 text-white text-[8px] sm:text-[9px] font-bold leading-none px-0.5 sm:px-1">{count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Category sub-panel ── */}
              {filterSubPanel === 'category' && (
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-white">
                  <div className="flex flex-wrap items-center gap-2">
                    {visibleCategories.map((cat: any) => {
                      const active = mainFilters.has(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setMainFilters(prev => {
                              const next = new Set(prev);
                              if (next.has(cat.id)) {
                                next.delete(cat.id);
                                const subIds = new Set((cat.subCategories || []).map((sc: any) => sc.id));
                                setSubFilters(sp => { const ns = new Set(sp); subIds.forEach(id => ns.delete(id as string)); return ns; });
                              } else { next.add(cat.id); }
                              return next;
                            });
                            setPage(1);
                          }}
                          className={`inline-flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium border transition-all ${
                            active ? 'bg-black border-black text-white' : 'bg-white border-black text-slate-700 hover:bg-black hover:text-white'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          {cat.name}
                        </button>
                      );
                    })}
                    {(categories?.length || 0) > MAX_FILTER_CHIPS && (
                      showAllFilterChips
                        ? <button onClick={() => setShowAllFilterChips(false)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors">show less <ChevronDown className="w-3 h-3 rotate-180" /></button>
                        : <button onClick={() => setShowAllFilterChips(true)} className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border border-dashed border-black text-slate-600 hover:bg-black hover:text-white hover:border-black transition-all">+{(categories?.length || 0) - MAX_FILTER_CHIPS} more <ChevronDown className="w-3 h-3" /></button>
                    )}
                    {/* Subcategory chips */}
                    {mainFilters.size > 0 && (() => {
                      const subCats: any[] = [];
                      (categories || []).forEach((c: any) => { if (mainFilters.has(c.id)) (c.subCategories || []).forEach((sc: any) => subCats.push({ ...sc, parentName: c.name })); });
                      if (!subCats.length) return null;
                      return (
                        <>
                          <div className="w-full h-px bg-slate-100 my-0.5" />
                          {subCats.map((sc: any) => {
                            const subActive = subFilters.has(sc.id);
                            return (
                              <button key={sc.id}
                                onClick={() => { setSubFilters(prev => { const next = new Set(prev); next.has(sc.id) ? next.delete(sc.id) : next.add(sc.id); return next; }); setPage(1); }}
                                title={mainFilters.size > 1 ? sc.parentName : undefined}
                                className={`inline-flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium border transition-all ${
                                  subActive ? 'bg-black border-black text-white' : 'bg-white border-black text-slate-700 hover:bg-black hover:text-white'
                                }`}
                              >
                                {subActive && <Check className="w-3 h-3" />}{sc.name}
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                    {(mainFilters.size > 0 || subFilters.size > 0) && (
                      <button onClick={() => { setMainFilters(new Set()); setSubFilters(new Set()); setPage(1); }} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium">clear</button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Price sub-panel ── */}
              {filterSubPanel === 'price' && (
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <span className="text-xs font-medium text-slate-500">Price range</span>
                    <div className="flex items-center gap-1.5 flex-1">
                      <input type="number" placeholder="Min" value={minPriceFilter}
                        onChange={e => { setMinPriceFilter(e.target.value); setPage(1); }}
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition"
                      />
                      <span className="text-slate-300 text-xs shrink-0">–</span>
                      <input type="number" placeholder="Max" value={maxPriceFilter}
                        onChange={e => { setMaxPriceFilter(e.target.value); setPage(1); }}
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition"
                      />
                      {(minPriceFilter || maxPriceFilter) && (
                        <button onClick={() => { setMinPriceFilter(''); setMaxPriceFilter(''); setPage(1); }} className="shrink-0 p-1 text-red-400 hover:text-red-600 transition">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {(minPriceFilter || maxPriceFilter) && (
                      <span className="text-xs text-indigo-600 font-medium">
                        {minPriceFilter && minPriceFilter}{minPriceFilter && maxPriceFilter && ' – '}{maxPriceFilter && maxPriceFilter}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tax sub-panel ── */}
              {filterSubPanel === 'tax' && (
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-white">
                  <div className="flex flex-wrap items-center gap-2">
                    {allTaxCodes.length === 0 && <span className="text-xs text-slate-400 italic">No tax codes in current products</span>}
                    {/* None / exempt option */}
                    {data?.items?.some((p: Product) => !p.taxCode) && (
                      <button
                        onClick={() => { setTaxFilters(prev => { const next = new Set(prev); next.has('__none__') ? next.delete('__none__') : next.add('__none__'); return next; }); setPage(1); }}
                        className={`inline-flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium border transition-all ${
                          taxFilters.has('__none__') ? 'bg-black border-black text-white' : 'bg-white border-black text-slate-700 hover:bg-black hover:text-white'
                        }`}
                      >
                        {taxFilters.has('__none__') && <Check className="w-3 h-3" />} No Tax
                      </button>
                    )}
                    {allTaxCodes.map(code => (
                      <button
                        key={code}
                        onClick={() => { setTaxFilters(prev => { const next = new Set(prev); next.has(code) ? next.delete(code) : next.add(code); return next; }); setPage(1); }}
                        className={`inline-flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium border transition-all ${
                          taxFilters.has(code) ? 'bg-black border-black text-white' : 'bg-white border-black text-slate-700 hover:bg-black hover:text-white'
                        }`}
                      >
                        {taxFilters.has(code) && <Check className="w-3 h-3" />}{code}
                      </button>
                    ))}
                    {taxFilters.size > 0 && (
                      <button onClick={() => { setTaxFilters(new Set()); setPage(1); }} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium">clear</button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Stock sub-panel ── */}
              {filterSubPanel === 'stock' && (
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-white">
                  <div className="flex flex-wrap items-center gap-2">
                    {([
                      { value: 'all',        label: 'All',        color: 'slate' },
                      { value: 'inStock',    label: 'In Stock',   color: 'emerald' },
                      { value: 'lowStock',   label: 'Low Stock',  color: 'amber' },
                      { value: 'outOfStock', label: 'Out of Stock', color: 'red' },
                    ] as { value: typeof stockFilter; label: string; color: string }[]).map(({ value, label }) => {
                      return (
                        <button
                          key={value}
                          onClick={() => { setStockFilter(value); setPage(1); }}
                          className={`inline-flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium border transition-all ${
                            stockFilter === value ? 'bg-black border-black text-white' : 'bg-white border-black text-slate-700 hover:bg-black hover:text-white'
                          }`}
                        >
                          {stockFilter === value && <Check className="w-3 h-3" />}{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── Sort Panel ────────────────────────────────────────────────── */}
          {toolbarPanel === 'sort' && (
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-slate-100 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                {/* Asc/Desc toggle */}
                <button
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border bg-white border-black text-slate-700 hover:bg-black hover:text-white transition-all"
                >
                  {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                {/* Sort field chips */}
                {[
                  { field: 'name',         label: 'Name' },
                  { field: 'sku',          label: 'Item Code' },
                  { field: 'uom',          label: 'UOM' },
                  { field: 'sellingPrice', label: 'Price' },
                  { field: 'taxCode',      label: 'Sales Tax' },
                  { field: 'totalAmount',  label: 'All Inc Price' },
                  { field: 'mrp',          label: 'MRP' },
                  { field: 'quantity',     label: 'QOH' },
                ].map(({ field, label }) => (
                  <button
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`inline-flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium border transition-all ${sortField === field ? 'bg-black border-black text-white' : 'bg-white border-black text-slate-700 hover:bg-black hover:text-white'}`}
                  >
                    {sortField === field && <Check className="w-3 h-3" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Action Panel ──────────────────────────────────────────────── */}
          {toolbarPanel === 'action' && (
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-slate-100 bg-white">
              <div className="flex items-center gap-2 flex-wrap">

                {/* Selection info */}
                {selectionMode && selectedIds.size > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">{selectedIds.size}</span>
                    item{selectedIds.size !== 1 ? 's' : ''} selected
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">Double-click a row to select items first</span>
                )}

                <div className="w-px h-4 bg-slate-200 mx-0.5" />

                {/* Edit — only when exactly 1 selected */}
                <button
                  onClick={() => {
                    const p = sortedItems.find((p: Product) => selectedIds.has(p.id));
                    if (p) {
                      setInlineEditProduct({ ...p });
                      setToolbarPanel(null);
                    }
                  }}
                  disabled={selectedIds.size !== 1 || !!inlineEditProduct}
                  title={selectedIds.size !== 1 ? 'Select exactly one product to edit' : 'Edit product inline'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✎ Edit
                </button>

                {/* Delete */}
                <button
                  onClick={() => { if (selectedIds.size > 0) setShowBulkDeleteConfirm(true); }}
                  disabled={selectedIds.size === 0 || isBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>

                {/* Export group */}
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-xs text-slate-400">Export:</span>
                  <button
                    onClick={() => exportProducts('excel', selectedIds.size > 0)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button
                    onClick={() => exportProducts('pdf', selectedIds.size > 0)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>

                {/* Cancel selection */}
                {selectionMode && (
                  <button
                    onClick={() => { setSelectedIds(new Set()); setSelectionMode(false); }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all ml-auto"
                  >
                    <X className="w-3 h-3" /> Cancel selection
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── More Panel ─────────────────────────────────────────────────── */}
          {toolbarPanel === 'more' && (
            <div className="px-4 py-3 border-t border-slate-100 bg-white">
              <span className="text-xs text-slate-400 italic">No additional options</span>
            </div>
          )}

        </div>

        {/* hidden file input */}
        <input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      </div>

      {/* products listing only */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">

          {isLoading ? <div className="p-12 text-center text-slate-500">Loading products...</div> : !data?.items?.length ? <div className="p-12 text-center"><Package className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No products found</p></div> : (<>
                {/* Mobile / Tablet card list (< lg) */}
            <div className="lg:hidden">
              {sortedItems.map((product: Product) => (
                <div
                  key={product.id}
                  onDoubleClick={() => handleRowDoubleClick(product.id)}
                  onClick={() => { if (selectionMode) { setSelectedIds(prev => { const s = new Set(prev); if (s.has(product.id)) s.delete(product.id); else s.add(product.id); return s; }); } }}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 transition-colors cursor-default select-none
                    ${selectionMode && selectedIds.has(product.id) ? 'bg-indigo-50' : 'bg-white active:bg-slate-50/80'}`}
                >
                  {/* Checkbox (selection mode) */}
                  {selectionMode && (
                    <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                      selectedIds.has(product.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                    }`}>
                      {selectedIds.has(product.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  )}

                  {/* Icon */}
                  {!selectionMode && (
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center">
                      <Package className="w-4 h-4 text-indigo-400" />
                    </div>
                  )}

                  {/* Name + Item Code */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate leading-snug">{product.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono tracking-wide">{product.sku}</p>
                  </div>

                  {/* MRP */}
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatNumber(product.mrp ?? product.sellingPrice)}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mt-0.5">MRP</p>
                  </div>
                </div>
              ))}

              {sortedItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Package className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No products found</p>
                  <p className="text-xs mt-1 opacity-70">Try adjusting your filters</p>
                </div>
              )}

              {!selectionMode && sortedItems.length > 0 && (
                <p className="text-center text-[11px] text-slate-400 py-3 italic select-none">
                  Double-tap a row to enter selection mode
                </p>
              )}
              {selectionMode && (
                <p className="text-center text-[11px] text-indigo-500 py-3 font-medium select-none">
                  {selectedIds.size} selected &mdash;{' '}
                  <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }} className="underline underline-offset-2">Exit (Esc)</button>
                </p>
              )}
            </div>

            {/* Desktop table — grouped by category, same style as customer catalog */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {selectionMode && (
                      <th className="px-3 py-3.5 w-10 border-r border-slate-700 text-center">
                        <input type="checkbox"
                          checked={sortedItems.length > 0 && selectedIds.size === sortedItems.length}
                          onChange={() => {
                            if (selectedIds.size === sortedItems.length) setSelectedIds(new Set());
                            else setSelectedIds(new Set(sortedItems.map((p: Product) => p.id)));
                          }}
                        />
                      </th>
                    )}
                    <th className="text-left px-4 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 min-w-[180px] whitespace-nowrap">Group Name</th>
                    <th onClick={() => handleSort('sku')} className="text-left px-4 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-700 select-none whitespace-nowrap border-r border-slate-600">Item Code<SortIcon field="sku" /></th>
                    <th onClick={() => handleSort('name')} className="text-left px-4 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-700 select-none border-r border-slate-600 min-w-[240px]">Sales Description<SortIcon field="name" /></th>
                    <th onClick={() => handleSort('uom')} className="text-center px-4 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-700 select-none whitespace-nowrap border-r border-slate-600 w-32">UOM<SortIcon field="uom" /></th>
                    <th onClick={() => handleSort('sellingPrice')} className="text-right px-4 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-700 select-none whitespace-nowrap border-r border-slate-600">Price<SortIcon field="sellingPrice" /></th>
                    <th onClick={() => handleSort('taxCode')} className="text-center px-2 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-700 select-none whitespace-nowrap border-r border-slate-600 w-14">Tax<SortIcon field="taxCode" /></th>
                    <th onClick={() => handleSort('totalAmount')} className="text-right px-4 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-700 select-none whitespace-nowrap border-r border-slate-600">All Inc Price<SortIcon field="totalAmount" /></th>
                    <th onClick={() => handleSort('mrp')} className="text-right px-4 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-700 select-none whitespace-nowrap">MRP<SortIcon field="mrp" /></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Inline new-product row */}
                  {newProduct && (
                    <tr key="new" className="bg-amber-50">
                      {selectionMode && <td className="border border-slate-200" />}
                      <td className="px-4 py-3 text-xs text-slate-400 italic border border-slate-200">—</td>
                      <td className="px-4 py-3 font-mono text-xs border border-slate-200">
                        <input placeholder="SKU…" className="w-full font-mono text-xs border-b border-indigo-400 bg-transparent outline-none placeholder-slate-300" value={newProduct.sku || ''} onChange={e => setNewProduct(p => ({ ...p, sku: e.target.value }))} />
                      </td>
                      <td className="px-4 py-3 border border-slate-200">
                        <input placeholder="Description…" className="w-full border-b border-indigo-400 bg-transparent outline-none placeholder-slate-300 text-sm" value={newProduct.name || ''} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
                      </td>
                      <td className="px-4 py-3 text-xs border border-slate-200">
                        <input placeholder="UOM…" className="w-full text-xs border-b border-indigo-400 bg-transparent outline-none placeholder-slate-300" value={(newProduct as any).uom || ''} onChange={e => setNewProduct(p => ({ ...p, uom: e.target.value } as any))} />
                      </td>
                      <td className="px-4 py-3 text-right border border-slate-200">
                        <input type="number" step="0.01" placeholder="0.00" className="w-full text-right border-b border-indigo-400 bg-transparent outline-none placeholder-slate-300" value={newProduct.sellingPrice ?? ''} onChange={e => setNewProduct(p => ({ ...p, sellingPrice: parseFloat(e.target.value) || 0 }))} />
                      </td>
                      <td className="px-4 py-3 text-center border border-slate-200">
                        <input placeholder="V18…" className="w-14 text-center border-b border-indigo-400 bg-transparent outline-none placeholder-slate-300 mx-auto block" value={newProduct.taxCode || ''} onChange={e => setNewProduct(p => ({ ...p, taxCode: e.target.value }))} />
                      </td>
                      <td className="px-4 py-3 text-right border border-slate-200">
                        <input type="number" step="0.01" placeholder="0.00" className="w-full text-right border-b border-indigo-400 bg-transparent outline-none placeholder-slate-300" value={newProduct.totalAmount ?? ''} onChange={e => setNewProduct(p => ({ ...p, totalAmount: parseFloat(e.target.value) || undefined } as any))} />
                      </td>
                      <td className="px-4 py-3 text-right border border-slate-200">
                        <input type="number" step="0.01" placeholder="0.00" className="w-full text-right border-b border-indigo-400 bg-transparent outline-none placeholder-slate-300" value={newProduct.mrp ?? ''} onChange={e => setNewProduct(p => ({ ...p, mrp: parseFloat(e.target.value) || undefined } as any))} />
                      </td>
                    </tr>
                  )}
                  {Array.from(groupedItems.entries()).flatMap(([groupName, products]) => [
                    <tr key={`hdr-${groupName}`} className="bg-slate-100 border-y border-slate-300">
                      <td colSpan={selectionMode ? 9 : 8} className="px-4 py-2 font-bold text-slate-800 text-[12px]">{groupName}</td>
                    </tr>,
                    ...products.map((product: Product) => {
                      const isEditing = inlineEditProduct?.id === product.id;
                      if (isEditing && inlineEditProduct) {
                        return (
                          <tr key={product.id} className="bg-indigo-50/60">
                            {selectionMode && <td className="px-4 py-2 border border-slate-200" />}
                            <td className="px-3 py-2 text-xs text-slate-500 italic border border-indigo-300">{groupName}</td>
                            <td className="px-3 py-2 border border-indigo-300">
                              <input className="w-full font-mono text-xs border-b border-indigo-400 bg-transparent outline-none" value={(inlineEditProduct as any).sku || ''} onChange={e => setInlineEditProduct(p => ({ ...p, sku: e.target.value }))} />
                            </td>
                            <td className="px-3 py-2 border border-indigo-300">
                              <input className="w-full text-xs border-b border-indigo-400 bg-transparent outline-none" value={inlineEditProduct.name || ''} onChange={e => setInlineEditProduct(p => ({ ...p, name: e.target.value }))} />
                            </td>
                            <td className="px-3 py-2 border border-indigo-300">
                              <input className="w-full text-xs border-b border-indigo-400 bg-transparent outline-none" value={(inlineEditProduct as any).uom || ''} onChange={e => setInlineEditProduct(p => ({ ...p, uom: e.target.value } as any))} />
                            </td>
                            <td className="px-3 py-2 border border-indigo-300">
                              <input type="number" step="0.01" className="w-full text-right text-xs border-b border-indigo-400 bg-transparent outline-none" value={inlineEditProduct.sellingPrice ?? ''} onChange={e => setInlineEditProduct(p => ({ ...p, sellingPrice: parseFloat(e.target.value) || 0 }))} />
                            </td>
                            <td className="px-3 py-2 border border-indigo-300 text-center">
                              <input className="w-14 text-center text-xs border-b border-indigo-400 bg-transparent outline-none mx-auto block" value={inlineEditProduct.taxCode || ''} onChange={e => setInlineEditProduct(p => ({ ...p, taxCode: e.target.value }))} />
                            </td>
                            <td className="px-3 py-2 border border-indigo-300">
                              <input type="number" step="0.01" className="w-full text-right text-xs border-b border-indigo-400 bg-transparent outline-none" value={inlineEditProduct.totalAmount ?? ''} onChange={e => setInlineEditProduct(p => ({ ...p, totalAmount: parseFloat(e.target.value) || undefined } as any))} />
                            </td>
                            <td className="px-3 py-2 border border-indigo-300">
                              <input type="number" step="0.01" className="w-full text-right text-xs border-b border-indigo-400 bg-transparent outline-none" value={inlineEditProduct.mrp ?? ''} onChange={e => setInlineEditProduct(p => ({ ...p, mrp: parseFloat(e.target.value) || undefined } as any))} />
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr
                          key={product.id}
                          className={`transition-all cursor-pointer select-none border-b border-slate-100 ${selectionMode && selectedIds.has(product.id) ? 'bg-indigo-50/80' : 'hover:bg-slate-50/60'}`}
                          onDoubleClick={() => handleRowDoubleClick(product.id)}
                          onClick={() => { if (selectionMode) { setSelectedIds(prev => { const s = new Set(prev); if (s.has(product.id)) s.delete(product.id); else s.add(product.id); return s; }); } }}
                        >
                          {selectionMode && (
                            <td className="px-4 py-3 border border-slate-200">
                              <input type="checkbox" readOnly checked={selectedIds.has(product.id)} className="pointer-events-none" />
                            </td>
                          )}
                          <td className="px-4 py-3 text-slate-500 border-r border-slate-100 whitespace-nowrap">{groupName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap border-r border-slate-100">{product.sku}</td>
                          <td className="px-4 py-3 border-r border-slate-100">
                            <div className="flex items-center gap-2">
                              {(product.imageUrls?.length ?? 0) > 0 && (
                                <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}${product.imageUrls![0]}`} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-slate-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              )}
                              <span className="text-slate-800">{product.name}</span>
                              {(product.imageUrls?.length ?? 0) > 0 && <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold"><ImagePlus className="w-2.5 h-2.5" />{product.imageUrls!.length}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sky-600 font-medium border-r border-slate-100 w-32">{(product as any).uom || 'No UOM'}</td>
                          <td className="px-4 py-3 text-right text-slate-700 border-r border-slate-100 whitespace-nowrap">{formatNumber(product.sellingPrice)}</td>
                          <td className="px-2 py-3 text-center border-r border-slate-100 w-14 whitespace-nowrap">
                            {product.taxCode
                              ? <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${product.taxCode.startsWith('V') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{product.taxCode}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 border-r border-slate-100 whitespace-nowrap">{product.totalAmount != null ? formatNumber(product.totalAmount) : <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-orange-600 font-semibold whitespace-nowrap">{product.mrp != null ? formatNumber(product.mrp) : <span className="text-slate-300">—</span>}</td>
                        </tr>
                      );
                    }),
                    <tr key={`spacer-${groupName}`} className="bg-white"><td colSpan={selectionMode ? 9 : 8} className="py-1" /></tr>,
                  ])}
                </tbody>
              </table>
              {!selectionMode && sortedItems.length > 0 && (
                <p className="text-center text-[11px] text-slate-400 py-3 border-t border-slate-100 italic">Double-click a row to enter selection mode</p>
              )}
              {selectionMode && (
                <p className="text-center text-[11px] text-slate-400 py-3 border-t border-slate-100">Selection mode active &mdash; click rows to select &nbsp;·&nbsp; <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }} className="text-red-400 hover:text-red-600 font-medium transition-colors">Exit (Esc)</button></p>
              )}
            </div>
          </>)}
        </div>

      </> /* end mainTab === 'products' */}

      {isBusy && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col items-center" style={{ pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <div
            className="relative mt-16 w-full max-w-md mx-4 rounded-2xl border border-slate-200 bg-white shadow-2xl p-6"
            style={{ animation: 'slideDown 0.25s ease-out both' }}
          >
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center">
              <Package className="w-6 h-6 text-indigo-600 animate-pulse" />
            </div>
            <p className="text-base font-semibold text-slate-900 text-center">{busyTitle}</p>
            <p className="text-sm text-slate-500 mt-1 text-center">{busySubtitle}</p>

            {importProgress.active && (
              <div className="mt-4 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${importProgress.total > 0 ? Math.round((importProgress.processed / importProgress.total) * 100) : 0}%` }}
                />
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.2s]" />
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.1s]" />
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-bounce" />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Import Modal ─────────────────────────────────────────────────── */}
      {showImportModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowImportModal(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" style={{ animation: 'slideDown 0.2s ease-out both' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Import Products</h2>
                  <p className="text-xs text-slate-500">Upload your product Excel sheet</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Drop zone */}
              <label
                htmlFor="import-file-input"
                className="flex flex-col items-center justify-center gap-3 w-full h-36 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/40 hover:bg-emerald-50 cursor-pointer transition group"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-emerald-500', 'bg-emerald-50'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-emerald-500', 'bg-emerald-50'); }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-emerald-500', 'bg-emerald-50');
                  const file = e.dataTransfer.files?.[0];
                  if (file) { setShowImportModal(false); parseFile(file); }
                }}
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition">
                  <Upload className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Drop your Excel file here</p>
                  <p className="text-xs text-slate-400 mt-0.5">or click to browse &nbsp;·&nbsp; .xlsx / .xls</p>
                </div>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) { setShowImportModal(false); parseFile(file); }
                    e.target.value = '';
                  }}
                />
              </label>

              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Importing will <strong>replace all existing products</strong>. Make sure your file is correct before uploading.
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showForm && <ProductFormModal product={editProduct} onClose={() => { setShowForm(false); setEditProduct(null); }} onSubmit={d => editProduct ? updateMut.mutate({ id: editProduct.id, data: d }) : createMut.mutate(d as CreateProductRequest)} isPending={createMut.isPending || updateMut.isPending} />}

      {/* single-product delete confirmation */}
      <ConfirmModal
        open={pendingDeleteId !== null}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        onConfirm={confirmSingleDelete}
        onCancel={() => setPendingDeleteId(null)}
        confirmLabel={deleteMut.isPending ? 'Deleting...' : 'Delete'}
      />

      {/* bulk delete confirmation */}
      <ConfirmModal
        open={showBulkDeleteConfirm}
        title={`Delete ${selectedIds.size} Product${selectedIds.size === 1 ? '' : 's'}`}
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected product${selectedIds.size === 1 ? '' : 's'}? This action cannot be undone.`}
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        confirmLabel={isBulkDeleting ? 'Deleting...' : 'Delete'}
      />

      {/* Floating save/cancel bar for inline ROW EDIT */}
      {inlineEditProduct !== null &&
        createPortal(
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-5 pointer-events-none">
            <div
              className="pointer-events-auto flex items-center gap-3 px-5 py-3 bg-indigo-700 text-white rounded-2xl shadow-2xl border border-indigo-600 mx-4"
              style={{ animation: 'slideDown 0.2s ease-out both' }}
            >
              <span className="text-sm font-medium">Editing: <span className="font-bold">{inlineEditProduct.name}</span></span>
              <div className="h-4 w-px bg-indigo-400" />
              <button
                onClick={() => {
                  if (!inlineEditProduct?.id) return;
                  updateMut.mutate({
                    id: inlineEditProduct.id,
                    data: {
                      name: inlineEditProduct.name,
                      sku: (inlineEditProduct as any).sku,
                      sellingPrice: inlineEditProduct.sellingPrice,
                      mrp: inlineEditProduct.mrp,
                      taxCode: inlineEditProduct.taxCode,
                      totalAmount: inlineEditProduct.totalAmount as any,
                      uom: (inlineEditProduct as any).uom,
                    },
                  });
                }}
                disabled={updateMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-white text-xs font-medium transition disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              <button
                onClick={() => setInlineEditProduct(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900/60 hover:bg-indigo-900 text-white text-xs font-medium transition"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Floating save/cancel bar for inline new-product row */}
      {newProduct !== null &&
        createPortal(
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-5 pointer-events-none">
            <div
              className="pointer-events-auto flex items-center gap-3 px-5 py-3 bg-amber-600 text-white rounded-2xl shadow-2xl border border-amber-500 mx-4"
              style={{ animation: 'slideDown 0.2s ease-out both' }}
            >
              <span className="text-sm font-medium">Fill in the row above to add a new product</span>
              <div className="h-4 w-px bg-amber-400" />
              <button
                onClick={() => {
                  const payload: CreateProductRequest = {
                    name: newProduct.name || '',
                    sku: newProduct.sku || '',
                    sellingPrice: parseFloat(newProduct.sellingPrice?.toString()||'0')||0,
                    mrp: newProduct.mrp != null ? parseFloat(newProduct.mrp?.toString()||'0') : undefined,
                    quantity: parseInt(newProduct.quantity?.toString()||'0')||0,
                    uom: (newProduct as any).uom || undefined,
                    discountPercent: newProduct.discountPercent as any,
                    discountAmount: newProduct.discountAmount as any,
                    taxCode: newProduct.taxCode,
                    taxAmount: newProduct.taxAmount as any,
                    totalAmount: newProduct.totalAmount as any,
                  };
                  createMut.mutate(payload, { onSuccess: () => setNewProduct(null) });
                }}
                disabled={createMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              <button
                onClick={() => { setNewProduct(null); setEditing(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800/70 hover:bg-amber-800 text-white text-xs font-medium transition"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
}

function ProductFormModal({ product, onClose, onSubmit, isPending }: { product: Product | null; onClose: () => void; onSubmit: (d: Partial<CreateProductRequest>) => void; isPending: boolean }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    sellingPrice: product?.sellingPrice?.toString() || '0',
    mrp: product?.mrp?.toString() || '',
    quantity: product?.quantity?.toString() || '0',
    discountPercent: product?.discountPercent?.toString() || '',
    discountAmount: product?.discountAmount?.toString() || '',
    taxCode: product?.taxCode || '',
    taxAmount: product?.taxAmount?.toString() || '',
    totalAmount: product?.totalAmount?.toString() || ''
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: form.name,
      sku: form.sku,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      quantity: parseInt(form.quantity) || 0,
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : undefined,
      discountAmount: form.discountAmount ? parseFloat(form.discountAmount) : undefined,
      taxCode: form.taxCode || undefined,
      taxAmount: form.taxAmount ? parseFloat(form.taxAmount) : undefined,
      totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : undefined,
      mrp: form.mrp ? parseFloat(form.mrp) : undefined,
    });
  };
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none';

  const queryClient = useQueryClient();
  const imgFileRef = useRef<HTMLInputElement>(null);
  const [localImages, setLocalImages] = useState<string[]>(product?.imageUrls || []);
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

  const addImgMut = useMutation({
    mutationFn: (fd: FormData) => productsApi.addImage(product!.id, fd),
    onSuccess: (res) => {
      const updated = res.data.data?.imageUrls || [];
      setLocalImages(updated);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Image added');
    },
    onError: () => toast.error('Failed to add image'),
  });

  const removeImgMut = useMutation({
    mutationFn: (index: number) => productsApi.removeImage(product!.id, index),
    onSuccess: (res) => {
      const updated = res.data.data?.imageUrls || [];
      setLocalImages(updated);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Image removed');
    },
    onError: () => toast.error('Failed to remove image'),
  });

  const imageSection = product && (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">Product Images</label>
      <input
        ref={imgFileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files || []);
          files.forEach(file => {
            const fd = new FormData();
            fd.append('image', file);
            addImgMut.mutate(fd);
          });
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-2">
        {localImages.map((url, idx) => (
          <div key={idx} className="relative group/img w-20 h-20 flex-shrink-0">
            <img
              src={`${apiBase}${url}`}
              alt=""
              className="w-full h-full object-cover rounded-lg border border-slate-200"
              onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/80x80?text=?'; }}
            />
            <button
              type="button"
              onClick={() => removeImgMut.mutate(idx)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold items-center justify-center hidden group-hover/img:flex shadow"
            >×</button>
            {idx === 0 && <span className="absolute bottom-0.5 left-0.5 text-[9px] bg-black/60 text-white px-1 rounded">cover</span>}
          </div>
        ))}
        <button
          type="button"
          onClick={() => imgFileRef.current?.click()}
          disabled={addImgMut.isPending}
          className="w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition text-xs"
        >
          <ImagePlus className="w-5 h-5" />
          {addImgMut.isPending ? '…' : 'Add'}
        </button>
      </div>
      <p className="text-[11px] text-slate-400">First image is used as cover. Click × to remove.</p>
    </div>
  );

  const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isDesktop()) {
      document.body.style.overflow = 'hidden';
      try { window.scrollTo({ top: 0, behavior: 'instant' as any }); } catch {}
    }
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (typeof window !== 'undefined' && isDesktop()) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-slate-900">{product ? 'Edit Product' : 'New Product'}</h2><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label><input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label><input required value={form.sku} onChange={e => set('sku', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Selling Price *</label><input required type="number" step="0.01" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">MRP</label><input type="number" step="0.01" value={form.mrp} onChange={e => set('mrp', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input required type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Discount %</label><input type="number" step="0.01" value={form.discountPercent} onChange={e => set('discountPercent', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount</label><input type="number" step="0.01" value={form.discountAmount} onChange={e => set('discountAmount', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tax Code</label><input value={form.taxCode} onChange={e => set('taxCode', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tax Amount</label><input type="number" step="0.01" value={form.taxAmount} onChange={e => set('taxAmount', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Total Amount</label><input type="number" step="0.01" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} className={inputCls} /></div>
            </div>
            {imageSection}
            <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Cancel</button><button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-50">{isPending ? 'Saving...' : product ? 'Update' : 'Create'}</button></div>
          </form>
        </div>
      </div>
    );
  }

  // Mobile: bottom-sheet (portal) — match RecordPaymentSheet UI
  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up pb-safe pointer-events-auto">
        <div className="sticky top-0 bg-white pt-3 pb-2 px-6 border-b border-slate-100 z-10">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-lg">{product ? 'Edit Product' : 'New Product'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label><input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label><input required value={form.sku} onChange={e => set('sku', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Selling Price *</label><input required type="number" step="0.01" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input required type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Discount %</label><input type="number" step="0.01" value={form.discountPercent} onChange={e => set('discountPercent', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount</label><input type="number" step="0.01" value={form.discountAmount} onChange={e => set('discountAmount', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tax Code</label><input value={form.taxCode} onChange={e => set('taxCode', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tax Amount</label><input type="number" step="0.01" value={form.taxAmount} onChange={e => set('taxAmount', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Total Amount</label><input type="number" step="0.01" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} className={inputCls} /></div>
            </div>
            {imageSection}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="w-full py-2.5 bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
              <button type="submit" disabled={isPending} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{isPending ? 'Saving...' : product ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}




function CategoryFormModal({ onClose, onSubmit, isPending }: { onClose: () => void; onSubmit: (d: { name: string; description?: string; parentCategoryId?: string }) => void; isPending: boolean }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [parentId, setParentId] = useState('');
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none';
  const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => productsApi.getCategories().then(r => r.data.data) });

  if (typeof window !== 'undefined' && isDesktop()) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="fixed inset-0 bg-black/50" onClick={onClose} /><div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">New Category</h2>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Parent Category (optional)</label>
            <select value={parentId} onChange={e => setParentId(e.target.value)} className={inputCls + ' cursor-pointer'}>
              <option value="">None</option>
              {cats?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className={inputCls + ' resize-none'} /></div>
        </div>
        <div className="flex gap-3 mt-6"><button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Cancel</button><button onClick={() => onSubmit({ name, description: desc || undefined })} disabled={isPending || !name} className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-50">{isPending ? 'Creating...' : 'Create'}</button></div>
      </div></div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up pb-safe pointer-events-auto">
        <div className="sticky top-0 bg-white pt-3 pb-2 px-6 border-b border-slate-100 z-10">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-lg">New Category</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Parent Category (optional)</label>
              <select value={parentId} onChange={e => setParentId(e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">None</option>
                {cats?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className={inputCls + ' resize-none'} /></div>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Cancel</button><button onClick={() => onSubmit({ name, description: desc || undefined, parentCategoryId: parentId || undefined })} disabled={isPending || !name} className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-50">{isPending ? 'Creating...' : 'Create'}</button></div>
        </div>
      </div>
    </div>,
    document.body
  );
}


 

function DeleteModal({ product, onClose, onSubmit, isPending }: { product: Product; onClose: () => void; onSubmit: () => void; isPending: boolean }) {
  const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  const displayName = (product && 'name' in product) ? (product as Product).name : (product as any).productName;

  if (typeof window !== 'undefined' && isDesktop()) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="fixed inset-0 bg-black/50" onClick={onClose} /><div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Delete product</h2><p className="text-sm text-slate-500 mb-4">Are you sure you want to delete <strong>{displayName}</strong>? This action cannot be undone.</p>
        <div className="flex gap-3 mt-6"><button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Cancel</button><button onClick={() => onSubmit()} disabled={isPending} className="flex-1 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition disabled:opacity-50">{isPending ? 'Deleting...' : 'Delete product'}</button></div>
      </div></div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up pb-safe pointer-events-auto">
        <div className="sticky top-0 bg-white pt-3 pb-2 px-6 border-b border-slate-100 z-10">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-lg">Delete product</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">Are you sure you want to delete <strong>{displayName}</strong>? This action cannot be undone.</p>
          <div className="flex gap-3 mt-6"><button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Cancel</button><button onClick={() => onSubmit()} disabled={isPending} className="flex-1 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition disabled:opacity-50">{isPending ? 'Deleting...' : 'Delete product'}</button></div>
        </div>
      </div>
    </div>,
    document.body
  );
}


