import { useState } from 'react';
import { 
  Plus, UserPlus, Phone, Calendar, Edit, UserCheck, 
  Archive, X, Camera, DollarSign, Wallet, Award,
  ChevronDown, ChevronUp, Trash2, Tag, Check, CreditCard, Users, PlusCircle
} from 'lucide-react';
import { formatDateToDMY, type Staff, type Settings, type Attendance, type CashTransaction, type Vendor, type ProductionEntry, type CostItem } from '../db/db';
import { db } from '../db/db';

interface StaffViewProps {
  activeStaff: Staff[];
  archivedStaff: Staff[];
  settings: Settings;
  isLoading?: boolean;
  addStaff: (staffMember: Omit<Staff, 'id'>) => Promise<any>;
  updateStaff: (id: string, staffMember: Partial<Staff>) => Promise<any>;
  vendors: Vendor[];
  productionEntries: ProductionEntry[];
  addVendor: (vendor: Omit<Vendor, 'id'>) => Promise<any>;
  updateVendor: (id: string, vendor: Partial<Vendor>) => Promise<any>;
  deleteVendor: (id: string) => Promise<any>;
  addProductionEntry: (entry: Omit<ProductionEntry, 'id'>) => Promise<any>;
  updateProductionEntry: (id: string, entry: Partial<ProductionEntry>) => Promise<any>;
  deleteProductionEntry: (id: string) => Promise<any>;
  payVendorDues: (id: string, vendorName: string, amount: number, notes?: string) => Promise<any>;
}

export function StaffView({ 
  activeStaff, 
  archivedStaff, 
  settings, 
  isLoading = false, 
  addStaff, 
  updateStaff,
  vendors,
  productionEntries,
  addVendor,
  updateVendor,
  deleteVendor,
  addProductionEntry,
  deleteProductionEntry,
  payVendorDues
}: StaffViewProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'outsourced'>('active');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // Vendor Modals & Form States
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Production Entry Modals & Form States
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [productionName, setProductionName] = useState('');
  const [productionPrice, setProductionPrice] = useState('');
  const [productionUnit, setProductionUnit] = useState('1');
  const [productionDescription, setProductionDescription] = useState('');
  const [productionRemarks, setProductionRemarks] = useState('');
  const [productionContactNo, setProductionContactNo] = useState('');
  const [productionType, setProductionType] = useState<'product' | 'service' | 'other'>('product');
  const [productionAdditionalCharges, setProductionAdditionalCharges] = useState<CostItem[]>([]);
  const [productionDate, setProductionDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Vendor payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentVendor, setPaymentVendor] = useState<Vendor | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Expand state for vendor cards
  const [expandedVendorIds, setExpandedVendorIds] = useState<Set<string>>(new Set());

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dailySalary, setDailySalary] = useState('');
  const [joinDate, setJoinDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [formError, setFormError] = useState('');

  // History Profile States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStaff, setHistoryStaff] = useState<Staff | null>(null);
  const [historyAttendance, setHistoryAttendance] = useState<Attendance[]>([]);
  const [historyPayments, setHistoryPayments] = useState<CashTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyActiveTab, setHistoryActiveTab] = useState<'attendance' | 'payments'>('attendance');

  const handleToggleVendorExpand = (vendorId: string) => {
    const next = new Set(expandedVendorIds);
    if (next.has(vendorId)) {
      next.delete(vendorId);
    } else {
      next.add(vendorId);
    }
    setExpandedVendorIds(next);
  };

  const handleOpenAddVendorModal = () => {
    setEditingVendor(null);
    setVendorName('');
    setVendorPhone('');
    setShowVendorModal(true);
  };

  const handleOpenEditVendorModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorName(vendor.name);
    setVendorPhone(vendor.phone || '');
    setShowVendorModal(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;

    try {
      if (editingVendor) {
        await updateVendor(editingVendor.id!, {
          name: vendorName.trim(),
          phone: vendorPhone.trim() || undefined,
        });
      } else {
        await addVendor({
          name: vendorName.trim(),
          phone: vendorPhone.trim() || undefined,
        });
      }
      setShowVendorModal(false);
      setVendorName('');
      setVendorPhone('');
      setEditingVendor(null);
    } catch (err) {
      console.error('Error saving vendor:', err);
    }
  };

  const handleDeleteVendorClick = async (vendor: Vendor) => {
    if (window.confirm(`Are you sure you want to delete vendor "${vendor.name}"? This will delete all their production entries and cannot be undone.`)) {
      try {
        await deleteVendor(vendor.id!);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenAddProductionModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setProductionName('');
    setProductionPrice('');
    setProductionUnit('1');
    setProductionDescription('');
    setProductionRemarks('');
    setProductionContactNo(vendor.phone || '');
    setProductionType('product');
    setProductionAdditionalCharges([]);
    setProductionDate(new Date().toISOString().split('T')[0]);
    setShowProductionModal(true);
  };

  const handleAddProductionChargeField = () => {
    setProductionAdditionalCharges([...productionAdditionalCharges, { label: '', amount: 0 }]);
  };

  const handleRemoveProductionChargeField = (index: number) => {
    setProductionAdditionalCharges(productionAdditionalCharges.filter((_, i) => i !== index));
  };

  const handleProductionChargeChange = (index: number, field: keyof CostItem, value: string) => {
    const updated = [...productionAdditionalCharges];
    if (field === 'amount') {
      updated[index] = { ...updated[index], amount: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], label: value };
    }
    setProductionAdditionalCharges(updated);
  };

  const handleSaveProductionEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !productionName.trim() || !productionPrice || !productionUnit) return;

    const parsedPrice = parseFloat(productionPrice) || 0;
    const parsedUnit = parseFloat(productionUnit) || 0;
    const sumAdditional = productionAdditionalCharges.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalAmount = (parsedPrice * parsedUnit) + sumAdditional;

    try {
      await addProductionEntry({
        vendorId: selectedVendor.id!,
        name: productionName.trim(),
        price: parsedPrice,
        unit: parsedUnit,
        description: productionDescription.trim() || undefined,
        remarks: productionRemarks.trim() || undefined,
        contactNo: productionContactNo.trim() || undefined,
        type: productionType,
        additionalCharges: productionAdditionalCharges.filter(c => c.label.trim() !== ''),
        totalAmount,
        status: 'unpaid',
        date: productionDate,
      });

      setShowProductionModal(false);
      setSelectedVendor(null);
    } catch (err) {
      console.error('Error saving production entry:', err);
    }
  };

  const handleDeleteProductionClick = async (entry: ProductionEntry) => {
    if (window.confirm(`Are you sure you want to delete production record "${entry.name}"?`)) {
      try {
        await deleteProductionEntry(entry.id!);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenPaymentModal = (vendor: Vendor, duesAmount: number) => {
    setPaymentVendor(vendor);
    setPaymentAmount(duesAmount.toString());
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentVendor) return;
    
    const amountVal = parseFloat(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid payment amount greater than 0.');
      return;
    }

    try {
      await payVendorDues(paymentVendor.id!, paymentVendor.name, amountVal, paymentNotes.trim() || undefined);
      setShowPaymentModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setDailySalary('');
    setJoinDate(new Date().toISOString().split('T')[0]);
    setStatus('active');
    setPhotoBase64('');
    setFormError('');
    setEditingStaff(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (member: Staff) => {
    setEditingStaff(member);
    setName(member.name);
    setPhone(member.phone);
    setDailySalary(member.dailySalary.toString());
    setJoinDate(member.joinDate);
    setStatus(member.status);
    setPhotoBase64(member.photo || '');
    setFormError('');
    setShowModal(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1500000) {
      setFormError('Image size should be less than 1.5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter a name.');
      return;
    }
    const salaryNum = parseFloat(dailySalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      setFormError('Please enter a valid daily salary.');
      return;
    }

    const staffData = {
      name: name.trim(),
      phone: phone.trim(),
      dailySalary: salaryNum,
      joinDate,
      status,
      photo: photoBase64 || undefined,
    };

    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id!, staffData);
      } else {
        await addStaff(staffData);
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Error saving staff member:', err);
      setFormError('Failed to save staff member details.');
    }
  };

  const handleToggleStatus = async (member: Staff) => {
    const nextStatus = member.status === 'active' ? 'archived' : 'active';
    try {
      await updateStaff(member.id!, { status: nextStatus });
    } catch (err) {
      console.error('Error toggling staff status:', err);
    }
  };

  // Click on a staff card opens their full ledger and logs history
  const handleCardClick = async (member: Staff) => {
    setHistoryStaff(member);
    setHistoryLoading(true);
    setShowHistoryModal(true);
    setHistoryActiveTab('attendance');
    try {
      // Query IndexedDB tables
      const attendanceRecords = await db.attendance.where('staffId').equals(member.id!).toArray();
      const payments = await db.cashLog.where('partyName').equals(member.name).toArray();
      
      setHistoryAttendance(attendanceRecords);
      setHistoryPayments(payments);
    } catch (err) {
      console.error('Error fetching staff history logs:', err);
    } finally {
      setHistoryLoading(false);
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

  // Statistics calculations for the selected staff member
  const totalDaysLogged = historyAttendance.length;
  const attendanceScore = historyAttendance.reduce((sum, r) => sum + r.attendanceValue, 0);
  const totalEarnedSalary = attendanceScore * (historyStaff?.dailySalary || 0);
  
  // Sum up all cash transactions where category is 'Salary' (only payments of type Salary)
  const totalPaidSalary = historyPayments
    .filter(tx => tx.type === 'expense' && tx.category === 'Salary')
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const balanceOwed = totalEarnedSalary - totalPaidSalary;

  const displayList = activeTab === 'active' ? activeStaff : archivedStaff;

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16">
      {/* Header view controls */}
      <div className="flex items-center justify-between">
        {/* Scrollable tab bar */}
        <div className="flex p-1 bg-stone-100 dark:bg-darkSecondary rounded-xl border border-stone-200/30 dark:border-stone-800/50 overflow-x-auto no-scrollbar whitespace-nowrap max-w-full shrink-0">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-white dark:bg-stone-850 text-accent shadow-sm'
                : 'text-stone-555 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            Active ({activeStaff.length})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'archived'
                ? 'bg-white dark:bg-stone-850 text-accent shadow-sm'
                : 'text-stone-555 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            Archived ({archivedStaff.length})
          </button>
          <button
            onClick={() => setActiveTab('outsourced')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'outsourced'
                ? 'bg-white dark:bg-stone-850 text-accent shadow-sm'
                : 'text-stone-555 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            Outsourced Production ({vendors.length})
          </button>
        </div>

        <button
          onClick={activeTab === 'outsourced' ? handleOpenAddVendorModal : handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-opacity-95 text-white shadow-sm shadow-accent/25 transition-all shrink-0"
        >
          <Plus size={15} />
          {activeTab === 'outsourced' ? 'Add Vendor' : 'Add Staff'}
        </button>
      </div>

      {/* Staff Grid */}
      {activeTab === 'outsourced' ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          {vendors.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center flex flex-col items-center gap-3 border border-stone-200/40 dark:border-stone-850/40 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-darkSecondary/40 text-stone-400 flex items-center justify-center">
                <Users size={18} />
              </div>
              <span className="text-xs font-semibold text-stone-850 dark:text-stone-200">
                No Outsourced Production Vendors Found
              </span>
              <span className="text-3xs text-stone-450 dark:text-stone-500 max-w-xs leading-relaxed font-semibold">
                Add vendors and record multiple production items (products, services, transport charges, polishing costs) to track payouts.
              </span>
              <button
                onClick={handleOpenAddVendorModal}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-opacity-95 text-white shadow-sm shadow-accent/25 transition-all"
              >
                <Plus size={14} />
                Register First Vendor
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {vendors.map(vendor => {
                const isExpanded = expandedVendorIds.has(vendor.id!);
                const vendorEntries = productionEntries.filter(e => e.vendorId === vendor.id);
                
                // Calculate amounts with partial payments support
                const unpaidAmount = vendorEntries
                  .filter(e => e.status === 'unpaid')
                  .reduce((sum, e) => sum + (e.totalAmount - (e.paidAmount || 0)), 0);
                  
                const paidAmount = vendorEntries
                  .reduce((sum, e) => sum + (e.paidAmount || 0), 0);

                return (
                  <div 
                    key={vendor.id}
                    className="glass-card rounded-2xl border border-stone-200/35 dark:border-stone-800/30 overflow-hidden shadow-2xs transition-shadow"
                  >
                    {/* Vendor Header */}
                    <div 
                      onClick={() => handleToggleVendorExpand(vendor.id!)}
                      className="p-4.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-stone-50/15 dark:hover:bg-stone-800/10 transition-colors"
                    >
                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-accent shrink-0" />
                          <h4 className="text-xs font-bold text-stone-850 dark:text-stone-100 truncate">{vendor.name}</h4>
                        </div>
                        {vendor.phone && (
                          <span className="text-3xs text-stone-405 dark:text-stone-550 flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            {vendor.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4.5 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-stone-200/20 pt-3 sm:pt-0" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-4 text-center mr-2">
                          <div className="flex flex-col">
                            <span className="text-4xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Dues</span>
                            <span className={`text-xs font-bold mt-0.5 ${unpaidAmount > 0 ? 'text-amber-655 dark:text-amber-400' : 'text-stone-500'}`}>
                              {formatCurrency(unpaidAmount)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-4xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Paid</span>
                            <span className="text-xs font-bold text-emerald-605 dark:text-emerald-450 mt-0.5">
                              {formatCurrency(paidAmount)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {unpaidAmount > 0 && (
                            <button
                              onClick={() => handleOpenPaymentModal(vendor, unpaidAmount)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-605 hover:bg-emerald-700 text-white text-3xs font-bold rounded-lg shadow-sm transition-all"
                              title="Pay Vendor Dues"
                            >
                              <CreditCard size={10} />
                              Pay Dues
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenAddProductionModal(vendor)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 hover:bg-accent/15 text-accent text-3xs font-bold rounded-lg transition-all"
                            title="Add Production Item"
                          >
                            <Plus size={10} />
                            Add Item
                          </button>
                          <button
                            onClick={() => handleOpenEditVendorModal(vendor)}
                            className="p-1.5 text-stone-400 hover:text-accent rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                            title="Edit Vendor"
                          >
                            <Edit size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteVendorClick(vendor)}
                            className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                            title="Delete Vendor"
                          >
                            <Trash2 size={11} />
                          </button>
                          <button 
                            onClick={() => handleToggleVendorExpand(vendor.id!)}
                            className="text-stone-400 p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Vendor Entries Collapsible list */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-stone-50/40 dark:bg-darkSecondary/15 border-t border-stone-200/20 dark:border-stone-850/40 flex flex-col gap-3">
                        <div className="flex items-center gap-1 text-4xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                          <Tag size={10} />
                          Production Ledger
                        </div>

                        {vendorEntries.length === 0 ? (
                          <span className="text-4xs text-stone-400 dark:text-stone-500 italic py-2">
                            No production entries recorded for this vendor. Tap "Add Item" to record items.
                          </span>
                        ) : (
                          <div className="flex flex-col gap-2.5">
                            {vendorEntries.map(entry => (
                              <div 
                                key={entry.id}
                                className="p-3 bg-white dark:bg-darkCard rounded-xl border border-stone-200/30 dark:border-stone-800/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-3xs"
                              >
                                <div className="flex-1 flex flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-4xs font-bold text-stone-400 dark:text-stone-500 px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded">{formatDateToDMY(entry.date)}</span>
                                    <span className="text-3xs font-semibold text-accent px-1.5 py-0.5 bg-accent/5 rounded-full capitalize">{entry.type}</span>
                                    <h5 className="text-2xs font-bold text-stone-850 dark:text-stone-200 truncate">{entry.name}</h5>
                                  </div>
                                  
                                  {(entry.description || entry.remarks || entry.contactNo) && (
                                    <div className="flex flex-col gap-0.5 text-4xs text-stone-450 dark:text-stone-500 leading-relaxed mt-1 pl-1">
                                      {entry.description && <span><strong>Specs:</strong> {entry.description}</span>}
                                      {entry.remarks && <span><strong>Remarks:</strong> {entry.remarks}</span>}
                                      {entry.contactNo && <span><strong>Contact No:</strong> {entry.contactNo}</span>}
                                    </div>
                                  )}

                                  {entry.additionalCharges && entry.additionalCharges.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5 pl-1">
                                      {entry.additionalCharges.map((ch, idx) => (
                                        <span key={idx} className="text-5xs bg-stone-100 dark:bg-darkSecondary text-stone-550 dark:text-stone-400 rounded-md px-1.5 py-0.5 font-semibold">
                                          {ch.label}: +{formatCurrency(ch.amount)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-4.5 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-stone-200/10 pt-2 sm:pt-0 shrink-0">
                                  <div className="flex gap-4 items-center mr-1">
                                    <div className="flex flex-col text-right">
                                      <span className="text-5xs text-stone-400 dark:text-stone-500">Unit Break</span>
                                      <span className="text-4xs font-semibold text-stone-700 dark:text-stone-300">
                                        {formatCurrency(entry.price)} x {entry.unit}
                                      </span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                      <span className="text-5xs text-stone-400 dark:text-stone-500">Total Amount</span>
                                      <span className="text-2xs font-bold text-stone-850 dark:text-stone-150">
                                        {formatCurrency(entry.totalAmount)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {entry.status === 'paid' ? (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-4xs font-bold rounded-lg" title={`Paid on ${entry.paidAt ? new Date(entry.paidAt).toLocaleDateString() : ''}`}>
                                        <Check size={10} />
                                        Paid
                                      </span>
                                    ) : (
                                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-4xs font-bold rounded-lg">
                                          Unpaid
                                        </span>
                                        {entry.paidAmount && entry.paidAmount > 0 ? (
                                          <span className="text-[9px] text-stone-400 dark:text-stone-500 italic font-semibold">
                                            Paid: {formatCurrency(entry.paidAmount)}
                                          </span>
                                        ) : null}
                                      </div>
                                    )}
                                    <button
                                      onClick={() => handleDeleteProductionClick(entry)}
                                      className="p-1 text-stone-400 hover:text-red-500 hover:bg-stone-50 dark:hover:bg-stone-850 rounded"
                                      title="Delete Record"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map(idx => (
            <div key={idx} className="glass-card rounded-2xl p-5 flex flex-col gap-4 border border-stone-200/40 dark:border-stone-850/40">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-stone-200 dark:bg-stone-800 shrink-0"></div>
                <div className="flex flex-col gap-2 w-full">
                  <div className="h-3.5 bg-stone-200 dark:bg-stone-800 rounded w-1/2"></div>
                  <div className="h-2 bg-stone-200 dark:bg-stone-800 rounded w-1/3"></div>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-stone-200/30 dark:border-stone-800/30">
                <div className="flex justify-between items-center">
                  <div className="h-2.5 bg-stone-200 dark:bg-stone-800 rounded w-24"></div>
                  <div className="h-2.5 bg-stone-200 dark:bg-stone-800 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center flex flex-col items-center gap-3 border border-stone-200/40 dark:border-stone-850/40 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            No {activeTab} staff members found.
          </span>
          <span className="text-3xs text-stone-400 dark:text-stone-500 max-w-xs leading-relaxed">
            {activeTab === 'active'
              ? 'Get started by registering your first staff member to track their attendance and calculate their salaries.'
              : 'Archived staff members will be shown here. Archiving disables them from attendance sheets but retains their historical records.'}
          </span>
          {activeTab === 'active' && (
            <button
              onClick={handleOpenAddModal}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-opacity-95 text-white shadow-sm shadow-accent/25 transition-all animate-fade-in"
            >
              <Plus size={15} />
              Add First Staff Member
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayList.map(member => (
            <div
              key={member.id}
              onClick={() => handleCardClick(member)}
              className="glass-card rounded-2xl p-5 flex flex-col gap-4 shadow-sm border border-stone-200/45 dark:border-stone-850/45 hover:shadow-md transition-all relative group cursor-pointer hover:border-accent/40"
            >
              {/* Top row: Avatar & Basic Details */}
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full border border-stone-200/60 dark:border-stone-800/50 overflow-hidden shrink-0 bg-stone-100 dark:bg-darkSecondary flex items-center justify-center">
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-accent">
                      {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <h4 className="font-semibold text-xs text-stone-800 dark:text-stone-200 truncate pr-16">
                    {member.name}
                  </h4>
                  <span className="text-3xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-1 mt-0.5">
                    <Phone size={10} />
                    {member.phone || 'No phone number'}
                  </span>
                </div>
              </div>

              {/* Bottom row: Details & Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t border-stone-200/30 dark:border-stone-800/30 text-3xs text-stone-500 dark:text-stone-400">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} className="text-stone-400" />
                    Joined: {formatDateToDMY(member.joinDate)}
                  </span>
                  <span className="font-bold text-stone-700 dark:text-stone-300">
                    Daily Pay: {settings.currency}{member.dailySalary}
                  </span>
                </div>
              </div>

              {/* Quick Actions (Floating panel on card) */}
              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // prevent opening history modal
                    handleOpenEditModal(member);
                  }}
                  className="p-1.5 rounded-lg bg-stone-100 dark:bg-darkSecondary text-stone-550 dark:text-stone-400 hover:text-accent dark:hover:text-accent border border-stone-200/10 dark:border-stone-800/10"
                  title="Edit staff details"
                >
                  <Edit size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // prevent opening history modal
                    handleToggleStatus(member);
                  }}
                  className="p-1.5 rounded-lg bg-stone-100 dark:bg-darkSecondary text-stone-550 dark:text-stone-400 hover:text-accent dark:hover:text-accent border border-stone-200/10 dark:border-stone-800/10"
                  title={member.status === 'active' ? 'Archive staff member' : 'Restore staff member'}
                >
                  {member.status === 'active' ? <Archive size={12} /> : <UserCheck size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile & History Ledger Modal */}
      {showHistoryModal && historyStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/65 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5 border border-stone-200/60 dark:border-stone-850/60 max-h-[90vh] overflow-hidden animate-scale-up">
            
            {/* Header info */}
            <div className="flex justify-between items-start pb-3 border-b border-stone-200/35 dark:border-stone-800/25">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border-2 border-stone-250 dark:border-stone-800 overflow-hidden bg-stone-100 dark:bg-darkSecondary flex items-center justify-center shrink-0">
                  {historyStaff.photo ? (
                    <img src={historyStaff.photo} alt={historyStaff.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-accent">
                      {historyStaff.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-stone-850 dark:text-stone-50">{historyStaff.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-4xs font-bold ${
                      historyStaff.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-stone-200/50 text-stone-500 dark:bg-stone-800'
                    }`}>
                      {historyStaff.status === 'active' ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <span className="text-3xs text-stone-450 dark:text-stone-500 flex items-center gap-1 mt-0.5">
                    <Phone size={10} /> {historyStaff.phone || 'No phone number'}
                  </span>
                  <span className="text-4xs text-stone-400 dark:text-stone-550 mt-0.5">
                    Date Joined: {historyStaff.joinDate}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-full text-stone-450 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X size={18} />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-xs text-stone-500">
                Loading history ledger...
              </div>
            ) : (
              <>
                {/* Stats Cards Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="bg-stone-50 dark:bg-darkSecondary p-3.5 rounded-xl border border-stone-200/20 dark:border-stone-800/20 flex flex-col gap-1">
                    <span className="text-4xs font-semibold text-stone-400 uppercase tracking-wider">Daily Pay</span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1">
                      <DollarSign size={12} className="text-accent shrink-0" />
                      {settings.currency}{historyStaff.dailySalary}
                    </span>
                  </div>

                  <div className="bg-stone-50 dark:bg-darkSecondary p-3.5 rounded-xl border border-stone-200/20 dark:border-stone-800/20 flex flex-col gap-1">
                    <span className="text-4xs font-semibold text-stone-400 uppercase tracking-wider">Days Logged</span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1">
                      <Calendar size={12} className="text-accent shrink-0" />
                      {totalDaysLogged} ({attendanceScore.toFixed(1)} pts)
                    </span>
                  </div>

                  <div className="bg-stone-50 dark:bg-darkSecondary p-3.5 rounded-xl border border-stone-200/20 dark:border-stone-800/20 flex flex-col gap-1">
                    <span className="text-4xs font-semibold text-stone-400 uppercase tracking-wider">Total Earned</span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1">
                      <Award size={12} className="text-accent shrink-0" />
                      {formatCurrency(totalEarnedSalary)}
                    </span>
                  </div>

                  <div className="bg-stone-50 dark:bg-darkSecondary p-3.5 rounded-xl border border-stone-200/20 dark:border-stone-800/20 flex flex-col gap-1">
                    <span className="text-4xs font-semibold text-stone-400 uppercase tracking-wider">
                      {balanceOwed >= 0 ? 'Owed Balance' : 'Overpaid / Adv'}
                    </span>
                    <span className={`text-xs font-bold flex items-center gap-1 ${
                      balanceOwed >= 0 ? 'text-primary dark:text-accent' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      <Wallet size={12} className="shrink-0" />
                      {formatCurrency(Math.abs(balanceOwed))}
                    </span>
                  </div>
                </div>

                {/* Sub Tab selection */}
                <div className="flex p-0.5 bg-stone-100 dark:bg-darkSecondary rounded-xl border border-stone-250/20 dark:border-stone-850/40 w-fit">
                  <button
                    onClick={() => setHistoryActiveTab('attendance')}
                    className={`px-3 py-1.5 rounded-lg text-3xs font-semibold transition-all ${
                      historyActiveTab === 'attendance'
                        ? 'bg-white dark:bg-stone-850 text-accent shadow-sm'
                        : 'text-stone-500 hover:text-stone-750 dark:text-stone-450 dark:hover:text-stone-300'
                    }`}
                  >
                    Attendance Ledger ({historyAttendance.length})
                  </button>
                  <button
                    onClick={() => setHistoryActiveTab('payments')}
                    className={`px-3 py-1.5 rounded-lg text-3xs font-semibold transition-all ${
                      historyActiveTab === 'payments'
                        ? 'bg-white dark:bg-stone-850 text-accent shadow-sm'
                        : 'text-stone-500 hover:text-stone-750 dark:text-stone-450 dark:hover:text-stone-300'
                    }`}
                  >
                    Cash Payments History ({historyPayments.length})
                  </button>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto no-scrollbar pr-1 flex flex-col gap-2 min-h-[180px]">
                  {historyActiveTab === 'attendance' ? (
                    historyAttendance.length === 0 ? (
                      <div className="text-center py-10 text-3xs text-stone-400 dark:text-stone-500">
                        No logged attendance entries found.
                      </div>
                    ) : (
                      historyAttendance
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(rec => (
                          <div 
                            key={rec.id}
                            className="p-3 bg-stone-50/50 dark:bg-darkSecondary/30 rounded-xl flex items-center justify-between border border-stone-200/20 dark:border-stone-800/10 text-3xs"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-stone-700 dark:text-stone-300">{formatDateToDMY(rec.date)}</span>
                              <span className="text-4xs text-stone-400 dark:text-stone-500">
                                Standard Pay: {settings.currency}{historyStaff.dailySalary}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded-md font-semibold text-4xs ${
                                rec.attendanceValue === 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                rec.attendanceValue === 0.5 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                rec.attendanceValue === 1.0 ? 'bg-emerald-500/10 text-emerald-605 dark:text-emerald-400' :
                                'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              }`}>
                                {rec.attendanceValue === 0 ? 'Absent' :
                                 rec.attendanceValue === 0.5 ? '0.5 Day' :
                                 rec.attendanceValue === 1.0 ? 'Present' :
                                 `${rec.attendanceValue} Days`}
                              </span>
                              <span className="font-bold text-stone-750 dark:text-stone-250">
                                {formatCurrency(rec.attendanceValue * historyStaff.dailySalary)}
                              </span>
                            </div>
                          </div>
                        ))
                    )
                  ) : (
                    historyPayments.length === 0 ? (
                      <div className="text-center py-10 text-3xs text-stone-400 dark:text-stone-500">
                        No recorded cash payouts associated with this name.
                      </div>
                    ) : (
                      historyPayments
                        .filter(tx => tx.category === 'Salary')
                        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                        .map(tx => (
                          <div 
                            key={tx.id}
                            className="p-3 bg-stone-50/50 dark:bg-darkSecondary/30 rounded-xl flex items-center justify-between border border-stone-200/20 dark:border-stone-800/10 text-3xs"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-stone-700 dark:text-stone-300">
                                {tx.category} {tx.notes ? `- ${tx.notes}` : ''}
                              </span>
                              <span className="text-4xs text-stone-400 dark:text-stone-500">
                                Date: {formatDateToDMY(tx.date)} at {tx.time}
                              </span>
                            </div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              -{formatCurrency(tx.amount)}
                            </span>
                          </div>
                        ))
                    )
                  )}
                </div>

                {/* Footer summary */}
                <div className="pt-3.5 border-t border-stone-200/35 dark:border-stone-800/25 flex items-center justify-between text-3xs text-stone-500">
                  <span>Cumulative Cash Paid:</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalPaidSalary)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal Dialog */}
      {showModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-5 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center">
              <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-1.5">
                <UserPlus size={18} />
                {editingStaff ? 'Edit Staff Details' : 'Add Staff Member'}
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

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              {/* Photo Input Selector */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-stone-300 dark:border-stone-700 overflow-hidden bg-stone-50 dark:bg-darkSecondary relative group flex items-center justify-center">
                  {photoBase64 ? (
                    <img src={photoBase64} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={24} className="text-stone-400" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    title="Upload profile image"
                  />
                </div>
                <span className="text-3xs text-stone-450 dark:text-stone-500">
                  Click circle to upload photo (Max 1.5MB)
                </span>
              </div>

              {/* Form fields */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Daily Salary ({settings.currency})
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="e.g. 500"
                    value={dailySalary}
                    onChange={e => setDailySalary(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={joinDate}
                    onChange={e => setJoinDate(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Registry Status
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as 'active' | 'archived')}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="active">Active (Appears on sheets)</option>
                  <option value="archived">Archived (Stored historically)</option>
                </select>
              </div>

              {formError && (
                <span className="text-3xs font-semibold text-red-500 dark:text-red-400 text-center">
                  {formError}
                </span>
              )}

              <div className="flex items-center gap-3 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-opacity-95 shadow-sm shadow-accent/25 transition-all"
                >
                  {editingStaff ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Register/Edit Vendor popup Dialog */}
      {showVendorModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-2">
                <Users size={16} />
                {editingVendor ? 'Edit Vendor Details' : 'Register New Vendor'}
              </h4>
              <button
                onClick={() => setShowVendorModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Vendor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Timber Suppliers, Woodcraft Ltd..."
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Contact Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={vendorPhone}
                  onChange={e => setVendorPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-opacity-95 shadow-sm transition-all"
                >
                  {editingVendor ? 'Save Changes' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Add Production Entry popup Dialog */}
      {showProductionModal && selectedVendor && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-2">
                <Tag size={16} />
                <span>Add Production: {selectedVendor.name}</span>
              </h4>
              <button
                onClick={() => setShowProductionModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProductionEntry} className="flex flex-col gap-4">
              
              {/* Item Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Item/Production Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sofa Leg Polishing, Cabinet Carving..."
                  value={productionName}
                  onChange={e => setProductionName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Price & Unit Quantity */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Price (per unit)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 dark:text-stone-400 font-bold">{settings.currency}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="0.00"
                      value={productionPrice}
                      onChange={e => setProductionPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Unit Quantity
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="1"
                    value={productionUnit}
                    onChange={e => setProductionUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>
              </div>

              {/* Classification Type (Product, Service, Other) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Select Type
                </label>
                <select
                  value={productionType}
                  onChange={e => setProductionType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                >
                  <option value="product">Product (Physical Item)</option>
                  <option value="service">Service (Labour / Machining)</option>
                  <option value="other">Other / Something Else</option>
                </select>
              </div>

              {/* Specifications / Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Specs / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dimensions: 3ft x 2ft, Teakwood..."
                  value={productionDescription}
                  onChange={e => setProductionDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Remarks, Contact No & Date */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Contact No
                  </label>
                  <input
                    type="tel"
                    placeholder="Defaults to vendor phone"
                    value={productionContactNo}
                    onChange={e => setProductionContactNo(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Production Date
                  </label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={e => setProductionDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delivered to workshop..."
                  value={productionRemarks}
                  onChange={e => setProductionRemarks(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Custom Additional Charges list */}
              <div className="flex flex-col gap-2 pt-2 border-t border-stone-200/20 dark:border-stone-800/25">
                <div className="flex justify-between items-center">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Additional Charges
                  </label>
                  <button
                    type="button"
                    onClick={handleAddProductionChargeField}
                    className="flex items-center gap-1 text-accent text-3xs font-bold hover:underline"
                  >
                    <PlusCircle size={10} />
                    Add Charge Row
                  </button>
                </div>

                {productionAdditionalCharges.length > 0 && (
                  <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto no-scrollbar">
                    {productionAdditionalCharges.map((ch, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="e.g. Transport, Polishing..."
                          value={ch.label}
                          onChange={e => handleProductionChargeChange(idx, 'label', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs focus:outline-none focus:border-accent"
                          required
                        />
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-500 dark:text-stone-400 font-bold">{settings.currency}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            placeholder="0"
                            value={ch.amount || ''}
                            onChange={e => handleProductionChargeChange(idx, 'amount', e.target.value)}
                            className="w-full pl-5 pr-1 py-1.5 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-accent"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProductionChargeField(idx)}
                          className="p-1.5 text-stone-400 hover:text-red-500 rounded hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals Yield calculator */}
              <div className="p-3.5 bg-stone-100/50 dark:bg-darkSecondary/20 border border-stone-200/20 dark:border-stone-850/20 rounded-2xl flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-3xs text-stone-500 dark:text-stone-400 font-semibold">
                  <span>Base Cost ({formatCurrency(parseFloat(productionPrice) || 0)} x {parseFloat(productionUnit) || 0} units):</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    {formatCurrency((parseFloat(productionPrice) || 0) * (parseFloat(productionUnit) || 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-3xs text-stone-500 dark:text-stone-400 font-semibold">
                  <span>Additional Charges total:</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    +{formatCurrency(productionAdditionalCharges.reduce((sum, item) => sum + (item.amount || 0), 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-stone-200/20 dark:border-stone-800/10 font-bold text-stone-800 dark:text-stone-150">
                  <span>Total Calculated Amount:</span>
                  <span className="text-accent">
                    {formatCurrency(
                      ((parseFloat(productionPrice) || 0) * (parseFloat(productionUnit) || 0)) + 
                      productionAdditionalCharges.reduce((sum, item) => sum + (item.amount || 0), 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowProductionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:bg-stone-105 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-opacity-95 shadow-sm transition-all"
                >
                  Record Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 8. Record Vendor Payment popup Dialog */}
      {showPaymentModal && paymentVendor && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-2">
                <CreditCard size={16} />
                <span>Pay Vendor: {paymentVendor.name}</span>
              </h4>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="flex flex-col gap-4">
              
              {/* Payment Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 dark:text-stone-400 font-bold">{settings.currency}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Payment Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Payment Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid part dues, wood carving adv..."
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Submit Actions */}
              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-605 hover:bg-emerald-700 text-white shadow-sm transition-all"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
