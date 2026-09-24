import { getSupabaseServiceClient } from '../../lib/supabase/client.ts';

export interface ImportBatch {
  id: string;
  batch_name: string;
  batch_type: string;
  module: string;
  source_type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  total_rows: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  completed_at?: string;
  error_summary?: string;
}

export class ImportService {
  static async createBatch(data: {
    name: string;
    module: string;
    sourceType: string;
    totalRows: number;
  }): Promise<string> {
    const supabase = getSupabaseServiceClient();
    const { data: batch, error } = await supabase
      .from('import_batches')
      .insert({
        batch_name: data.name,
        module: data.module,
        source_type: data.sourceType,
        total_rows: data.totalRows,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create import batch: ${error.message}`);
    return batch.id;
  }

  static async updateBatchProgress(batchId: string, data: {
    status?: string;
    successCount?: number;
    failedCount?: number;
    skippedCount?: number;
    errorSummary?: string;
    completed?: boolean;
  }) {
    const supabase = getSupabaseServiceClient();
    const updateData: any = {
      status: data.status,
      success_count: data.successCount,
      failed_count: data.failedCount,
      skipped_count: data.skippedCount,
      error_summary: data.errorSummary,
    };

    if (data.completed) {
      updateData.completed_at = new Date().toISOString();
      if (!updateData.status) updateData.status = 'COMPLETED';
    }

    const { error } = await supabase
      .from('import_batches')
      .update(updateData)
      .eq('id', batchId);

    if (error) console.error('Failed to update batch progress:', error);
  }

  static async addLog(batchId: string, rowIndex: number, status: string, errorMessage?: string, rawData?: any, processedData?: any) {
    const supabase = getSupabaseServiceClient();
    await supabase.from('import_logs').insert({
      batch_id: batchId,
      row_index: rowIndex,
      status,
      error_message: errorMessage,
      raw_data: rawData,
      processed_data: processedData,
    });
  }

  static async getImportHistory(module?: string) {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('import_batches')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (module) {
      query = query.eq('module', module);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch import history: ${error.message}`);
    return data;
  }

  static async getBatchDetails(batchId: string) {
    const supabase = getSupabaseServiceClient();
    const { data: batch, error: bError } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (bError) throw new Error(`Batch not found: ${bError.message}`);

    const { data: logs, error: lError } = await supabase
      .from('import_logs')
      .select('*')
      .eq('batch_id', batchId)
      .order('row_index', { ascending: true });

    if (lError) throw new Error(`Logs not found: ${lError.message}`);

    return { batch, logs };
  }

  static async executeBatch(batchId: string, module: string, items: any[]) {
    const ProductService = (await import('./productService.ts')).ProductService;
    const MasterService = (await import('./masterService.ts')).MasterService;
    const InventoryService = (await import('./inventoryService.ts')).InventoryService;

    let successCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    await this.updateBatchProgress(batchId, { status: 'PROCESSING' });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        let result;
        // Inject batchId into item for audit tracking
        item.import_batch_id = batchId;

        switch (module) {
          case 'products':
            result = await ProductService.createProduct(item);
            break;
          case 'brands':
            result = await MasterService.createBrand(item);
            break;
          case 'pack-sizes':
            result = await MasterService.createPackSize(item);
            break;
          case 'categories':
            result = await (await import('./masterService.ts')).MasterService.getCategories(); // This is just for import verification
            // We need a createCategory method in MasterService
            const { data: cat, error } = await getSupabaseServiceClient()
              .from('categories')
              .insert({
                name: item.name || item.category_name,
                code: item.code || item.category_code || (item.name || item.category_name).substring(0, 3).toUpperCase(),
                active: item.active !== undefined ? item.active : true,
                import_batch_id: batchId
              })
              .select()
              .single();
            if (error) throw new Error(error.message);
            result = cat;
            break;
          case 'opening-stock':
            result = await InventoryService.recordOpeningStock(item);
            break;
          case 'purchases':
            // Purchases usually come as bulk items
            // For import simplicity, we might process one by one if the format allows
            // Or the import service handles the grouping.
            // For now, let's assume one purchase per row if not grouped.
            result = await InventoryService.processPurchase({
              purchaseNumber: item.purchaseNumber || item.purchase_number || `IMP-${Date.now()}`,
              purchaseDate: item.purchaseDate || item.purchase_date,
              tpPermitReference: item.tpPermitReference || item.tp_permit_reference,
              exciseReference: item.exciseReference || item.excise_reference,
              documentReference: item.documentReference || item.document_reference,
              remarks: item.remarks,
              items: [{
                productId: item.productId || item.product_id,
                quantity: Number(item.quantity),
                purchaseTpPrice: Number(item.purchaseTpPrice || item.purchase_tp_price),
                batchNumber: item.batchNumber || item.batch_number,
                mrpReference: Number(item.mrpReference || item.mrp_reference || 0)
              }],
              import_batch_id: batchId
            } as any);
            break;
          case 'adjustments':
            result = await InventoryService.processAdjustment(item);
            break;
          default:
            throw new Error(`Unsupported module: ${module}`);
        }

        successCount++;
        await this.addLog(batchId, i, 'SUCCESS', undefined, item, result);
      } catch (err: any) {
        failedCount++;
        const errMsg = err.message || 'Unknown error';
        errors.push({ index: i, row: item, error: errMsg });
        await this.addLog(batchId, i, 'FAILED', errMsg, item);
      }
    }

    await this.updateBatchProgress(batchId, {
      status: failedCount === items.length ? 'FAILED' : 'COMPLETED',
      successCount,
      failedCount,
      completed: true,
      errorSummary: errors.length > 0 ? `Completed with ${errors.length} errors.` : undefined
    });

    return { successCount, failedCount, errors };
  }

  static async rollbackBatch(batchId: string) {
    const supabase = getSupabaseServiceClient();
    const { data: batch, error: bError } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (bError || !batch) throw new Error('Batch not found');
    if (batch.status === 'ROLLED_BACK') throw new Error('Batch already rolled back');

    // Reversal logic depends on module
    // For simple masters, we just delete the records linked to this batch_id
    const tablesToRollback = [
      'products', 'brands', 'pack_sizes', 'categories'
    ];

    try {
      // 1. Transactional reversal (Compensating transactions)
      if (batch.module === 'opening-stock' || batch.module === 'purchases' || batch.module === 'adjustments') {
        // Find all stock ledger entries created by this batch
        const { data: ledgerEntries } = await supabase
          .from('stock_ledger')
          .select('*')
          .eq('import_batch_id', batchId);

        if (ledgerEntries && ledgerEntries.length > 0) {
          // For each ledger entry, we need to create a reversal entry
          // and adjust the current inventory
          for (const entry of ledgerEntries) {
            const reversalIn = entry.stock_out; // Invert in/out
            const reversalOut = entry.stock_in;
            
            // Adjust inventory current_quantity
            const { data: inventory } = await supabase
              .from('inventory')
              .select('*')
              .eq('product_id', entry.product_id)
              .single();

            if (inventory) {
              const newCurrent = Number(inventory.current_quantity) - entry.stock_in + entry.stock_out;
              
              const updateObj: any = {
                current_quantity: newCurrent,
                updated_at: new Date().toISOString()
              };

              // Also adjust specific source columns if applicable
              if (entry.transaction_type === 'OPENING') {
                updateObj.opening_quantity = Number(inventory.opening_quantity) - entry.stock_in;
              } else if (entry.transaction_type === 'PURCHASE') {
                updateObj.purchased_quantity = Number(inventory.purchased_quantity) - entry.stock_in;
              } else if (entry.transaction_type.startsWith('ADJUSTMENT')) {
                updateObj.adjustment_quantity = Number(inventory.adjustment_quantity) - (entry.stock_in - entry.stock_out);
              }

              await supabase.from('inventory').update(updateObj).eq('product_id', entry.product_id);

              // Record reversal in ledger
              await supabase.from('stock_ledger').insert({
                product_id: entry.product_id,
                transaction_date: new Date().toISOString(),
                transaction_type: 'CORRECTION',
                reference_number: `ROLLBACK-${batchId.substring(0, 8)}`,
                stock_in: reversalIn,
                stock_out: reversalOut,
                balance: newCurrent,
                remarks: `Reversal of import batch ${batchId}`,
                import_batch_id: batchId // Keep it linked to same batch for audit
              });
            }
          }
        }

        // Delete purchase records/items if applicable
        if (batch.module === 'purchases') {
          await supabase.from('purchases').delete().eq('import_batch_id', batchId);
        }
        if (batch.module === 'adjustments') {
          await supabase.from('stock_adjustments').delete().eq('import_batch_id', batchId);
        }
      }

      // 2. Simple Masters deletion
      for (const table of tablesToRollback) {
        await supabase.from(table).delete().eq('import_batch_id', batchId);
      }

      // 3. Mark batch as rolled back
      await supabase.from('import_batches').update({
        status: 'ROLLED_BACK',
        completed_at: new Date().toISOString()
      }).eq('id', batchId);

      return { success: true };
    } catch (err: any) {
      throw new Error(`Rollback failed: ${err.message}`);
    }
  }
}
