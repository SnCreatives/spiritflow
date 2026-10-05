import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../utils/api';
import { Category, Brand, Product } from '../types';

export interface MasterDataState {
  productTypes: string[];
  categories: Category[];
  brands: Brand[];
  variants: string[];
  packSizes: any[];
  packagingTypes: string[];
  products: Product[];
  loading: boolean;
  error: string | null;
}

export function useMasterData(params: {
  productType?: string;
  categoryId?: string;
  brandId?: string;
  variant?: string;
  packSizeId?: string;
  packagingType?: string;
} = {}) {
  const [state, setState] = useState<MasterDataState>({
    productTypes: [],
    categories: [],
    brands: [],
    variants: [],
    packSizes: [],
    packagingTypes: [],
    products: [],
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const query = new URLSearchParams();
      if (params.productType) query.append('productType', params.productType);
      if (params.categoryId) query.append('categoryId', params.categoryId);
      if (params.brandId) query.append('brandId', params.brandId);
      if (params.variant) query.append('variant', params.variant);
      if (params.packSizeId) query.append('packSizeId', params.packSizeId);
      if (params.packagingType) query.append('packagingType', params.packagingType);

      const res = await apiGet(`/api/products/cascading?${query.toString()}`);
      if (res.success && res.data) {
        setState({
          productTypes: res.data.productTypes || [],
          categories: res.data.categories || [],
          brands: res.data.brands || [],
          variants: res.data.variants || [],
          packSizes: res.data.packSizes || [],
          packagingTypes: res.data.packagingTypes || [],
          products: res.data.products || [],
          loading: false,
          error: null,
        });
      } else {
        throw new Error(res.error?.message || 'Failed to fetch master data');
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [
    params.productType,
    params.categoryId,
    params.brandId,
    params.variant,
    params.packSizeId,
    params.packagingType,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/categories').then(res => {
      if (res.success) {
        setCategories(res.data || []);
      }
      setLoading(false);
    });
  }, []);

  return { categories, loading };
}

const brandsCache: Record<string, Brand[]> = {};

export function useBrands(categoryId?: string) {
  const cacheKey = categoryId || 'ALL';
  const [brands, setBrands] = useState<Brand[]>(() => brandsCache[cacheKey] || []);
  const [loading, setLoading] = useState(!brandsCache[cacheKey]);

  useEffect(() => {
    let mounted = true;
    if (brandsCache[cacheKey]) {
      setBrands(brandsCache[cacheKey]);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const url = categoryId ? `/api/brands?categoryId=${categoryId}&limit=500` : '/api/brands?limit=500';
    apiGet(url).then(res => {
      if (!mounted) return;
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.items || res.data.brands || [];
        brandsCache[cacheKey] = list;
        setBrands(list);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [categoryId, cacheKey]);

  return { brands, loading };
}

export function useVariants(brandId?: string) {
  const [variants, setVariants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) {
      setVariants([]);
      setLoading(false);
      return;
    }
    apiGet(`/api/products/cascading?brandId=${brandId}`).then(res => {
      if (res.success) {
        setVariants(res.data.variants || []);
      }
      setLoading(false);
    });
  }, [brandId]);

  return { variants, loading };
}

export function useProducts(params: { categoryId?: string; brandId?: string; variant?: string } = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = new URLSearchParams();
    if (params.categoryId) query.append('categoryId', params.categoryId);
    if (params.brandId) query.append('brandId', params.brandId);
    if (params.variant) query.append('variant', params.variant);

    apiGet(`/api/products/cascading?${query.toString()}`).then(res => {
      if (res.success) {
        setProducts(res.data.products || []);
      }
      setLoading(false);
    });
  }, [params.categoryId, params.brandId, params.variant]);

  return { products, loading };
}
