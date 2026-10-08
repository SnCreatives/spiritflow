import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type ImportModule = 
  | 'products' 
  | 'brands' 
  | 'categories'
  | 'pack-sizes' 
  | 'opening-stock' 
  | 'purchases' 
  | 'adjustments';

export interface ColumnMapping {
  [key: string]: string; // csvHeader -> fieldKey
}

export const FIELD_ALIASES: { [key: string]: string[] } = {
  product_name: ['product name', 'product', 'item name', 'item', 'name', 'itemname', 'description', 'variant', 'variant name'],
  brand_name: ['brand', 'brand name', 'brandname'],
  category_name: ['category', 'category name', 'categoryname'],
  pack_size_name: ['pack size', 'packsize', 'volume', 'size', 'bottle size'],
  quantity: ['qty', 'quantity', 'stock', 'opening qty', 'opening quantity', 'units'],
  qty_cases: ['qty (cases)', 'qty cases', 'cases', 'cases qty'],
  qty_bottles: ['qty (bottles)', 'qty bottles', 'bottles', 'bottles qty'],
  total_bottles: ['tot. bott.', 'tot. bott', 'tot bott', 'total bottles', 'tot.bott.', 'tot.bott', 'total qty'],
  sku: ['sku', 'code', 'product code', 'item code', 'scm code', 'scm', 'scmcode', 'excise code'],
  purchase_price: ['purchase price', 'tp price', 'tp', 'cost', 'buy price', 'purchase_tp_price'],
  selling_price: ['selling price', 'sale price', 'retail price'],
  mrp: ['mrp', 'max retail price', 'maximum retail price', 'price'],
  batch_number: ['batch', 'batch number', 'batch no', 'batch no.', 'lot number', 'lot'],
  auto_batch: ['auto batch', 'autobatch'],
  mfg_month: ['mfg. month', 'mfg month', 'mfg date', 'manufacturing month'],
  bulk_litres: ['b.l.', 'b.l', 'bl', 'bulk litres', 'bulk litre'],
  strength: ['v/v (%)', 'v/v%', 'v/v', 'strength', 'abv'],
  remarks: ['remarks', 'notes', 'comments', 'description'],
  status: ['status', 'active', 'state'],
  purchase_number: ['purchase number', 'invoice number', 'bill number', 'purchase no', 'ref no'],
  purchase_date: ['date', 'purchase date', 'invoice date', 'bill date'],
  adjustment_type: ['type', 'adjustment type', 'movement type'],
};

export function autoMapColumns(headers: string[], fieldKeys: string[] = Object.keys(FIELD_ALIASES)): ColumnMapping {
  const mapping: ColumnMapping = {};
  const keys = fieldKeys && fieldKeys.length > 0 ? fieldKeys : Object.keys(FIELD_ALIASES);
  
  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim().replace(/_/g, ' ');
    
    // Exact match first
    const exactMatch = keys.find(key => key.toLowerCase() === normalizedHeader.replace(/ /g, '_'));
    if (exactMatch) {
      mapping[header] = exactMatch;
      return;
    }

    // Alias match
    for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
      if (keys.includes(key) && aliases.includes(normalizedHeader)) {
        mapping[header] = key;
        break;
      }
    }
  });

  return mapping;
}

export async function parseCsv(file: File): Promise<{ headers: string[], data: any[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields || [],
          data: results.data
        });
      },
      error: (err) => reject(err)
    });
  });
}

export async function parseExcel(file: File): Promise<{ [sheetName: string]: { headers: string[], data: any[] } }> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const result: { [sheetName: string]: { headers: string[], data: any[] } } = {};

  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
    result[name] = { headers, data: jsonData };
  });

  return result;
}

export interface ParsedDocumentResult {
  headers: string[];
  data: any[];
  metadata?: {
    receivedDate?: string;
    autoTpNo?: string;
    manualTpNo?: string;
    tpDate?: string;
    receivedFrom?: string;
    district?: string;
    party?: string;
    validityDate?: string;
  };
}

/**
 * Robust clipboard parser for tabular data copied from Excel, Google Sheets,
 * and excise portal/PDF reports with line wrapping.
 * 
 * Rules:
 * 1. Parse tab-separated, pipe-separated or column-aligned data using actual delimiters and header positions.
 * 2. Continuation lines for a wrapped logical row are merged into the same product row.
 * 3. Detect new product rows using sequence number ("SrNo") or complete row boundaries.
 * 4. "SCM Code:..." lines must NOT become separate product rows; they are continuation data.
 * 5. Summary / footer rows (e.g. "Total 14.000", "Grand Total") are excluded.
 * 6. Preserves all 12 canonical fields.
 * 7. Extracts header metadata (Received Date, Auto TP No, Party, etc.) if pasted as full document.
 */
export function parsePaste(text: string): ParsedDocumentResult {
  // Extract Header Metadata if present in pasted document
  const metadata: any = {};
  const recDateMatch = text.match(/Received\s*Date\s*:\s*([^\r\n]+)/i);
  if (recDateMatch) metadata.receivedDate = recDateMatch[1].trim();

  const autoTpMatch = text.match(/Auto\s*T\.?\s*P\.?\s*No\s*:\s*([^\r\n]+)/i);
  if (autoTpMatch) metadata.autoTpNo = autoTpMatch[1].trim();

  const manualTpMatch = text.match(/T\.?\s*P\.?\s*No\s*\(Manual\)\s*:\s*([^\r\n]+)/i);
  if (manualTpMatch) metadata.manualTpNo = manualTpMatch[1].trim();

  const tpDateMatch = text.match(/T\.?\s*P\.?\s*Date\s*:\s*([^\r\n]+)/i);
  if (tpDateMatch) metadata.tpDate = tpDateMatch[1].trim();

  const recFromMatch = text.match(/Received\s*From\s*:\s*([^\r\n]+)/i);
  if (recFromMatch) metadata.receivedFrom = recFromMatch[1].trim();

  const districtMatch = text.match(/District\s*:\s*([^\r\n]+)/i);
  if (districtMatch) metadata.district = districtMatch[1].trim();

  const partyMatch = text.match(/Party\s*:\s*([^\r\n]+)/i);
  if (partyMatch) metadata.party = partyMatch[1].trim();

  const validityMatch = text.match(/Validity\s*(?:Date)?\s*:\s*([^\r\n]+)/i);
  if (validityMatch) metadata.validityDate = validityMatch[1].trim();

  const rawLines = text.split(/\r?\n/);
  const nonEmptyLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Exclude summary / footer rows from candidate lines
    if (/^(total|grand\s*total|sub\s*total|subtotal|summary|page\s*\d+|net\s*total)\b/i.test(trimmed)) {
      continue;
    }
    nonEmptyLines.push(trimmed);
  }

  if (nonEmptyLines.length === 0) return { headers: [], data: [], metadata };

  // Find the table header line index
  let headerIndex = -1;
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const l = nonEmptyLines[i].toLowerCase();
    const isHeaderCandidate =
      (l.includes('srno') || l.includes('sr.no') || l.includes('sr no') || l.includes('s.no') || l.includes('s no') || l.includes('#')) &&
      (l.includes('item') || l.includes('product') || l.includes('brand') || l.includes('variant') || l.includes('size') || l.includes('qty'));
    if (isHeaderCandidate) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // If no header row with SrNo found, check if line has columns (tab or pipe)
    for (let i = 0; i < nonEmptyLines.length; i++) {
      const l = nonEmptyLines[i].toLowerCase();
      if ((l.includes('item') || l.includes('product') || l.includes('size') || l.includes('qty') || l.includes('tp')) && (l.includes('\t') || l.includes('|'))) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) headerIndex = 0;

  const headerLine = nonEmptyLines[headerIndex];
  const usePipe = headerLine.includes('|');
  const useTab = headerLine.includes('\t');

  const splitCells = (l: string): string[] => {
    if (usePipe) {
      return l.split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
    }
    if (useTab) {
      return l.split('\t').map(c => c.trim());
    }
    return l.split(/\s{2,}/).map(c => c.trim());
  };

  const headers = splitCells(headerLine);
  const hasSrNo = /^sr\.?\s*no|^s\.?\s*no|^#$/i.test(headers[0] || '');

  const dataRows: any[] = [];
  let currentRow: any = null;
  let nextExpectedSr = 1;

  for (let i = headerIndex + 1; i < nonEmptyLines.length; i++) {
    const line = nonEmptyLines[i];
    const cells = splitCells(line);
    if (cells.length === 0 || (cells.length === 1 && !cells[0])) continue;

    // Check if line represents a summary / footer row
    if (/^(total|grand\s*total|sub\s*total|subtotal|summary|page\s*\d+|net\s*total)\b/i.test(cells[0])) {
      continue;
    }

    const firstCell = cells[0];
    const isIntegerSr = /^\d+$/.test(firstCell);
    const parsedSr = isIntegerSr ? parseInt(firstCell, 10) : -1;

    // Check if line represents a NEW product row
    let isNewRow = false;
    if (hasSrNo) {
      if (
        isIntegerSr &&
        (parsedSr === 1 ||
          parsedSr === nextExpectedSr ||
          (currentRow && parsedSr === parseInt(currentRow['SrNo'] || '0', 10) + 1))
      ) {
        isNewRow = true;
      }
    } else {
      // If table lacks SrNo column, line is a new row if column count is close to header length
      // and first column does not look like SCM continuation or purely decimal wrap
      if (
        cells.length >= headers.length - 2 &&
        !/^(scm\s*code|scm)/i.test(firstCell) &&
        !/^\d+(\.\d+)?$/.test(firstCell)
      ) {
        isNewRow = true;
      }
    }

    if (isNewRow) {
      if (currentRow) {
        finalizeLogicalRow(currentRow);
        dataRows.push(currentRow);
      }
      currentRow = {};
      nextExpectedSr = parsedSr + 1;

      headers.forEach((h, idx) => {
        if (cells[idx] !== undefined && cells[idx] !== '') {
          currentRow[h] = cells[idx];
        }
      });
    } else if (currentRow) {
      // Continuation line for currentRow:
      // 1. SCM Code extraction
      const scmMatch = cells.find(c => /scm\s*code/i.test(c)) || (cells[0] && /scm/i.test(cells[0]) ? cells[0] : null);
      if (scmMatch) {
        const extractedScm = scmMatch.match(/(?:scm\s*code\s*[:\-\s]?\s*|scm\s*[:\-\s]?\s*)([a-z0-9_\-]+)/i);
        if (extractedScm) {
          currentRow['SCM Code'] = extractedScm[1];
        } else {
          currentRow['SCM Code'] = scmMatch;
        }
      }

      // 2. Map cells to remaining unpopulated headers
      const startsWithScm = /scm\s*code/i.test(cells[0]);
      const startHeaderOffset = startsWithScm ? 2 : 1;

      for (let hIdx = startHeaderOffset; hIdx < headers.length; hIdx++) {
        const headerName = headers[hIdx];
        const cellVal = cells[startsWithScm ? hIdx - 1 : hIdx];
        if (cellVal !== undefined && cellVal !== '' && !currentRow[headerName]) {
          currentRow[headerName] = cellVal;
        }
      }

      // 3. Fallback cell extraction for essential fields if still missing
      cells.forEach(c => {
        if (/^\d+\s*(ml|l)(\s*\(\d+\))?$/i.test(c) && !currentRow['Size']) {
          currentRow['Size'] = c;
        }
      });
    }
  }

  if (currentRow) {
    finalizeLogicalRow(currentRow);
    dataRows.push(currentRow);
  }

  return { headers, data: dataRows, metadata };
}

/**
 * Clean and normalize a logical row after parsing continuation lines
 */
function finalizeLogicalRow(row: any) {
  // If ItemName contains SCM Code, extract SCM Code and clean ItemName
  const itemNameKey = Object.keys(row).find(k => /^(item\s*name|item|product\s*name|product)/i.test(k));
  if (itemNameKey && row[itemNameKey]) {
    const val = String(row[itemNameKey]);
    const scmInItem = val.match(/(?:scm\s*code\s*[:\-\s]\s*|scm\s*[:\-\s]\s*)([a-z0-9_\-]+)/i);
    if (scmInItem) {
      if (!row['SCM Code']) {
        row['SCM Code'] = scmInItem[1];
      }
      row[itemNameKey] = val.replace(/(?:scm\s*code\s*[:\-\s]\s*|scm\s*[:\-\s]\s*)[a-z0-9_\-]+/i, '').trim();
    }
  }

  // Ensure normalized SCM Code field
  if (row['SCM Code']) {
    const val = String(row['SCM Code']).trim();
    const scmClean = val.match(/(?:scm\s*code\s*[:\-\s]\s*|scm\s*[:\-\s]\s*)([a-z0-9_\-]+)/i);
    if (scmClean && scmClean[1]) {
      row['SCM Code'] = scmClean[1];
    } else {
      row['SCM Code'] = val;
    }
  }
}

/**
 * Parse numeric volume in ML from various string formats (e.g. "650 ML", "650ml", "650 ml Pint")
 */
export function parseVolumeMl(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const match = str.match(/(\d+)\s*(?:ml|l)?/i);
  return match ? parseInt(match[1], 10) : 0;
}

const GENERIC_STOP_WORDS = new Set([
  'whisky', 'whiskey', 'beer', 'rum', 'vodka', 'gin', 'brandy', 'wine',
  'liquor', 'spirit', 'beverage', 'bottle', 'can', 'pint', 'ml',
  'international', 'premium', 'deluxe', 'special', 'classic', 'original', 'super'
]);

/**
 * Standardized interface for a resolved canonical product
 */
export interface ResolvedProduct {
  productId: string;
  brandId: string;
  variantId?: string; // variant_id if available, otherwise variant name
  categoryId: string;
  packSizeId: string;
  packagingTypeId?: string;
  scmMasterId?: string;
  
  productName: string;
  brandName: string;
  categoryName: string;
  variant: string;
  volumeMl: number;
  packType: string;
  sku: string;
  mrp: number;
  purchasePrice: number;
  
  score: number;
  matchType: 'scm' | 'id' | 'product_size' | 'brand_variant_size' | 'name_size' | 'partial';
  isAmbiguous?: boolean;
  potentialMatches?: ResolvedProduct[];
}

/**
 * Normalizes strings for robust matching
 */
/**
 * Normalizes strings for robust matching
 * Removes common punctuation, trailing dots, and standard size patterns (e.g. " (750ml)")
 */
function normalizeForMatch(str: any): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s*\(\d+\s*ml\)\s*/gi, ' ') // remove "(750ml)" patterns
    .replace(/\s*\d+\s*ml\s*/gi, ' ')     // remove "750ml" patterns
    .replace(/[.\-_,]/g, ' ')             // replace common separators with space
    .replace(/\s+/g, ' ')                  // collapse multiple spaces
    .trim();
}

/**
 * Canonical product resolution against existing catalog items:
 * Priority:
 * 1. Exact SCM Code
 * 2. Exact canonical Product ID, if available
 * 3. Product Name + Bottle Size (Canonical Match)
 * 4. Brand + Variant + Bottle Size
 * 5. Fuzzy Item Name Match + Bottle Size
 * 
 * Strict: Never creates new records; resolves only against existing database items.
 */
export function resolveCanonicalProduct(params: {
  itemName: string;
  scmCode?: string;
  brandName?: string;
  variant?: string;
  size?: number | string;
  packaging?: string;
  productId?: string;
  catalogProducts: any[];
}): ResolvedProduct | null {
  const { itemName, scmCode, brandName, variant, size, packaging, productId, catalogProducts } = params;
  if (!catalogProducts || catalogProducts.length === 0) return null;

  const numSize = typeof size === 'number' ? size : parseVolumeMl(size);
  const normScm = normalizeForMatch(scmCode);
  const normItem = normalizeForMatch(itemName);
  const normBrand = normalizeForMatch(brandName);
  const normVariant = normalizeForMatch(variant);
  const normPkg = normalizeForMatch(packaging || 'Bottle');

  // Helper to build result from catalog row
  const buildResult = (p: any, score: number, matchType: ResolvedProduct['matchType']): ResolvedProduct => {
    // Determine IDs and labels from row structure
    const pid = p.id || p.productId;
    const bid = p.brand_id || p.brandId;
    const cid = p.category_id || p.categoryId || (p.category?.id);
    const psid = p.pack_size_id || p.packSizeId;
    const scmId = p.scmMasterId || '';
    
    const pName = p.product_name || p.name || p.productName || '';
    const bName = p.brand_name || p.brandName || (p.brand?.name) || '';
    const cName = p.category_name || p.categoryName || (p.category?.name) || '';
    const vName = p.variant || p.product_name || p.name || '';
    const vol = p.volume_ml || p.volumeMl || parseVolumeMl(p.pack_size || p.pack_size_name || '');
    const pPkg = p.pack_type || p.packType || 'Bottle';
    const sku = scmCode ? scmCode.trim() : (p.sku || p.scmCode || p.scm_code || '');
    const mrp = Number(p.mrp_reference || p.mrp || 0);
    const pPrice = Number(p.purchase_tp_price || p.purchase_price || p.purchasePrice || 0);

    return {
      productId: pid,
      brandId: bid,
      categoryId: cid,
      packSizeId: psid,
      scmMasterId: scmId,
      productName: pName,
      brandName: bName,
      categoryName: cName,
      variant: vName,
      volumeMl: vol,
      packType: pPkg,
      sku,
      mrp,
      purchasePrice: pPrice,
      score,
      matchType,
    };
  };

  // 1. Direct SCM / SKU match (Highest priority)
  if (normScm) {
    const match = catalogProducts.find(p => {
      const pSku = normalizeForMatch(p.sku || p.scmCode || p.scm_code);
      return pSku === normScm;
    });
    if (match) return buildResult(match, 1000, 'scm');
  }

  // 2. Exact Product ID match
  if (productId) {
    const match = catalogProducts.find(p => p.id === productId || p.productId === productId);
    if (match) return buildResult(match, 900, 'id');
  }

  // 3. Product Name + Bottle Size (Strict Normalized Match)
  if (normItem && numSize > 0) {
    const matches = catalogProducts.filter(p => {
      const pNameNorm = normalizeForMatch(p.product_name || p.name);
      const pVol = p.volume_ml || p.volumeMl || parseVolumeMl(p.pack_size || p.pack_size_name || '');
      
      // Direct name match or Brand + Variant combination match
      const nameMatch = pNameNorm === normItem || 
                        pNameNorm === `${normBrand} ${normVariant}`.trim() ||
                        pNameNorm === `${normBrand} ${normItem}`.trim();
      
      return nameMatch && pVol === numSize;
    });
    
    if (matches.length === 1) {
      return buildResult(matches[0], 800, 'product_size');
    } else if (matches.length > 1) {
      // Disambiguate by brand
      const brandMatch = matches.find(p => {
        const bName = normalizeForMatch(p.brand_name || p.brand?.name);
        return bName === normBrand || (normBrand && (bName.includes(normBrand) || normBrand.includes(bName)));
      });
      if (brandMatch) return buildResult(brandMatch, 850, 'product_size');
      
      const result = buildResult(matches[0], 800, 'product_size');
      result.isAmbiguous = true;
      result.potentialMatches = matches.map(m => buildResult(m, 800, 'product_size'));
      return result;
    }
  }

  // 4. Brand + Variant + Bottle Size
  if (normBrand && normVariant && numSize > 0) {
    const match = catalogProducts.find(p => {
      const bName = normalizeForMatch(p.brand_name || p.brand?.name);
      const vName = normalizeForMatch(p.variant || p.product_name || p.name);
      const pVol = p.volume_ml || p.volumeMl || parseVolumeMl(p.pack_size || p.pack_size_name || '');
      return (bName === normBrand || bName.includes(normBrand) || normBrand.includes(bName)) && 
             (vName === normVariant || vName.includes(normVariant) || normVariant.includes(vName)) && 
             pVol === numSize;
    });
    if (match) return buildResult(match, 700, 'brand_variant_size');
  }

  // 5. Normalized Item Name Lookup (Containment Match)
  if (normItem && numSize > 0) {
    const matches = catalogProducts.filter(p => {
      const pNameNorm = normalizeForMatch(p.product_name || p.name);
      const pVol = p.volume_ml || p.volumeMl || parseVolumeMl(p.pack_size || p.pack_size_name || '');
      if (pVol !== numSize) return false;
      
      // If the pasted Item Name is contained in the product name OR vice-versa
      return pNameNorm.includes(normItem) || normItem.includes(pNameNorm);
    });

    if (matches.length === 1) {
      return buildResult(matches[0], 600, 'name_size');
    } else if (matches.length > 1) {
      // Prioritize by brand match if brandName was provided
      if (normBrand) {
        const brandMatch = matches.find(p => {
          const bName = normalizeForMatch(p.brand_name || p.brand?.name);
          return bName === normBrand || bName.includes(normBrand) || normBrand.includes(bName);
        });
        if (brandMatch) return buildResult(brandMatch, 650, 'name_size');
      }

      const potentialResults = matches.map(m => buildResult(m, 600, 'name_size'));
      const result = potentialResults[0];
      result.isAmbiguous = true;
      result.potentialMatches = potentialResults;
      return result;
    }
  }

  // Fallback: Legacy fuzzy scoring logic for harder matches
  const tokens = `${normBrand} ${normItem}`.split(/\s+/).filter(Boolean);
  let bestMatch: any = null;
  let highestScore = 0;

  for (const p of catalogProducts) {
    const pBrand = normalizeForMatch(p.brand?.name || p.brand_name || '');
    const pVariant = normalizeForMatch(p.product_name || p.variant || p.name || '');
    const pVolume = p.volume_ml || p.volumeMl || parseVolumeMl(p.pack_size || p.pack_size_name || '');
    const pPack = normalizeForMatch(p.pack_type || p.pack_size || '');

    if (numSize > 0 && pVolume > 0 && pVolume !== numSize) continue;

    const pBrandWords = pBrand.split(/\s+/).filter((w: string) => !GENERIC_STOP_WORDS.has(w) && w.length > 2);
    let brandScore = 0;
    if (pBrand) {
      if (normBrand.includes(pBrand) || normItem.includes(pBrand)) {
        brandScore += 60 + pBrand.length * 2;
      } else if (pBrandWords.length > 0 && pBrandWords.every((w: string) => tokens.includes(w))) {
        brandScore += 40 + pBrand.length;
      }
    }

    if (brandScore === 0) continue;

    const pVariantWords = pVariant.split(/\s+/).filter((w: string) => !GENERIC_STOP_WORDS.has(w) && w.length > 2);
    let variantScore = 0;
    if (pVariant) {
      if (normItem.includes(pVariant)) {
        variantScore += 30 + pVariant.length * 2;
      } else if (pVariantWords.length > 0 && pVariantWords.every((w: string) => tokens.includes(w))) {
        variantScore += 15;
      }
    }

    let score = brandScore + variantScore;
    if (numSize > 0 && pVolume === numSize) score += 40;
    if (normPkg && pPack.includes(normPkg)) score += 10;

    if (score > highestScore && score >= 70) {
      highestScore = score;
      bestMatch = p;
    }
  }

  if (bestMatch) {
    return buildResult(bestMatch, highestScore, 'partial');
  }

  return null;
}
