import { getSupabaseServiceClient } from '../../lib/supabase/client.js';

export interface DryDayRecord {
  id: string;
  bar_id?: string | null;
  dry_date: string; // YYYY-MM-DD
  reason: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// In-memory backing store for resiliency
const memoryDryDays: DryDayRecord[] = [
  {
    id: 'dry-day-001',
    bar_id: null, // State-wide dry day
    dry_date: '2026-01-26',
    reason: 'Republic Day',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dry-day-002',
    bar_id: null,
    dry_date: '2026-08-15',
    reason: 'Independence Day',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dry-day-003',
    bar_id: null,
    dry_date: '2026-10-02',
    reason: 'Gandhi Jayanti',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export class DryDayService {
  private static dbTableAvailable: boolean | null = null;

  private static async checkDbTable(): Promise<boolean> {
    if (this.dbTableAvailable !== null) return this.dbTableAvailable;
    try {
      const supabase = getSupabaseServiceClient();
      const { error } = await supabase.from('dry_days').select('id').limit(1);
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        this.dbTableAvailable = false;
      } else {
        this.dbTableAvailable = true;
      }
    } catch {
      this.dbTableAvailable = false;
    }
    return this.dbTableAvailable;
  }

  /**
   * Check if a given date is a dry day for a specific bar (or state-wide).
   */
  static async isDryDay(date: string, barId?: string): Promise<{ isDryDay: boolean; reason?: string }> {
    if (!date) return { isDryDay: false };
    const cleanDate = date.split('T')[0];

    const isDbReady = await this.checkDbTable();
    if (isDbReady) {
      try {
        const supabase = getSupabaseServiceClient();
        let query = supabase
          .from('dry_days')
          .select('*')
          .eq('dry_date', cleanDate)
          .eq('is_active', true);

        if (barId) {
          query = query.or(`bar_id.eq.${barId},bar_id.is.null`);
        } else {
          query = query.is('bar_id', null);
        }

        const { data, error } = await query.limit(1).maybeSingle();
        if (!error && data) {
          return { isDryDay: true, reason: data.reason };
        }
      } catch {}
    }

    const found = memoryDryDays.find(
      d => d.dry_date === cleanDate && d.is_active && (!d.bar_id || d.bar_id === barId)
    );

    if (found) {
      return { isDryDay: true, reason: found.reason };
    }

    return { isDryDay: false };
  }

  /**
   * Get all dry days for a bar (including global dry days).
   */
  static async getDryDays(barId?: string): Promise<DryDayRecord[]> {
    const isDbReady = await this.checkDbTable();
    if (isDbReady) {
      try {
        const supabase = getSupabaseServiceClient();
        let query = supabase.from('dry_days').select('*');
        if (barId) {
          query = query.or(`bar_id.eq.${barId},bar_id.is.null`);
        }
        const { data, error } = await query.order('dry_date', { ascending: true });
        if (!error && data) return data as DryDayRecord[];
      } catch {}
    }

    return memoryDryDays.filter(d => !d.bar_id || d.bar_id === barId);
  }

  /**
   * Add a new dry day (bar-specific or global).
   */
  static async createDryDay(input: { barId?: string | null; dryDate: string; reason: string }): Promise<DryDayRecord> {
    if (!input.dryDate) throw new Error('Dry date is required (YYYY-MM-DD).');
    if (!input.reason?.trim()) throw new Error('Reason for dry day is required.');

    const cleanDate = input.dryDate.split('T')[0];
    const isDbReady = await this.checkDbTable();

    if (isDbReady) {
      try {
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
          .from('dry_days')
          .insert({
            bar_id: input.barId || null,
            dry_date: cleanDate,
            reason: input.reason.trim(),
            is_active: true,
          })
          .select()
          .single();

        if (!error && data) return data as DryDayRecord;
      } catch (err: any) {
        console.warn('Fallback to memory dry days:', err.message);
      }
    }

    const record: DryDayRecord = {
      id: crypto.randomUUID(),
      bar_id: input.barId || null,
      dry_date: cleanDate,
      reason: input.reason.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryDryDays.push(record);
    return record;
  }

  /**
   * Delete a dry day
   */
  static async deleteDryDay(id: string, barId?: string): Promise<boolean> {
    const isDbReady = await this.checkDbTable();
    if (isDbReady) {
      try {
        const supabase = getSupabaseServiceClient();
        let query = supabase.from('dry_days').delete().eq('id', id);
        if (barId) query = query.eq('bar_id', barId);
        const { error } = await query;
        if (!error) return true;
      } catch {}
    }

    const idx = memoryDryDays.findIndex(d => d.id === id && (!barId || d.bar_id === barId));
    if (idx >= 0) {
      memoryDryDays.splice(idx, 1);
      return true;
    }
    return false;
  }
}
