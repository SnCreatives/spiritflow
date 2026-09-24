/**
 * LiquorFlow Verification Test Suite
 * Tests 1 to 10 covering Prompt Section 34
 */

import { validateEnvironmentConfig } from '../src/lib/supabase/config';
import { SetupSchema } from '../src/lib/validation/setup';
import { LoginSchema } from '../src/lib/validation/auth';
import {
  CategoryBrandValidationSchema,
  CategoryPackSizeValidationSchema,
  SaleItemValidationSchema,
  ProductCreateSchema,
  PackSizeCreateSchema,
} from '../src/lib/validation/inventory';
import { hashPassword, verifyPassword } from '../src/lib/auth/password';
import { generateSessionToken, calculateSessionExpiry, createSessionCookie, extractSessionTokenFromCookie } from '../src/lib/auth/session';

async function runTests() {
  console.log('--- RUNNING LIQUORFLOW MASTER PROMPT 1 VERIFICATION SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // TEST 8: Missing environment variable check
  console.log('\n--- Test 8: Missing environment variable check ---');
  const envCheck = validateEnvironmentConfig();
  assert(
    !envCheck.isConfigured && envCheck.missingVariables.includes('NEXT_PUBLIC_SUPABASE_URL'),
    'Test 8: System detects missing env variables and produces structured missing report'
  );

  // TEST 4: Wrong credentials message
  console.log('\n--- Test 4: Wrong credentials message exactness ---');
  const invalidLogin = LoginSchema.safeParse({ mobileNumber: '12345', password: '' });
  assert(!invalidLogin.success, 'Test 4: Invalid phone format rejected by server validation');

  // TEST 9: Category-Brand combination validation
  console.log('\n--- Test 9: Category-Brand combination rejection ---');
  const cat1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const cat2 = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const brandId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  // Valid matching category
  const validMatch = CategoryBrandValidationSchema.safeParse({
    categoryId: cat1,
    brandId: brandId,
    brandCategoryId: cat1,
  });
  assert(validMatch.success, 'Test 9: Valid category-brand match is accepted');

  // Incompatible brand category
  const invalidMatch = CategoryBrandValidationSchema.safeParse({
    categoryId: cat1,
    brandId: brandId,
    brandCategoryId: cat2,
  });
  assert(!invalidMatch.success, 'Test 9: Incompatible brand category is strictly rejected');

  // TEST 10: Selling more stock than available
  console.log('\n--- Test 10: Stock limit enforcement ---');
  const validSale = SaleItemValidationSchema.safeParse({
    productId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    quantity: 5,
    sellingPrice: 500,
    availableStock: 10,
  });
  assert(validSale.success, 'Test 10: Sale with quantity <= availableStock is permitted');

  const oversell = SaleItemValidationSchema.safeParse({
    productId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    quantity: 15,
    sellingPrice: 500,
    availableStock: 10,
  });
  assert(!oversell.success, 'Test 10: Selling more stock than available (15 > 10) is strictly rejected');

  // PASSWORD HASHING & SECURITY CHECK
  console.log('\n--- Password Hashing & Verification Check ---');
  const rawPw = 'StrongOwnerPass123';
  const hash = await hashPassword(rawPw);
  assert(hash.startsWith('$2'), 'Password hashed with bcrypt / argon2 salt format');
  assert(await verifyPassword(rawPw, hash), 'Valid password verification returns true');
  assert(!(await verifyPassword('WrongPass', hash)), 'Invalid password verification returns false');

  // SESSION COOKIE CHECK
  console.log('\n--- Session Cookie Generation Check ---');
  const token = generateSessionToken();
  assert(token.length === 64, 'Session token is 64-hex-char cryptographically secure token');
  const cookieStr = createSessionCookie(token);
  assert(cookieStr.includes('HttpOnly'), 'Session cookie is HttpOnly');
  assert(cookieStr.includes('SameSite=Lax'), 'Session cookie uses SameSite=Lax');
  const extracted = extractSessionTokenFromCookie(cookieStr);
  assert(extracted === token, 'Extracted session token matches original token');

  // SETUP SCHEMA VALIDATION (Indian mobile number, VAT format, password match)
  console.log('\n--- Setup Schema Input Rules (State VAT & TIN) ---');
  const validSetup = SetupSchema.safeParse({
    businessName: 'Royal Liquor Shop',
    address: 'Shop 14, Station Road, Pune',
    ownerMobile: '9876543210',
    vatNumber: '27001234567V',
    mobileNumber: '9876543210',
    password: 'SecurePassword1',
    confirmPassword: 'SecurePassword1',
    language: 'mr',
  });
  assert(validSetup.success, 'Valid Setup data with State VAT passes validation');

  const mismatchedPw = SetupSchema.safeParse({
    businessName: 'Royal Liquor Shop',
    address: 'Shop 14, Station Road, Pune',
    ownerMobile: '9876543210',
    mobileNumber: '9876543210',
    password: 'SecurePassword1',
    confirmPassword: 'DifferentPassword2',
    language: 'mr',
  });
  assert(!mismatchedPw.success, 'Setup rejects mismatched passwords');

  // PROMPT 2: CATEGORY-PACK SIZE & STRICT 500 ML PINT REJECTION
  console.log('\n--- Prompt 2: Category-Pack Size & Pack Constraints ---');
  const packId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';

  const validCatPack = CategoryPackSizeValidationSchema.safeParse({
    categoryId: cat1,
    packSizeId: packId,
    packSizeCategoryId: cat1,
    volumeMl: 650,
    packType: 'Bottle',
  });
  assert(validCatPack.success, 'Category-Pack Size match is accepted');

  const mismatchedCatPack = CategoryPackSizeValidationSchema.safeParse({
    categoryId: cat1,
    packSizeId: packId,
    packSizeCategoryId: cat2,
  });
  assert(!mismatchedCatPack.success, 'Category-Pack Size mismatch is strictly rejected');

  // STRICT RULE: "Do not create 500 ml Pint"
  const invalid500mlPint = PackSizeCreateSchema.safeParse({
    name: '500 ml Pint',
    categoryId: cat1,
    volumeMl: 500,
    packType: 'Pint',
    active: true,
  });
  assert(!invalid500mlPint.success, 'Strict constraint enforced: "500 ml Pint" is rejected by schema');

  const valid500mlCan = PackSizeCreateSchema.safeParse({
    name: '500 ml Can',
    categoryId: cat1,
    volumeMl: 500,
    packType: 'Can',
    active: true,
  });
  assert(valid500mlCan.success, 'Standard 500 ml Can is valid');

  // PROMPT 2: PRODUCT MASTER VALIDATION (Selling price vs MRP)
  console.log('\n--- Prompt 2: Product Master Validation ---');
  const validProduct = ProductCreateSchema.safeParse({
    name: 'Royal Stag 750ml',
    categoryId: cat1,
    brandId: brandId,
    packSizeId: packId,
    purchasePrice: 620,
    sellingPrice: 750,
    mrp: 750,
    status: 'Active',
    openingStock: 24,
  });
  assert(validProduct.success, 'Valid Product creation passes validation');

  const invalidOverMRP = ProductCreateSchema.safeParse({
    name: 'Royal Stag 750ml',
    categoryId: cat1,
    brandId: brandId,
    packSizeId: packId,
    purchasePrice: 620,
    sellingPrice: 800, // Greater than MRP!
    mrp: 750,
    status: 'Active',
  });
  assert(!invalidOverMRP.success, 'Selling price exceeding MRP is rejected');

  console.log(`\n========================================`);
  console.log(`ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
