import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, X, FolderPlus, 
  Calendar, AlertTriangle, CheckCircle2,
  DollarSign
} from 'lucide-react';
import { formatDateToDMY, type CashTransaction, type ExpenseGroup, type Settings } from '../db/db';

interface ExpensesViewProps {
  settings: Settings;
  cashTransactions: CashTransaction[];
  expenseGroups: ExpenseGroup[];
  addExpenseGroup: (name: string) => Promise<any>;
  updateExpenseGroup: (id: number, name: string) => Promise<any>;
  deleteExpenseGroup: (id: number) => Promise<any>;
  addTransaction: (tx: Omit<CashTransaction, 'id'>) => Promise<any>;
  updateTransaction: (id: number, tx: Partial<CashTransaction>) => Promise<any>;
  deleteTransaction: (id: number) => Promise<any>;
}

export function ExpensesView({
  settings,
  cashTransactions,
  expenseGroups,
  addExpenseGroup,
  updateExpenseGroup,
  deleteExpenseGroup,
  addTransaction,
  updateTransaction,
  deleteTransaction
}: ExpensesViewProps) {
  // Navigation & Modal States
  const [filterMode, setFilterMode] = useState<'day' | 'month' | 'time'>('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
  // Custom Selected Group state
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Custom Group Modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExpenseGroup | null>(null);
  const [groupName, setGroupName] = useState('');

  // Record/Edit Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseGroupId, setExpenseGroupId] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseTime, setExpenseTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [expenseNotes, setExpenseNotes] = useState('');

  // Confirmation Modals State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Toast UI feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  // Sync default group selection once groups load
  React.useEffect(() => {
    if (selectedGroupId === null && expenseGroups.length > 0) {
      setSelectedGroupId(expenseGroups[0].id || null);
    }
  }, [expenseGroups, selectedGroupId]);

  // Group Handlers
  const handleOpenAddGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setShowGroupModal(true);
  };

  const handleOpenEditGroup = (group: ExpenseGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const action = editingGroup ? 'rename' : 'create';
    triggerConfirm(
      `${editingGroup ? 'Rename' : 'Create'} Expense Group`,
      `Are you sure you want to ${action} this group to "${groupName.trim()}"?`,
      async () => {
        try {
          if (editingGroup) {
            await updateExpenseGroup(editingGroup.id!, groupName.trim());
            showToast('success', 'Group renamed successfully!');
          } else {
            await addExpenseGroup(groupName.trim());
            showToast('success', 'Group created successfully!');
          }
          setShowGroupModal(false);
          setGroupName('');
          setEditingGroup(null);
        } catch (err) {
          console.error(err);
          showToast('error', 'Failed to save group details.');
        }
      }
    );
  };

  const handleDeleteGroup = (group: ExpenseGroup) => {
    triggerConfirm(
      'Delete Expense Group',
      `Are you sure you want to delete the group "${group.name}"? All expenses in this group will be moved to the "Others" group. This action cannot be undone.`,
      async () => {
        try {
          // If deleted group was selected, switch selection to a different group
          if (selectedGroupId === group.id) {
            const nextGroup = expenseGroups.find(g => g.id !== group.id);
            setSelectedGroupId(nextGroup?.id || null);
          }
          await deleteExpenseGroup(group.id!);
          showToast('success', 'Group deleted and expenses moved to "Others".');
        } catch (err) {
          console.error(err);
          showToast('error', 'Failed to delete group.');
        }
      }
    );
  };

  // Expense Handlers
  const handleOpenAddExpense = () => {
    setEditingTx(null);
    setExpenseName('');
    setExpenseAmount('');
    // Lock to the currently active group selection
    setExpenseGroupId(selectedGroupId || expenseGroups[0]?.id || 0);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    const now = new Date();
    setExpenseTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setExpenseNotes('');
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (tx: CashTransaction) => {
    setEditingTx(tx);
    setExpenseName(tx.category);
    setExpenseAmount(tx.amount.toString());
    setExpenseGroupId(tx.groupId || 0);
    setExpenseDate(tx.date);
    setExpenseTime(tx.time);
    setExpenseNotes(tx.notes || '');
    setShowExpenseModal(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(expenseAmount);
    if (!expenseName.trim() || isNaN(amtNum) || amtNum <= 0) return;

    try {
      const txData = {
        type: 'expense' as const,
        category: expenseName.trim(),
        amount: amtNum,
        date: expenseDate,
        time: expenseTime,
        partyName: '',
        notes: expenseNotes.trim(),
        groupId: expenseGroupId || undefined,
        createdAt: editingTx ? editingTx.createdAt : Date.now(),
      };

      if (editingTx) {
        await updateTransaction(editingTx.id!, txData);
        showToast('success', 'Expense transaction updated!');
      } else {
        await addTransaction(txData);
        showToast('success', 'Expense transaction saved!');
      }
      setShowExpenseModal(false);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save expense transaction.');
    }
  };

  const handleDeleteExpense = (id: number) => {
    triggerConfirm(
      'Delete Expense',
      'Are you sure you want to delete this expense record? This will permanently remove it from both Expenses and Cash Log lists.',
      async () => {
        try {
          await deleteTransaction(id);
          showToast('success', 'Expense transaction deleted.');
        } catch (err) {
          console.error(err);
          showToast('error', 'Failed to delete transaction.');
        }
      }
    );
  };

  // Filters calculations
  const filterTransactions = () => {
    return cashTransactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      if (filterMode === 'day') {
        return tx.date === selectedDate;
      } else if (filterMode === 'month') {
        const [year, month] = tx.date.split('-');
        return Number(year) === selectedYear && Number(month) === (selectedMonth + 1);
      }
      return true; // 'time' shows all time
    });
  };

  const activeTransactions = filterTransactions();

  // Filter transactions for the selected group
  const groupTransactions = activeTransactions.filter(tx => tx.groupId === selectedGroupId);

  // Sort group transactions: newest first
  const sortedGroupTransactions = [...groupTransactions].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.time.localeCompare(a.time);
  });

  // Calculate totals per group (still scoped to the active date/month filters)
  const getGroupTotal = (groupId?: number) => {
    return activeTransactions
      .filter(tx => tx.groupId === groupId)
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  const totalExpenseAccrued = activeTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency === '$' ? 'USD' : settings.currency === '₹' ? 'INR' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val).replace('USD', '$').replace('INR', '₹').replace('EUR', '€');
  };

  // Helper arrays
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-16">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-xl border text-xs font-semibold shadow-lg animate-scale-up ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-808 dark:text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-808 dark:text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 1. Header Metrics Card */}
      <div className="glass-card rounded-2xl p-5 border border-stone-200/35 dark:border-stone-800/30 flex items-center gap-4.5">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <DollarSign size={20} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
            {filterMode === 'day' ? "Day's Total Expenses" : filterMode === 'month' ? "Month's Total Expenses" : "All Time Expenses"}
          </span>
          <span className="text-xl md:text-2xl font-extrabold text-stone-850 dark:text-stone-100 mt-0.5 truncate">
            {formatCurrency(totalExpenseAccrued)}
          </span>
        </div>
      </div>

      {/* 2. Filter controls Panel */}
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Segment switch */}
          <div className="flex p-0.5 bg-stone-100 dark:bg-darkSecondary rounded-xl border border-stone-250/20 dark:border-stone-800/40 w-fit shrink-0">
            {[
              { id: 'day', label: 'By Day' },
              { id: 'month', label: 'By Month' },
              { id: 'time', label: 'All Time' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => setFilterMode(preset.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-3xs font-semibold transition-all ${
                  filterMode === preset.id
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'text-stone-500 hover:text-stone-750 dark:text-stone-450 dark:hover:text-stone-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Dynamic selector block */}
          {filterMode === 'day' && (
            <div className="flex items-center gap-1.5 text-3xs font-semibold text-stone-500 dark:text-stone-455 animate-fade-in">
              <Calendar size={12} className="text-stone-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-stone-50 dark:bg-darkSecondary border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200 focus:outline-none"
              />
            </div>
          )}

          {filterMode === 'month' && (
            <div className="flex items-center gap-2 animate-fade-in">
              {/* Month Dropdown */}
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="px-2.5 py-1 text-3xs font-semibold rounded-xl border border-stone-200/50 dark:border-stone-850/50 bg-stone-55 dark:bg-darkSecondary text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
              >
                {months.map((m, i) => (
                  <option key={m} value={i} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">{m}</option>
                ))}
              </select>
              
              {/* Year Dropdown */}
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="px-2.5 py-1 text-3xs font-semibold rounded-xl border border-stone-200/50 dark:border-stone-850/50 bg-stone-55 dark:bg-darkSecondary text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
              >
                {years.map(y => (
                  <option key={y} value={y} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">{y}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. Groups List & Analytics */}
      <div className="flex flex-col gap-3.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
            Expense Groups Breakdown
          </span>
          <button
            onClick={handleOpenAddGroup}
            className="flex items-center gap-1 text-4xs font-bold text-accent hover:underline"
          >
            <FolderPlus size={12} />
            Add Group
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {expenseGroups.map(group => {
            const totalGroupSpend = getGroupTotal(group.id);
            const percentage = totalExpenseAccrued > 0 ? Math.round((totalGroupSpend / totalExpenseAccrued) * 100) : 0;
            const isSelected = selectedGroupId === group.id;
            return (
              <div 
                key={group.id}
                onClick={() => setSelectedGroupId(group.id!)}
                className={`rounded-2xl border-2 p-4.5 flex flex-col justify-between transition-all group relative cursor-pointer ${
                  isSelected 
                    ? 'border-primary dark:border-accent bg-primary/5 dark:bg-accent/5 shadow-sm' 
                    : 'glass-card border-stone-200/35 dark:border-stone-800/30 hover:border-accent/40'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-bold text-stone-850 dark:text-stone-100 truncate">{group.name}</span>
                    <span className="text-4xs text-stone-450 dark:text-stone-500 font-semibold">{percentage}% of total expenses</span>
                  </div>
                  
                  {/* Actions overlay for custom group edits */}
                  <div className="flex gap-1 shrink-0 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditGroup(group);
                      }}
                      className="p-1 rounded-lg text-stone-450 hover:text-accent hover:bg-stone-100 dark:hover:bg-stone-800"
                      title="Rename Group"
                    >
                      <Edit2 size={11} />
                    </button>
                    {group.name.toLowerCase() !== 'others' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group);
                        }}
                        className="p-1 rounded-lg text-stone-450 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                        title="Delete Group"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between mt-4">
                  <span className="text-base font-extrabold text-stone-800 dark:text-accent">
                    {formatCurrency(totalGroupSpend)}
                  </span>
                  <div className="h-1.5 w-16 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden shrink-0">
                    <div 
                      className="bg-accent h-full rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Transactions List under Selected Group */}
      <div className="flex flex-col gap-4.5 mt-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-stone-850 dark:text-stone-200">
            {selectedGroupId 
              ? `Expenses under "${expenseGroups.find(g => g.id === selectedGroupId)?.name}" (${sortedGroupTransactions.length})`
              : 'Select a group above to manage expenses'}
          </span>
          {selectedGroupId && (
            <button
              onClick={handleOpenAddExpense}
              className="flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-3xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus size={11} />
              Add Expense
            </button>
          )}
        </div>

        {!selectedGroupId ? (
          <div className="glass-card rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2 border border-stone-200/30 dark:border-stone-800/30">
            <span className="text-xs text-stone-550 dark:text-stone-400 font-semibold">No Group Selected</span>
            <span className="text-3xs text-stone-450 dark:text-stone-500 max-w-xs leading-relaxed">
              Click an expense group card above to view and add expenses under it.
            </span>
          </div>
        ) : sortedGroupTransactions.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2 border border-stone-200/30 dark:border-stone-800/30">
            <span className="text-xs text-stone-550 dark:text-stone-400 font-semibold">No Expense Records Found</span>
            <span className="text-3xs text-stone-450 dark:text-stone-500 max-w-xs leading-relaxed">
              No transactions recorded for this group inside the selected period range. Click "Add Expense" to record one!
            </span>
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-stone-200/40 dark:border-stone-850/40 overflow-hidden shadow-2xs divide-y divide-stone-200/50 dark:divide-stone-800/40 animate-fade-in">
            {sortedGroupTransactions.map(tx => {
              return (
                <div key={tx.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-stone-50/20 dark:hover:bg-stone-800/10 transition-colors">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-3xs font-bold text-stone-500 px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded-full">{formatDateToDMY(tx.date)} at {tx.time}</span>
                      <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">{tx.category}</h4>
                    </div>
                    {tx.notes && (
                      <p className="text-2xs text-stone-450 dark:text-stone-500 line-clamp-1">{tx.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-stone-200/10 pt-3 sm:pt-0">
                    <span className="text-sm font-extrabold text-red-605 dark:text-red-400">
                      -{formatCurrency(tx.amount)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditExpense(tx)}
                        className="p-1.5 text-stone-400 hover:text-accent rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                        title="Edit Record"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(tx.id!)}
                        className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                        title="Delete Record"
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

      {/* 5. Custom Confirm Dialog Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              {confirmModal.title}
            </h4>
            <p className="text-2xs text-stone-550 dark:text-stone-400 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center gap-3 justify-end mt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-stone-250/50 dark:border-stone-805/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-300 hover:bg-stone-105 dark:hover:bg-stone-800 transition-all"
              >
                No, Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-accent-hover text-white shadow-sm transition-all"
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Custom Group Add/Edit Dialog Modal */}
      {showGroupModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent">
                {editingGroup ? 'Rename Group' : 'Create Group'}
              </h4>
              <button
                onClick={() => setShowGroupModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delivery, Raw Material, Shop..."
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 border border-stone-250/50 dark:border-stone-805/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-300 hover:bg-stone-105 dark:hover:bg-stone-805 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Record / Edit Expense Dialog Modal */}
      {showExpenseModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent">
                {editingTx ? 'Edit Expense Record' : 'Record Expense'}
              </h4>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="flex flex-col gap-4">
              
              {/* Expense Category / Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Expense Category / Item
                </label>
                <input
                  type="text"
                  placeholder="e.g. Electric bill, Polish solvent..."
                  value={expenseName}
                  onChange={e => setExpenseName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                  autoFocus
                />
              </div>

              {/* Row: Amount & Group */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Amount ({settings.currency})
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                {/* Locked Group selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Expense Group
                  </label>
                  <select
                    value={expenseGroupId}
                    onChange={e => setExpenseGroupId(Number(e.target.value))}
                    disabled={true}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-100 dark:bg-stone-800 text-xs text-stone-450 dark:text-stone-400 cursor-not-allowed opacity-80"
                  >
                    {expenseGroups.map(g => (
                      <option key={g.id} value={g.id} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-850 text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Time
                  </label>
                  <input
                    type="time"
                    value={expenseTime}
                    onChange={e => setExpenseTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-850 text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Description / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Remarks description..."
                  value={expenseNotes}
                  onChange={e => setExpenseNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 border border-stone-250/50 dark:border-stone-855/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-300 hover:bg-stone-105 dark:hover:bg-stone-850 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
