import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Calendar, PieChart,
  DollarSign, CheckSquare, Square
} from 'lucide-react';
import type { CashTransaction, ExpenseGroup, Settings, Sale } from '../db/db';

interface ProfitViewProps {
  settings: Settings;
  sales: Sale[];
  cashTransactions: CashTransaction[];
  expenseGroups: ExpenseGroup[];
}

export function ProfitView({
  settings,
  sales,
  cashTransactions,
  expenseGroups
}: ProfitViewProps) {
  // Date State
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
  // Selected Expense Group IDs for Net Profit offset
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Sync selected group IDs when expense groups load (check all by default)
  useEffect(() => {
    if (expenseGroups.length > 0 && selectedGroupIds.length === 0) {
      setSelectedGroupIds(expenseGroups.map(g => g.id!).filter(id => id !== undefined));
    }
  }, [expenseGroups]);

  // Months array
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Years array
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Toggle selection for a group ID
  const handleToggleGroup = (id: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(id) 
        ? prev.filter(gid => gid !== id) 
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedGroupIds(expenseGroups.map(g => g.id!).filter(Boolean));
  };

  const handleClearAll = () => {
    setSelectedGroupIds([]);
  };

  // Calculations for chosen Month/Year
  // 1. Gross Profit from Sales
  const monthlySales = sales.filter(s => {
    const [year, month] = s.date.split('-');
    return Number(year) === selectedYear && Number(month) === (selectedMonth + 1);
  });
  const totalGrossProfit = monthlySales.reduce((sum, s) => sum + s.profit, 0);

  // 2. Expenses filtered by month/year and selected groups
  const monthlyExpenses = cashTransactions.filter(tx => {
    if (tx.type !== 'expense') return false;
    const [year, month] = tx.date.split('-');
    const matchesDate = Number(year) === selectedYear && Number(month) === (selectedMonth + 1);
    if (!matchesDate) return false;

    // Must be in selectedGroupIds (if a transaction doesn't have a groupId, treat it as Others or check if it falls under undefined/0)
    // To support backward compatibility, if a transaction has no groupId, we categorize it under 'Others' group (which usually exists)
    const targetGroupId = tx.groupId || expenseGroups.find(g => g.name.toLowerCase() === 'others')?.id || '';
    return selectedGroupIds.includes(targetGroupId);
  });

  const totalExpensesSelected = monthlyExpenses.reduce((sum, tx) => sum + tx.amount, 0);

  // Calculate Net Profit
  const netProfit = totalGrossProfit - totalExpensesSelected;
  const isPositiveProfit = netProfit >= 0;

  // Grouped expenses totals dictionary
  const getGroupTotal = (groupId: string) => {
    return cashTransactions
      .filter(tx => {
        if (tx.type !== 'expense') return false;
        const [year, month] = tx.date.split('-');
        const matchesDate = Number(year) === selectedYear && Number(month) === (selectedMonth + 1);
        if (!matchesDate) return false;

        const targetGroupId = tx.groupId || expenseGroups.find(g => g.name.toLowerCase() === 'others')?.id || 0;
        return targetGroupId === groupId;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  // Currency Formatter
  const formatCurrency = (val: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency === '$' ? 'USD' : settings.currency === '₹' ? 'INR' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.abs(val)).replace('USD', '$').replace('INR', '₹').replace('EUR', '€');
    return val < 0 ? `-${formatted}` : formatted;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16">
      
      {/* 1. Date & Year Selector Controls */}
      <div className="glass-card rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm border border-stone-200/35 dark:border-stone-805/30">
        <div className="flex items-center gap-2">
          <Calendar className="text-stone-400" size={16} />
          <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Select Report Period</span>
        </div>
        
        <div className="flex items-center gap-2.5">
          {/* Month Dropdown */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-stone-200/50 dark:border-stone-850/50 bg-stone-55 dark:bg-darkSecondary text-stone-850 dark:text-stone-200 focus:outline-none cursor-pointer"
          >
            {months.map((m, i) => (
              <option key={m} value={i} className="bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-200">{m}</option>
            ))}
          </select>
          
          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-stone-200/50 dark:border-stone-850/50 bg-stone-55 dark:bg-darkSecondary text-stone-850 dark:text-stone-200 focus:outline-none cursor-pointer"
          >
            {years.map(y => (
              <option key={y} value={y} className="bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-200">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gross Profit Card */}
        <div className="glass-card rounded-2xl p-5 border border-stone-200/35 dark:border-stone-800/30 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-4xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
              Gross Profit (Sales)
            </span>
            <span className="text-lg md:text-xl font-extrabold text-emerald-600 dark:text-emerald-450 mt-0.5 truncate">
              {formatCurrency(totalGrossProfit)}
            </span>
          </div>
        </div>

        {/* Selected Expenses Card */}
        <div className="glass-card rounded-2xl p-5 border border-stone-200/35 dark:border-stone-800/30 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <TrendingDown size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-4xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
              Selected Expenses
            </span>
            <span className="text-lg md:text-xl font-extrabold text-amber-655 dark:text-amber-450 mt-0.5 truncate">
              {formatCurrency(totalExpensesSelected)}
            </span>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className={`glass-card rounded-2xl p-5 border flex items-center gap-4 ${
          isPositiveProfit 
            ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/2' 
            : 'border-red-500/20 bg-red-500/5 dark:bg-red-500/2'
        }`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            isPositiveProfit 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
              : 'bg-red-500/10 text-red-600 dark:text-red-405'
          }`}>
            <DollarSign size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-4xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
              Calculated Net Profit
            </span>
            <span className={`text-lg md:text-xl font-black mt-0.5 truncate ${
              isPositiveProfit ? 'text-emerald-650 dark:text-emerald-400' : 'text-red-650 dark:text-red-400'
            }`}>
              {formatCurrency(netProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Split View: Selection Checklist on left, Table Ledger on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Checklist Selector (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-5 border border-stone-200/35 dark:border-stone-800/30 flex flex-col gap-4 shadow-2xs">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <span className="text-xs font-bold text-stone-850 dark:text-stone-100 flex items-center gap-1.5">
                <PieChart size={14} className="text-accent" />
                Select Expense Groups
              </span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleSelectAll}
                className="flex-1 py-1 px-2 border border-stone-250 dark:border-stone-800 rounded-lg text-4xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
              >
                Check All
              </button>
              <button 
                onClick={handleClearAll}
                className="flex-1 py-1 px-2 border border-stone-250 dark:border-stone-800 rounded-lg text-4xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
              >
                Uncheck All
              </button>
            </div>

            {/* Checkboxes List */}
            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {expenseGroups.map(group => {
                const isChecked = selectedGroupIds.includes(group.id!);
                return (
                  <button
                    key={group.id}
                    onClick={() => handleToggleGroup(group.id!)}
                    className="flex items-center gap-3 text-left py-2 px-3 rounded-xl hover:bg-stone-100/60 dark:hover:bg-stone-800/40 transition-colors w-full group"
                  >
                    {isChecked ? (
                      <CheckSquare size={16} className="text-accent shrink-0" />
                    ) : (
                      <Square size={16} className="text-stone-400 dark:text-stone-500 shrink-0 group-hover:text-stone-600" />
                    )}
                    <span className={`text-2xs font-semibold ${
                      isChecked 
                        ? 'text-stone-850 dark:text-stone-200 font-bold' 
                        : 'text-stone-500 dark:text-stone-400'
                    }`}>
                      {group.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ledger Details (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-5 border border-stone-200/35 dark:border-stone-800/30 flex flex-col gap-4 shadow-2xs">
            <span className="text-xs font-bold text-stone-850 dark:text-stone-100">
              Ledger Summary: {months[selectedMonth]} {selectedYear}
            </span>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-2xs">
                <thead>
                  <tr className="border-b border-stone-200/30 dark:border-stone-800/20 text-4xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                    <th className="py-2.5">Category / Department</th>
                    <th className="py-2.5 text-right">Inflow (+)</th>
                    <th className="py-2.5 text-right">Outflow (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/20 dark:divide-stone-800/10 font-medium">
                  {/* Gross Profit row */}
                  <tr className="text-stone-850 dark:text-stone-200">
                    <td className="py-3">Gross Profit from Product Sales</td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-450 font-bold">
                      {formatCurrency(totalGrossProfit)}
                    </td>
                    <td className="py-3 text-right text-stone-400">-</td>
                  </tr>

                  {/* Expense Groups rows */}
                  {expenseGroups.map(group => {
                    const isChecked = selectedGroupIds.includes(group.id!);
                    const groupSpend = getGroupTotal(group.id!);
                    if (!isChecked && groupSpend === 0) return null; // hide if unchecked and zero spend

                    return (
                      <tr 
                        key={group.id} 
                        className={isChecked ? 'text-stone-700 dark:text-stone-300' : 'text-stone-400 dark:text-stone-600 line-through opacity-70'}
                      >
                        <td className="py-3 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isChecked ? 'bg-accent' : 'bg-stone-300 dark:bg-stone-800'}`} />
                          {group.name} Expenses {!isChecked && ' (Excluded)'}
                        </td>
                        <td className="py-3 text-right text-stone-400">-</td>
                        <td className="py-3 text-right text-red-500/80 dark:text-red-400/80">
                          {formatCurrency(groupSpend)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Summary Totals Footer */}
                  <tr className="border-t-2 border-stone-200/50 dark:border-stone-800/40 text-stone-850 dark:text-stone-100 font-extrabold bg-stone-50/20 dark:bg-darkSecondary/10">
                    <td className="py-4 text-xs font-black">Net Profit</td>
                    <td className="py-4 text-right text-emerald-600 dark:text-emerald-450 font-black">
                      {isPositiveProfit ? formatCurrency(netProfit) : '-'}
                    </td>
                    <td className="py-4 text-right text-red-650 dark:text-red-400 font-black">
                      {!isPositiveProfit ? formatCurrency(netProfit) : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
