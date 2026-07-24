import React, { useState } from 'react';
import { 
  TrendingUp, Plus, Search, Trash2, ChevronDown, ChevronUp, 
  PlusCircle, X, Tag, DollarSign, Calculator, Edit2 
} from 'lucide-react';
import { formatDateToDMY, type Settings, type Sale, type CostItem } from '../db/db';

interface SalesViewProps {
  settings: Settings;
  sales: Sale[];
  addSale: (sale: Omit<Sale, 'id'>) => Promise<any>;
  updateSale: (id: number, sale: Partial<Sale>) => Promise<any>;
  deleteSale: (id: number) => Promise<any>;
}

export function SalesView({ settings, sales, addSale, updateSale, deleteSale }: SalesViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDatePreset, setFilterDatePreset] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [filterCustomStart, setFilterCustomStart] = useState('');
  const [filterCustomEnd, setFilterCustomEnd] = useState('');

  // Expand states for item cost breakdowns
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<number>>(new Set());

  const handleOpenEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setProductName(sale.productName);
    setDescription(sale.description || '');
    setSoldFor(sale.soldFor.toString());
    setDate(sale.date);
    
    // Prefill material & labour costs
    const material = sale.costBreakdown.find(c => c.label === 'Material')?.amount || 0;
    const labour = sale.costBreakdown.find(c => c.label === 'Labour')?.amount || 0;
    setMaterialCost(material.toString());
    setLabourCost(labour.toString());
    
    // Prefill custom costs
    const customs = sale.costBreakdown.filter(c => c.label !== 'Material' && c.label !== 'Labour');
    setCustomCosts(customs);
    
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setEditingSale(null);
    setProductName('');
    setDescription('');
    setSoldFor('');
    setMaterialCost('0');
    setLabourCost('0');
    setCustomCosts([]);
    setDate(new Date().toISOString().split('T')[0]);
    setShowModal(false);
  };

  const handleToggleExpand = (id: number) => {
    const next = new Set(expandedSaleIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSaleIds(next);
  };

  // Form States
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [soldFor, setSoldFor] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [materialCost, setMaterialCost] = useState('0');
  const [labourCost, setLabourCost] = useState('0');
  const [customCosts, setCustomCosts] = useState<CostItem[]>([]);



  const handleAddCustomCostField = () => {
    setCustomCosts([...customCosts, { label: '', amount: 0 }]);
  };

  const handleRemoveCustomCostField = (index: number) => {
    setCustomCosts(customCosts.filter((_, i) => i !== index));
  };

  const handleCustomCostChange = (index: number, field: keyof CostItem, value: string) => {
    const updated = [...customCosts];
    if (field === 'amount') {
      updated[index] = { ...updated[index], amount: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], label: value };
    }
    setCustomCosts(updated);
  };

  // Dynamic calculations in Add Sale Form
  const materialVal = Number(materialCost) || 0;
  const labourVal = Number(labourCost) || 0;
  const customSum = customCosts.reduce((sum, item) => sum + (item.amount || 0), 0);
  const calcTotalCost = materialVal + labourVal + customSum;
  const priceVal = Number(soldFor) || 0;
  const calcProfit = priceVal - calcTotalCost;
  const calcMargin = priceVal > 0 ? Math.round((calcProfit / priceVal) * 100) : 0;

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !soldFor) return;

    const costBreakdown: CostItem[] = [
      { label: 'Material', amount: materialVal },
      { label: 'Labour', amount: labourVal },
      ...customCosts.filter(c => c.label.trim() !== '')
    ];

    try {
      const saleData = {
        productName: productName.trim(),
        description: description.trim(),
        soldFor: priceVal,
        totalCost: calcTotalCost,
        profit: calcProfit,
        costBreakdown,
        date,
      };

      if (editingSale) {
        await updateSale(editingSale.id!, {
          ...saleData,
          createdAt: editingSale.createdAt
        });
      } else {
        await addSale({
          ...saleData,
          createdAt: Date.now()
        });
      }

      handleCloseModal();
    } catch (err) {
      console.error('Error saving sale:', err);
    }
  };

  const handleDeleteClick = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this sales record? This action cannot be undone.')) {
      try {
        await deleteSale(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Date filter logic
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const todayStr = getTodayDateString();

  const getWeekRange = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  };

  const getMonthRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const filteredSales = sales.filter(s => {
    // 1. Text Search Filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchName = s.productName.toLowerCase().includes(query);
      const matchDesc = s.description.toLowerCase().includes(query);
      if (!matchName && !matchDesc) return false;
    }

    // 2. Date Preset Filter
    if (filterDatePreset === 'today') {
      return s.date === todayStr;
    } else if (filterDatePreset === 'week') {
      const { start, end } = getWeekRange();
      return s.date >= start && s.date <= end;
    } else if (filterDatePreset === 'month') {
      const { start, end } = getMonthRange();
      return s.date >= start && s.date <= end;
    } else if (filterDatePreset === 'custom') {
      if (filterCustomStart && s.date < filterCustomStart) return false;
      if (filterCustomEnd && s.date > filterCustomEnd) return false;
    }

    return true;
  });

  // Sort sales by date decending, then by createdAt decending
  const sortedSales = [...filteredSales].sort((a, b) => {
    if (b.date !== a.date) {
      return b.date.localeCompare(a.date);
    }
    return b.createdAt - a.createdAt;
  });

  // Totals calculations
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.soldFor, 0);
  const totalCost = filteredSales.reduce((sum, s) => sum + s.totalCost, 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + s.profit, 0);
  const averageMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency === '$' ? 'USD' : settings.currency === '₹' ? 'INR' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val).replace('USD', '$').replace('INR', '₹').replace('EUR', '€');
  };



  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-16">
      
      {/* 1. Header Metrics Card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4.5 border border-stone-200/35 dark:border-stone-800/30 flex flex-col">
          <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Total Revenue</span>
          <span className="text-xl font-extrabold text-stone-850 dark:text-stone-100 mt-1">{formatCurrency(totalRevenue)}</span>
          <span className="text-4xs text-stone-450 dark:text-stone-500 mt-0.5">Product gross pricing</span>
        </div>
        <div className="glass-card rounded-2xl p-4.5 border border-stone-200/35 dark:border-stone-800/30 flex flex-col">
          <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Total Costs</span>
          <span className="text-xl font-extrabold text-stone-850 dark:text-stone-100 mt-1">{formatCurrency(totalCost)}</span>
          <span className="text-4xs text-stone-450 dark:text-stone-500 mt-0.5">Material + Labour + Custom</span>
        </div>
        <div className="glass-card rounded-2xl p-4.5 border border-stone-200/35 dark:border-stone-800/30 flex flex-col">
          <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Gross Profit</span>
          <span className={`text-xl font-extrabold mt-1 ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-450' : 'text-red-500'}`}>
            {totalProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(totalProfit))}
          </span>
          <span className="text-4xs text-stone-450 dark:text-stone-500 mt-0.5">Revenue minus costs</span>
        </div>
        <div className="glass-card rounded-2xl p-4.5 border border-stone-200/35 dark:border-stone-800/30 flex flex-col">
          <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Avg Margin</span>
          <span className={`text-xl font-extrabold mt-1 ${averageMargin >= 30 ? 'text-emerald-600 dark:text-emerald-450' : averageMargin >= 15 ? 'text-amber-500' : 'text-stone-850 dark:text-stone-100'}`}>
            {averageMargin}%
          </span>
          <span className="text-4xs text-stone-450 dark:text-stone-500 mt-0.5">Average profit yield %</span>
        </div>
      </div>

      {/* 2. Filter controls Panel */}
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
            <input
              type="text"
              placeholder="Search sales by product name or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 text-xs rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkSecondary/35 text-stone-850 dark:text-stone-205 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Date Presets Switcher (High contrast white-active pill style) */}
          <div className="flex p-0.5 bg-stone-100 dark:bg-darkSecondary rounded-xl border border-stone-250/20 dark:border-stone-800/40 w-fit shrink-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => setFilterDatePreset(preset.id as any)}
                className={`px-3 py-1.5 rounded-lg text-3xs font-semibold transition-all ${
                  filterDatePreset === preset.id
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'text-stone-500 hover:text-stone-750 dark:text-stone-450 dark:hover:text-stone-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {filterDatePreset === 'custom' && (
          <div className="flex items-center gap-1.5 text-3xs font-semibold text-stone-500 dark:text-stone-455 animate-fade-in">
            <div className="relative flex items-center bg-stone-50 dark:bg-darkSecondary border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200 gap-1.5 cursor-pointer">
              <span>{formatDateToDMY(filterCustomStart)}</span>
              <input
                type="date"
                value={filterCustomStart}
                onChange={e => setFilterCustomStart(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <span>to</span>
            <div className="relative flex items-center bg-stone-50 dark:bg-darkSecondary border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200 gap-1.5 cursor-pointer">
              <span>{formatDateToDMY(filterCustomEnd)}</span>
              <input
                type="date"
                value={filterCustomEnd}
                onChange={e => setFilterCustomEnd(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Action headers: Count & Buttons */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
          Sales Records ({sortedSales.length})
        </span>

        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-3.5 py-2 bg-accent hover:bg-accent-hover text-white text-3xs font-bold rounded-xl shadow-sm transition-all shrink-0"
          >
            <Plus size={12} />
            Record Sale
          </button>
        </div>
      </div>

      {/* 4. Sales records listing */}
      {sortedSales.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2.5 border border-stone-200/30 dark:border-stone-800/30">
          <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-darkSecondary/40 text-stone-400 flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
          <span className="text-xs font-semibold text-stone-850 dark:text-stone-200">No Sales Records Found</span>
          <span className="text-3xs text-stone-450 dark:text-stone-500 max-w-xs leading-relaxed">
            Record items sold, describe specs, and configure exact costs breakdowns to evaluate accurate margin percentages.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {sortedSales.map(sale => {
            const isExpanded = expandedSaleIds.has(sale.id!);
            const margin = sale.soldFor > 0 ? Math.round((sale.profit / sale.soldFor) * 100) : 0;
            return (
              <div 
                key={sale.id}
                className="glass-card rounded-2xl border border-stone-200/35 dark:border-stone-800/30 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow"
              >
                {/* Main Card header row */}
                <div 
                  onClick={() => handleToggleExpand(sale.id!)}
                  className="p-4.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-stone-50/15 dark:hover:bg-stone-800/10 transition-colors"
                >
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-3xs font-bold text-accent px-2 py-0.5 bg-accent/10 rounded-full">{formatDateToDMY(sale.date)}</span>
                      <h4 className="text-xs font-bold text-stone-850 dark:text-stone-100">{sale.productName}</h4>
                    </div>
                    {sale.description && (
                      <p className="text-2xs text-stone-450 dark:text-stone-500 line-clamp-1">{sale.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-stone-200/20 pt-3 sm:pt-0">
                    <div className="flex gap-4.5 text-center">
                      <div className="flex flex-col">
                        <span className="text-4xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Sold Price</span>
                        <span className="text-xs font-bold text-stone-850 dark:text-stone-100 mt-0.5">{formatCurrency(sale.soldFor)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-4xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Total Cost</span>
                        <span className="text-xs font-semibold text-stone-600 dark:text-stone-400 mt-0.5">{formatCurrency(sale.totalCost)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-4xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">Profit</span>
                        <span className={`text-xs font-bold mt-0.5 ${sale.profit >= 0 ? 'text-emerald-600 dark:text-emerald-450' : 'text-red-500'}`}>
                          {formatCurrency(sale.profit)} ({margin}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(sale);
                        }}
                        className="p-1.5 text-stone-400 hover:text-accent rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                        title="Edit Sale"
                        aria-label="Edit Sale"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(sale.id!);
                        }}
                        className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                        title="Delete Sale"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button className="text-stone-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible cost breakdown drawer */}
                {isExpanded && (
                  <div className="px-5 py-4 bg-stone-50/40 dark:bg-darkSecondary/15 border-t border-stone-200/20 dark:border-stone-850/40 flex flex-col gap-3">
                    <div className="flex items-center gap-1.5 text-4xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                      <Calculator size={10} />
                      Product Cost Breakdown
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {sale.costBreakdown.map((item, index) => (
                        <div 
                          key={index}
                          className="px-3.5 py-2.5 bg-white dark:bg-darkCard rounded-xl border border-stone-200/40 dark:border-stone-800/40 flex flex-col gap-0.5 shadow-3xs"
                        >
                          <span className="text-4xs text-stone-400 dark:text-stone-500 truncate" title={item.label}>
                            {item.label}
                          </span>
                          <span className="text-2xs font-bold text-stone-750 dark:text-stone-250 mt-0.5">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Record Sale popup Dialog */}
      {showModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-2">
                <Tag size={16} />
                {editingSale ? 'Edit Sold Product' : 'Record Product Sale'}
              </h4>
              <button
                onClick={handleCloseModal}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                title="Close Dialog"
                aria-label="Close Dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="flex flex-col gap-4">
              
              {/* Product Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Product Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Oak Dining Table, Wardrobe Set..."
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Specs / Description
                </label>
                <textarea
                  placeholder="Material specs, client modifications or dimensions..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent min-h-[60px]"
                />
              </div>

              {/* Row: Price & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide flex items-center gap-0.5">
                    <DollarSign size={10} />
                    Sold For ({settings.currency})
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={soldFor}
                    onChange={e => setSoldFor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Sale Date
                  </label>
                  <div className="relative px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 cursor-pointer min-h-[36px] flex items-center">
                    <span>{formatDateToDMY(date)}</span>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section: Costs Breakdown */}
              <div className="flex flex-col gap-2.5 p-3.5 bg-stone-50/70 dark:bg-darkSecondary/35 border border-stone-250/20 dark:border-stone-850/40 rounded-2xl">
                <div className="flex justify-between items-center pb-1.5 border-b border-stone-200/35 dark:border-stone-800/20">
                  <span className="text-3xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Cost Breakdown Settings
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCustomCostField}
                    className="text-4xs font-bold text-accent flex items-center gap-0.5 hover:underline"
                  >
                    <PlusCircle size={10} />
                    Add Custom Cost
                  </button>
                </div>

                {/* Material Cost */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-2xs font-semibold text-stone-700 dark:text-stone-300">Material Cost</span>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-500 dark:text-stone-400 font-bold">{settings.currency}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={materialCost}
                      onChange={e => setMaterialCost(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Labour Cost */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-2xs font-semibold text-stone-700 dark:text-stone-300">Labour Cost</span>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-500 dark:text-stone-400 font-bold">{settings.currency}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={labourCost}
                      onChange={e => setLabourCost(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Custom Costs items list */}
                {customCosts.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Custom label (e.g. Polish)"
                      value={item.label}
                      onChange={e => handleCustomCostChange(index, 'label', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-accent"
                      required
                    />
                    <div className="relative w-24">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-500 dark:text-stone-400 font-bold">{settings.currency}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="0"
                        value={item.amount || ''}
                        onChange={e => handleCustomCostChange(index, 'amount', e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-accent"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomCostField(index)}
                      className="p-1.5 text-stone-400 hover:text-red-500 rounded hover:bg-white dark:hover:bg-stone-800"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Profit Yield Calculator Panel */}
              <div className="flex flex-col gap-2 p-3 bg-stone-100/50 dark:bg-darkSecondary/20 border border-stone-200/20 dark:border-stone-850/20 rounded-2xl">
                <div className="flex justify-between items-center text-3xs font-semibold text-stone-500 dark:text-stone-400">
                  <span>Calculated Cost:</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">{formatCurrency(calcTotalCost)}</span>
                </div>
                <div className="flex justify-between items-center text-3xs font-semibold text-stone-500 dark:text-stone-400">
                  <span>Calculated Gross Profit:</span>
                  <span className={`font-bold ${calcProfit >= 0 ? 'text-emerald-600 dark:text-emerald-450' : 'text-red-500'}`}>
                    {calcProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(calcProfit))} ({calcMargin}% Yield)
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end mt-1 pb-1">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-stone-250/50 dark:border-stone-800/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-300 hover:bg-stone-105 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  {editingSale ? 'Save Changes' : 'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
