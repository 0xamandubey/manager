import Dexie, { type Table } from 'dexie';

export interface Branch {
  id?: number;
  name: string;
}

export interface Staff {
  id?: number;
  name: string;
  phone: string;
  dailySalary: number;
  joinDate: string; // YYYY-MM-DD
  status: 'active' | 'archived';
  photo?: string; // base64 string
  branchId?: number; // associated branch ID
}

export interface Attendance {
  id?: number;
  staffId: number;
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
  id?: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  partyName: string;
  notes: string;
  createdAt: number; // Unix timestamp
  branchId?: number; // associated branch ID
  groupId?: number; // linked parent expense group ID
}

export interface CustomCategory {
  id?: number;
  name: string;
  type: 'income' | 'expense' | 'both';
}

export interface CustomerDue {
  id?: number;
  customerName: string;
  customerPhone?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes: string;
  status: 'pending' | 'received';
  receivedDate?: string; // YYYY-MM-DD
  branchId?: number; // associated branch ID
  orderId?: number; // linked customer order ID
}

export interface CostItem {
  label: string;
  amount: number;
}

export interface Sale {
  id?: number;
  productName: string;
  description: string;
  soldFor: number;
  totalCost: number;
  profit: number;
  costBreakdown: CostItem[];
  branchId?: number; // associated branch ID
  date: string; // YYYY-MM-DD
  createdAt: number; // Unix timestamp
  orderId?: number; // linked customer order ID
}

export interface Vendor {
  id?: number;
  name: string;
  phone?: string;
  branchId?: number; // associated branch ID
}

export interface ProductionEntry {
  id?: number;
  vendorId: number;
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
  branchId?: number; // associated branch ID
}

export interface Note {
  id?: number;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  branchId?: number;
}

export interface ExpenseGroup {
  id?: number;
  name: string;
  branchId?: number;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  branchId?: number;
}

export interface CustomerOrder {
  id?: number;
  customerId: number;
  productBought: string;
  totalAmount: number;
  advance: number;
  dues: number;
  deliveryDate: string; // YYYY-MM-DD
  status: 'pending' | 'in-production' | 'delivered';
  deliveryFeeType: 'included' | 'free' | 'not-from-us' | 'custom';
  deliveryFeeAmount?: number; // only if deliveryFeeType === 'custom'
  branchId?: number;
  createdAt: number;
}

export interface CftCalculation {
  id?: number;
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
  branchId?: number;
  createdAt: number;
}




class StaffAttendanceDatabase extends Dexie {
  staff!: Table<Staff>;
  attendance!: Table<Attendance>;
  settings!: Table<Settings>;
  cashLog!: Table<CashTransaction>;
  customCategories!: Table<CustomCategory>;
  customerDues!: Table<CustomerDue>;
  branches!: Table<Branch>;
  sales!: Table<Sale>;
  vendors!: Table<Vendor>;
  productionEntries!: Table<ProductionEntry>;
  notes!: Table<Note>;
  expenseGroups!: Table<ExpenseGroup>;
  customers!: Table<Customer>;
  customerOrders!: Table<CustomerOrder>;
  cftCalculations!: Table<CftCalculation>;

  constructor() {
    super('StaffAttendanceDatabase');
    
    this.version(1).stores({
      staff: '++id, name, phone, dailySalary, joinDate, status',
      attendance: '++id, staffId, date, [staffId+date]', // compound index to prevent double entries per day
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
      // Create default branch
      const defaultBranchId = await tx.table('branches').add({ name: 'Main Branch' });
      
      // Update existing records
      await tx.table('staff').toCollection().modify(s => {
        if (!s.branchId) s.branchId = defaultBranchId;
      });

      await tx.table('cashLog').toCollection().modify(c => {
        if (!c.branchId) c.branchId = defaultBranchId;
      });

      await tx.table('customerDues').toCollection().modify(d => {
        if (!d.branchId) d.branchId = defaultBranchId;
      });
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
  }
}

export const db = new StaffAttendanceDatabase();

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
      // Check if YYYY-MM-DD
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
