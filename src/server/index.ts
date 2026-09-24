import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import { validateEnvironmentConfig } from '../lib/supabase/config.ts';
import { getSupabaseServiceClient, ConfigurationError } from '../lib/supabase/client.ts';
import { SetupService } from './services/setupService.ts';
import { AuthService } from './services/authService.ts';
import { InventoryService } from './services/inventoryService.ts';
import { ProductService } from './services/productService.ts';
import { MasterService } from './services/masterService.ts';
import { ExciseService } from './services/exciseService.ts';
import { MigrationService } from './services/migrationService.ts';
import { ImportService } from './services/importService.ts';
import { reportService } from './services/reportService.ts';
import { createSessionCookie, clearSessionCookie, extractSessionTokenFromCookie, isSecureRequest } from '../lib/auth/session.ts';

export const apiApp = express();
apiApp.set('trust proxy', 1);
apiApp.use(express.json());

// URL Normalization Middleware for Vercel Serverless environment
apiApp.use((req: Request, _res: Response, next: NextFunction) => {
  const isApiRequest = req.originalUrl?.startsWith('/api') || req.url?.startsWith('/api');
  if (isApiRequest && req.url && !req.url.startsWith('/api') && !req.url.startsWith('/static')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// Automatically check and apply migrations in background if database credentials present
MigrationService.runMigrations().catch(err => {
  console.log('[Migration] Auto-run status:', err?.message || err);
});

// Helper for unified success responses
function sendSuccess<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data });
}

// Helper for unified failure responses (No stack traces or raw SQL leaked)
function sendError(res: Response, code: string, message: string, status = 400, details?: unknown) {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

/**
 * Authentication Middleware:
 * Validates session token from HTTP-only Cookie, Bearer header, or custom header against sessions database table.
 */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const tokenFromHeader = typeof req.headers['x-session-token'] === 'string'
    ? req.headers['x-session-token'].trim()
    : null;
  const tokenFromBearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.substring(7).trim()
    : null;
  const cookieHeader = req.headers.cookie || '';
  const tokenFromCookie = extractSessionTokenFromCookie(cookieHeader);

  const token = tokenFromHeader || tokenFromBearer || tokenFromCookie;
  const tokenSource = tokenFromHeader ? 'X-SESSION-TOKEN-HEADER' : tokenFromBearer ? 'BEARER-HEADER' : tokenFromCookie ? 'COOKIE' : 'NONE';

  // Cookie stripping diagnosis
  const isCookieStripped = !cookieHeader && (!!tokenFromHeader || !!tokenFromBearer);

  console.log(`\n=================== [AUTH TRACE: ${req.method} ${req.path}] ===================`);
  console.log(`[AUTH TRACE] Raw Cookie Header: "${cookieHeader || 'NONE_PRESENT'}"`);
  console.log(`[AUTH TRACE] Cookie Token ('liquorflow_session'): ${tokenFromCookie ? tokenFromCookie.substring(0, 8) + '...' : 'NOT_PARSED'}`);
  console.log(`[AUTH TRACE] Header Token ('x-session-token'): ${tokenFromHeader ? tokenFromHeader.substring(0, 8) + '...' : 'NOT_PRESENT'}`);
  console.log(`[AUTH TRACE] Selected Token Source: ${tokenSource}`);
  if (isCookieStripped) {
    console.warn(`[AUTH TRACE DIAGNOSTIC] ⚠️ Browser Cookie Stripping Detected! Browser omitted Cookie header in iframe context, falling back to header token.`);
  }

  if (!token) {
    console.warn(`[AUTH TRACE RESULT] ❌ Unauthenticated request to ${req.path} - No token found in Cookie or Headers.`);
    console.log(`=========================================================================\n`);
    return sendError(res, 'UNAUTHENTICATED', 'Authentication required', 401);
  }

  try {
    const user = await AuthService.validateSession(token);
    if (!user) {
      console.warn(`[AUTH TRACE RESULT] ❌ Database lookup failed for token (${token.substring(0, 8)}...). Session invalid or expired in 'sessions' table.`);
      const isSecure = isSecureRequest(req);
      res.setHeader('Set-Cookie', clearSessionCookie(isSecure));
      console.log(`=========================================================================\n`);
      return sendError(res, 'SESSION_EXPIRED', 'Authentication required', 401);
    }
    console.log(`[AUTH TRACE RESULT] ✅ Session verified successfully! User: ${user.mobile_number} (${user.business_name})`);
    console.log(`=========================================================================\n`);
    (req as any).user = user;
    next();
  } catch (err: any) {
    console.error(`[AUTH TRACE ERROR] Exception during session validation:`, err?.message);
    console.log(`=========================================================================\n`);
    return sendError(res, 'AUTH_ERROR', err?.message || 'Authentication error', 500);
  }
}

/**
 * 1. Health Check Endpoint
 * Requirement 29: Verifies application availability and database connectivity.
 */
apiApp.get('/api/health', async (_req: Request, res: Response) => {
  const envCheck = validateEnvironmentConfig();
  if (!envCheck.isConfigured) {
    return sendError(
      res,
      'MISSING_ENV_CONFIGURATION',
      'Required Supabase environment variables are missing or incomplete in .env.',
      503,
      { missing: envCheck.missingVariables }
    );
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from('application_setup').select('id').limit(1);

    if (error && error.code !== '42P01') {
      return sendError(res, 'DB_UNREACHABLE', 'Database connection failed', 503);
    }

    return sendSuccess(res, {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (err: any) {
    return sendError(res, 'HEALTH_CHECK_FAILED', err?.message || 'Service unavailable', 503);
  }
});

/**
 * 2. Setup Status Endpoint
 * Determine whether setup is required or already completed.
 */
apiApp.get('/api/setup/status', async (_req: Request, res: Response) => {
  const envCheck = validateEnvironmentConfig();
  if (!envCheck.isConfigured) {
    return sendError(
      res,
      'MISSING_ENV_CONFIGURATION',
      'Database credentials not configured in .env',
      503,
      { missing: envCheck.missingVariables }
    );
  }

  try {
    const status = await SetupService.getSetupStatus();
    return sendSuccess(res, status);
  } catch (err: any) {
    if (err instanceof ConfigurationError) {
      return sendError(res, 'MISSING_ENV_CONFIGURATION', err.message, 503, { missing: err.missingVariables });
    }
    return sendError(res, 'SETUP_STATUS_ERROR', err?.message || 'Failed to check setup status', 500);
  }
});

/**
 * 3. Atomic Setup Endpoint
 * Requirement 4, 5, 6, 7: Executes atomic setup.
 */
apiApp.post('/api/setup', async (req: Request, res: Response) => {
  const envCheck = validateEnvironmentConfig();
  if (!envCheck.isConfigured) {
    return sendError(
      res,
      'MISSING_ENV_CONFIGURATION',
      'Cannot execute setup: Missing database credentials in .env',
      503,
      { missing: envCheck.missingVariables }
    );
  }

  try {
    const result = await SetupService.executeSetup(req.body);
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'SETUP_FAILED', err?.message || 'Failed to complete setup', 400);
  }
});

/**
 * 4. Login Endpoint
 * Requirement 10: Authenticates against database owner credentials or env credentials.
 */
const handleLogin = async (req: Request, res: Response) => {
  const envCheck = validateEnvironmentConfig();
  if (!envCheck.isConfigured) {
    return sendError(res, 'MISSING_ENV_CONFIGURATION', 'Database configuration missing in .env', 503);
  }

  try {
    const { sessionToken, user } = await AuthService.authenticate(req.body);
    const isSecure = isSecureRequest(req);
    const cookieHeaderVal = createSessionCookie(sessionToken, isSecure);
    
    res.setHeader('Set-Cookie', cookieHeaderVal);

    console.log(`[/api/login] Login successful for user: ${user.mobile_number}`);
    console.log(`[/api/login] Set-Cookie ('liquorflow_session') generated with Path=/: ${cookieHeaderVal.replace(sessionToken, sessionToken.substring(0, 8) + '...')}`);

    return sendSuccess(res, { redirect: '/dashboard', user, sessionToken });
  } catch (err: any) {
    console.error(`[/api/login] Login failed for input:`, req.body?.username || req.body?.mobileNumber, `Error:`, err?.message);
    return sendError(res, 'AUTH_FAILED', err?.message || 'Invalid username or password', 401);
  }
};

apiApp.post('/api/login', handleLogin);
apiApp.post('/login', handleLogin);

/**
 * 5. Logout Endpoint
 */
apiApp.post('/api/logout', async (req: Request, res: Response) => {
  try {
    const token =
      extractSessionTokenFromCookie(req.headers.cookie) ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7).trim()
        : null);

    if (token) {
      await AuthService.logout(token);
    }
  } catch {
    // Ignore db logout errors
  }
  const isSecure = isSecureRequest(req);
  res.setHeader('Set-Cookie', clearSessionCookie(isSecure));
  return sendSuccess(res, { redirect: '/login' });
});

/**
 * 6. Current User & Business Info Endpoint (Protected)
 */
apiApp.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  const cookieHeader = req.headers.cookie;
  const cookieToken = extractSessionTokenFromCookie(cookieHeader);
  const headerToken = typeof req.headers['x-session-token'] === 'string' ? req.headers['x-session-token'] : null;
  const user = (req as any).user;

  console.log(`[/api/auth/me Response] Cookie Header: "${cookieHeader || 'NONE'}"`);
  console.log(`[/api/auth/me Response] Parsed Cookie Token: ${cookieToken ? cookieToken.substring(0, 8) + '...' : 'NOT_PARSED'}`);
  console.log(`[/api/auth/me Response] Header Fallback Token: ${headerToken ? headerToken.substring(0, 8) + '...' : 'NOT_PRESENT'}`);
  console.log(`[/api/auth/me Response] Verified Session User: ID=${user?.id}, Mobile=${user?.mobile_number}, Business=${user?.business_name}`);

  return sendSuccess(res, { user });
});

/**
 * 7. Live Dashboard KPIs (Protected)
 */
apiApp.get('/api/dashboard/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await InventoryService.getDashboardStats();
    return sendSuccess(res, stats);
  } catch (err: any) {
    return sendError(res, 'DASHBOARD_ERROR', err?.message || 'Failed to fetch dashboard metrics', 500);
  }
});

/**
 * 8. Category -> Brand Validation (Test 9) (Protected)
 */
apiApp.post('/api/validate/category-brand', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId, brandId } = req.body;
    if (!categoryId || !brandId) {
      return sendError(res, 'INVALID_INPUT', 'categoryId and brandId are required');
    }
    await InventoryService.validateBrandCategory(categoryId, brandId);
    return sendSuccess(res, { valid: true });
  } catch (err: any) {
    return sendError(res, 'INVALID_CATEGORY_BRAND', err?.message || 'Brand does not belong to selected category', 400);
  }
});

/**
 * 9. Inventory Stock Management (Stock Listing, Inward, Adjustment, Ledger) (Protected)
 */
apiApp.get('/api/inventory', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, categoryId, lowStockOnly } = req.query;
    const items = await InventoryService.getInventoryList({
      search: search as string,
      categoryId: categoryId as string,
      lowStockOnly: lowStockOnly === 'true',
    });
    return sendSuccess(res, { items });
  } catch (err: any) {
    return sendError(res, 'INVENTORY_FETCH_FAILED', err?.message || 'Failed to fetch inventory', 500);
  }
});

apiApp.post('/api/inventory/opening-stock', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await InventoryService.recordOpeningStock(req.body);
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'OPENING_STOCK_FAILED', err?.message || 'Failed to record opening stock', 400);
  }
});

apiApp.post('/api/inventory/purchases', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await InventoryService.processPurchase(req.body);
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'PURCHASE_FAILED', err?.message || 'Inward purchase transaction failed', 400);
  }
});

apiApp.post('/api/inventory/adjustments', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await InventoryService.processAdjustment(req.body);
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'ADJUSTMENT_FAILED', err?.message || 'Stock adjustment failed', 400);
  }
});

apiApp.get('/api/inventory/opening-stock', requireAuth, async (req: Request, res: Response) => {
  try {
    const records = await InventoryService.getOpeningStockRecords({
      productId: req.query.productId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });
    return sendSuccess(res, { records });
  } catch (err: any) {
    return sendError(res, 'OPENING_RECORDS_FETCH_FAILED', err?.message || 'Failed to fetch opening records', 500);
  }
});

apiApp.get('/api/inventory/purchases', requireAuth, async (req: Request, res: Response) => {
  try {
    const purchases = await InventoryService.getPurchases({
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    });
    return sendSuccess(res, { purchases });
  } catch (err: any) {
    return sendError(res, 'PURCHASES_FETCH_FAILED', err?.message || 'Failed to fetch purchases', 500);
  }
});

apiApp.get('/api/inventory/adjustments', requireAuth, async (req: Request, res: Response) => {
  try {
    const adjustments = await InventoryService.getAdjustments({
      search: req.query.search as string,
      adjustmentType: req.query.adjustmentType as string,
      productId: req.query.productId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    });
    return sendSuccess(res, { adjustments });
  } catch (err: any) {
    return sendError(res, 'ADJUSTMENTS_FETCH_FAILED', err?.message || 'Failed to fetch adjustments', 500);
  }
});

apiApp.get('/api/batches', requireAuth, async (req: Request, res: Response) => {
  try {
    const batches = await InventoryService.getBatches({
      search: req.query.search as string,
      productId: req.query.productId as string,
    });
    return sendSuccess(res, { batches });
  } catch (err: any) {
    return sendError(res, 'BATCHES_FETCH_FAILED', err?.message || 'Failed to fetch batches', 500);
  }
});

apiApp.post('/api/batches', requireAuth, async (req: Request, res: Response) => {
  try {
    const batch = await InventoryService.createBatch(req.body);
    return sendSuccess(res, batch, 201);
  } catch (err: any) {
    return sendError(res, 'BATCH_CREATE_FAILED', err?.message || 'Failed to create batch', 400);
  }
});

apiApp.get('/api/settings', requireAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await InventoryService.getSettings();
    return sendSuccess(res, settings);
  } catch (err: any) {
    return sendError(res, 'SETTINGS_FETCH_FAILED', err?.message || 'Failed to fetch settings', 500);
  }
});

apiApp.put('/api/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await InventoryService.updateSettings(req.body);
    return sendSuccess(res, settings);
  } catch (err: any) {
    return sendError(res, 'SETTINGS_UPDATE_FAILED', err?.message || 'Failed to update settings', 400);
  }
});

apiApp.get('/api/inventory/ledger', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId, limit } = req.query;
    const ledger = await InventoryService.getStockLedger(
      productId as string,
      limit ? parseInt(limit as string, 10) : 50
    );
    return sendSuccess(res, { ledger });
  } catch (err: any) {
    return sendError(res, 'LEDGER_FETCH_FAILED', err?.message || 'Failed to fetch stock ledger', 500);
  }
});

/**
 * Report Endpoints (Protected)
 */
apiApp.get('/api/reports/ml-stock', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate, categoryId, brandId, productId, packSizeId } = req.query;
    const report = await reportService.getMlStockReport({
      fromDate: fromDate as string,
      toDate: toDate as string,
      categoryId: categoryId as string,
      brandId: brandId as string,
      productId: productId as string,
      packSizeId: packSizeId as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'ML_STOCK_REPORT_FAILED', err?.message || 'Failed to generate ML-wise stock report', 500);
  }
});

apiApp.get('/api/reports/sales-tax', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate } = req.query;
    const report = await reportService.getSalesTaxSummary({
      fromDate: fromDate as string,
      toDate: toDate as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'SALES_TAX_REPORT_FAILED', err?.message || 'Failed to generate Sales Tax Summary report', 500);
  }
});

apiApp.get('/api/excise/monthly-return', requireAuth, async (req: Request, res: Response) => {
  try {
    const month = req.query.month ? parseInt(req.query.month as string, 10) : new Date().getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
    const report = await reportService.getMonthlyForeignLiquorReturn(month, year);
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'MONTHLY_RETURN_FAILED', err?.message || 'Failed to generate Monthly Foreign Liquor Return', 500);
  }
});

/**
 * Excise Management Endpoints (Protected)
 */
apiApp.get('/api/excise/licences', requireAuth, async (req: Request, res: Response) => {
  try {
    const licences = await ExciseService.getLicences(req.query.status as string);
    return sendSuccess(res, { licences });
  } catch (err: any) {
    return sendError(res, 'LICENCES_FETCH_FAILED', err?.message || 'Failed to fetch excise licences', 500);
  }
});

apiApp.post('/api/excise/licences', requireAuth, async (req: Request, res: Response) => {
  try {
    const licence = await ExciseService.createLicence(req.body);
    return sendSuccess(res, licence, 201);
  } catch (err: any) {
    return sendError(res, 'LICENCE_CREATE_FAILED', err?.message || 'Failed to create excise licence', 400);
  }
});

apiApp.put('/api/excise/licences/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const licence = await ExciseService.updateLicence(req.params.id, req.body);
    return sendSuccess(res, licence);
  } catch (err: any) {
    return sendError(res, 'LICENCE_UPDATE_FAILED', err?.message || 'Failed to update excise licence', 400);
  }
});

apiApp.get('/api/excise/documents', requireAuth, async (req: Request, res: Response) => {
  try {
    const documents = await ExciseService.getDocumentReferences({
      referenceType: req.query.referenceType as string,
      search: req.query.search as string,
    });
    return sendSuccess(res, { documents });
  } catch (err: any) {
    return sendError(res, 'EXCISE_DOCS_FETCH_FAILED', err?.message || 'Failed to fetch excise documents', 500);
  }
});

apiApp.post('/api/excise/documents', requireAuth, async (req: Request, res: Response) => {
  try {
    const doc = await ExciseService.createDocumentReference(req.body);
    return sendSuccess(res, doc, 201);
  } catch (err: any) {
    return sendError(res, 'EXCISE_DOC_CREATE_FAILED', err?.message || 'Failed to create excise document reference', 400);
  }
});

/**
 * Database Migration & Schema Verification Endpoints
 */
apiApp.get('/api/migrations/status', async (_req: Request, res: Response) => {
  try {
    const report = await MigrationService.verifySchemaIntegrity();
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'MIGRATION_STATUS_FAILED', err?.message || 'Status check failed', 500);
  }
});

apiApp.post('/api/migrations/run', async (_req: Request, res: Response) => {
  try {
    const result = await MigrationService.runMigrations();
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'MIGRATION_RUN_FAILED', err?.message || 'Migration run failed', 500);
  }
});

apiApp.get('/api/database/verify', async (_req: Request, res: Response) => {
  try {
    const report = await MigrationService.verifySchemaIntegrity();
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'SCHEMA_VERIFY_FAILED', err?.message || 'Verification failed', 500);
  }
});

/**
 * 10. Global Search (Requirement 23) (Protected)
 */
apiApp.get('/api/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const results = await InventoryService.searchGlobal(q);
    return sendSuccess(res, { results });
  } catch (err: any) {
    return sendError(res, 'SEARCH_FAILED', err?.message || 'Search failed', 500);
  }
});

/**
 * 11. Categories List (Protected)
 */
apiApp.get('/api/categories', requireAuth, async (_req: Request, res: Response) => {
  try {
    const categories = await MasterService.getCategories();
    return sendSuccess(res, categories);
  } catch (err: any) {
    return sendError(res, 'FETCH_FAILED', err?.message || 'Failed to fetch categories', 500);
  }
});

/**
 * 12. Category -> Pack Size Validation (Protected)
 */
apiApp.post('/api/validate/category-pack-size', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId, packSizeId } = req.body;
    if (!categoryId || !packSizeId) {
      return sendError(res, 'INVALID_INPUT', 'categoryId and packSizeId are required');
    }
    const supabase = getSupabaseServiceClient();
    const { data: ps, error } = await supabase
      .from('pack_sizes')
      .select('id, category_id, name, volume_ml, pack_type')
      .eq('id', packSizeId)
      .maybeSingle();

    if (error || !ps) {
      return sendError(res, 'PACK_SIZE_NOT_FOUND', 'Pack size not found', 404);
    }

    if (ps.category_id !== categoryId) {
      return sendError(res, 'INVALID_CATEGORY_PACK_SIZE', 'Pack size does not belong to selected category', 400);
    }

    if (ps.volume_ml === 500 && ps.pack_type?.toLowerCase() === 'pint') {
      return sendError(res, 'INVALID_PACK_TYPE', '500 ml cannot be classified as Pint', 400);
    }

    return sendSuccess(res, { valid: true });
  } catch (err: any) {
    return sendError(res, 'VALIDATION_FAILED', err?.message || 'Validation failed', 400);
  }
});

/**
 * 13. Products CRUD Endpoints (Protected)
 */
apiApp.get('/api/products/selection', requireAuth, async (req: Request, res: Response) => {
  try {
    const items = await ProductService.getActiveProductsForSelection();
    return sendSuccess(res, { items });
  } catch (err: any) {
    return sendError(res, 'PRODUCTS_SELECTION_FAILED', err?.message || 'Failed to fetch product selection list', 500);
  }
});

apiApp.get('/api/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, categoryId, brandId, status, page, limit } = req.query;
    const result = await ProductService.getProducts({
      search: search as string,
      categoryId: categoryId as string,
      brandId: brandId as string,
      status: status as any,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'PRODUCTS_FETCH_FAILED', err?.message || 'Failed to fetch products', 500);
  }
});

apiApp.get('/api/products/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const product = await ProductService.getProductById(req.params.id);
    if (!product) {
      return sendError(res, 'PRODUCT_NOT_FOUND', 'Product not found', 404);
    }
    return sendSuccess(res, product);
  } catch (err: any) {
    return sendError(res, 'PRODUCT_FETCH_FAILED', err?.message || 'Failed to fetch product', 500);
  }
});

apiApp.post('/api/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const product = await ProductService.createProduct(req.body);
    return sendSuccess(res, product, 201);
  } catch (err: any) {
    return sendError(res, 'PRODUCT_CREATE_FAILED', err?.message || 'Failed to create product', 400);
  }
});

apiApp.put('/api/products/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const product = await ProductService.updateProduct(req.params.id, req.body);
    return sendSuccess(res, product);
  } catch (err: any) {
    return sendError(res, 'PRODUCT_UPDATE_FAILED', err?.message || 'Failed to update product', 400);
  }
});

apiApp.patch('/api/products/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (status !== 'Active' && status !== 'Inactive') {
      return sendError(res, 'INVALID_STATUS', 'Status must be Active or Inactive', 400);
    }
    const product = await ProductService.toggleProductStatus(req.params.id, status);
    return sendSuccess(res, product);
  } catch (err: any) {
    return sendError(res, 'STATUS_UPDATE_FAILED', err?.message || 'Failed to update status', 400);
  }
});

apiApp.delete('/api/products/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await ProductService.deleteProduct(req.params.id);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'PRODUCT_DELETE_FAILED', err?.message || 'Cannot delete product', 400);
  }
});

/**
 * 14. Brands CRUD Endpoints (Protected)
 */
apiApp.get('/api/brands', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, categoryId, status, page, limit, activeOnly } = req.query;
    
    if (activeOnly === 'true') {
      const brands = await MasterService.getActiveBrands();
      return sendSuccess(res, { items: brands });
    }

    const result = await MasterService.getBrands({
      search: search as string,
      categoryId: categoryId as string,
      status: status as any,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'BRANDS_FETCH_FAILED', err?.message || 'Failed to fetch brands', 500);
  }
});

apiApp.post('/api/brands', requireAuth, async (req: Request, res: Response) => {
  try {
    const brand = await MasterService.createBrand(req.body);
    return sendSuccess(res, brand, 201);
  } catch (err: any) {
    return sendError(res, 'BRAND_CREATE_FAILED', err?.message || 'Failed to create brand', 400);
  }
});

apiApp.put('/api/brands/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const brand = await MasterService.updateBrand(req.params.id, req.body);
    return sendSuccess(res, brand);
  } catch (err: any) {
    return sendError(res, 'BRAND_UPDATE_FAILED', err?.message || 'Failed to update brand', 400);
  }
});

apiApp.patch('/api/brands/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { active } = req.body;
    const brand = await MasterService.toggleBrandStatus(req.params.id, Boolean(active));
    return sendSuccess(res, brand);
  } catch (err: any) {
    return sendError(res, 'STATUS_UPDATE_FAILED', err?.message || 'Failed to update brand status', 400);
  }
});

/**
 * 15. Pack Sizes CRUD Endpoints (Protected)
 */
apiApp.get('/api/pack-sizes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, categoryId, status, page, limit } = req.query;
    const result = await MasterService.getPackSizes({
      search: search as string,
      categoryId: categoryId as string,
      status: status as any,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'PACK_SIZES_FETCH_FAILED', err?.message || 'Failed to fetch pack sizes', 500);
  }
});

apiApp.post('/api/pack-sizes', requireAuth, async (req: Request, res: Response) => {
  try {
    const packSize = await MasterService.createPackSize(req.body);
    return sendSuccess(res, packSize, 201);
  } catch (err: any) {
    return sendError(res, 'PACK_SIZE_CREATE_FAILED', err?.message || 'Failed to create pack size', 400);
  }
});

apiApp.put('/api/pack-sizes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const packSize = await MasterService.updatePackSize(req.params.id, req.body);
    return sendSuccess(res, packSize);
  } catch (err: any) {
    return sendError(res, 'PACK_SIZE_UPDATE_FAILED', err?.message || 'Failed to update pack size', 400);
  }
});

apiApp.patch('/api/pack-sizes/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { active } = req.body;
    const packSize = await MasterService.togglePackSizeStatus(req.params.id, Boolean(active));
    return sendSuccess(res, packSize);
  } catch (err: any) {
    return sendError(res, 'STATUS_UPDATE_FAILED', err?.message || 'Failed to update pack size status', 400);
  }
});

/**
 * 17. Advanced Import System Endpoints
 */
apiApp.get('/api/import/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const history = await ImportService.getImportHistory(req.query.module as string);
    return sendSuccess(res, { history });
  } catch (err: any) {
    return sendError(res, 'IMPORT_HISTORY_FAILED', err?.message || 'Failed to fetch import history', 500);
  }
});

apiApp.get('/api/import/batches/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const details = await ImportService.getBatchDetails(req.params.id);
    return sendSuccess(res, details);
  } catch (err: any) {
    return sendError(res, 'BATCH_FETCH_FAILED', err?.message || 'Failed to fetch batch details', 500);
  }
});

apiApp.post('/api/import/init', requireAuth, async (req: Request, res: Response) => {
  try {
    const batchId = await ImportService.createBatch(req.body);
    return sendSuccess(res, { batchId }, 201);
  } catch (err: any) {
    return sendError(res, 'IMPORT_INIT_FAILED', err?.message || 'Failed to initialize import batch', 400);
  }
});

apiApp.post('/api/import/rollback/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await ImportService.rollbackBatch(req.params.id);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'ROLLBACK_FAILED', err?.message || 'Rollback failed', 400);
  }
});

apiApp.post('/api/import/execute', requireAuth, async (req: Request, res: Response) => {
  const { batchId, module, items } = req.body;
  if (!batchId || !module || !items || !Array.isArray(items)) {
    return sendError(res, 'INVALID_INPUT', 'batchId, module, and items array are required');
  }

  try {
    const result = await ImportService.executeBatch(batchId, module, items);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'IMPORT_EXECUTION_FAILED', err?.message || 'Bulk import execution failed', 400);
  }
});

// 404 Fallback handler for unmatched API endpoints
apiApp.use((req: Request, res: Response, next: NextFunction) => {
  const isApiRequest = req.originalUrl?.startsWith('/api') || req.url?.startsWith('/api');
  if (isApiRequest) {
    sendError(res, 'NOT_FOUND', `API endpoint not found: ${req.method} ${req.url}`, 404);
  } else {
    next();
  }
});

// Global error handler middleware
apiApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[UNCAUGHT SERVER ERROR]', err);
  sendError(res, 'SERVER_ERROR', err?.message || 'An unexpected server error occurred', err?.status || 500);
});
