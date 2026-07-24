import { useState } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, AlertTriangle, 
  CheckCircle2, UserPlus, Calendar, ShoppingBag, 
  Phone, DollarSign, Truck, ChevronDown, ChevronUp, UserCheck,
  ShoppingCart
} from 'lucide-react';
import { formatDateToDMY, type Customer, type CustomerOrder, type Settings, type CashTransaction } from '../db/db';

interface CustomersViewProps {
  settings: Settings;
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'branchId'>) => Promise<any>;
  updateCustomer: (id: number, customer: Partial<Omit<Customer, 'id' | 'branchId'>>) => Promise<any>;
  deleteCustomer: (id: number) => Promise<any>;
  customerOrders: CustomerOrder[];
  addCustomerOrder: (order: Omit<CustomerOrder, 'id' | 'branchId' | 'createdAt'>) => Promise<any>;
  updateCustomerOrder: (id: number, order: Partial<Omit<CustomerOrder, 'id' | 'branchId'>>) => Promise<any>;
  deleteCustomerOrder: (id: number) => Promise<any>;
  addTransaction: (tx: Omit<CashTransaction, 'id'>) => Promise<any>;
}

export function CustomersView({
  settings,
  customers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  customerOrders,
  addCustomerOrder,
  updateCustomerOrder,
  deleteCustomerOrder,
  addTransaction
}: CustomersViewProps) {
  // Expansion State per customer ID
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | null>(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [selectedCustomerIdForOrder, setSelectedCustomerIdForOrder] = useState<number | null>(null);
  
  // Order Form States
  const [productBought, setProductBought] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [advance, setAdvance] = useState('');
  const [dues, setDues] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [orderStatus, setOrderStatus] = useState<'pending' | 'in-production' | 'delivered'>('pending');
  const [deliveryFeeType, setDeliveryFeeType] = useState<'included' | 'free' | 'not-from-us' | 'custom'>('free');
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState('');

  // Helper calculations for order form
  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    const tot = parseFloat(val) || 0;
    const adv = parseFloat(advance) || 0;
    setDues((tot - adv).toString());
  };

  const handleAdvanceChange = (val: string) => {
    setAdvance(val);
    const tot = parseFloat(totalAmount) || 0;
    const adv = parseFloat(val) || 0;
    setDues((tot - adv).toString());
  };

  // Pay Dues Modal
  const [showPayDuesModal, setShowPayDuesModal] = useState<CustomerOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Confirmation state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Toast State
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

  // Toggle Accordion Expansion
  const toggleExpandCustomer = (id: number) => {
    setExpandedCustomerId(prev => (prev === id ? null : id));
  };

  // Customer CRUD handlers
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setShowCustomerModal(true);
  };

  const handleOpenEditCustomer = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(cust);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    try {
      const data = {
        name: customerName.trim(),
        phone: customerPhone.trim()
      };

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id!, data);
        showToast('success', 'Customer profile updated!');
      } else {
        await addCustomer(data);
        showToast('success', 'Customer registered successfully!');
      }
      setShowCustomerModal(false);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save customer profile.');
    }
  };

  const handleDeleteCustomer = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerConfirm(
      'Delete Customer Profile',
      `Are you sure you want to delete "${cust.name}"? All their recorded purchase and order histories will be deleted from the database.`,
      async () => {
        try {
          await deleteCustomer(cust.id!);
          showToast('success', 'Customer and associated orders deleted.');
          if (expandedCustomerId === cust.id) {
            setExpandedCustomerId(null);
          }
        } catch (err) {
          console.error(err);
          showToast('error', 'Failed to delete customer.');
        }
      }
    );
  };

  // Order CRUD handlers
  const handleOpenAddOrder = (customerId: number) => {
    setSelectedCustomerIdForOrder(customerId);
    setEditingOrder(null);
    setProductBought('');
    setTotalAmount('');
    setAdvance('');
    setDues('');
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setOrderStatus('pending');
    setDeliveryFeeType('free');
    setDeliveryFeeAmount('');
    setShowOrderModal(true);
  };

  const handleOpenEditOrder = (order: CustomerOrder) => {
    setSelectedCustomerIdForOrder(order.customerId);
    setEditingOrder(order);
    setProductBought(order.productBought);
    setTotalAmount((order.totalAmount || (order.advance + order.dues)).toString());
    setAdvance(order.advance.toString());
    setDues(order.dues.toString());
    setDeliveryDate(order.deliveryDate);
    setOrderStatus(order.status);
    setDeliveryFeeType(order.deliveryFeeType);
    setDeliveryFeeAmount(order.deliveryFeeAmount?.toString() || '');
    setShowOrderModal(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productBought.trim() || !selectedCustomerIdForOrder) return;

    const advNum = parseFloat(advance) || 0;
    const duesNum = parseFloat(dues) || 0;
    const totNum = parseFloat(totalAmount) || (advNum + duesNum);
    const feeNum = deliveryFeeType === 'custom' ? parseFloat(deliveryFeeAmount) || 0 : 0;

    try {
      const orderData = {
        customerId: selectedCustomerIdForOrder,
        productBought: productBought.trim(),
        totalAmount: totNum,
        advance: advNum,
        dues: duesNum,
        deliveryDate,
        status: orderStatus,
        deliveryFeeType,
        deliveryFeeAmount: deliveryFeeType === 'custom' ? feeNum : undefined,
      };

      if (editingOrder) {
        await updateCustomerOrder(editingOrder.id!, orderData);
        showToast('success', 'Order updated successfully!');
      } else {
        await addCustomerOrder(orderData);
        // Automatically log Advance payment as income in cashLog if advance > 0
        if (advNum > 0) {
          const customer = customers.find(c => c.id === selectedCustomerIdForOrder);
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          await addTransaction({
            type: 'income',
            category: 'Customer Payment',
            amount: advNum,
            date: new Date().toISOString().split('T')[0],
            time: timeStr,
            partyName: customer?.name || '',
            notes: `Advance for ${productBought.trim()} (Order)`,
            createdAt: Date.now(),
          });
        }
        showToast('success', 'Order recorded successfully!');
      }
      setShowOrderModal(false);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save order details.');
    }
  };

  const handleDeleteOrder = (order: CustomerOrder) => {
    triggerConfirm(
      'Delete Order',
      `Are you sure you want to delete the order record for "${order.productBought}"?`,
      async () => {
        try {
          await deleteCustomerOrder(order.id!);
          showToast('success', 'Order deleted.');
        } catch (err) {
          console.error(err);
          showToast('error', 'Failed to delete order.');
        }
      }
    );
  };

  const handleUpdateOrderStatus = async (order: CustomerOrder, newStatus: 'pending' | 'in-production' | 'delivered') => {
    try {
      await updateCustomerOrder(order.id!, { status: newStatus });
      showToast('success', `Status updated to ${newStatus.replace('-', ' ')}`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update order status.');
    }
  };

  // Pay Dues Handler
  const handleOpenPayDues = (order: CustomerOrder) => {
    setShowPayDuesModal(order);
    setPaymentAmount(order.dues.toString());
    setPaymentNotes('');
  };

  const handleSavePayDues = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayDuesModal) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Please enter a valid payment amount.');
      return;
    }

    try {
      const remaining = Math.max(0, showPayDuesModal.dues - amt);
      await updateCustomerOrder(showPayDuesModal.id!, { dues: remaining });
      
      const customer = customers.find(c => c.id === showPayDuesModal.customerId);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // Add transaction to Cash Log
      await addTransaction({
        type: 'income',
        category: 'Customer Payment',
        amount: amt,
        date: new Date().toISOString().split('T')[0],
        time: timeStr,
        partyName: customer?.name || '',
        notes: `Dues paid towards ${showPayDuesModal.productBought} ${paymentNotes ? ' - ' + paymentNotes.trim() : ''}`,
        createdAt: Date.now(),
      });

      showToast('success', `Recorded payment of ${formatCurrency(amt)}!`);
      setShowPayDuesModal(null);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to record dues payment.');
    }
  };

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency === '$' ? 'USD' : settings.currency === '₹' ? 'INR' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val).replace('USD', '$').replace('INR', '₹').replace('EUR', '€');
  };

  // Format delivery fee description
  const formatDeliveryFee = (order: CustomerOrder) => {
    if (order.deliveryFeeType === 'included') return 'Delivery Fee Included';
    if (order.deliveryFeeType === 'free') return 'Free Delivery';
    if (order.deliveryFeeType === 'not-from-us') return 'Not from us (Customer arrangements)';
    return `Custom: ${formatCurrency(order.deliveryFeeAmount || 0)}`;
  };

  // Filter customers by search query
  const filteredCustomers = customers.filter(cust => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      cust.name.toLowerCase().includes(query) ||
      cust.phone.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-16">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-xl border text-xs font-semibold shadow-lg animate-scale-up ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-808 dark:text-emerald-450' 
            : 'bg-red-500/10 border-red-500/20 text-red-808 dark:text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Search and Register block */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
          <input
            type="text"
            placeholder="Search customers by name or contact number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 text-xs rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-55 dark:bg-darkSecondary/35 text-stone-850 dark:text-stone-205 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Register Customer Button */}
        <button
          onClick={handleOpenAddCustomer}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all shrink-0"
        >
          <UserPlus size={15} />
          Add Customer
        </button>
      </div>

      {/* Customer Accordion List */}
      <div className="flex flex-col gap-4">
        <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
          Customer Registry ({filteredCustomers.length})
        </span>

        {filteredCustomers.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-2.5 border border-stone-200/30 dark:border-stone-800/30">
            <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-darkSecondary/40 text-stone-400 flex items-center justify-center">
              <UserCheck size={20} />
            </div>
            <span className="text-xs font-semibold text-stone-850 dark:text-stone-200">No Customers Found</span>
            <span className="text-3xs text-stone-450 dark:text-stone-500 max-w-xs leading-relaxed">
              Add customers to log order detail status, deliveries, advances, and outstanding dues.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredCustomers.map(cust => {
              const isExpanded = expandedCustomerId === cust.id;
              const orders = customerOrders.filter(o => o.customerId === cust.id);
              const pendingOrders = orders.filter(o => o.status !== 'delivered');
              const totalDues = orders.reduce((sum, o) => sum + o.dues, 0);

              return (
                <div 
                  key={cust.id}
                  className="glass-card rounded-2xl border border-stone-200/35 dark:border-stone-805/30 overflow-hidden shadow-2xs hover:shadow-xs transition-all"
                >
                  
                  {/* Accordion Trigger Header */}
                  <div 
                    onClick={() => toggleExpandCustomer(cust.id!)}
                    className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-stone-50/20 dark:hover:bg-stone-800/10 transition-colors flex-wrap sm:flex-nowrap"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-darkSecondary/50 text-stone-500 flex items-center justify-center shrink-0">
                        <ShoppingBag size={16} />
                      </div>
                      
                      <div className="flex flex-col min-w-0">
                        <h4 className="text-xs font-bold text-stone-850 dark:text-stone-100 truncate">{cust.name}</h4>
                        {cust.phone && (
                          <span className="text-3xs text-stone-450 dark:text-stone-500 font-semibold flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            {cust.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-5 ml-auto sm:ml-0 shrink-0">
                      {/* Order info counts */}
                      <div className="flex items-center gap-4 text-3xs font-bold">
                        <div className="flex flex-col items-end">
                          <span className="text-stone-400 font-medium">Orders</span>
                          <span className="text-stone-700 dark:text-stone-300">{orders.length} ({pendingOrders.length} active)</span>
                        </div>

                        {/* Total Shopped Cart Badge (Delivered Orders + active order payments) */}
                        {(() => {
                          const totalShopped = orders.reduce((sum, o) => {
                            const orderTotal = o.totalAmount || (o.advance + o.dues);
                            if (o.status === 'delivered') {
                              return sum + orderTotal;
                            } else {
                              const paidSoFar = orderTotal - o.dues;
                              return sum + Math.max(0, paidSoFar);
                            }
                          }, 0);
                          return (
                            <div className="flex flex-col items-end border-l border-stone-200/20 pl-4">
                              <span className="text-stone-400 font-medium flex items-center gap-1">
                                <ShoppingCart size={11} className="text-accent" />
                                Total Shopped
                              </span>
                              <span className="text-stone-750 dark:text-stone-350 font-bold">
                                {formatCurrency(totalShopped)}
                              </span>
                            </div>
                          );
                        })()}
                        
                        <div className="flex flex-col items-end border-l border-stone-200/20 pl-4">
                          <span className="text-stone-400 font-medium">Balance Dues</span>
                          <span className={totalDues > 0 ? 'text-red-500 font-extrabold' : 'text-stone-500 dark:text-stone-405 font-bold'}>
                            {formatCurrency(totalDues)}
                          </span>
                        </div>
                      </div>

                      {/* Header Edit / Delete actions */}
                      <div className="flex gap-1.5 border-l border-stone-200/20 pl-4">
                        <button
                          onClick={(e) => handleOpenEditCustomer(cust, e)}
                          className="p-1.5 text-stone-400 hover:text-accent rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                          title="Edit Profile"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteCustomer(cust, e)}
                          className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                          title="Delete Customer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="text-stone-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Purchase Ledger details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-stone-200/20 dark:border-stone-850/40 bg-stone-50/20 dark:bg-darkSecondary/10 animate-fade-in flex flex-col gap-4">
                      
                      {/* Products Ledger Header */}
                      <div className="flex justify-between items-center pt-4">
                        <span className="text-3xs font-bold text-stone-400 uppercase tracking-wider">
                          Purchased Products Ledger
                        </span>
                        <button
                          onClick={() => handleOpenAddOrder(cust.id!)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-4xs font-bold rounded-lg shadow-sm transition-all"
                        >
                          <Plus size={10} />
                          Add Order
                        </button>
                      </div>

                      {/* Products List */}
                      {orders.length === 0 ? (
                        <div className="py-6 text-center text-3xs text-stone-450 dark:text-stone-500 font-semibold italic">
                          No order records logged for this customer. Tap "Add Order" to begin tracking.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {orders.map(order => (
                            <div 
                              key={order.id}
                              className="bg-white dark:bg-darkSecondary p-4 rounded-xl border border-stone-200/50 dark:border-stone-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs"
                            >
                              {/* Product Info columns */}
                              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                <div className="flex items-center flex-wrap gap-2">
                                  <span className="text-xs font-bold text-stone-850 dark:text-stone-105">
                                    {order.productBought}
                                  </span>
                                  
                                  {/* Delivery Fee badge */}
                                  <span className="text-4xs font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/60 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                    <Truck size={8} />
                                    {formatDeliveryFee(order)}
                                  </span>
                                </div>

                                <div className="flex items-center flex-wrap gap-3 text-3xs text-stone-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar size={10} />
                                    Deliver: <strong className="text-stone-700 dark:text-stone-300">{formatDateToDMY(order.deliveryDate)}</strong>
                                  </span>
                                  
                                  <span className="flex items-center gap-1 border-l border-stone-200/20 pl-3">
                                    Total Price: <strong className="text-stone-850 dark:text-stone-200">{formatCurrency(order.totalAmount || (order.advance + order.dues))}</strong>
                                  </span>
                                  
                                  <span className="flex items-center gap-1 border-l border-stone-200/20 pl-3">
                                    Advance: <strong className="text-emerald-600">{formatCurrency(order.advance)}</strong>
                                  </span>

                                  <span className="flex items-center gap-1 border-l border-stone-200/20 pl-3">
                                    Dues: <strong className={order.dues > 0 ? 'text-red-500 font-bold' : 'text-stone-505 dark:text-stone-400'}>{formatCurrency(order.dues)}</strong>
                                  </span>
                                </div>
                              </div>

                              {/* Status Dropdowns & Edit actions */}
                              <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                                
                                {/* Pay Dues Action Button */}
                                {order.dues > 0 && (
                                  <button
                                    onClick={() => handleOpenPayDues(order)}
                                    className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-650 dark:text-emerald-400 text-3xs font-extrabold rounded-lg transition-colors flex items-center gap-0.5"
                                  >
                                    <DollarSign size={10} />
                                    Pay Dues
                                  </button>
                                )}

                                {/* Status Select Dropdown */}
                                <select
                                  value={order.status}
                                  onChange={(e) => handleUpdateOrderStatus(order, e.target.value as any)}
                                  className={`px-2 py-1 text-3xs font-bold rounded-lg border focus:outline-none cursor-pointer ${
                                    order.status === 'delivered' 
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400' 
                                      : order.status === 'in-production'
                                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-655 dark:text-amber-400'
                                      : 'bg-blue-500/10 border-blue-500/20 text-blue-650 dark:text-blue-400'
                                  }`}
                                >
                                  <option value="pending" className="bg-white dark:bg-stone-900 text-blue-600">Pending</option>
                                  <option value="in-production" className="bg-white dark:bg-stone-900 text-amber-600">In Production</option>
                                  <option value="delivered" className="bg-white dark:bg-stone-900 text-emerald-600">Delivered</option>
                                </select>

                                {/* Action Buttons */}
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleOpenEditOrder(order)}
                                    className="p-1 text-stone-400 hover:text-accent rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800/80 transition-colors"
                                    title="Edit Order"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrder(order)}
                                    className="p-1 text-stone-400 hover:text-red-500 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800/80 transition-colors"
                                    title="Delete Order"
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

      {/* 5. Add / Edit Customer Modal */}
      {showCustomerModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent">
                {editingCustomer ? 'Edit Customer Profile' : 'Register Customer'}
              </h4>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="flex flex-col gap-4">
              
              {/* Customer Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe, Sarah Khan..."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                  autoFocus
                />
              </div>

              {/* Customer Contact */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Contact Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +92 300 1234567..."
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 border border-stone-250/50 dark:border-stone-805/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-300 hover:bg-stone-105 dark:hover:bg-stone-805 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add / Edit Order Modal */}
      {showOrderModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent">
                {editingOrder ? 'Edit Order Details' : 'Record Product Purchased'}
              </h4>
              <button
                onClick={() => setShowOrderModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="flex flex-col gap-4">
              
              {/* Product Purchased */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Product Details / Item
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dining Table set, Wooden Wardrobe (3 Door)..."
                  value={productBought}
                  onChange={e => setProductBought(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                  autoFocus
                />
              </div>

              {/* Total Amount, Advance & Dues Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Total Amount ({settings.currency})
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={totalAmount}
                    onChange={e => handleTotalAmountChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Advance Payment ({settings.currency})
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={advance}
                    onChange={e => handleAdvanceChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Outstanding Dues ({settings.currency})
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={dues}
                    onChange={e => setDues(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Delivery Date & Order Status Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Date to be Delivered
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-850 text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Order Status
                  </label>
                  <select
                    value={orderStatus}
                    onChange={e => setOrderStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="pending" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Pending</option>
                    <option value="in-production" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">In Production</option>
                    <option value="delivered" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Delivered</option>
                  </select>
                </div>
              </div>

              {/* Delivery Fee Section */}
              <div className="flex flex-col gap-2.5 border-t border-stone-200/20 dark:border-stone-800/10 pt-3">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Delivery Fee Status
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'included', label: 'Included' },
                    { id: 'free', label: 'Free Delivery' },
                    { id: 'not-from-us', label: 'Not from us' },
                    { id: 'custom', label: 'Custom Amount' },
                  ].map(fee => (
                    <button
                      key={fee.id}
                      type="button"
                      onClick={() => setDeliveryFeeType(fee.id as any)}
                      className={`py-2 px-3 border text-center rounded-xl text-3xs font-bold transition-all ${
                        deliveryFeeType === fee.id
                          ? 'bg-accent border-accent text-white shadow-3xs'
                          : 'bg-transparent border-stone-250/60 dark:border-stone-800 text-stone-650 dark:text-stone-405 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      {fee.label}
                    </button>
                  ))}
                </div>

                {deliveryFeeType === 'custom' && (
                  <div className="flex flex-col gap-1 mt-1.5 animate-fade-in">
                    <label className="text-3xs font-semibold text-stone-550 dark:text-stone-400">
                      Delivery Fee Amount ({settings.currency})
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="0.00"
                      value={deliveryFeeAmount}
                      onChange={e => setDeliveryFeeAmount(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Submit Action Buttons */}
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 border border-stone-250/50 dark:border-stone-855/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-300 hover:bg-stone-105 dark:hover:bg-stone-850 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  {editingOrder ? 'Save Changes' : 'Record Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Pay Dues Form Modal */}
      {showPayDuesModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent">
                Receive Dues Payment
              </h4>
              <button
                onClick={() => setShowPayDuesModal(null)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayDues} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-2xs text-stone-500">
                <span>Product: <strong className="text-stone-800 dark:text-stone-200">{showPayDuesModal.productBought}</strong></span>
                <span>Outstanding Dues: <strong className="text-red-500 font-bold">{formatCurrency(showPayDuesModal.dues)}</strong></span>
              </div>

              {/* Payment Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Amount Received ({settings.currency})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                  autoFocus
                />
              </div>

              {/* Description Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Description / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Final payment clearance, partial collection..."
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowPayDuesModal(null)}
                  className="px-4 py-2 border border-stone-250/50 dark:border-stone-805/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-300 hover:bg-stone-105 dark:hover:bg-stone-855 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Custom Confirm Dialog Modal */}
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

    </div>
  );
}
