import Dexie, { type Table } from 'dexie';

export interface Branch {
  id?: string;
  name: string;
}

export interface Staff {
  id?: string;
  name: string;
  phone: string;
  dailySalary: number;
  joinDate: string; // YYYY-MM-DD
  status: 'active' | 'archived';
  photo?: string; // base64 string
  branchId?: string; // associated branch ID
}

export interface Attendance {
  id?: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  attendanceValue: number; // 0, 0.5, 1, 1.5, 2
}

export interface Settings {
  key: string; // e.g. 'general'
  businessName: string;
  currency: string;
  weekStart: number; // 0 = Sunday, 1 = Monday
  theme: 'light' | 'dark' | 'system';
}

export interface CashTransaction {
  id?: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  partyName: string;
  notes: string;
  createdAt: number; // Unix timestamp
  branchId?: string; // associated branch ID
  groupId?: string; // linked parent expense group ID
}

export interface CustomCategory {
  id?: string;
  name: string;
  type: 'income' | 'expense' | 'both';
}

export interface CustomerDue {
  id?: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes: string;
  status: 'pending' | 'received';
  receivedDate?: string; // YYYY-MM-DD
  branchId?: string; // associated branch ID
  orderId?: string; // linked customer order ID
}

export interface CostItem {
  label: string;
  amount: number;
}

export interface Sale {
  id?: string;
  productName: string;
  description: string;
  soldFor: number;
  totalCost: number;
  profit: number;
  costBreakdown: CostItem[];
  branchId?: string; // associated branch ID
  date: string; // YYYY-MM-DD
  createdAt: number; // Unix timestamp
  orderId?: string; // linked customer order ID
}

export interface Vendor {
  id?: string;
  name: string;
  phone?: string;
  branchId?: string; // associated branch ID
}

export interface ProductionEntry {
  id?: string;
  vendorId: string;
  name: string;
  price: number; // price per unit
  unit: number; // quantity of units
  description?: string;
  remarks?: string;
  contactNo?: string;
  type: 'product' | 'service' | 'other';
  additionalCharges: CostItem[]; // custom charge label + amount
  totalAmount: number;
  status: 'unpaid' | 'paid';
  paidAmount?: number; // total amount paid towards this entry
  paidAt?: number; // unix timestamp when paid
  date: string; // YYYY-MM-DD
  branchId?: string; // associated branch ID
}

export interface Note {
  id?: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  branchId?: string;
}

export interface ExpenseGroup {
  id?: string;
  name: string;
  branchId?: string;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  branchId?: string;
}

export interface CustomerOrder {
  id?: string;
  customerId: string;
  productBought: string;
  totalAmount: number;
  advance: number;
  dues: number;
  deliveryDate: string; // YYYY-MM-DD
  status: 'pending' | 'in-production' | 'delivered';
  deliveryFeeType: 'included' | 'free' | 'not-from-us' | 'custom';
  deliveryFeeAmount?: number; // only if deliveryFeeType === 'custom'
  branchId?: string;
  createdAt: number;
}

export interface CftCalculation {
  id?: string;
  label: string;
  thickness: number;
  thicknessUnit: 'inches' | 'feet' | 'cm';
  width: number;
  widthUnit: 'inches' | 'feet' | 'cm';
  length: number;
  lengthUnit: 'inches' | 'feet' | 'cm';
  quantity: number;
  cftPerPiece: number;
  totalCft: number;
  branchId?: string;
  createdAt: number;
}

export interface UserProfile {
  googleId: string;
  fullName: string;
  email: string;
  profilePhoto?: string;
  authProvider: 'google' | 'email';
  passwordHash?: string; // stored for local email/password sign-in accounts
  createdDate: number; // unix timestamp
  lastLogin: number; // unix timestamp
  businessId: string;
  branchId: string;
  mobileNumber?: string;
  businessAddress?: string;
  businessType?: string;
}

export interface SyncOutboxEntry {
  id?: number;
  tableName: string;
  action: 'insert' | 'update' | 'delete';
  recordId: string;
  payload?: string; // JSON string of the record
  timestamp: number;
}

class StaffAttendanceDatabase extends Dexie {
  staff!: Table<Staff, string>;
  attendance!: Table<Attendance, string>;
  settings!: Table<Settings, string>;
  cashLog!: Table<CashTransaction, string>;
  customCategories!: Table<CustomCategory, string>;
  customerDues!: Table<CustomerDue, string>;
  branches!: Table<Branch, string>;
  sales!: Table<Sale, string>;
  vendors!: Table<Vendor, string>;
  productionEntries!: Table<ProductionEntry, string>;
  notes!: Table<Note, string>;
  expenseGroups!: Table<ExpenseGroup, string>;
  customers!: Table<Customer, string>;
  customerOrders!: Table<CustomerOrder, string>;
  cftCalculations!: Table<CftCalculation, string>;
  users!: Table<UserProfile, string>;
  syncOutbox!: Table<SyncOutboxEntry, number>;

  // Global flag to bypass hooks during remote sync operations
  public syncing: boolean = false;

  // Callback to trigger instant sync when changes are saved to outbox
  public onChangesSaved?: () => void;

  constructor() {
    super('StaffAttendanceDatabase');
    
    this.version(1).stores({
      staff: '++id, name, phone, dailySalary, joinDate, status',
      attendance: '++id, staffId, date, [staffId+date]',
      settings: 'key',
    });

    this.version(2).stores({
      cashLog: '++id, type, category, amount, date, partyName',
      customCategories: '++id, name, type',
    });

    this.version(3).stores({
      customerDues: '++id, customerName, amount, date, status',
    });

    this.version(4).stores({
      staff: '++id, name, phone, dailySalary, joinDate, status, branchId',
      cashLog: '++id, type, category, amount, date, partyName, branchId',
      customerDues: '++id, customerName, amount, date, status, branchId',
      branches: '++id, name',
    }).upgrade(async tx => {
      const defaultBranchId = await tx.table('branches').add({ name: 'Main Branch' });
      await tx.table('staff').toCollection().modify(s => { if (!s.branchId) s.branchId = defaultBranchId; });
      await tx.table('cashLog').toCollection().modify(c => { if (!c.branchId) c.branchId = defaultBranchId; });
      await tx.table('customerDues').toCollection().modify(d => { if (!d.branchId) d.branchId = defaultBranchId; });
    });

    this.version(5).stores({
      sales: '++id, productName, soldFor, totalCost, profit, branchId, date',
    });

    this.version(6).stores({
      vendors: '++id, name, branchId',
      productionEntries: '++id, vendorId, name, type, status, branchId, date',
    });

    this.version(7).stores({
      notes: '++id, title, branchId, createdAt',
    });

    this.version(8).stores({
      expenseGroups: '++id, name, branchId',
      cashLog: '++id, type, category, amount, date, partyName, branchId, groupId',
    });

    this.version(9).stores({
      customers: '++id, name, phone, branchId',
      customerOrders: '++id, customerId, status, branchId, deliveryDate',
    });

    this.version(10).stores({
      cftCalculations: '++id, branchId, createdAt',
    });

    this.version(11).stores({
      users: 'googleId, email, businessId, branchId',
    });

    // Version 12: Migrate all primary keys to UUID strings and add syncOutbox
    this.version(12).stores({
      staff: 'id, name, phone, dailySalary, joinDate, status, branchId',
      attendance: 'id, staffId, date, [staffId+date]',
      settings: 'key',
      cashLog: 'id, type, category, amount, date, partyName, branchId, groupId',
      customCategories: 'id, name, type',
      customerDues: 'id, customerName, amount, date, status, branchId',
      branches: 'id, name',
      sales: 'id, productName, soldFor, totalCost, profit, branchId, date',
      vendors: 'id, name, branchId',
      productionEntries: 'id, vendorId, name, type, status, branchId, date',
      notes: 'id, title, branchId, createdAt',
      expenseGroups: 'id, name, branchId',
      customers: 'id, name, phone, branchId',
      customerOrders: 'id, customerId, status, branchId, deliveryDate',
      cftCalculations: 'id, branchId, createdAt',
      users: 'googleId, email, businessId, branchId',
      syncOutbox: '++id, tableName, action, recordId, timestamp',
    }).upgrade(async tx => {
      console.log('Migrating local database to Version 12 (UUIDs)...');
      
      // 1. Gather all existing records
      const oldBranches = await tx.table('branches').toArray();
      const oldStaff = await tx.table('staff').toArray();
      const oldAttendance = await tx.table('attendance').toArray();
      const oldCashLog = await tx.table('cashLog').toArray();
      const oldCustomCategories = await tx.table('customCategories').toArray();
      const oldCustomerDues = await tx.table('customerDues').toArray();
      const oldSales = await tx.table('sales').toArray();
      const oldVendors = await tx.table('vendors').toArray();
      const oldProductionEntries = await tx.table('productionEntries').toArray();
      const oldNotes = await tx.table('notes').toArray();
      const oldExpenseGroups = await tx.table('expenseGroups').toArray();
      const oldCustomers = await tx.table('customers').toArray();
      const oldCustomerOrders = await tx.table('customerOrders').toArray();
      const oldCftCalculations = await tx.table('cftCalculations').toArray();
      const oldUsers = await tx.table('users').toArray();

      // 2. Generate mappings from old integer IDs to new string UUIDs
      const branchMap = new Map<number, string>();
      const staffMap = new Map<number, string>();
      const customCategoryMap = new Map<number, string>();
      const customerMap = new Map<number, string>();
      const orderMap = new Map<number, string>();
      const vendorMap = new Map<number, string>();
      const expenseGroupMap = new Map<number, string>();

      oldBranches.forEach(b => { if (typeof b.id === 'number') branchMap.set(b.id, crypto.randomUUID()); });
      oldStaff.forEach(s => { if (typeof s.id === 'number') staffMap.set(s.id, crypto.randomUUID()); });
      oldCustomCategories.forEach(c => { if (typeof c.id === 'number') customCategoryMap.set(c.id, crypto.randomUUID()); });
      oldCustomers.forEach(c => { if (typeof c.id === 'number') customerMap.set(c.id, crypto.randomUUID()); });
      oldCustomerOrders.forEach(o => { if (typeof o.id === 'number') orderMap.set(o.id, crypto.randomUUID()); });
      oldVendors.forEach(v => { if (typeof v.id === 'number') vendorMap.set(v.id, crypto.randomUUID()); });
      oldExpenseGroups.forEach(eg => { if (typeof eg.id === 'number') expenseGroupMap.set(eg.id, crypto.randomUUID()); });

      // 3. Clear existing numeric records
      await tx.table('branches').clear();
      await tx.table('staff').clear();
      await tx.table('attendance').clear();
      await tx.table('cashLog').clear();
      await tx.table('customCategories').clear();
      await tx.table('customerDues').clear();
      await tx.table('sales').clear();
      await tx.table('vendors').clear();
      await tx.table('productionEntries').clear();
      await tx.table('notes').clear();
      await tx.table('expenseGroups').clear();
      await tx.table('customers').clear();
      await tx.table('customerOrders').clear();
      await tx.table('cftCalculations').clear();
      await tx.table('users').clear();

      // 4. Add records back with string UUID keys and mapped foreign keys
      for (const b of oldBranches) {
        const newId = branchMap.get(b.id) || crypto.randomUUID();
        await tx.table('branches').add({ ...b, id: newId });
      }

      for (const s of oldStaff) {
        const newId = staffMap.get(s.id) || crypto.randomUUID();
        const newBranchId = s.branchId ? branchMap.get(s.branchId) : undefined;
        await tx.table('staff').add({ ...s, id: newId, branchId: newBranchId });
      }

      for (const a of oldAttendance) {
        const newId = crypto.randomUUID();
        const newStaffId = staffMap.get(a.staffId) || crypto.randomUUID();
        await tx.table('attendance').add({ ...a, id: newId, staffId: newStaffId });
      }

      for (const c of oldCustomCategories) {
        const newId = customCategoryMap.get(c.id) || crypto.randomUUID();
        await tx.table('customCategories').add({ ...c, id: newId });
      }

      for (const eg of oldExpenseGroups) {
        const newId = expenseGroupMap.get(eg.id) || crypto.randomUUID();
        const newBranchId = eg.branchId ? branchMap.get(eg.branchId) : undefined;
        await tx.table('expenseGroups').add({ ...eg, id: newId, branchId: newBranchId });
      }

      for (const cl of oldCashLog) {
        const newId = crypto.randomUUID();
        const newBranchId = cl.branchId ? branchMap.get(cl.branchId) : undefined;
        const newGroupId = cl.groupId ? expenseGroupMap.get(cl.groupId) : undefined;
        await tx.table('cashLog').add({ ...cl, id: newId, branchId: newBranchId, groupId: newGroupId });
      }

      for (const v of oldVendors) {
        const newId = vendorMap.get(v.id) || crypto.randomUUID();
        const newBranchId = v.branchId ? branchMap.get(v.branchId) : undefined;
        await tx.table('vendors').add({ ...v, id: newId, branchId: newBranchId });
      }

      for (const c of oldCustomers) {
        const newId = customerMap.get(c.id) || crypto.randomUUID();
        const newBranchId = c.branchId ? branchMap.get(c.branchId) : undefined;
        await tx.table('customers').add({ ...c, id: newId, branchId: newBranchId });
      }

      for (const o of oldCustomerOrders) {
        const newId = orderMap.get(o.id) || crypto.randomUUID();
        const newCustomerId = customerMap.get(o.customerId) || crypto.randomUUID();
        const newBranchId = o.branchId ? branchMap.get(o.branchId) : undefined;
        await tx.table('customerOrders').add({ ...o, id: newId, customerId: newCustomerId, branchId: newBranchId });
      }

      for (const cd of oldCustomerDues) {
        const newId = crypto.randomUUID();
        const newBranchId = cd.branchId ? branchMap.get(cd.branchId) : undefined;
        const newOrderId = cd.orderId ? orderMap.get(cd.orderId) : undefined;
        await tx.table('customerDues').add({ ...cd, id: newId, branchId: newBranchId, orderId: newOrderId });
      }

      for (const sa of oldSales) {
        const newId = crypto.randomUUID();
        const newBranchId = sa.branchId ? branchMap.get(sa.branchId) : undefined;
        const newOrderId = sa.orderId ? orderMap.get(sa.orderId) : undefined;
        await tx.table('sales').add({ ...sa, id: newId, branchId: newBranchId, orderId: newOrderId });
      }

      for (const pe of oldProductionEntries) {
        const newId = crypto.randomUUID();
        const newVendorId = vendorMap.get(pe.vendorId) || crypto.randomUUID();
        const newBranchId = pe.branchId ? branchMap.get(pe.branchId) : undefined;
        await tx.table('productionEntries').add({ ...pe, id: newId, vendorId: newVendorId, branchId: newBranchId });
      }

      for (const n of oldNotes) {
        const newId = crypto.randomUUID();
        const newBranchId = n.branchId ? branchMap.get(n.branchId) : undefined;
        await tx.table('notes').add({ ...n, id: newId, branchId: newBranchId });
      }

      for (const cc of oldCftCalculations) {
        const newId = crypto.randomUUID();
        const newBranchId = cc.branchId ? branchMap.get(cc.branchId) : undefined;
        await tx.table('cftCalculations').add({ ...cc, id: newId, branchId: newBranchId });
      }

      for (const u of oldUsers) {
        const newBranchId = u.branchId ? branchMap.get(u.branchId) : undefined;
        await tx.table('users').add({ ...u, branchId: newBranchId || '' });
      }

      // Update activeBranchId string reference in localStorage
      const oldActiveBranchId = localStorage.getItem('activeBranchId');
      if (oldActiveBranchId) {
        const numId = parseInt(oldActiveBranchId, 10);
        if (!isNaN(numId)) {
          const newActiveBranchId = branchMap.get(numId);
          if (newActiveBranchId) {
            localStorage.setItem('activeBranchId', newActiveBranchId);
          }
        }
      }
      console.log('IndexedDB migration to UUIDs completed successfully.');
    });

    this.registerHooks();
  }

  private registerHooks() {
    const self = this;

    // Helper to log changes to outbox table
    async function addToOutbox(tableName: string, action: 'insert' | 'update' | 'delete', recordId: string, recordObj?: any) {
      if (self.syncing) return; // Skip outbox logging if we are writing remote sync updates
      try {
        await self.syncOutbox.add({
          tableName,
          action,
          recordId,
          payload: recordObj ? JSON.stringify(recordObj) : undefined,
          timestamp: Date.now(),
        });
        if (self.onChangesSaved) {
          self.onChangesSaved();
        }
      } catch (err) {
        console.error(`Failed to add outbox entry for ${tableName} ${action}:`, err);
      }
    }

    const tablesToHook = [
      'staff', 'attendance', 'cashLog', 'customCategories', 'customerDues',
      'branches', 'sales', 'vendors', 'productionEntries', 'notes',
      'expenseGroups', 'customers', 'customerOrders', 'cftCalculations', 'settings'
    ];

    tablesToHook.forEach(tName => {
      this.table(tName).hook('creating', (_primKey, obj) => {
        // Auto-assign UUID for non-settings tables
        if (tName !== 'settings' && !obj.id) {
          obj.id = crypto.randomUUID();
        }
        const idToLog = tName === 'settings' ? obj.key : obj.id;
        addToOutbox(tName, 'insert', idToLog, obj);
      });

      this.table(tName).hook('updating', (mods, _primKey, obj) => {
        const idToLog = tName === 'settings' ? obj.key : obj.id;
        const mergedObj = { ...obj, ...mods };
        addToOutbox(tName, 'update', idToLog, mergedObj);
      });

      this.table(tName).hook('deleting', (_primKey, obj) => {
        const idToLog = tName === 'settings' ? obj.key : obj.id;
        addToOutbox(tName, 'delete', idToLog);
      });
    });
  }
}

export const db = new StaffAttendanceDatabase();

db.open().catch(async (err) => {
  if (err.name === 'UpgradeError' || err.message?.toLowerCase().includes('primary key')) {
    console.warn("Primary key change or UpgradeError detected. Recreating local database...", err);
    try {
      await Dexie.delete('StaffAttendanceDatabase');
      window.location.reload();
    } catch (deleteErr) {
      console.error("Failed to delete database:", deleteErr);
    }
  }
});

// Helper to initialize default settings
export async function initDefaultSettings() {
  const existing = await db.settings.get('general');
  if (!existing) {
    await db.settings.put({
      key: 'general',
      businessName: 'My Business',
      currency: '$',
      weekStart: 1, // Monday
      theme: 'system',
    });
  }

  // Seed default branch if none exists
  const branchCount = await db.branches.count();
  if (branchCount === 0) {
    await db.branches.add({ name: 'Main Branch' });
  }
}

// Global date formatter helper to format dates as DD/MM/YYYY
export function formatDateToDMY(dateInput: string | number | Date | undefined): string {
  if (!dateInput) return '';
  try {
    let d: Date;
    if (typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      const parts = dateInput.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        return `${day}/${month}/${year}`;
      }
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return String(dateInput);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateInput);
  }
}
