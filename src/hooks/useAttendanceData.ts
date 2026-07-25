import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Staff, type Attendance, type Settings, type CashTransaction, type CustomerDue, type Sale, type Vendor, type ProductionEntry, type Note, type ExpenseGroup, type Customer, type CustomerOrder, type CftCalculation, initDefaultSettings } from '../db/db';
import { useEffect, useState } from 'react';

export function useAttendanceData() {
  // Expose activeBranchId safely as a string UUID
  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    try {
      return localStorage.getItem('activeBranchId') || '';
    } catch (e) {
      console.warn('localStorage is restricted:', e);
      return '';
    }
  });

  const changeActiveBranch = (id: string) => {
    setActiveBranchId(id);
    try {
      localStorage.setItem('activeBranchId', id);
    } catch (e) {
      console.warn('localStorage is restricted:', e);
    }
  };

  // Ensure default settings are initialized
  useEffect(() => {
    initDefaultSettings();
  }, []);

  // Fetch all branches
  const branches = useLiveQuery(() => db.branches.toArray()) || [];

  // Auto-select first branch if activeBranchId is not set
  useEffect(() => {
    if (!activeBranchId && branches.length > 0) {
      const firstBranchId = branches[0].id;
      if (firstBranchId) {
        changeActiveBranch(firstBranchId);
      }
    }
  }, [branches, activeBranchId]);

  // Seeding default expense groups for the active branch if empty
  useEffect(() => {
    async function seedGroups() {
      if (!activeBranchId) return;
      try {
        const count = await db.expenseGroups.where('branchId').equals(activeBranchId).count();
        if (count === 0) {
          const defaultGroupNames = ['Shop', 'Production', 'Material', 'Labour', 'Delivery', 'Others'];
          for (const name of defaultGroupNames) {
            await db.expenseGroups.add({ name, branchId: activeBranchId });
          }
        }
      } catch (err) {
        console.error('Error seeding default expense groups:', err);
      }
    }
    seedGroups();
  }, [activeBranchId]);

  // Fetch staff members for the active branch
  const staff = useLiveQuery<Staff[]>(() => 
    activeBranchId ? db.staff.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  );
  
  const activeStaff = staff ? staff.filter(s => s.status === 'active') : [];
  const archivedStaff = staff ? staff.filter(s => s.status === 'archived') : [];
  const isLoading = staff === undefined;

  // Fetch Cash Transactions & Custom Categories for the active branch
  const cashTransactions = useLiveQuery<CashTransaction[]>(() => 
    activeBranchId ? db.cashLog.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];
  
  const customCategories = useLiveQuery(() => db.customCategories.toArray()) || [];

  // Fetch Customer Dues for the active branch
  const customerDues = useLiveQuery<CustomerDue[]>(() => 
    activeBranchId ? db.customerDues.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch Sales for the active branch
  const sales = useLiveQuery<Sale[]>(() =>
    activeBranchId ? db.sales.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch Vendors for the active branch
  const vendors = useLiveQuery<Vendor[]>(() => 
    activeBranchId ? db.vendors.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch Production Entries for the active branch
  const productionEntries = useLiveQuery<ProductionEntry[]>(() => 
    activeBranchId ? db.productionEntries.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch Notes for the active branch
  const notes = useLiveQuery<Note[]>(() =>
    activeBranchId ? db.notes.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch Expense Groups for the active branch
  const expenseGroups = useLiveQuery<ExpenseGroup[]>(() =>
    activeBranchId ? db.expenseGroups.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch Customers for the active branch
  const customers = useLiveQuery<Customer[]>(() =>
    activeBranchId ? db.customers.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch Customer Orders for the active branch
  const customerOrders = useLiveQuery<CustomerOrder[]>(() =>
    activeBranchId ? db.customerOrders.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch CFT Calculations for the active branch
  const cftCalculations = useLiveQuery<CftCalculation[]>(() =>
    activeBranchId ? db.cftCalculations.where('branchId').equals(activeBranchId).toArray() : Promise.resolve([]),
    [activeBranchId]
  ) || [];

  // Fetch settings
  const settings = useLiveQuery(() => db.settings.get('general')) || {
    key: 'general',
    businessName: 'My Business',
    currency: '$',
    weekStart: 1,
    theme: 'system' as const,
  };

  // Fetch attendance records
  const getAttendanceForDate = async (dateStr: string) => {
    return await db.attendance.where('date').equals(dateStr).toArray();
  };

  // Save/Update attendance records for a specific date
  const saveAttendanceForDate = async (dateStr: string, records: { staffId: string; value: number }[]) => {
    return await db.transaction('rw', [db.attendance], async () => {
      for (const record of records) {
        // Find existing attendance for this staff member on this date
        const existing = await db.attendance
          .where('[staffId+date]')
          .equals([record.staffId, dateStr])
          .first();

        if (existing) {
          await db.attendance.update(existing.id!, { attendanceValue: record.value });
        } else {
          await db.attendance.add({
            staffId: record.staffId,
            date: dateStr,
            attendanceValue: record.value,
          });
        }
      }
    });
  };

  // Staff CRUD operations (linked to activeBranchId)
  const addStaff = async (staffMember: Omit<Staff, 'id'>) => {
    return await db.staff.add({ ...staffMember, branchId: activeBranchId });
  };

  const updateStaff = async (id: string, staffMember: Partial<Staff>) => {
    return await db.staff.update(id, staffMember);
  };

  const archiveStaff = async (id: string) => {
    return await db.staff.update(id, { status: 'archived' });
  };

  const unarchiveStaff = async (id: string) => {
    return await db.staff.update(id, { status: 'active' });
  };

  const deleteStaff = async (id: string) => {
    return await db.staff.delete(id);
  };

  // Update Settings
  const updateSettings = async (newSettings: Partial<Omit<Settings, 'key'>>) => {
    const current = await db.settings.get('general');
    await db.settings.put({
      key: 'general',
      businessName: newSettings.businessName ?? current?.businessName ?? 'My Business',
      currency: newSettings.currency ?? current?.currency ?? '$',
      weekStart: newSettings.weekStart ?? current?.weekStart ?? 1,
      theme: newSettings.theme ?? current?.theme ?? 'system',
    });
  };

  // Report calculations helper
  const getSalaryReport = async (startDateStr: string, endDateStr: string) => {
    // Get all attendance records in the date range
    const attendanceRecords = await db.attendance
      .where('date')
      .between(startDateStr, endDateStr, true, true)
      .toArray();

    // Filter staff list to only match the selected active branch
    const staffList = activeBranchId ? await db.staff.where('branchId').equals(activeBranchId).toArray() : [];
    const staffMap = new Map<string, Staff>();
    staffList.forEach(s => staffMap.set(s.id!, s));

    // Filter attendance records to match active branch's staff
    const branchAttendanceRecords = attendanceRecords.filter(rec => staffMap.has(rec.staffId));

    // Group records by staff ID
    const recordsByStaff = new Map<string, Attendance[]>();
    branchAttendanceRecords.forEach(rec => {
      const list = recordsByStaff.get(rec.staffId) || [];
      list.push(rec);
      recordsByStaff.set(rec.staffId, list);
    });

    // Generate report entries
    const reportData = staffList.map(member => {
      const records = recordsByStaff.get(member.id!) || [];
      const totalDays = records.length;
      
      // Calculate total attendance score
      const totalAttendance = records.reduce((sum, r) => sum + r.attendanceValue, 0);
      
      // Dynamic salary = attendanceValue * dailySalary
      const totalSalary = records.reduce((sum, r) => sum + (r.attendanceValue * member.dailySalary), 0);

      return {
        staffId: member.id!,
        name: member.name,
        phone: member.phone,
        dailySalary: member.dailySalary,
        status: member.status,
        photo: member.photo,
        totalDays,
        totalAttendance,
        totalSalary,
        records, // daily breakdown
      };
    });

    return reportData;
  };

  // Cash Log Operations (linked to activeBranchId)
  const addTransaction = async (transaction: Omit<CashTransaction, 'id'>) => {
    return await db.cashLog.add({ ...transaction, branchId: activeBranchId });
  };

  const updateTransaction = async (id: string, transaction: Partial<CashTransaction>) => {
    return await db.cashLog.update(id, transaction);
  };

  const deleteTransaction = async (id: string) => {
    return await db.cashLog.delete(id);
  };

  const addCustomCategory = async (name: string, type: 'income' | 'expense' | 'both') => {
    return await db.customCategories.add({ name, type });
  };

  const deleteCustomCategory = async (id: string) => {
    return await db.customCategories.delete(id);
  };

  // --- Customer Dues Handlers (linked to activeBranchId) ---
  const addDue = async (due: Omit<CustomerDue, 'id'>) => {
    return await db.customerDues.add({ ...due, branchId: activeBranchId });
  };

  const receiveDue = async (id: string, receivedAmount?: number, paymentDate?: string) => {
    return await db.transaction('rw', [db.customerDues, db.cashLog, db.customerOrders], async () => {
      const due = await db.customerDues.get(id);
      if (!due) throw new Error('Due not found');

      const amt = receivedAmount !== undefined ? receivedAmount : due.amount;
      const payDate = paymentDate || new Date().toISOString().split('T')[0];

      if (amt < due.amount) {
        // Partial payment: decrement due amount but keep pending
        const remaining = due.amount - amt;
        await db.customerDues.update(id, {
          amount: remaining,
          notes: `${due.notes ? due.notes + ' ' : ''}(Paid ${amt} on ${payDate})`,
        });
      } else {
        // Full/over payment: mark received
        await db.customerDues.update(id, {
          amount: Math.max(0, due.amount - amt),
          status: 'received',
          receivedDate: payDate,
        });
      }

      // Sync to linked customer order if orderId exists
      if (due.orderId) {
        const order = await db.customerOrders.get(due.orderId);
        if (order) {
          const remainingOrderDues = Math.max(0, order.dues - amt);
          await db.customerOrders.update(due.orderId, { dues: remainingOrderDues });
        }
      }

      // Add to cashLog (automatically logging payment income under the correct branch!)
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await db.cashLog.add({
        type: 'income',
        category: 'Customer Payment',
        amount: amt,
        date: payDate,
        time: timeStr,
        partyName: due.customerName,
        notes: `Payment received for due (ID: #${id}) ${due.notes ? `- ${due.notes}` : ''}`,
        createdAt: Date.now(),
        branchId: due.branchId || activeBranchId,
      });
    });
  };

  const updateDue = async (id: string, due: Partial<CustomerDue>) => {
    return await db.customerDues.update(id, due);
  };

  const deleteDue = async (id: string) => {
    return await db.customerDues.delete(id);
  };

  // --- Sales Operations (linked to activeBranchId) ---
  const addSale = async (sale: Omit<Sale, 'id'>) => {
    return await db.sales.add({ ...sale, branchId: activeBranchId });
  };

  const updateSale = async (id: string, sale: Partial<Sale>) => {
    return await db.sales.update(id, sale);
  };

  const deleteSale = async (id: string) => {
    return await db.sales.delete(id);
  };

  // --- Branch Management Operations ---
  const addBranch = async (name: string) => {
    return await db.branches.add({ name });
  };

  const renameBranch = async (id: string, newName: string) => {
    return await db.branches.update(id, { name: newName });
  };

  const deleteBranch = async (id: string) => {
    return await db.transaction('rw', [db.branches, db.staff, db.cashLog, db.customerDues, db.sales], async () => {
      const count = await db.branches.count();
      if (count <= 1) {
        throw new Error('Cannot delete the only branch.');
      }
      
      // Delete branch
      await db.branches.delete(id);

      // Clean up records associated with deleted branch
      await db.staff.where('branchId').equals(id).delete();
      await db.cashLog.where('branchId').equals(id).delete();
      await db.customerDues.where('branchId').equals(id).delete();
      await db.sales.where('branchId').equals(id).delete();
    });
  };

  // Import Database Backup
  const importBackup = async (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      if (!data.staff || !data.attendance || !data.settings) {
        throw new Error('Invalid backup file structure.');
      }

      await db.transaction('rw', [db.staff, db.attendance, db.settings, db.cashLog, db.customCategories, db.customerDues, db.branches, db.sales], async () => {
        // Clear existing tables
        await db.staff.clear();
        await db.attendance.clear();
        await db.settings.clear();
        await db.cashLog.clear();
        await db.customCategories.clear();
        await db.customerDues.clear();
        await db.branches.clear();
        await db.sales.clear();

        // Restore records
        if (Array.isArray(data.staff)) {
          await db.staff.bulkAdd(data.staff);
        }
        if (Array.isArray(data.attendance)) {
          await db.attendance.bulkAdd(data.attendance);
        }
        if (Array.isArray(data.settings)) {
          await db.settings.bulkAdd(data.settings);
        }
        if (Array.isArray(data.cashLog)) {
          await db.cashLog.bulkAdd(data.cashLog);
        }
        if (Array.isArray(data.customCategories)) {
          await db.customCategories.bulkAdd(data.customCategories);
        }
        if (Array.isArray(data.customerDues)) {
          await db.customerDues.bulkAdd(data.customerDues);
        }
        if (Array.isArray(data.sales)) {
          await db.sales.bulkAdd(data.sales);
        }

        // Restore branches with fallback migration
        if (Array.isArray(data.branches) && data.branches.length > 0) {
          await db.branches.bulkAdd(data.branches);
        } else {
          // Fallback: create default branch
          const defaultBranchId = await db.branches.add({ name: 'Main Branch' });
          await db.staff.toCollection().modify(s => {
            if (!s.branchId) s.branchId = defaultBranchId;
          });
          await db.cashLog.toCollection().modify(c => {
            if (!c.branchId) c.branchId = defaultBranchId;
          });
          await db.customerDues.toCollection().modify(d => {
            if (!d.branchId) d.branchId = defaultBranchId;
          });
          await db.sales.toCollection().modify(sa => {
            if (!sa.branchId) sa.branchId = defaultBranchId;
          });
        }
      });
      return true;
    } catch (e) {
      console.error('Backup import error:', e);
      throw e;
    }
  };

  // Export Database Backup
  const exportBackup = async () => {
    const staffList = await db.staff.toArray();
    const attendanceList = await db.attendance.toArray();
    const settingsList = await db.settings.toArray();
    const cashList = await db.cashLog.toArray();
    const categoriesList = await db.customCategories.toArray();
    const duesList = await db.customerDues.toArray();
    const branchesList = await db.branches.toArray();
    const salesList = await db.sales.toArray();

    const backupData = {
      version: 5,
      timestamp: new Date().toISOString(),
      staff: staffList,
      attendance: attendanceList,
      settings: settingsList,
      cashLog: cashList,
      customCategories: categoriesList,
      customerDues: duesList,
      branches: branchesList,
      sales: salesList,
    };

    return JSON.stringify(backupData, null, 2);
  };

  const addVendor = async (vendor: Omit<Vendor, 'id' | 'branchId'>) => {
    return await db.vendors.add({
      ...vendor,
      branchId: activeBranchId,
    });
  };

  const updateVendor = async (id: string, vendor: Partial<Vendor>) => {
    return await db.vendors.update(id, vendor);
  };

  const deleteVendor = async (id: string) => {
    await db.productionEntries.where('vendorId').equals(id).delete();
    return await db.vendors.delete(id);
  };

  const addProductionEntry = async (entry: Omit<ProductionEntry, 'id' | 'branchId'>) => {
    return await db.productionEntries.add({
      ...entry,
      branchId: activeBranchId,
    });
  };

  const updateProductionEntry = async (id: string, entry: Partial<ProductionEntry>) => {
    return await db.productionEntries.update(id, entry);
  };

  const deleteProductionEntry = async (id: string) => {
    return await db.productionEntries.delete(id);
  };

  const payVendorDues = async (vendorId: string, vendorName: string, amount: number, notes?: string) => {
    const unpaidEntries = await db.productionEntries
      .where('vendorId')
      .equals(vendorId)
      .filter(e => e.status === 'unpaid')
      .toArray();

    // Sort by date then by id to ensure older-to-newer order
    unpaidEntries.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.id || '').localeCompare(b.id || '');
    });

    if (unpaidEntries.length === 0) return;

    await db.transaction('rw', [db.productionEntries, db.cashLog], async () => {
      let paymentLimit = amount;
      const paidEntryNames: string[] = [];

      for (const entry of unpaidEntries) {
        if (paymentLimit <= 0) break;

        const currentPaid = entry.paidAmount || 0;
        const remainingUnpaid = entry.totalAmount - currentPaid;

        if (paymentLimit >= remainingUnpaid) {
          // Fully pay this entry
          await db.productionEntries.update(entry.id!, {
            status: 'paid',
            paidAmount: entry.totalAmount,
            paidAt: Date.now(),
          });
          paymentLimit -= remainingUnpaid;
          paidEntryNames.push(`${entry.name} (Fully Paid)`);
        } else {
          // Partially pay this entry
          await db.productionEntries.update(entry.id!, {
            paidAmount: currentPaid + paymentLimit,
          });
          paidEntryNames.push(`${entry.name} (Partially Paid Rs ${paymentLimit})`);
          paymentLimit = 0;
        }
      }

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

      const entrySummary = paidEntryNames.join(', ');
      await db.cashLog.add({
        type: 'expense',
        category: 'Outsourced Production',
        amount,
        date: dateStr,
        time: timeStr,
        partyName: vendorName,
        notes: `Paid dues to ${vendorName}: ${entrySummary}${notes ? ' - ' + notes : ''}`,
        branchId: activeBranchId,
        createdAt: Date.now(),
      });
    });
  };

  // --- Notes Handlers (linked to activeBranchId) ---
  const addNote = async (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>) => {
    const now = Date.now();
    return await db.notes.add({
      ...note,
      createdAt: now,
      updatedAt: now,
      branchId: activeBranchId,
    });
  };

  const updateNote = async (id: string, note: Partial<Omit<Note, 'id' | 'createdAt' | 'branchId'>>) => {
    return await db.notes.update(id, {
      ...note,
      updatedAt: Date.now(),
    });
  };

  const deleteNote = async (id: string) => {
    return await db.notes.delete(id);
  };

  // --- Expense Groups Handlers (linked to activeBranchId) ---
  const addExpenseGroup = async (name: string) => {
    return await db.expenseGroups.add({ name, branchId: activeBranchId });
  };

  const updateExpenseGroup = async (id: string, name: string) => {
    return await db.expenseGroups.update(id, { name });
  };

  const deleteExpenseGroup = async (id: string) => {
    return await db.transaction('rw', [db.expenseGroups, db.cashLog], async () => {
      const groupToDelete = await db.expenseGroups.get(id);
      if (!groupToDelete) return;

      let othersGroup = await db.expenseGroups
        .filter(g => g.branchId === activeBranchId && g.name.toLowerCase() === 'others')
        .first();

      if (!othersGroup) {
        const othersId = await db.expenseGroups.add({ name: 'Others', branchId: activeBranchId });
        othersGroup = { id: othersId, name: 'Others', branchId: activeBranchId };
      }

      await db.cashLog
        .where('groupId')
        .equals(id)
        .modify({ groupId: othersGroup.id });

      await db.expenseGroups.delete(id);
    });
  };

  // --- Customer Handlers (linked to activeBranchId) ---
  const addCustomer = async (customer: Omit<Customer, 'id' | 'branchId'>) => {
    return await db.customers.add({ ...customer, branchId: activeBranchId });
  };

  const updateCustomer = async (id: string, customer: Partial<Omit<Customer, 'id' | 'branchId'>>) => {
    return await db.customers.update(id, customer);
  };

  const deleteCustomer = async (id: string) => {
    return await db.transaction('rw', [db.customers, db.customerOrders, db.customerDues, db.sales], async () => {
      const orders = await db.customerOrders.where('customerId').equals(id).toArray();
      const orderIds = orders.map(o => o.id!).filter(Boolean);

      // Delete customer
      await db.customers.delete(id);
      // Delete customer orders
      await db.customerOrders.where('customerId').equals(id).delete();
      // Delete linked dues & sales
      for (const orderId of orderIds) {
        await db.customerDues.filter(d => d.orderId === orderId).delete();
        await db.sales.filter(s => s.orderId === orderId).delete();
      }
    });
  };

  // --- Customer Order Handlers (linked to activeBranchId) ---
  const addCustomerOrder = async (order: Omit<CustomerOrder, 'id' | 'branchId' | 'createdAt'>) => {
    return await db.transaction('rw', [db.customerOrders, db.customers, db.customerDues, db.sales], async () => {
      const orderId = await db.customerOrders.add({
        ...order,
        createdAt: Date.now(),
        branchId: activeBranchId
      });

      const customer = await db.customers.get(order.customerId);
      const customerName = customer ? customer.name : '';

      // Automatically add to Sales tab
      await db.sales.add({
        productName: order.productBought,
        description: `Customer Order: ${customerName}`,
        soldFor: order.totalAmount,
        totalCost: 0,
        profit: order.totalAmount,
        costBreakdown: [],
        branchId: activeBranchId,
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        orderId: orderId
      });

      if (order.dues > 0) {
        if (customer) {
          await db.customerDues.add({
            customerName: customer.name,
            customerPhone: customer.phone,
            amount: order.dues,
            notes: `Dues for order: ${order.productBought}`,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            branchId: activeBranchId,
            orderId: orderId
          });
        }
      }

      return orderId;
    });
  };

  const updateCustomerOrder = async (id: string, order: Partial<Omit<CustomerOrder, 'id' | 'branchId'>>) => {
    return await db.transaction('rw', [db.customerOrders, db.customerDues, db.customers, db.sales], async () => {
      await db.customerOrders.update(id, order);

      // Sync modifications to Sales tab
      const linkedSale = await db.sales.filter(s => s.orderId === id).first();
      if (linkedSale) {
        const updateData: Partial<Sale> = {};
        if (order.productBought !== undefined) {
          updateData.productName = order.productBought;
        }
        if (order.totalAmount !== undefined) {
          updateData.soldFor = order.totalAmount;
          updateData.profit = order.totalAmount - (linkedSale.totalCost || 0);
        }
        if (Object.keys(updateData).length > 0) {
          await db.sales.update(linkedSale.id!, updateData);
        }
      }

      if (order.dues !== undefined) {
        const linkedDue = await db.customerDues.filter(d => d.orderId === id).first();
        if (linkedDue) {
          if (order.dues === 0) {
            await db.customerDues.update(linkedDue.id!, {
              amount: 0,
              status: 'received',
              receivedDate: new Date().toISOString().split('T')[0]
            });
          } else {
            await db.customerDues.update(linkedDue.id!, {
              amount: order.dues,
              status: 'pending'
            });
          }
        } else if (order.dues > 0) {
          const fullOrder = await db.customerOrders.get(id);
          if (fullOrder) {
            const customer = await db.customers.get(fullOrder.customerId);
            if (customer) {
              await db.customerDues.add({
                customerName: customer.name,
                customerPhone: customer.phone,
                amount: order.dues,
                notes: `Dues for order: ${fullOrder.productBought}`,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                branchId: activeBranchId,
                orderId: id
              });
            }
          }
        }
      }
    });
  };

  const deleteCustomerOrder = async (id: string) => {
    return await db.transaction('rw', [db.customerOrders, db.customerDues, db.sales], async () => {
      await db.customerOrders.delete(id);
      await db.customerDues.filter(d => d.orderId === id).delete();
      await db.sales.filter(s => s.orderId === id).delete();
    });
  };

  // --- CFT Calculations Handlers (linked to activeBranchId) ---
  const addCftCalculation = async (calc: Omit<CftCalculation, 'id' | 'branchId' | 'createdAt'>) => {
    return await db.cftCalculations.add({
      ...calc,
      branchId: activeBranchId,
      createdAt: Date.now()
    });
  };

  const deleteCftCalculation = async (id: string) => {
    return await db.cftCalculations.delete(id);
  };

  const clearCftCalculations = async () => {
    return await db.cftCalculations.where('branchId').equals(activeBranchId).delete();
  };

  return {
    staff: staff || [],
    activeStaff,
    archivedStaff,
    isLoading,
    cashTransactions,
    customCategories,
    customerDues,
    sales,
    vendors,
    productionEntries,
    branches,
    activeBranchId,
    changeActiveBranch,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCustomCategory,
    deleteCustomCategory,
    addDue,
    receiveDue,
    updateDue,
    deleteDue,
    addSale,
    updateSale,
    deleteSale,
    addBranch,
    renameBranch,
    deleteBranch,
    settings,
    getAttendanceForDate,
    saveAttendanceForDate,
    addStaff,
    updateStaff,
    deleteStaff,
    archiveStaff,
    unarchiveStaff,
    updateSettings,
    getSalaryReport,
    importBackup,
    exportBackup,
    addVendor,
    updateVendor,
    deleteVendor,
    addProductionEntry,
    updateProductionEntry,
    deleteProductionEntry,
    payVendorDues,
    notes,
    addNote,
    updateNote,
    deleteNote,
    expenseGroups,
    addExpenseGroup,
    updateExpenseGroup,
    deleteExpenseGroup,
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    customerOrders,
    addCustomerOrder,
    updateCustomerOrder,
    deleteCustomerOrder,
    cftCalculations,
    addCftCalculation,
    deleteCftCalculation,
    clearCftCalculations,
  };
}
