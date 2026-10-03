import { getSupabaseServiceClient } from '../../lib/supabase/client.js';
import { BarStoreService } from './barStoreService.js';

export interface ExportBackupInput {
  barId: string;
  dataType?: 'all' | 'opening_stock' | 'received_stock' | 'sales' | 'available_stock';
  userId?: string;
}

export interface BackupPackage {
  metadata: {
    barId: string;
    barName: string;
    dataType: string;
    timestamp: string;
    schemaVersion: string;
    exportedBy?: string;
  };
  data: {
    inventory?: any[];
    openingStock?: any[];
    purchases?: any[];
    sales?: any[];
    ledger?: any[];
  };
}

export class BackupService {
  /**
   * Export bar-scoped operational backup with complete metadata
   */
  static async exportBackup(input: ExportBackupInput): Promise<BackupPackage> {
    if (!input.barId || input.barId === 'ALL_BARS') {
      throw new Error('Please select a bar before exporting backup.');
    }

    const bar = await BarStoreService.getBarById(input.barId);
    if (!bar) throw new Error('Target bar not found.');

    const supabase = getSupabaseServiceClient();
    const dataType = input.dataType || 'all';

    const backupData: any = {};

    // 1. Inventory / Available Stock
    if (dataType === 'all' || dataType === 'available_stock' || dataType === 'opening_stock') {
      const { data: inv } = await supabase
        .from('inventory')
        .select('*')
        .eq('bar_id', input.barId);
      backupData.inventory = inv || [];
    }

    // 2. Received Stock / Inward Purchases
    if (dataType === 'all' || dataType === 'received_stock') {
      const { data: pur } = await supabase
        .from('purchases')
        .select(`
          *,
          items:purchase_items(*)
        `)
        .eq('bar_id', input.barId);
      backupData.purchases = pur || [];
    }

    // 3. Sales Transactions
    if (dataType === 'all' || dataType === 'sales') {
      const { data: sales } = await supabase
        .from('sales_transactions')
        .select(`
          *,
          items:sales_transaction_items(*)
        `)
        .eq('bar_id', input.barId);
      backupData.sales = sales || [];
    }

    // 4. Stock Ledger
    if (dataType === 'all') {
      const { data: ledger } = await supabase
        .from('stock_ledger')
        .select('*')
        .eq('bar_id', input.barId);
      backupData.ledger = ledger || [];
    }

    const backupPackage: BackupPackage = {
      metadata: {
        barId: bar.id,
        barName: bar.name,
        dataType,
        timestamp: new Date().toISOString(),
        schemaVersion: '2.0.0',
        exportedBy: input.userId || 'system',
      },
      data: backupData,
    };

    // Save backup audit record if table exists
    try {
      await supabase.from('backups').insert({
        bar_id: bar.id,
        bar_name: bar.name,
        data_type: dataType,
        backup_timestamp: backupPackage.metadata.timestamp,
        schema_version: '2.0.0',
        data: backupPackage,
        created_by: input.userId || null,
      });
    } catch {}

    return backupPackage;
  }

  /**
   * Restore bar-scoped operational data.
   * Strict Rule: Destination bar MUST match backup barId (no cross-bar data pollution).
   */
  static async restoreBackup(targetBarId: string, backupPackage: BackupPackage, userId?: string) {
    if (!targetBarId || targetBarId === 'ALL_BARS') {
      throw new Error('Please select a target bar for restore.');
    }

    if (!backupPackage?.metadata || !backupPackage?.data) {
      throw new Error('Invalid backup package format.');
    }

    // Strict Cross-Bar Protection: Verify origin bar matches destination bar
    if (backupPackage.metadata.barId !== targetBarId) {
      throw new Error(
        `Cross-bar restore rejected: Cannot restore data belonging to "${backupPackage.metadata.barName}" (${backupPackage.metadata.barId}) into target bar (${targetBarId}).`
      );
    }

    const bar = await BarStoreService.getBarById(targetBarId);
    if (!bar) throw new Error('Destination bar not found.');

    const supabase = getSupabaseServiceClient();

    let restoredInventory = 0;
    let restoredPurchases = 0;
    let restoredSales = 0;

    // 1. Restore Inventory
    if (Array.isArray(backupPackage.data.inventory)) {
      for (const row of backupPackage.data.inventory) {
        const { error } = await supabase
          .from('inventory')
          .upsert({
            ...row,
            bar_id: targetBarId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'bar_id, product_id' });

        if (!error) restoredInventory++;
      }
    }

    // 2. Restore Purchases
    if (Array.isArray(backupPackage.data.purchases)) {
      for (const p of backupPackage.data.purchases) {
        const { items, ...parent } = p;
        const { data: insP, error: pErr } = await supabase
          .from('purchases')
          .upsert({
            ...parent,
            bar_id: targetBarId,
          })
          .select('id')
          .maybeSingle();

        if (!pErr && insP && Array.isArray(items)) {
          restoredPurchases++;
          for (const item of items) {
            await supabase
              .from('purchase_items')
              .upsert({
                ...item,
                purchase_id: insP.id,
                bar_id: targetBarId,
              });
          }
        }
      }
    }

    // 3. Restore Sales
    if (Array.isArray(backupPackage.data.sales)) {
      for (const s of backupPackage.data.sales) {
        const { items, ...parent } = s;
        const { data: insS, error: sErr } = await supabase
          .from('sales_transactions')
          .upsert({
            ...parent,
            bar_id: targetBarId,
          })
          .select('id')
          .maybeSingle();

        if (!sErr && insS && Array.isArray(items)) {
          restoredSales++;
          for (const item of items) {
            await supabase
              .from('sales_transaction_items')
              .upsert({
                ...item,
                sale_id: insS.id,
                bar_id: targetBarId,
              });
          }
        }
      }
    }

    return {
      success: true,
      targetBarId,
      targetBarName: bar.name,
      restoredSummary: {
        inventoryRows: restoredInventory,
        purchases: restoredPurchases,
        sales: restoredSales,
      },
    };
  }
}
