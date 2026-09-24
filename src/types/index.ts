/**
 * LiquorFlow - Core Types & Database Interfaces
 */

export type SupportedLanguage = 'mr' | 'hi' | 'en';

export interface ApplicationSetup {
  id: string;
  setup_completed: boolean;
  setup_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerCredentials {
  id: string;
  mobile_number: string;
  password_hash: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  session_token: string;
  owner_id: string;
  expires_at: string;
  created_at: string;
  last_accessed_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  address: string;
  owner_mobile: string;
  vat_number: string | null;
  licence_reference: string | null;
  currency: string;
  timezone: string;
  date_format: string;
  selected_language: SupportedLanguage;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
}

export interface PackSize {
  id: string;
  category_id: string;
  name: string;
  volume_ml: number;
  pack_type: 'Bottle' | 'Can' | 'Pint' | string;
  active: boolean;
  created_at: string;
  category?: Category;
}

export interface Brand {
  id: string;
  name: string;
  category_id: string;
  maharashtra_status: string;
  registration_reference: string | null;
  registration_ref?: string | null;
  active: boolean;
  created_at: string;
  category?: Category;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  brand_id: string;
  pack_size_id: string;
  sku: string | null;
  pack_type: string;
  purchase_price: number;
  selling_price: number;
  mrp: number;
  status: 'Active' | 'Inactive';
  compliance_ref: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  brand?: Brand;
  pack_size?: PackSize;
  inventory?: {
    current_stock: number;
    opening_stock?: number;
    minimum_stock?: number;
  };
}

export interface Customer {
  id: string;
  name: string;
  mobile: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  inward_number: string;
  purchase_date: string;
  tp_permit_ref: string | null;
  total_amount: number;
  remarks: string | null;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  batch_id?: string | null;
  quantity: number;
  purchase_tp_price?: number;
  purchase_price?: number;
  total_value?: number;
  total?: number;
  product?: Product;
}

export interface Batch {
  id: string;
  product_id: string;
  batch_number: string;
  batch_date: string;
  quantity: number;
  purchase_tp_value: number;
  mrp_reference: number;
  excise_reference?: string | null;
  document_reference?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  adjustment_date: string;
  product_id: string;
  batch_id?: string | null;
  adjustment_type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN_IN' | 'RETURN_OUT' | 'CORRECTION';
  quantity: number;
  reference?: string | null;
  reason?: string | null;
  remarks?: string | null;
  created_at: string;
  product?: Product;
  batch?: Batch;
}

export interface ExciseLicence {
  id: string;
  licence_type: string;
  licence_number: string;
  issue_date?: string | null;
  valid_from: string;
  valid_to: string;
  issuing_authority: string;
  business_reference?: string | null;
  document_reference?: string | null;
  status: 'Active' | 'Expired' | 'Suspended';
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExciseDocumentReference {
  id: string;
  reference_type: 'TP_PERMIT' | 'TRANSPORT' | 'INWARD' | 'LICENCE' | 'EXCISE_DOCUMENT' | 'OTHER';
  reference_number: string;
  reference_date: string;
  product_id?: string | null;
  batch_id?: string | null;
  purchase_id?: string | null;
  quantity?: number | null;
  document_reference?: string | null;
  remarks?: string | null;
  created_at: string;
  product?: Product;
}

export interface ComplianceReference {
  id: string;
  reference_type: string;
  reference_number: string;
  brand_id?: string | null;
  product_id?: string | null;
  batch_id?: string | null;
  excise_document_id?: string | null;
  details?: Record<string, any> | null;
  created_at: string;
}

export interface InventoryRecord {
  id: string;
  product_id: string;
  opening_quantity: number;
  purchased_quantity: number;
  adjustment_quantity: number;
  returned_quantity: number;
  current_quantity: number;
  stock_value: number;
  updated_at: string;
  // Aliases for compatibility
  opening_stock?: number;
  current_stock?: number;
  adjustments?: number;
  product?: Product;
}

export type StockTransactionType =
  | 'OPENING'
  | 'PURCHASE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'CORRECTION'
  | 'Opening'
  | 'Purchase'
  | 'Adjustment'
  | 'Return'
  | 'Correction';

export interface StockLedgerRecord {
  id: string;
  product_id: string;
  transaction_date?: string;
  date?: string;
  transaction_type: StockTransactionType;
  reference_id?: string | null;
  reference_number?: string | null;
  reference?: string | null;
  stock_in: number;
  stock_out: number;
  balance: number;
  remarks: string | null;
  created_at: string;
  product?: Product;
}

// API Response Standard
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Setup Input / Output
export interface SetupInput {
  businessName: string;
  address: string;
  ownerMobile: string;
  vatNumber?: string;
  licenceReference?: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
  language: 'mr' | 'hi';
}

// Login Input / Output
export interface LoginInput {
  mobileNumber: string;
  password: string;
}

export interface AuthUser {
  id: string;
  mobile_number: string;
  business_name: string;
  selected_language: SupportedLanguage;
}

// Pagination Interface
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export type PaginationMeta = PaginationMetadata;

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMetadata;
}

// Product Management DTOs
export interface CreateProductInput {
  name: string;
  categoryId: string;
  brandId: string;
  packSizeId: string;
  sku?: string | null;
  packType?: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  status: 'Active' | 'Inactive';
  complianceRef?: string | null;
  openingStock?: number;
  import_batch_id?: string;
}

export interface UpdateProductInput {
  name?: string;
  categoryId?: string;
  brandId?: string;
  packSizeId?: string;
  sku?: string | null;
  packType?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  mrp?: number;
  status?: 'Active' | 'Inactive';
  complianceRef?: string | null;
}

export interface ProductFilterParams {
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: 'All' | 'Active' | 'Inactive';
  page?: number;
  limit?: number;
}

// Brand Management DTOs
export interface CreateBrandInput {
  name: string;
  categoryId: string;
  maharashtraStatus?: string;
  registrationReference?: string | null;
  active?: boolean;
}

export interface UpdateBrandInput {
  name?: string;
  categoryId?: string;
  maharashtraStatus?: string;
  registrationReference?: string | null;
  active?: boolean;
}

export interface BrandFilterParams {
  search?: string;
  categoryId?: string;
  status?: 'All' | 'Active' | 'Inactive';
  page?: number;
  limit?: number;
}

// Pack Size Management DTOs
export interface CreatePackSizeInput {
  name: string;
  categoryId: string;
  volumeMl: number;
  packType: string;
  active?: boolean;
}

export interface UpdatePackSizeInput {
  name?: string;
  categoryId?: string;
  volumeMl?: number;
  packType?: string;
  active?: boolean;
}

export interface PackSizeFilterParams {
  search?: string;
  categoryId?: string;
  status?: 'All' | 'Active' | 'Inactive';
  page?: number;
  limit?: number;
}

// Dashboard Summary Type (Inventory & Excise Only)
export interface DashboardStats {
  todaysPurchases: number;
  currentStockUnits: number;
  stockValuation: number;
  totalProducts: number;
  lowStockCount: number;
  activeLicencesCount?: number;
  categoryStock: {
    categoryName: string;
    count: number;
    units: number;
    valuation: number;
  }[];
  recentTransactions: StockLedgerRecord[];
}
