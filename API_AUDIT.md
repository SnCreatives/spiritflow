# SpiritFlow / LiquorFlow ERP - API Audit Report

Complete inventory of Express backend API routes, methods, authentication requirements, and statuses:

| Method | Endpoint | Auth Required | Description | Status |
|---|---|---|---|---|
| GET | `/api/health` | No | System health and database connectivity check | PASS |
| GET | `/api/setup/status` | No | Check if establishment setup is completed | PASS |
| POST | `/api/setup` | No | Execute atomic establishment and admin setup | PASS |
| POST | `/api/login` | No | Authenticate user session and set secure cookie | PASS |
| POST | `/api/logout` | Yes | Terminate session and clear cookie | PASS |
| GET | `/api/auth/me` | Yes | Retrieve current authenticated user profile | PASS |
| GET | `/api/dashboard/stats` | Yes | Retrieve live dashboard metrics and stock KPIs | PASS |
| POST | `/api/validate/category-brand` | Yes | Validate brand belongs to selected category | PASS |
| POST | `/api/validate/category-pack-size` | Yes | Validate pack size belongs to category | PASS |
| GET | `/api/inventory` | Yes | List inventory items with filters & low stock | PASS |
| POST | `/api/inventory/opening-stock` | Yes | Record opening stock for product | PASS |
| POST | `/api/inventory/purchases` | Yes | Process inward purchase & update stock ledger | PASS |
| POST | `/api/inventory/adjustments` | Yes | Record stock adjustments (damage/surplus) | PASS |
| GET | `/api/inventory/opening-stock` | Yes | List opening stock records | PASS |
| GET | `/api/inventory/purchases` | Yes | List purchase inward transactions | PASS |
| GET | `/api/inventory/adjustments` | Yes | List stock adjustment records | PASS |
| GET | `/api/batches` | Yes | List batch tracking numbers | PASS |
| POST | `/api/batches` | Yes | Create new product batch | PASS |
| GET | `/api/inventory/ledger` | Yes | Retrieve stock ledger movement for product | PASS |
| GET | `/api/settings` | Yes | Retrieve establishment settings | PASS |
| PUT | `/api/settings` | Yes | Update establishment settings | PASS |
| GET | `/api/reports/ml-stock` | Yes | Generate ML-wise stock valuation report | PASS |
| GET | `/api/reports/sales-tax` | Yes | Generate Sales Tax summary report | PASS |
| GET | `/api/excise/monthly-return` | Yes | Generate monthly excise foreign liquor return | PASS |
| GET | `/api/excise/licences` | Yes | List excise licences | PASS |
| POST | `/api/excise/licences` | Yes | Create excise licence record | PASS |
| PUT | `/api/excise/licences/:id` | Yes | Update excise licence record | PASS |
| GET | `/api/excise/documents` | Yes | List excise transport permit documents | PASS |
| POST | `/api/excise/documents` | Yes | Create excise transport permit reference | PASS |
| GET | `/api/migrations/status` | No | Verify database schema migration status | PASS |
| POST | `/api/migrations/run` | No | Run pending database migrations | PASS |
| GET | `/api/database/verify` | No | Verify schema integrity report | PASS |
| GET | `/api/search` | Yes | Global search across products, brands, batches | PASS |
| GET | `/api/categories` | Yes | List product categories | PASS |
| GET | `/api/products/selection` | Yes | List active products for dropdowns | PASS |
| GET | `/api/products` | Yes | Paginated list of products with filters | PASS |
| GET | `/api/products/:id` | Yes | Get product details by ID | PASS |
| POST | `/api/products` | Yes | Create new product | PASS |
| PUT | `/api/products/:id` | Yes | Update product details | PASS |
| PATCH | `/api/products/:id/status` | Yes | Toggle product Active/Inactive status | PASS |
| DELETE | `/api/products/:id` | Yes | Soft-delete or archive product | PASS |
| GET | `/api/brands` | Yes | Paginated list of brands with filters | PASS |
| POST | `/api/brands` | Yes | Create new brand | PASS |
| PUT | `/api/brands/:id` | Yes | Update brand details | PASS |
| PATCH | `/api/brands/:id/status` | Yes | Toggle brand active status | PASS |
| GET | `/api/pack-sizes` | Yes | Paginated list of pack sizes | PASS |
| POST | `/api/pack-sizes` | Yes | Create pack size | PASS |
| PUT | `/api/pack-sizes/:id` | Yes | Update pack size | PASS |
| PATCH | `/api/pack-sizes/:id/status` | Yes | Toggle pack size status | PASS |
| GET | `/api/import/history` | Yes | List bulk import batch history | PASS |
| GET | `/api/import/batches/:id` | Yes | Get batch import details | PASS |
| POST | `/api/import/init` | Yes | Initialize import batch | PASS |
| POST | `/api/import/rollback/:id` | Yes | Rollback import batch | PASS |
| POST | `/api/import/execute` | Yes | Execute bulk import items | PASS |
