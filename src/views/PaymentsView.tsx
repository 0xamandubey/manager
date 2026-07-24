import { useState } from 'react';
import { 
  Coins, Plus, Search, Check, Trash2, Edit2, 
  X, Calendar, User, FileText, Phone 
} from 'lucide-react';
import { formatDateToDMY, type CustomerDue, type Settings } from '../db/db';

interface PaymentsViewProps {
  settings: Settings;
  customerDues: CustomerDue[];
  addDue: (due: Omit<CustomerDue, 'id'>) => Promise<any>;
  receiveDue: (id: number, receivedAmount?: number, paymentDate?: string) => Promise<any>;
  updateDue: (id: number, due: Partial<CustomerDue>) => Promise<any>;
  deleteDue: (id: number) => Promise<any>;
}

export function PaymentsView({
  settings,
  customerDues,
  addDue,
  receiveDue,
  updateDue,
  deleteDue,
}: PaymentsViewProps) {
  // Modal & Tab States
  const [showModal, setShowModal] = useState(false);
  const [editingDue, setEditingDue] = useState<CustomerDue | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'collected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Form States
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Receive Payment Modal States
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingDue, setReceivingDue] = useState<CustomerDue | null>(null);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiveError, setReceiveError] = useState('');

  // Notifications/Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const triggerToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setFormError('');
    setEditingDue(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (due: CustomerDue) => {
    setEditingDue(due);
    setCustomerName(due.customerName);
    setCustomerPhone(due.customerPhone || '');
    setAmount(due.amount.toString());
    setDate(due.date);
    setNotes(due.notes);
    setFormError('');
    setShowModal(true);
  };

  const handleSaveDue = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }

    if (!customerName.trim()) {
      setFormError('Please enter a customer name.');
      return;
    }

    const dueData = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      amount: amtNum,
      date,
      notes: notes.trim(),
      status: editingDue ? editingDue.status : ('pending' as const),
      receivedDate: editingDue ? editingDue.receivedDate : undefined,
    };

    try {
      if (editingDue) {
        await updateDue(editingDue.id!, dueData);
        triggerToast('success', 'Due record updated!');
      } else {
        await addDue(dueData);
        triggerToast('success', 'Customer due added successfully!');
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Save due error:', err);
      setFormError('Failed to save credit details.');
    }
  };

  // Open Receive Payment Dialog
  const handleOpenReceiveDialog = (due: CustomerDue) => {
    setReceivingDue(due);
    setReceiveAmount(due.amount.toString());
    setReceiveDate(new Date().toISOString().split('T')[0]);
    setReceiveError('');
    setShowReceiveModal(true);
  };

  // Confirm received payment (Supports partial collection & custom payment dates)
  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiveError('');

    if (!receivingDue) return;

    const amtNum = parseFloat(receiveAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setReceiveError('Please enter a valid amount.');
      return;
    }

    if (amtNum > receivingDue.amount) {
      setReceiveError(`Amount cannot exceed outstanding due of ${formatCurrency(receivingDue.amount)}.`);
      return;
    }

    try {
      await receiveDue(receivingDue.id!, amtNum, receiveDate);
      triggerToast('success', 'Payment recorded successfully!');
      setShowReceiveModal(false);
      setReceivingDue(null);
    } catch (err) {
      console.error('Receive due payment error:', err);
      setReceiveError('Failed to record payment.');
    }
  };

  const handleDeleteDue = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this credit due record?')) {
      try {
        await deleteDue(id);
        triggerToast('success', 'Record deleted.');
      } catch (err) {
        console.error('Delete due error:', err);
        triggerToast('error', 'Failed to delete record.');
      }
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency === '$' ? 'USD' : settings.currency === '₹' ? 'INR' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val).replace('USD', '$').replace('INR', '₹').replace('EUR', '€');
  };

  // Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  
  const pendingDuesList = customerDues.filter(d => d.status === 'pending');
  const collectedDuesList = customerDues.filter(d => d.status === 'received');

  const totalPendingSum = pendingDuesList.reduce((sum, d) => sum + d.amount, 0);
  const collectedTodaySum = collectedDuesList
    .filter(d => d.receivedDate === todayStr)
    .reduce((sum, d) => sum + d.amount, 0);
  const totalCollectedSum = collectedDuesList.reduce((sum, d) => sum + d.amount, 0);

  // Filter lists based on Tab & Search Query
  const displayList = activeTab === 'pending' ? pendingDuesList : collectedDuesList;

  const filteredDues = displayList.filter(d => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = d.customerName.toLowerCase().includes(q);
      const phoneMatch = d.customerPhone?.toLowerCase().includes(q);
      const notesMatch = d.notes.toLowerCase().includes(q);
      return nameMatch || (phoneMatch || false) || notesMatch;
    }
    return true;
  });

  // Sort: newest due first
  const sortedDues = [...filteredDues].sort((a, b) => b.date.localeCompare(a.date));



  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-20">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold shadow-lg animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-emerald-500/90 text-white border-emerald-550' 
            : 'bg-red-500/90 text-white border-red-550'
        }`}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Metric 1: Pending Dues */}
        <div className="glass-card rounded-2xl p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
              Total Pending Dues
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-405 mt-0.5">
              {formatCurrency(totalPendingSum)}
            </span>
            <span className="text-4xs text-stone-400 dark:text-stone-500 mt-1">
              Outstanding credit balance
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Coins size={18} />
          </div>
        </div>

        {/* Metric 2: Collected Today */}
        <div className="glass-card rounded-2xl p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
              Collected Today
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              +{formatCurrency(collectedTodaySum)}
            </span>
            <span className="text-4xs text-stone-400 dark:text-stone-500 mt-1">
              Payments cleared today
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Check size={18} />
          </div>
        </div>

        {/* Metric 3: Total Collected Dues */}
        <div className="glass-card rounded-2xl p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
              Total Collected
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(totalCollectedSum)}
            </span>
            <span className="text-4xs text-stone-400 dark:text-stone-500 mt-1">
              Total credit payments cleared
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Coins size={18} />
          </div>
        </div>
      </div>

      {/* Dues Actions Header */}
      <div className="flex items-center justify-between">
        {/* Toggle active tab */}
        <div className="flex p-1 bg-stone-100 dark:bg-darkSecondary rounded-xl border border-stone-200/30 dark:border-stone-800/50">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'pending'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-stone-555 dark:text-stone-400 hover:text-stone-800'
            }`}
          >
            Pending Dues ({pendingDuesList.length})
          </button>
          <button
            onClick={() => setActiveTab('collected')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'collected'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-stone-555 dark:text-stone-400 hover:text-stone-800'
            }`}
          >
            Collected ({collectedDuesList.length})
          </button>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-opacity-95 text-white shadow-sm shadow-accent/25 transition-all"
        >
          <Plus size={15} />
          Add Customer Due
        </button>
      </div>

      {/* Dues List & Filters */}
      <div className="glass-card rounded-2xl p-5 flex flex-col gap-4 shadow-sm border border-stone-200/40 dark:border-stone-855/40">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by customer name, phone, or item notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-stone-200/50 dark:border-stone-850/50 bg-transparent rounded-xl focus:outline-none focus:border-accent text-stone-850 dark:text-stone-200"
            />
          </div>
        </div>

        {/* Ledger Items */}
        <div className="flex flex-col gap-3.5 mt-2">
          {sortedDues.length === 0 ? (
            <div className="text-center py-10 text-xs text-stone-500 dark:text-stone-400">
              No credit due records found. Click "Add Customer Due" to record.
            </div>
          ) : (
            sortedDues.map(due => {
              const isPending = due.status === 'pending';
              return (
                <div 
                  key={due.id}
                  className={`p-4.5 rounded-xl border-l-4 shadow-sm border border-stone-250/15 dark:border-stone-855/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                    isPending ? 'border-l-amber-500' : 'border-l-emerald-500'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-9.5 h-9.5 rounded-xl flex items-center justify-center shrink-0 ${
                      isPending ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      <Coins size={16} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1 font-sans">
                          <User size={10} className="text-stone-400" />
                          {due.customerName}
                        </span>
                        {due.customerPhone && (
                          <span className="text-3xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                            <Phone size={9} className="text-stone-400" />
                            {due.customerPhone}
                          </span>
                        )}
                        {!isPending && due.receivedDate && (
                          <span className="text-4xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                            Cleared: {formatDateToDMY(due.receivedDate)}
                          </span>
                        )}
                      </div>
                      {due.notes && (
                        <span className="text-3xs text-stone-500 dark:text-stone-450 mt-1 flex items-center gap-1">
                          <FileText size={10} className="text-stone-400 shrink-0" />
                          {due.notes}
                        </span>
                      )}
                      <span className="text-4xs text-stone-400 dark:text-stone-550 mt-1 flex items-center gap-1">
                        <Calendar size={10} className="text-stone-400" />
                        Due Date: {formatDateToDMY(due.date)}
                      </span>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className={`text-sm font-bold ${
                      isPending ? 'text-amber-605' : 'text-emerald-655'
                    }`}>
                      {formatCurrency(due.amount)}
                    </span>

                    <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPending && (
                        <button
                          onClick={() => handleOpenReceiveDialog(due)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-4xs font-bold shadow-sm"
                          title="Mark paid"
                        >
                          <Check size={10} />
                          Receive
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditModal(due)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-darkSecondary text-stone-550 hover:text-accent border border-stone-205/15 dark:border-stone-800/15"
                        title="Edit entry"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteDue(due.id!)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-darkSecondary text-stone-550 hover:text-red-500 border border-stone-205/15 dark:border-stone-800/15"
                        title="Delete entry"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add / Edit Modal Drawer */}
      {showModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-5 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent">
                {editingDue ? 'Edit Customer Due' : 'Record Customer Due'}
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

            <form onSubmit={handleSaveDue} className="flex flex-col gap-4">
              {/* Customer Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Robert Smith"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Customer Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Amount ({settings.currency})
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Due Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Due Date (Given by Customer)
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Purchase Details / Notes
                </label>
                <textarea
                  placeholder="e.g. Deposit for Dining Table and 6 Chairs"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent min-h-[70px] resize-none"
                />
              </div>

              {formError && (
                <span className="text-3xs font-semibold text-red-500 text-center">
                  {formError}
                </span>
              )}

              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-opacity-95 shadow-sm shadow-accent/25"
                >
                  Save Due Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment Modal (Supports custom amount and payment date) */}
      {showReceiveModal && receivingDue && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 shadow-xl flex flex-col gap-4.5 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-sm font-bold text-primary dark:text-accent">
                Receive Due Payment
              </h4>
              <button
                onClick={() => {
                  setShowReceiveModal(false);
                  setReceivingDue(null);
                }}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-450 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                title="Close Dialog"
                aria-label="Close Dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-3xs bg-stone-50 dark:bg-darkSecondary/35 p-3 rounded-xl border border-stone-200/20 dark:border-stone-800/10">
              <div className="flex justify-between py-1">
                <span className="text-stone-450">Customer:</span>
                <span className="font-bold text-stone-750 dark:text-stone-200">{receivingDue.customerName}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-stone-450">Outstanding Due:</span>
                <span className="font-bold text-amber-600">{formatCurrency(receivingDue.amount)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmReceive} className="flex flex-col gap-4">
              {/* Amount Received */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Amount Received ({settings.currency})
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 500"
                  value={receiveAmount}
                  onChange={e => setReceiveAmount(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
                <span className="text-4xs text-stone-400">
                  Entering less than outstanding will record a partial payment.
                </span>
              </div>

              {/* Payment Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Payment Date Received
                </label>
                <input
                  type="date"
                  value={receiveDate}
                  onChange={e => setReceiveDate(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {receiveError && (
                <span className="text-3xs font-semibold text-red-500 text-center">
                  {receiveError}
                </span>
              )}

              <div className="flex items-center gap-3 justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowReceiveModal(false);
                    setReceivingDue(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
