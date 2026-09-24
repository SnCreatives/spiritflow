import { z } from 'zod';

export const CategoryBrandValidationSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  brandId: z.string().uuid('Invalid brand ID'),
  brandCategoryId: z.string().uuid('Invalid brand category ID'),
}).refine(data => data.categoryId === data.brandCategoryId, {
  message: 'Invalid category-brand combination: Brand does not belong to selected category',
  path: ['brandId'],
});

export const CategoryPackSizeValidationSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  packSizeId: z.string().uuid('Invalid pack size ID'),
  packSizeCategoryId: z.string().uuid('Invalid pack size category ID'),
  volumeMl: z.number().optional(),
  packType: z.string().optional(),
}).refine(data => data.categoryId === data.packSizeCategoryId, {
  message: 'Invalid category-pack size combination: Pack size does not belong to selected category',
  path: ['packSizeId'],
}).refine(data => {
  if (data.volumeMl === 500 && data.packType && data.packType.toLowerCase() === 'pint') {
    return false;
  }
  return true;
}, {
  message: 'Invalid pack specification: 500 ml cannot be classified as Pint (500 ml is Can, Pint is 330 ml or 375 ml)',
  path: ['packType'],
});

export const SaleItemValidationSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Sale quantity must be greater than 0'),
  sellingPrice: z.number().min(0, 'Selling price must be non-negative'),
  availableStock: z.number().int().min(0, 'Available stock must be non-negative'),
}).refine(data => data.quantity <= data.availableStock, {
  message: 'Cannot sell more stock than available. Transaction rejected.',
  path: ['quantity'],
});

export const ProductCreateSchema = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').max(255),
  categoryId: z.string().uuid('Valid Category is required'),
  brandId: z.string().uuid('Valid Brand is required'),
  packSizeId: z.string().uuid('Valid Pack Size is required'),
  sku: z.string().trim().max(100).nullable().optional(),
  packType: z.string().trim().max(50).optional(),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative'),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
  mrp: z.number().min(0, 'MRP cannot be negative'),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  complianceRef: z.string().trim().max(100).nullable().optional(),
  openingStock: z.number().int().min(0, 'Opening stock cannot be negative').optional().default(0),
}).refine(data => data.sellingPrice <= data.mrp || data.mrp === 0, {
  message: 'Selling price cannot exceed Maximum Retail Price (MRP)',
  path: ['sellingPrice'],
});

export const ProductUpdateSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  packSizeId: z.string().uuid().optional(),
  sku: z.string().trim().max(100).nullable().optional(),
  packType: z.string().trim().max(50).optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  mrp: z.number().min(0).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  complianceRef: z.string().trim().max(100).nullable().optional(),
});

export const BrandCreateSchema = z.object({
  name: z.string().trim().min(2, 'Brand name must be at least 2 characters').max(255),
  categoryId: z.string().uuid('Valid Category is required'),
  maharashtraStatus: z.string().trim().default('Active'),
  registrationReference: z.string().trim().max(100).nullable().optional(),
  active: z.boolean().default(true),
});

export const BrandUpdateSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  categoryId: z.string().uuid().optional(),
  maharashtraStatus: z.string().trim().optional(),
  registrationReference: z.string().trim().max(100).nullable().optional(),
  active: z.boolean().optional(),
});

export const PackSizeCreateSchema = z.object({
  name: z.string().trim().min(2, 'Pack size name is required').max(100),
  categoryId: z.string().uuid('Category is required'),
  volumeMl: z.number().positive('Volume in ml must be positive'),
  packType: z.string().trim().min(2, 'Pack type is required').max(50),
  active: z.boolean().default(true),
}).refine(data => !(data.volumeMl === 500 && data.packType.toLowerCase() === 'pint'), {
  message: 'Do not create 500 ml Pint: 500 ml in beer/spirits is Can or Bottle. Pints are 330 ml or 375 ml.',
  path: ['packType'],
});

export const PackSizeUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  categoryId: z.string().uuid().optional(),
  volumeMl: z.number().positive().optional(),
  packType: z.string().trim().min(2).max(50).optional(),
  active: z.boolean().optional(),
}).refine(data => {
  if (data.volumeMl === 500 && data.packType && data.packType.toLowerCase() === 'pint') {
    return false;
  }
  return true;
}, {
  message: 'Do not create 500 ml Pint: 500 ml in beer/spirits is Can or Bottle.',
  path: ['packType'],
});
