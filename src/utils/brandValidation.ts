export interface BrandSchemaValidationResult {
  isValid: boolean;
  errors: string[];
  validCount: number;
  invalidCount: number;
}

/**
 * Validates that brand items from /api/masters/brands match the expected schema
 * (id, name, category_id) and correctly map to category filter IDs.
 */
export function validateBrandsSchemaAndMapping(
  brands: any[],
  selectedCategoryId?: string
): BrandSchemaValidationResult {
  const errors: string[] = [];
  let validCount = 0;
  let invalidCount = 0;

  if (!Array.isArray(brands)) {
    return {
      isValid: false,
      errors: ['Brands response data is not an array.'],
      validCount: 0,
      invalidCount: 0,
    };
  }

  brands.forEach((brand, index) => {
    let hasError = false;

    if (!brand || typeof brand !== 'object') {
      errors.push(`Item at index ${index} is not a valid object.`);
      invalidCount++;
      return;
    }

    // Check id
    if (!brand.id || typeof brand.id !== 'string') {
      errors.push(`Brand at index ${index} (${brand.name || 'Unknown'}) missing valid 'id'.`);
      hasError = true;
    }

    // Check name
    if (!brand.name && !brand.brand_name) {
      errors.push(`Brand with id ${brand.id || index} missing 'name' or 'brand_name'.`);
      hasError = true;
    }

    // Check category_id schema
    const catId = brand.category_id || brand.categoryId;
    if (!catId || typeof catId !== 'string') {
      errors.push(`Brand "${brand.name || brand.id}" missing valid 'category_id'.`);
      hasError = true;
    } else if (selectedCategoryId && catId !== selectedCategoryId) {
      errors.push(`Brand "${brand.name}" category_id (${catId}) does not match selected filter category_id (${selectedCategoryId}).`);
      hasError = true;
    }

    if (hasError) {
      invalidCount++;
    } else {
      validCount++;
    }
  });

  return {
    isValid: invalidCount === 0 && errors.length === 0,
    errors,
    validCount,
    invalidCount,
  };
}
