import { useState, useEffect } from 'react';
import { 
  Wallet, ArrowDownRight, ArrowUpRight, Plus, 
  Trash2, Copy, Edit2, Search, 
  X, PlusCircle, User, FileText 
} from 'lucide-react';
import { formatDateToDMY, type CashTransaction, type CustomCategory, type Staff, type Settings, type ExpenseGroup } from '../db/db';
import { db } from '../db/db';

interface CashLogViewProps {
  activeStaff: Staff[];
  settings: Settings;
  cashTransactions: CashTransaction[];
  customCategories: CustomCategory[];
  expenseGroups: ExpenseGroup[];
  addTransaction: (tx: Omit<CashTransaction, 'id'>) => Promise<any>;
  updateTransaction: (id: string, tx: Partial<CashTransaction>) => Promise<any>;
  deleteTransaction: (id: string) => Promise<any>;
  addCustomCategory: (name: string, type: 'income' | 'expense' | 'both') => Promise<any>;
}

const DEFAULT_INCOME_CATEGORIES = ['Customer Payment', 'Misc.'];
const DEFAULT_EXPENSE_CATEGORIES = ['Material', 'Salary', 'Transport', 'Rent', 'Electricity', 'Fuel', 'Food', 'Marketing', 'Misc.'];

export function CashLogView({
  activeStaff,
  settings,
  cashTransactions,
  customCategories,
  expenseGroups,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  addCustomCategory,
}: CashLogViewProps) {
  // Navigation & Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);

  // Form States
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseGroupId, setExpenseGroupId] = useState<string>('');
  const [partyName, setPartyName] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  
  // Custom Category Dialog
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense' | 'both'>('both');

  // Filters States
  const [filterDatePreset, setFilterDatePreset] = useState<'all' | 'today' | 'week' | 'lastweek' | 'month' | 'custom'>('month');
  const [filterCustomStart, setFilterCustomStart] = useState('');
  const [filterCustomEnd, setFilterCustomEnd] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Salary link states
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [unpaidSalaryCalc, setUnpaidSalaryCalc] = useState<number | null>(null);

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Form validation errors
  const [validationError, setValidationError] = useState('');

  const triggerToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Get active categories list
  const getCategories = (type: 'income' | 'expense') => {
    const defaults = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
    const custom = customCategories
      .filter(c => c.type === type || c.type === 'both')
      .map(c => c.name);
    return Array.from(new Set([...defaults, ...custom]));
  };

  // Reset transaction form
  const resetForm = () => {
    setAmount('');
    setCategory(modalType === 'income' ? 'Customer Payment' : 'Material');
    setExpenseGroupId('');
    setPartyName('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    const now = new Date();
    setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setValidationError('');
    setEditingTx(null);
    setSelectedStaffId('');
    setUnpaidSalaryCalc(null);
  };

  // Autofill form for Quick Actions
  const handleQuickAction = (type: 'income' | 'expense', initialCategory?: string, isSalary = false) => {
    setModalType(type);
    setShowModal(true);
    setAmount('');
    setPartyName('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    const now = new Date();
    setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setValidationError('');
    setEditingTx(null);
    setExpenseGroupId('');

    if (isSalary) {
      setCategory('Salary');
      // Set to first active staff if available
      if (activeStaff.length > 0) {
        setSelectedStaffId(activeStaff[0].id!.toString());
      }
    } else {
      setSelectedStaffId('');
      setCategory(initialCategory || (type === 'income' ? 'Customer Payment' : 'Material'));
    }
  };

  // Calculate unpaid salary when staff is selected
  useEffect(() => {
    if (category === 'Salary' && selectedStaffId) {
      calculateUnpaidSalary(selectedStaffId);
    } else {
      setUnpaidSalaryCalc(null);
    }
  }, [selectedStaffId, category]);

  const calculateUnpaidSalary = async (staffId: string) => {
    try {
      const staffMember = activeStaff.find(s => s.id === staffId);
      if (!staffMember) return;

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const firstDayStr = formatDate(firstDay);
      const lastDayStr = formatDate(lastDay);

      // 1. Calculate accrued salary based on attendance
      const attendanceRecords = await db.attendance
        .where('date')
        .between(firstDayStr, lastDayStr, true, true)
        .toArray();

      const staffRecords = attendanceRecords.filter(r => r.staffId === staffId);
      const totalAccrued = staffRecords.reduce((sum, r) => sum + (r.attendanceValue * staffMember.dailySalary), 0);

      // 2. Calculate already paid salaries this month
      const monthTransactions = await db.cashLog
        .where('date')
        .between(firstDayStr, lastDayStr, true, true)
        .toArray();

      const paidSalaries = monthTransactions
        .filter(t => t.type === 'expense' && t.category === 'Salary' && t.partyName === staffMember.name)
        .reduce((sum, t) => sum + t.amount, 0);

      const unpaid = totalAccrued - paidSalaries;
      setUnpaidSalaryCalc(unpaid > 0 ? unpaid : 0);
      setAmount(unpaid > 0 ? unpaid.toString() : '');
      setPartyName(staffMember.name);
    } catch (err) {
      console.error('Error calculating unpaid salary:', err);
    }
  };

  const handleOpenEdit = (tx: CashTransaction) => {
    setEditingTx(tx);
    setModalType(tx.type);
    setAmount(tx.amount.toString());
    setCategory(tx.category);
    setPartyName(tx.partyName);
    setNotes(tx.notes);
    setDate(tx.date);
    setTime(tx.time);
    setValidationError('');
    setExpenseGroupId(tx.groupId || '');
    
    // Check if it matches a staff member for salary
    const matchedStaff = activeStaff.find(s => s.name === tx.partyName);
    if (tx.category === 'Salary' && matchedStaff) {
      setSelectedStaffId(matchedStaff.id!.toString());
    } else {
      setSelectedStaffId('');
    }

    setShowModal(true);
  };

  const handleDuplicate = (tx: CashTransaction) => {
    setEditingTx(null);
    setModalType(tx.type);
    setAmount(tx.amount.toString());
    setCategory(tx.category);
    setPartyName(tx.partyName);
    setNotes(tx.notes + ' (Copy)');
    setDate(new Date().toISOString().split('T')[0]);
    const now = new Date();
    setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setValidationError('');
    setExpenseGroupId(tx.groupId || '');
    setShowModal(true);
    triggerToast('success', 'Transaction duplicated! Click Save to log.');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteTransaction(id);
        triggerToast('success', 'Transaction deleted successfully.');
      } catch (err) {
        triggerToast('error', 'Failed to delete transaction.');
      }
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setValidationError('Please enter a valid amount.');
      return;
    }

    if (!category) {
      setValidationError('Please select a category.');
      return;
    }

    const txData = {
      type: modalType,
      category,
      amount: amtNum,
      date,
      time,
      partyName: partyName.trim(),
      notes: notes.trim(),
      groupId: modalType === 'expense' && expenseGroupId ? expenseGroupId : undefined,
      createdAt: editingTx ? editingTx.createdAt : Date.now(),
    };

    try {
      if (editingTx) {
        await updateTransaction(editingTx.id!, txData);
        triggerToast('success', 'Transaction updated!');
      } else {
        await addTransaction(txData);
        triggerToast('success', 'Transaction saved!');
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Save transaction error:', err);
      setValidationError('Failed to save transaction details.');
    }
  };

  const handleAddCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      await addCustomCategory(newCatName.trim(), newCatType);
      setCategory(newCatName.trim());
      setShowCatModal(false);
      setNewCatName('');
      triggerToast('success', 'Custom category added!');
    } catch (err) {
      console.error('Error adding custom category:', err);
    }
  };

  // Helper date calculators
  const getPresetDates = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    switch (filterDatePreset) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'week': {
        const start = new Date(today);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 && settings.weekStart === 1 ? -6 : settings.weekStart);
        return { start: formatDate(new Date(start.setDate(diff))), end: todayStr };
      }
      case 'lastweek': {
        const start = new Date(today);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 && settings.weekStart === 1 ? -6 : settings.weekStart) - 7;
        const lastWeekStart = new Date(start.setDate(diff));
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
        return { start: formatDate(lastWeekStart), end: formatDate(lastWeekEnd) };
      }
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: formatDate(start), end: todayStr };
      }
      case 'custom':
        return { start: filterCustomStart, end: filterCustomEnd };
      default:
        return { start: '', end: '' };
    }
  };

  // Filter transactions
  const { start: filterStart, end: filterEnd } = getPresetDates();

  const filteredTx = cashTransactions.filter(tx => {
    // Type Filter
    if (filterType !== 'all' && tx.type !== filterType) return false;
    
    // Category Filter
    if (filterCategory !== 'all' && tx.category !== filterCategory) return false;

    // Date Filter
    if (filterStart && tx.date < filterStart) return false;
    if (filterEnd && tx.date > filterEnd) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const partyMatch = tx.partyName.toLowerCase().includes(q);
      const notesMatch = tx.notes.toLowerCase().includes(q);
      const catMatch = tx.category.toLowerCase().includes(q);
      if (!partyMatch && !notesMatch && !catMatch) return false;
    }

    return true;
  });

  // Calculate Metrics
  const allTimeIncome = cashTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const allTimeExpense = cashTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const currentCashBalance = allTimeIncome - allTimeExpense;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayIncome = cashTransactions.filter(t => t.type === 'income' && t.date === todayStr).reduce((sum, t) => sum + t.amount, 0);
  const todayExpense = cashTransactions.filter(t => t.type === 'expense' && t.date === todayStr).reduce((sum, t) => sum + t.amount, 0);

  const periodIncome = filteredTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const periodExpense = filteredTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const periodNetCash = periodIncome - periodExpense;

  // Sorting helper (newest first)
  const sortedTx = [...filteredTx].sort((a, b) => {
    const dateTimeA = `${a.date}T${a.time}`;
    const dateTimeB = `${b.date}T${b.time}`;
    return dateTimeB.localeCompare(dateTimeA);
  });

  // Unique categories used in transactions (for filters)
  const uniqueCategoriesUsed = Array.from(new Set(cashTransactions.map(t => t.category)));

  // Currency formatting
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency === '$' ? 'USD' : settings.currency === '₹' ? 'INR' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val).replace('USD', '$').replace('INR', '₹').replace('EUR', '€');
  };



  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-20">
      {/* Toast notifications */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold shadow-lg animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-emerald-500/90 text-white border-emerald-550' 
            : 'bg-red-500/90 text-white border-red-550'
        }`}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Cash Dashboard Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Cash Balance */}
        <div className="glass-card rounded-2xl p-3.5 sm:p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-4xs sm:text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold truncate">
              Current Cash
            </span>
            <span className="text-sm sm:text-2xl font-bold text-primary dark:text-accent mt-0.5 truncate">
              {formatCurrency(currentCashBalance)}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <Wallet size={16} className="sm:hidden" />
            <Wallet size={18} className="hidden sm:block" />
          </div>
        </div>

        {/* Metric 2: Today's Income */}
        <div className="glass-card rounded-2xl p-3.5 sm:p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-4xs sm:text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold truncate">
              Received
            </span>
            <span className="text-sm sm:text-2xl font-bold text-emerald-605 dark:text-emerald-400 mt-0.5 truncate">
              +{formatCurrency(todayIncome)}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-55/15 text-emerald-605 flex items-center justify-center shrink-0">
            <ArrowDownRight size={16} className="sm:hidden" />
            <ArrowDownRight size={18} className="hidden sm:block" />
          </div>
        </div>

        {/* Metric 3: Today's Expenses */}
        <div className="glass-card rounded-2xl p-3.5 sm:p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-4xs sm:text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold truncate">
              Exp
            </span>
            <span className="text-sm sm:text-2xl font-bold text-red-605 dark:text-red-400 mt-0.5 truncate">
              -{formatCurrency(todayExpense)}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-55/15 text-red-605 flex items-center justify-center shrink-0">
            <ArrowUpRight size={16} className="sm:hidden" />
            <ArrowUpRight size={18} className="hidden sm:block" />
          </div>
        </div>

        {/* Metric 4: Net Cash Flow */}
        <div className="glass-card rounded-2xl p-3.5 sm:p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-4xs sm:text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold truncate">
              Net Cash
            </span>
            <span className={`text-sm sm:text-2xl font-bold mt-0.5 truncate ${
              periodNetCash >= 0 ? 'text-emerald-605 dark:text-emerald-400' : 'text-red-605 dark:text-red-400'
            }`}>
              {periodNetCash >= 0 ? '+' : ''}{formatCurrency(periodNetCash)}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-stone-100 dark:bg-darkSecondary text-stone-550 flex items-center justify-center shrink-0">
            <span className="text-[10px] sm:text-xs font-bold font-sans">NET</span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleQuickAction('income', 'Customer Payment')}
          className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 text-2xs sm:text-xs font-bold shadow-sm transition-all text-center w-full"
        >
          <ArrowDownRight size={15} />
          <span>Receive Money</span>
        </button>

        <button
          onClick={() => handleQuickAction('expense', 'Material')}
          className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl border-2 border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-2xs sm:text-xs font-bold shadow-sm transition-all text-center w-full"
        >
          <ArrowUpRight size={15} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Filters & Actions Panel */}
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
        {/* Row 1: Search box */}
        <div className="relative w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by party, notes, category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Row 2: 3 Dropdowns Side-by-Side */}
        <div className="grid grid-cols-3 gap-2">
          {/* Dropdown 1: Date Preset */}
          <div className="flex items-center gap-1 bg-stone-50 dark:bg-darkSecondary border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-2 py-2 text-3xs font-bold w-full">
            <select
              value={filterDatePreset}
              onChange={e => setFilterDatePreset(e.target.value as any)}
              className="bg-transparent border-none outline-none text-stone-705 dark:text-stone-300 cursor-pointer w-full text-center focus:outline-none"
            >
              <option value="today" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Today</option>
              <option value="week" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">This Week</option>
              <option value="lastweek" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Last Week</option>
              <option value="month" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">This Month</option>
              <option value="all" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">All Time</option>
              <option value="custom" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Custom</option>
            </select>
          </div>

          {/* Dropdown 2: Transaction Type */}
          <div className="flex items-center gap-1 bg-stone-50 dark:bg-darkSecondary border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-2 py-2 text-3xs font-bold w-full">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-transparent border-none outline-none text-stone-705 dark:text-stone-300 cursor-pointer w-full text-center focus:outline-none"
            >
              <option value="all" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">All Types</option>
              <option value="income" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Income</option>
              <option value="expense" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Expense</option>
            </select>
          </div>

          {/* Dropdown 3: Category */}
          <div className="flex items-center gap-1 bg-stone-50 dark:bg-darkSecondary border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-2 py-2 text-3xs font-bold w-full">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-transparent border-none outline-none text-stone-705 dark:text-stone-300 cursor-pointer w-full text-center focus:outline-none"
            >
              <option value="all" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">All Categories</option>
              {uniqueCategoriesUsed.map(c => (
                <option key={c} value={c} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Custom Date Pickers (conditionally rendered below) */}
        {filterDatePreset === 'custom' && (
          <div className="flex items-center justify-center gap-2 p-3 bg-stone-50 dark:bg-darkSecondary/40 rounded-xl border border-stone-200/20 dark:border-stone-800/10 text-3xs font-bold w-full mt-1.5">
            <div className="flex flex-col gap-1 items-start flex-1">
              <span className="text-4xs text-stone-400">Start Date</span>
              <div className="relative w-full bg-stone-100 dark:bg-stone-850 border border-stone-200/50 dark:border-stone-800/50 rounded-lg px-2 py-1.5 text-stone-800 dark:text-stone-200 text-3xs font-medium cursor-pointer min-h-[28px] flex items-center">
                <span>{formatDateToDMY(filterCustomStart)}</span>
                <input
                  type="date"
                  value={filterCustomStart}
                  onChange={e => setFilterCustomStart(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>
            <span className="text-stone-400 self-end mb-2">to</span>
            <div className="flex flex-col gap-1 items-start flex-1">
              <span className="text-4xs text-stone-400">End Date</span>
              <div className="relative w-full bg-stone-100 dark:bg-stone-850 border border-stone-200/50 dark:border-stone-800/50 rounded-lg px-2 py-1.5 text-stone-800 dark:text-stone-200 text-3xs font-medium cursor-pointer min-h-[28px] flex items-center">
                <span>{formatDateToDMY(filterCustomEnd)}</span>
                <input
                  type="date"
                  value={filterCustomEnd}
                  onChange={e => setFilterCustomEnd(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="flex flex-col gap-3">
        <h3 className="font-semibold text-xs text-stone-800 dark:text-stone-200 uppercase tracking-wider pl-1">
          Transactions Ledger ({sortedTx.length})
        </h3>

        {sortedTx.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center flex flex-col items-center gap-2 border border-stone-200/40 dark:border-stone-850/40 shadow-sm">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              No transactions found.
            </span>
            <span className="text-3xs text-stone-400 dark:text-stone-500 max-w-xs">
              Clear filters, search queries, or use the quick action buttons above to record new transactions.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {sortedTx.map(tx => {
              const isIncome = tx.type === 'income';
              return (
                <div
                  key={tx.id}
                  className={`glass-card rounded-2xl p-4.5 flex items-center justify-between border-l-4 shadow-sm hover:shadow-md transition-all group ${
                    isIncome ? 'border-l-emerald-500 border-stone-200/45 dark:border-stone-850/45' : 'border-l-red-500 border-stone-200/45 dark:border-stone-850/45'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Icon bubble */}
                    <div className={`w-9.5 h-9.5 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome ? 'bg-emerald-500/10 text-emerald-650 dark:text-emerald-400' : 'bg-red-500/10 text-red-655 dark:text-red-400'
                    }`}>
                      {isIncome ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}
                    </div>

                    {/* Details Column */}
                    <div className="flex flex-col min-w-0 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                          {tx.category}
                        </span>
                        {tx.partyName && (
                          <span className="text-3xs text-stone-450 dark:text-stone-500 flex items-center gap-1 font-medium bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                            <User size={9} />
                            {tx.partyName}
                          </span>
                        )}
                      </div>

                      {tx.notes && (
                        <span className="text-3xs text-stone-500 dark:text-stone-450 truncate mt-0.5 flex items-center gap-1">
                          <FileText size={9} />
                          {tx.notes}
                        </span>
                      )}

                      <span className="text-4xs text-stone-450 dark:text-stone-550 mt-1">
                        {formatDateToDMY(tx.date)} at {tx.time}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Cash amount & actions */}
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={`text-sm font-bold ${
                      isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-605 dark:text-red-405'
                    }`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>

                    {/* Inline actions on hover/focus */}
                    <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(tx)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-darkSecondary text-stone-500 hover:text-accent border border-stone-205/10 dark:border-stone-800/10"
                        title="Edit transaction"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDuplicate(tx)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-darkSecondary text-stone-500 hover:text-accent border border-stone-205/10 dark:border-stone-800/10"
                        title="Duplicate transaction"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id!)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-darkSecondary text-stone-500 hover:text-red-500 border border-stone-205/10 dark:border-stone-800/10"
                        title="Delete transaction"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => handleQuickAction('income', 'Customer Payment')}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-30 w-12 h-12 rounded-full bg-accent hover:bg-opacity-95 text-white flex items-center justify-center shadow-lg shadow-accent/30 transition-transform active:scale-95"
        title="Add Transaction"
      >
        <Plus size={24} />
      </button>

      {/* Add / Edit Transaction Sheet Modal */}
      {showModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4.5 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent">
                {editingTx ? 'Edit Transaction' : 'Record Transaction'}
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-450 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                title="Close Dialog"
                aria-label="Close Dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Type selector (only when adding new) */}
            {!editingTx && (
              <div className="flex p-0.5 bg-stone-100 dark:bg-darkSecondary rounded-xl border border-stone-250/20 dark:border-stone-800/40 w-full mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setModalType('income');
                    setCategory('Customer Payment');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    modalType === 'income'
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-stone-500 dark:text-stone-450'
                  }`}
                >
                  Income (In)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalType('expense');
                    setCategory('Material');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    modalType === 'expense'
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-stone-500 dark:text-stone-450'
                  }`}
                >
                  Expense (Out)
                </button>
              </div>
            )}

            <form onSubmit={handleSaveTransaction} className="flex flex-col gap-4">
              {/* Amount input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Amount ({settings.currency})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-450">
                    {settings.currency}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-sm font-bold text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Category selector */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCatType(modalType);
                      setShowCatModal(true);
                    }}
                    className="text-4xs font-bold text-accent flex items-center gap-0.5 hover:underline"
                  >
                    <PlusCircle size={10} />
                    New Category
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 max-h-[110px] overflow-y-auto pr-1 no-scrollbar">
                  {getCategories(modalType).map(catName => {
                    const isSelected = category === catName;
                    return (
                      <button
                        key={catName}
                        type="button"
                        onClick={() => {
                          setCategory(catName);
                          // Reset staff selection if changing from Salary
                          if (catName !== 'Salary') {
                            setSelectedStaffId('');
                            setUnpaidSalaryCalc(null);
                          } else if (activeStaff.length > 0) {
                            setSelectedStaffId(activeStaff[0].id!.toString());
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-3xs font-medium border text-center transition-all ${
                          isSelected
                            ? 'bg-accent text-white border-accent'
                            : 'bg-stone-50 dark:bg-darkCard border-stone-200/50 dark:border-stone-800/50 text-stone-650 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                      >
                        {catName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expense Group Selector */}
              {modalType === 'expense' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Expense Group
                  </label>
                  <select
                    value={expenseGroupId}
                    onChange={e => setExpenseGroupId(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                  >
                    <option value="" className="bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-200">Select Group (Optional)</option>
                    {expenseGroups.map(g => (
                      <option key={g.id} value={g.id} className="bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-200">
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic salary dropdown or generic Party Name input */}
              {category === 'Salary' ? (
                <div className="flex flex-col gap-1.5 bg-stone-50 dark:bg-darkSecondary/40 p-3 rounded-xl border border-stone-200/20 dark:border-stone-800/10">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Pay To Staff Member
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={e => setSelectedStaffId(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  >
                    <option value="" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Select Staff Member</option>
                    {activeStaff.map(s => (
                      <option key={s.id} value={s.id} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">{s.name}</option>
                    ))}
                  </select>
                  
                  {unpaidSalaryCalc !== null && (
                    <div className="flex justify-between items-center mt-1.5 text-3xs">
                      <span className="text-stone-450">Monthly Unpaid Accrued:</span>
                      <span className="font-bold text-accent">{formatCurrency(unpaidSalaryCalc)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Party Name / Payer / Payee
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Client name, Vendor, Landlord"
                    value={partyName}
                    onChange={e => setPartyName(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                    list="party-suggestions"
                  />
                  <datalist id="party-suggestions">
                    {/* Suggest from active staff list */}
                    {activeStaff.map(s => (
                      <option key={s.id} value={s.name} />
                    ))}
                    {/* Suggest from unique names already used in ledger */}
                    {Array.from(new Set(cashTransactions.map(t => t.partyName).filter(Boolean))).map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              )}

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Notes / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #1024, cash payment"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Date & Time fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide font-sans">
                    Date
                  </label>
                  <div className="relative px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-850 dark:text-stone-200 cursor-pointer min-h-[38px] flex items-center">
                    <span>{formatDateToDMY(date)}</span>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide font-sans">
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none"
                  />
                </div>
              </div>

              {validationError && (
                <span className="text-3xs font-semibold text-red-500 text-center">
                  {validationError}
                </span>
              )}

              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-505 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-opacity-95 shadow-sm shadow-accent/25 transition-all"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Category Dialog */}
      {showCatModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-5 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-xs font-bold text-primary dark:text-accent">
                Create Custom Category
              </h4>
              <button
                onClick={() => setShowCatModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-450 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                title="Close Dialog"
                aria-label="Close Dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCustomCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maintenance, Bonus, Commission"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-805 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Applies to
                </label>
                <select
                  value={newCatType}
                  onChange={e => setNewCatType(e.target.value as any)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-805 dark:text-stone-200 focus:outline-none"
                >
                  <option value="both">Both Income & Expense</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expense Only</option>
                </select>
              </div>

              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-3.5 py-2 rounded-xl text-3xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-850"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl text-3xs font-semibold bg-accent text-white hover:bg-opacity-95 shadow-sm shadow-accent/25 transition-all"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
