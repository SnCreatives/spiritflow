import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });
try {
  dotenv.config({ path: path.join(__dirname, '.env') });
} catch {}


import express, { Request, Response, NextFunction } from 'express';
import { validateEnvironmentConfig } from '../lib/supabase/config.js';
import { getSupabaseServiceClient, ConfigurationError } from '../lib/supabase/client.js';
import { SetupService } from './services/setupService.js';
import { AuthService } from './services/authService.js';
import { InventoryService } from './services/inventoryService.js';
import { ProductService } from './services/productService.js';
import { MasterService } from './services/masterService.js';
import { BarStoreService } from './services/barStoreService.js';
import { ExciseService } from './services/exciseService.js';
import { MigrationService } from './services/migrationService.js';
import { ImportService } from './services/importService.js';
import { reportService } from './services/reportService.js';
import { ProductMasterService, ALLOWED_PACKAGING_TYPES } from './services/productMasterService.js';
import { ScmService } from './services/scmService.js';
import { SalesService } from './services/salesService.js';
import { DryDayService } from './services/dryDayService.js';
import { ErpReportService } from './services/erpReportService.js';
import { BackupService } from './services/backupService.js';
import { TaxService } from './services/taxService.js';
import { createSessionCookie, clearSessionCookie, extractSessionTokenFromCookie, isSecureRequest } from '../lib/auth/session.js';

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

// Automatically check and apply migrations and canonical Brand Master sync in background on non-serverless runtime
if (!process.env.VERCEL) {
  MigrationService.runMigrations().catch(err => {
    console.log('[Migration] Auto-run status:', err?.message || err);
  });
  MasterService.syncCanonicalBrands().catch(err => {
    console.log('[BrandMaster] Canonical sync status:', err?.message || err);
  });
}

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

    // Validate Bar Access if barId is provided in headers, query, or body
    const barId = (req.headers['x-bar-id'] as string) || (req.query.barId as string) || (req.body.barId as string);
    if (barId && typeof barId === 'string' && barId.trim().length > 0 && barId !== 'ALL_BARS') {
      const cleanBarId = barId.trim();
      let hasAccess = Array.isArray(user.bars) && user.bars.some((b: any) => b.id === cleanBarId);
      if (!hasAccess) {
        const auths = await BarStoreService.getAuthorizations({ barId: cleanBarId, userId: user.id });
        hasAccess = auths.some((a: any) => a.status === 'Active');
      }
      if (!hasAccess) {
        const bar = await BarStoreService.getBarById(cleanBarId);
        if (bar && bar.owner_user_id && bar.owner_user_id === user.id) {
          hasAccess = true;
        }
      }
      
      if (!hasAccess) {
        console.warn(`[AUTH TRACE] ❌ Access denied to bar ${cleanBarId} for user ${user.id}`);
        console.log(`=========================================================================\n`);
        return sendError(res, 'FORBIDDEN', 'You do not have access to this bar.', 403);
      }
      
      (req as any).barId = cleanBarId;
    }

    next();
  } catch (err: any) {
    console.warn(`[AUTH TRACE WARNING] Exception during session validation:`, err?.message);
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
  if (!envCheck.isConfigured && !envCheck.config) {
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
  if (!envCheck.isConfigured && !envCheck.config) {
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
  if (!envCheck.isConfigured && !envCheck.config) {
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
  if (!envCheck.isConfigured && !envCheck.config) {
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
    console.warn(`[/api/login] Login failed for input:`, req.body?.username || req.body?.mobileNumber, `Reason:`, err?.message);
    return sendError(res, 'AUTH_FAILED', err?.message || 'Invalid username or password', 401);
  }
};

apiApp.post('/api/login', handleLogin);
apiApp.post('/login', handleLogin);

/**
 * 5. Logout Endpoint
 */
const handleLogout = async (req: Request, res: Response) => {
  try {
    const headerToken =
      typeof req.headers['x-session-token'] === 'string'
        ? req.headers['x-session-token'].trim()
        : null;
    const bearerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.substring(7).trim()
      : null;
    const cookieToken = extractSessionTokenFromCookie(req.headers.cookie);
    const token = headerToken || bearerToken || cookieToken;

    if (token) {
      await AuthService.logout(token);
    }
  } catch {
    // Ignore db logout errors
  }
  const isSecure = isSecureRequest(req);
  res.setHeader('Set-Cookie', clearSessionCookie(isSecure));
  return sendSuccess(res, { redirect: '/login' });
};

apiApp.post('/api/logout', handleLogout);
apiApp.post('/logout', handleLogout);

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
apiApp.get('/api/dashboard/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const barScope = req.query.barScope as string;
    const barId = (req as any).barId || (req.query.barId as string);

    if (barScope === 'ALL_BARS' || barId === 'ALL_BARS') {
      const authorizedBarIds = (user?.bars || []).map((b: any) => b.id);
      const stats = await InventoryService.getDashboardStats({ authorizedBarIds });
      return sendSuccess(res, stats);
    }

    const stats = await InventoryService.getDashboardStats({ barId });
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
    const barId = (req as any).barId || (req.query.barId as string);
    const items = await InventoryService.getInventoryList({
      barId,
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
    const barId = (req as any).barId || req.body.barId;
    const result = await InventoryService.recordOpeningStock({ ...req.body, barId });
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'OPENING_STOCK_FAILED', err?.message || 'Failed to record opening stock', 400);
  }
});

apiApp.post('/api/inventory/purchases', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || req.body.barId;
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before creating this transaction.', 400);
    }
    const result = await InventoryService.processPurchase({ ...req.body, barId });
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'PURCHASE_FAILED', err?.message || 'Inward purchase transaction failed', 400);
  }
});

const handleGetPurchaseById = async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before viewing this transaction.', 400);
    }
    const purchase = await InventoryService.getPurchaseById(req.params.id, barId);
    if (!purchase) {
      return sendError(res, 'NOT_FOUND', 'Purchase record not found.', 404);
    }
    return sendSuccess(res, { purchase });
  } catch (err: any) {
    return sendError(res, 'PURCHASE_FETCH_FAILED', err?.message || 'Failed to fetch purchase', 500);
  }
};

const handleUpdatePurchase = async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || req.body.barId;
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before updating this transaction.', 400);
    }
    const updated = await InventoryService.updatePurchase(req.params.id, barId, req.body);
    if (!updated) {
      return sendError(res, 'NOT_FOUND', 'Purchase record not found.', 404);
    }
    return sendSuccess(res, { purchase: updated });
  } catch (err: any) {
    return sendError(res, 'PURCHASE_UPDATE_FAILED', err?.message || 'Failed to update purchase', 400);
  }
};

const handleDeletePurchase = async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before deleting this transaction.', 400);
    }
    const deleted = await InventoryService.deletePurchase(req.params.id, barId);
    if (!deleted) {
      return sendError(res, 'NOT_FOUND', 'Purchase record not found.', 404);
    }
    return sendSuccess(res, { success: true });
  } catch (err: any) {
    return sendError(res, 'PURCHASE_DELETE_FAILED', err?.message || 'Failed to delete purchase', 400);
  }
};

apiApp.get('/api/inventory/purchases/:id', requireAuth, handleGetPurchaseById);
apiApp.get('/api/purchases/:id', requireAuth, handleGetPurchaseById);
apiApp.put('/api/inventory/purchases/:id', requireAuth, handleUpdatePurchase);
apiApp.put('/api/purchases/:id', requireAuth, handleUpdatePurchase);
apiApp.delete('/api/inventory/purchases/:id', requireAuth, handleDeletePurchase);
apiApp.delete('/api/purchases/:id', requireAuth, handleDeletePurchase);

apiApp.post('/api/inventory/adjustments', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || req.body.barId;
    const result = await InventoryService.processAdjustment({ ...req.body, barId });
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'ADJUSTMENT_FAILED', err?.message || 'Stock adjustment failed', 400);
  }
});

apiApp.post('/api/inventory/transfers', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await InventoryService.processTransfer(req.body);
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'TRANSFER_FAILED', err?.message || 'Stock transfer failed', 400);
  }
});

apiApp.get('/api/inventory/opening-stock', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    const records = await InventoryService.getOpeningStockRecords({
      barId,
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
    const barId = (req as any).barId || (req.query.barId as string);
    const purchases = await InventoryService.getPurchases({
      barId,
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
    const barId = (req as any).barId || (req.query.barId as string);
    const adjustments = await InventoryService.getAdjustments({
      barId,
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
    const barId = (req as any).barId || (req.query.barId as string);
    const batches = await InventoryService.getBatches({
      barId,
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
    const barId = (req as any).barId || req.body.barId;
    const batch = await InventoryService.createBatch({ ...req.body, barId });
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
    const user = (req as any).user;
    const { productId, limit, barScope } = req.query;
    const barId = (req as any).barId || (req.query.barId as string);

    if (barScope === 'ALL_BARS' || barId === 'ALL_BARS' || !barId) {
      const authorizedBarIds = (user?.bars || []).map((b: any) => b.id);
      const ledger = await InventoryService.getStockLedger(
        authorizedBarIds.length > 0 ? authorizedBarIds : 'ALL_BARS',
        productId as string,
        limit ? parseInt(limit as string, 10) : 100
      );
      return sendSuccess(res, { ledger });
    }

    const ledger = await InventoryService.getStockLedger(
      barId,
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
    const user = (req as any).user;
    const { fromDate, toDate, categoryId, brandId, productId, packSizeId, barScope } = req.query;
    const barId = (req as any).barId || (req.query.barId as string);

    const isAllBars = barScope === 'ALL_BARS' || barId === 'ALL_BARS';
    const barIds = isAllBars ? (user?.bars || []).map((b: any) => b.id) : undefined;

    const report = await reportService.getMlStockReport({
      barId: isAllBars ? undefined : barId,
      barIds,
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
    const user = (req as any).user;
    const { fromDate, toDate, barScope } = req.query;
    const barId = (req as any).barId || (req.query.barId as string);

    const isAllBars = barScope === 'ALL_BARS' || barId === 'ALL_BARS';
    const barIds = isAllBars ? (user?.bars || []).map((b: any) => b.id) : undefined;

    const report = await reportService.getSalesTaxSummary({
      barId: isAllBars ? undefined : barId,
      barIds,
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
    const barId = (req as any).barId || (req.query.barId as string);
    const results = await InventoryService.searchGlobal(q, barId);
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
 * Canonical Cascading Dropdown API (Section 17)
 * Flow: Product Type -> Brand -> Variant -> Bottle Size -> Packaging -> Product -> MRP / SCM Code
 */
apiApp.get('/api/products/cascading', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productType, categoryId, brandId, variant, packSizeId, packagingType } = req.query;
    const data = await ProductMasterService.getCascadingData({
      productType: productType as string,
      categoryId: categoryId as string,
      brandId: brandId as string,
      variant: variant as string,
      packSizeId: packSizeId as string,
      packagingType: packagingType as string,
    });
    return sendSuccess(res, data);
  } catch (err: any) {
    return sendError(res, 'CASCADE_FETCH_FAILED', err?.message || 'Failed to fetch cascading data', 500);
  }
});

/**
 * Filter Validation API (Section 18)
 * Validates combinations against canonical business rules
 */
apiApp.post('/api/products/validate-combination', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId, brandId, packSizeId, variant, packType } = req.body;
    const validation = await ProductMasterService.validateCombination({
      categoryId,
      brandId,
      packSizeId,
      variant,
      packType,
    });
    if (!validation.isValid) {
      return sendError(res, 'INVALID_COMBINATION', validation.error || 'Invalid product combination', 400);
    }
    return sendSuccess(res, { isValid: true });
  } catch (err: any) {
    return sendError(res, 'VALIDATION_FAILED', err?.message || 'Validation error', 400);
  }
});

/**
 * Packaging Types Master
 */
apiApp.get('/api/packaging-types', requireAuth, async (_req: Request, res: Response) => {
  return sendSuccess(res, { packagingTypes: ALLOWED_PACKAGING_TYPES });
});

/**
 * SCM / Maharashtra Excise Regulatory Code Endpoints (Section 10 & 11)
 */
apiApp.get('/api/scm-codes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, productId, activeOnly, limit } = req.query;
    const codes = await ScmService.getScmCodes({
      search: search as string,
      productId: productId as string,
      activeOnly: activeOnly === 'true',
      limit: limit ? parseInt(limit as string, 10) : 100,
    });
    return sendSuccess(res, { scmCodes: codes });
  } catch (err: any) {
    return sendError(res, 'SCM_FETCH_FAILED', err?.message || 'Failed to fetch SCM codes', 500);
  }
});

apiApp.get('/api/scm-codes/product/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const current = await ScmService.getCurrentScmCode(req.params.productId);
    return sendSuccess(res, { scmCode: current });
  } catch (err: any) {
    return sendError(res, 'SCM_FETCH_FAILED', err?.message || 'Failed to fetch current SCM code', 500);
  }
});

apiApp.get('/api/scm-codes/history/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const history = await ScmService.getScmHistory(req.params.productId);
    return sendSuccess(res, { history });
  } catch (err: any) {
    return sendError(res, 'SCM_HISTORY_FETCH_FAILED', err?.message || 'Failed to fetch SCM history', 500);
  }
});

apiApp.post('/api/scm-codes', requireAuth, async (req: Request, res: Response) => {
  try {
    const record = await ScmService.createScmCode(req.body);
    return sendSuccess(res, { scmCode: record }, 201);
  } catch (err: any) {
    return sendError(res, 'SCM_CREATE_FAILED', err?.message || 'Failed to assign SCM code', 400);
  }
});

/**
 * SCM Bulk Import & Export Endpoints
 */
apiApp.post('/api/scm/import-preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return sendError(res, 'INVALID_PAYLOAD', 'Rows array required', 400);
    const result = await ScmService.validateScmImport(rows);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'IMPORT_PREVIEW_FAILED', err?.message || 'Failed to preview SCM import', 400);
  }
});

apiApp.post('/api/scm/import-execute', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    const barId = (req as any).barId;
    if (!Array.isArray(rows)) return sendError(res, 'INVALID_PAYLOAD', 'Rows array required', 400);
    const result = await ScmService.bulkCreateScmCodes(rows, { barId });
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'IMPORT_EXECUTE_FAILED', err?.message || 'Failed to execute SCM import', 400);
  }
});

/**
 * Excel Import Preview / Validation Foundation (Section 19)
 */
apiApp.post('/api/products/import-preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return sendError(res, 'INVALID_PAYLOAD', 'Rows must be an array', 400);
    }
    const result = await ProductMasterService.validateImportBatch(rows);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'IMPORT_PREVIEW_FAILED', err?.message || 'Failed to preview import', 400);
  }
});

/**
 * 13B. Sales Transactions & Closing Stock Endpoints (Bar-Scoped)
 */
apiApp.post('/api/sales', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || req.body.barId;
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before creating this transaction.', 400);
    }
    const result = await SalesService.createSale({ ...req.body, barId });
    return sendSuccess(res, result, 201);
  } catch (err: any) {
    return sendError(res, 'SALE_FAILED', err?.message || 'Failed to create sale transaction', 400);
  }
});

apiApp.get('/api/sales', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar to view sales.', 400);
    }
    const result = await SalesService.getSales({
      barId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'SALES_FETCH_FAILED', err?.message || 'Failed to fetch sales', 500);
  }
});

apiApp.get('/api/sales/closing-stock', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar for closing stock calculation.', 400);
    }
    const result = await SalesService.calculateClosingStock({
      barId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      productId: req.query.productId as string,
    });
    return sendSuccess(res, { closingStock: result });
  } catch (err: any) {
    return sendError(res, 'CLOSING_STOCK_FAILED', err?.message || 'Failed to calculate closing stock', 500);
  }
});

apiApp.get('/api/sales/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before viewing this transaction.', 400);
    }
    const sale = await SalesService.getSaleById(req.params.id, barId);
    if (!sale) {
      return sendError(res, 'NOT_FOUND', 'Sales transaction not found.', 404);
    }
    return sendSuccess(res, { sale });
  } catch (err: any) {
    return sendError(res, 'SALE_FETCH_FAILED', err?.message || 'Failed to fetch sale', 500);
  }
});

apiApp.put('/api/sales/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || req.body.barId;
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before updating this transaction.', 400);
    }
    const updated = await SalesService.updateSale(req.params.id, barId, req.body);
    if (!updated) {
      return sendError(res, 'NOT_FOUND', 'Sales transaction not found.', 404);
    }
    return sendSuccess(res, { sale: updated });
  } catch (err: any) {
    return sendError(res, 'SALE_UPDATE_FAILED', err?.message || 'Failed to update sale', 400);
  }
});

apiApp.delete('/api/sales/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before deleting this transaction.', 400);
    }
    const deleted = await SalesService.deleteSale(req.params.id, barId);
    if (!deleted) {
      return sendError(res, 'NOT_FOUND', 'Sales transaction not found.', 404);
    }
    return sendSuccess(res, { success: true });
  } catch (err: any) {
    return sendError(res, 'SALE_DELETE_FAILED', err?.message || 'Failed to delete sale', 400);
  }
});

/**
 * 13C. Dry Days Management Endpoints (Bar-Scoped & State-Wide)
 */
apiApp.get('/api/dry-days', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    const dryDays = await DryDayService.getDryDays(barId);
    return sendSuccess(res, { dryDays });
  } catch (err: any) {
    return sendError(res, 'DRY_DAYS_FETCH_FAILED', err?.message || 'Failed to fetch dry days', 500);
  }
});

apiApp.post('/api/dry-days', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || req.body.barId;
    const dryDay = await DryDayService.createDryDay({
      barId: barId !== 'ALL_BARS' ? barId : null,
      dryDate: req.body.dryDate,
      reason: req.body.reason,
    });
    return sendSuccess(res, { dryDay }, 201);
  } catch (err: any) {
    return sendError(res, 'DRY_DAY_CREATE_FAILED', err?.message || 'Failed to add dry day', 400);
  }
});

apiApp.delete('/api/dry-days/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    const deleted = await DryDayService.deleteDryDay(req.params.id, barId);
    return sendSuccess(res, { success: deleted });
  } catch (err: any) {
    return sendError(res, 'DRY_DAY_DELETE_FAILED', err?.message || 'Failed to delete dry day', 400);
  }
});

/**
 * 13D. Comprehensive ERP & Excise Reporting Endpoints
 */
apiApp.get('/api/reports/daily-sales', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getDailySalesReport({
      barId,
      date: req.query.date as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to generate report', 500);
  }
});

apiApp.get('/api/reports/monthly', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getMonthlyReport({
      barId,
      month: req.query.month as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to generate report', 500);
  }
});

apiApp.get('/api/reports/excise-log-book', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getExciseLogBook({
      barId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to generate excise log book', 500);
  }
});

apiApp.get('/api/reports/sales-tax', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getSalesTaxReport({
      barId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to generate sales tax report', 500);
  }
});

apiApp.get('/api/reports/received-tp', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getReceivedTpReport({
      barId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to generate received TP report', 500);
  }
});

apiApp.get('/api/reports/available-stock', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getAvailableStockStatus({ barId });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to fetch available stock status', 500);
  }
});

apiApp.get('/api/reports/sales-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getSalesReportSummary({
      barId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to generate sales summary report', 500);
  }
});

apiApp.get('/api/reports/permit-bills', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getPermitBills({
      barId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to generate permit bills report', 500);
  }
});

apiApp.get('/api/reports/stock-value', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || (req.query.barId as string);
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before generating reports.', 400);
    }
    const report = await ErpReportService.getStockValueReport({ barId });
    return sendSuccess(res, report);
  } catch (err: any) {
    return sendError(res, 'REPORT_FAILED', err?.message || 'Failed to generate stock value report', 500);
  }
});

/**
 * 13E. Bar-Scoped Backup & Restore Endpoints
 */
apiApp.post('/api/backup/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || req.body.barId;
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a bar before exporting backup.', 400);
    }
    const user = (req as any).user;
    const backup = await BackupService.exportBackup({
      barId,
      dataType: req.body.dataType,
      userId: user?.id,
    });
    return sendSuccess(res, backup);
  } catch (err: any) {
    return sendError(res, 'BACKUP_EXPORT_FAILED', err?.message || 'Failed to export backup', 500);
  }
});

apiApp.post('/api/backup/restore', requireAuth, async (req: Request, res: Response) => {
  try {
    const barId = (req as any).barId || req.body.barId;
    if (!barId || barId === 'ALL_BARS') {
      return sendError(res, 'BAR_REQUIRED', 'Please select a target bar for restore.', 400);
    }
    const user = (req as any).user;
    const result = await BackupService.restoreBackup(barId, req.body.backupPackage, user?.id);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'BACKUP_RESTORE_FAILED', err?.message || 'Failed to restore backup', 400);
  }
});

/**
 * Canonical Masters Endpoints
 */
apiApp.get('/api/masters/brands', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId, search, limit, page, activeOnly } = req.query;
    if (activeOnly === 'true') {
      const brands = await MasterService.getActiveBrands(categoryId as string);
      return sendSuccess(res, { items: brands, total: brands.length });
    }
    const result = await MasterService.getBrands({
      categoryId: categoryId as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 500,
    });
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'MASTERS_BRANDS_FAILED', err?.message || 'Failed to fetch master brands', 500);
  }
});

apiApp.get('/api/masters/variants', requireAuth, async (req: Request, res: Response) => {
  try {
    const { brandId, categoryId } = req.query;
    const cascade = await ProductMasterService.getCascadingData({
      brandId: brandId as string,
      categoryId: categoryId as string,
    });
    return sendSuccess(res, {
      variants: cascade.variants,
      products: cascade.products,
      totalVariants: cascade.variants.length,
      totalProducts: cascade.products.length,
    });
  } catch (err: any) {
    return sendError(res, 'MASTERS_VARIANTS_FAILED', err?.message || 'Failed to fetch master variants', 500);
  }
});

/**
 * 14. Brands CRUD Endpoints (Protected)
 */
apiApp.get('/api/brands', requireAuth, async (req: Request, res: Response) => {
  try {
    const { search, categoryId, status, page, limit, activeOnly } = req.query;
    
    if (activeOnly === 'true') {
      const brands = await MasterService.getActiveBrands(categoryId as string);
      return sendSuccess(res, { items: brands });
    }

    const result = await MasterService.getBrands({
      search: search as string,
      categoryId: categoryId as string,
      status: status as any,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 500,
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
 * 16. Bar Outlets CRUD Endpoints (Protected)
 */
apiApp.get('/api/bars/public', async (_req: Request, res: Response) => {
  try {
    const bars = await MasterService.getBars();
    return sendSuccess(res, { bars: bars.map(b => ({ id: b.id, name: b.name, code: b.code })) });
  } catch (err: any) {
    return sendError(res, 'BARS_FETCH_FAILED', err?.message || 'Failed to fetch public bars', 500);
  }
});

apiApp.get('/api/bars', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const bars = await MasterService.getBars(user?.id);
    return sendSuccess(res, { bars });
  } catch (err: any) {
    return sendError(res, 'BARS_FETCH_FAILED', err?.message || 'Failed to fetch bars', 500);
  }
});

apiApp.get('/api/bars/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const bar = await MasterService.getBarById(req.params.id);
    if (!bar) {
      return sendError(res, 'BAR_NOT_FOUND', 'Bar outlet not found', 404);
    }
    return sendSuccess(res, bar);
  } catch (err: any) {
    return sendError(res, 'BAR_FETCH_FAILED', err?.message || 'Failed to fetch bar', 500);
  }
});

apiApp.post('/api/bars', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const bar = await MasterService.createBar(req.body, user?.id);
    return sendSuccess(res, bar, 201);
  } catch (err: any) {
    return sendError(res, 'BAR_CREATE_FAILED', err?.message || 'Failed to create bar outlet', 400);
  }
});

apiApp.put('/api/bars/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const bar = await MasterService.updateBar(req.params.id, req.body);
    return sendSuccess(res, bar);
  } catch (err: any) {
    return sendError(res, 'BAR_UPDATE_FAILED', err?.message || 'Failed to update bar outlet', 400);
  }
});

apiApp.patch('/api/bars/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (status !== 'Active' && status !== 'Inactive') {
      return sendError(res, 'INVALID_STATUS', 'Status must be Active or Inactive', 400);
    }
    const bar = await MasterService.toggleBarStatus(req.params.id, status);
    return sendSuccess(res, bar);
  } catch (err: any) {
    return sendError(res, 'STATUS_UPDATE_FAILED', err?.message || 'Failed to update bar status', 400);
  }
});

apiApp.delete('/api/bars/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await MasterService.deleteBar(req.params.id);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'BAR_DELETE_FAILED', err?.message || 'Failed to delete bar outlet', 400);
  }
});

apiApp.get('/api/bars/:id/authorizations', requireAuth, async (req: Request, res: Response) => {
  try {
    const authorizations = await BarStoreService.getAuthorizations({ barId: req.params.id });
    return sendSuccess(res, authorizations);
  } catch (err: any) {
    return sendError(res, 'BAR_AUTH_FETCH_FAILED', err?.message || 'Failed to fetch bar authorizations', 500);
  }
});

apiApp.get('/api/bar-authorizations', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const barId = req.query.barId as string;
    const authorizations = await BarStoreService.getAuthorizations({
      barId: barId || undefined,
      userId: user?.id || undefined,
    });
    return sendSuccess(res, authorizations);
  } catch (err: any) {
    return sendError(res, 'BAR_AUTH_FETCH_FAILED', err?.message || 'Failed to fetch authorizations', 500);
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
