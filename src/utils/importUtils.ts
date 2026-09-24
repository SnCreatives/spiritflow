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
  product_name: ['product name', 'product', 'item name', 'item', 'name'],
  brand_name: ['brand', 'brand name', 'brandname'],
  category_name: ['category', 'category name', 'categoryname'],
  pack_size_name: ['pack size', 'packsize', 'volume', 'size'],
  quantity: ['qty', 'quantity', 'stock', 'opening qty', 'opening quantity', 'units'],
  sku: ['sku', 'code', 'product code', 'item code'],
  purchase_price: ['purchase price', 'tp price', 'tp', 'cost', 'buy price', 'purchase_tp_price'],
  selling_price: ['selling price', 'sale price', 'retail price'],
  mrp: ['mrp', 'max retail price', 'maximum retail price'],
  batch_number: ['batch', 'batch number', 'batch no', 'lot number'],
  remarks: ['remarks', 'notes', 'comments', 'description'],
  status: ['status', 'active', 'state'],
  purchase_number: ['purchase number', 'invoice number', 'bill number', 'purchase no', 'ref no'],
  purchase_date: ['date', 'purchase date', 'invoice date', 'bill date'],
  adjustment_type: ['type', 'adjustment type', 'movement type'],
};

export function autoMapColumns(headers: string[], fieldKeys: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  
  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim().replace(/_/g, ' ');
    
    // Exact match first
    const exactMatch = fieldKeys.find(key => key.toLowerCase() === normalizedHeader.replace(/ /g, '_'));
    if (exactMatch) {
      mapping[header] = exactMatch;
      return;
    }

    // Alias match
    for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
      if (fieldKeys.includes(key) && aliases.includes(normalizedHeader)) {
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

export function parsePaste(text: string): { headers: string[], data: any[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], data: [] };

  const headers = lines[0].split('\t').map(h => h.trim());
  const data = lines.slice(1).map(line => {
    const values = line.split('\t');
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = values[i]?.trim();
    });
    return obj;
  });

  return { headers, data };
}
