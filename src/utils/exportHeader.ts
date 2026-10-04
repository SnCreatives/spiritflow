import { BarOutlet } from '../types';

export interface ExportHeaderInfo {
  titleLines: string[];
  metaLines: string[];
  csvRows: string[][];
}

export function getBarExportHeader(bar: BarOutlet | null, reportTitle: string, dateRange?: string): ExportHeaderInfo {
  const barName = bar?.name || 'LIQUORFLOW BAR OUTLET';
  const addressParts = [bar?.address, bar?.city, bar?.state, bar?.pincode].filter(Boolean);
  const addressStr = addressParts.join(', ');
  const contact = bar?.contact_person;
  const phone = bar?.phone;
  const license = bar?.license_number;

  const titleLines: string[] = [
    'LIQUORFLOW ERP',
    barName.toUpperCase(),
  ];

  if (addressStr) {
    titleLines.push(addressStr);
  }

  const metaLines: string[] = [];
  if (contact) {
    metaLines.push(`Contact: ${contact}`);
  }
  if (phone) {
    metaLines.push(`Phone: ${phone}`);
  }
  if (license) {
    metaLines.push(`Excise License No.: ${license}`);
  }

  metaLines.push(reportTitle.toUpperCase());
  if (dateRange) {
    metaLines.push(`Period / Filters: ${dateRange}`);
  }

  // CSV format rows
  const csvRows: string[][] = [
    ['LIQUORFLOW ERP'],
    [`Bar: ${barName}`],
    ...(addressStr ? [[`Address: ${addressStr}`]] : []),
    ...(contact ? [[`Contact Person: ${contact}`]] : []),
    ...(phone ? [[`Phone: ${phone}`]] : []),
    ...(license ? [[`Excise License No.: ${license}`]] : []),
    [`Report: ${reportTitle}`],
    ...(dateRange ? [[`Date / Filters: ${dateRange}`]] : []),
    [''], // blank row before table
  ];

  return { titleLines, metaLines, csvRows };
}
