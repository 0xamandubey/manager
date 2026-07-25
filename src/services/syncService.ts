import { db } from '../db/db';
import { supabase } from '../supabaseClient';

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'error';

// Local table to Supabase table mapping
const TABLE_MAP: Record<string, string> = {
  staff: 'staff',
  attendance: 'attendance',
  cashLog: 'cash_logs',
  customCategories: 'custom_categories',
  customerDues: 'customer_dues',
  branches: 'branches',
  sales: 'sales',
  vendors: 'vendors',
  productionEntries: 'production_entries',
  notes: 'notes',
  expenseGroups: 'expense_groups',
  customers: 'customers',
  customerOrders: 'customer_orders',
  cftCalculations: 'cft_calculations'
};

// CamelCase to SnakeCase helper
function camelToSnake(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  const snakeObj: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    // Special mapping for IndexedDB vs Supabase primary key naming
    const finalKey = snakeKey === 'google_id' ? 'id' : snakeKey;
    snakeObj[finalKey] = camelToSnake(obj[key]);
  }
  return snakeObj;
}

// SnakeCase to CamelCase helper
function snakeToCamel(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  const camelObj: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/([-_][a-z])/g, group =>
      group.toUpperCase().replace('-', '').replace('_', '')
    );
    // Restore naming mapping for primary keys
    const finalKey = camelKey === 'id' && obj.email ? 'googleId' : camelKey;
    camelObj[finalKey] = snakeToCamel(obj[key]);
  }
  return camelObj;
}

class SyncService {
  private syncTimeout: any = null;
  private isProcessing = false;
  private statusListeners = new Set<(status: SyncStatusType) => void>();
  private currentStatus: SyncStatusType = 'synced';

  public addStatusListener(callback: (status: SyncStatusType) => void) {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
  }

  private setStatus(status: SyncStatusType) {
    this.currentStatus = status;
    this.statusListeners.forEach(cb => cb(status));
  }

  public getStatus(): SyncStatusType {
    return this.currentStatus;
  }

  // Start background sync polling and event listeners
  public start() {
    window.addEventListener('online', () => this.triggerSync());
    window.addEventListener('offline', () => this.setStatus('offline'));
    
    // Initial sync trigger
    this.triggerSync();

    // Poll every 30 seconds for background pull syncing
    if (!this.syncTimeout) {
      this.syncTimeout = setInterval(() => this.triggerSync(), 30000);
    }
  }

  public stop() {
    if (this.syncTimeout) {
      clearInterval(this.syncTimeout);
      this.syncTimeout = null;
    }
  }

  // Primary trigger to run a sync cycle (push + pull)
  public async triggerSync() {
    if (this.isProcessing) return;
    if (!navigator.onLine) {
      this.setStatus('offline');
      return;
    }

    this.isProcessing = true;
    this.setStatus('syncing');

    try {
      // 1. Fetch current user session to ensure we have a valid context
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        this.setStatus('synced');
        this.isProcessing = false;
        return;
      }

      const userProfile = await db.users.toCollection().first();
      if (!userProfile || !userProfile.businessId) {
        this.setStatus('synced');
        this.isProcessing = false;
        return;
      }

      // 2. Run Push Sync Cycle
      await this.pushLocalChanges(session.user.id, userProfile.businessId);

      // 3. Run Pull Sync Cycle
      await this.pullRemoteChanges(userProfile.businessId);

      this.setStatus('synced');
    } catch (err) {
      console.error('Synchronization cycle error:', err);
      this.setStatus('error');
    } finally {
      this.isProcessing = false;
    }
  }

  // Push local outbox mutations to Supabase
  private async pushLocalChanges(ownerId: string, businessId: string) {
    const outboxItems = await db.syncOutbox.orderBy('id').toArray();
    if (outboxItems.length === 0) return;

    for (const item of outboxItems) {
      const supabaseTable = TABLE_MAP[item.tableName];
      if (!supabaseTable) {
        // Unmapped table, delete outbox entry
        await db.syncOutbox.delete(item.id!);
        continue;
      }

      try {
        if (item.action === 'delete') {
          // Perform soft-delete update in Supabase (if deleted_at exists) or physical delete
          const { error } = await supabase
            .from(supabaseTable)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', item.recordId);

          if (error && error.code === 'PGRST100') {
            // Table doesn't have deleted_at, fallback to physical delete
            await supabase.from(supabaseTable).delete().eq('id', item.recordId);
          }
        } else {
          // Insert/Update payload
          const localRecord = await db.table(item.tableName).get(item.recordId);
          if (!localRecord) {
            // Record no longer exists locally, treat as completed
            await db.syncOutbox.delete(item.id!);
            continue;
          }

          // Convert payload to snake_case and stamp RLS properties
          const supabasePayload: any = {
            ...camelToSnake(localRecord),
            owner_id: ownerId,
            business_id: businessId
          };

          if (item.tableName === 'notes') {
            supabasePayload.updated_at = Date.now();
            supabasePayload.created_at = localRecord.createdAt || Date.now();
          } else if (item.tableName === 'cftCalculations') {
            supabasePayload.created_at = localRecord.createdAt || Date.now();
          } else {
            supabasePayload.updated_at = new Date().toISOString();
          }

          const { error } = await supabase
            .from(supabaseTable)
            .upsert(supabasePayload);

          if (error) throw error;
        }

        // Successfully pushed, remove from local outbox
        await db.syncOutbox.delete(item.id!);
      } catch (err) {
        console.warn(`Sync push failed for ${item.tableName} ID ${item.recordId}:`, err);
        // Stop outbox processing to retain order on network errors
        throw err;
      }
    }
  }

  // Pull remote modifications from Supabase
  private async pullRemoteChanges(businessId: string) {
    const lastSynced = localStorage.getItem('last_synced_at') || new Date(0).toISOString();
    const currentSyncTime = new Date().toISOString();

    // Pull from all tables sequentially
    for (const [localTable, supabaseTable] of Object.entries(TABLE_MAP)) {
      try {
        // Query modified records
        let query = supabase.from(supabaseTable).select('*').eq('business_id', businessId);
        
        if (localTable === 'notes') {
          const numericTime = new Date(lastSynced).getTime();
          query = query.gt('updated_at', numericTime);
        } else if (localTable === 'cftCalculations') {
          const numericTime = new Date(lastSynced).getTime();
          query = query.gt('created_at', numericTime);
        } else {
          query = query.gt('updated_at', lastSynced);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (!data || data.length === 0) continue;

        // Bypass outbox logging hooks on local DB
        db.syncing = true;

        await db.transaction('rw', db.table(localTable), async () => {
          for (const remoteRecord of data) {
            const localRecord = snakeToCamel(remoteRecord);

            // Handle deleted records
            if (remoteRecord.deleted_at) {
              await db.table(localTable).delete(remoteRecord.id);
            } else {
              // Upsert local record
              const cleanRecord = { ...localRecord };
              delete cleanRecord.ownerId;
              delete cleanRecord.businessId;
              delete cleanRecord.updatedAt;
              delete cleanRecord.deletedAt;

              await db.table(localTable).put(cleanRecord);
            }
          }
        });
      } catch (err) {
        console.warn(`Sync pull failed for ${localTable}:`, err);
        throw err;
      } finally {
        db.syncing = false;
      }
    }

    // Pull business settings updates
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      if (error) throw error;
      if (data?.settings) {
        db.syncing = true;
        await db.settings.put({
          key: 'general',
          ...snakeToCamel(data.settings)
        });
      }
    } catch (err) {
      console.warn('Sync settings pull failed:', err);
    } finally {
      db.syncing = false;
    }

    // Save timestamp checkpoint
    localStorage.setItem('last_synced_at', currentSyncTime);
  }
}

export const syncService = new SyncService();
