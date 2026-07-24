import { useEffect, useState } from 'react';
import { 
  Users, CalendarDays, ArrowRight, 
  Wallet, ArrowDownRight, ArrowUpRight, AlertTriangle 
} from 'lucide-react';
import type { Staff, Attendance, Settings, CashTransaction, CustomerDue } from '../db/db';
import { db, formatDateToDMY } from '../db/db';

interface DashboardViewProps {
  activeStaff: Staff[];
  settings: Settings;
  setView: (view: string) => void;
  getAttendanceForDate: (date: string) => Promise<Attendance[]>;
  currentBranchId: number;
}

export function DashboardView({ activeStaff, settings, setView, getAttendanceForDate, currentBranchId }: DashboardViewProps) {
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);

  // Cash Log & Dues Overview States
  const [cashBalance, setCashBalance] = useState(0);
  const [todayCashIncome, setTodayCashIncome] = useState(0);
  const [todayCashExpense, setTodayCashExpense] = useState(0);
  const [recentCashLogs, setRecentCashLogs] = useState<CashTransaction[]>([]);
  const [duesList, setDuesList] = useState<CustomerDue[]>([]);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);

  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayDateString();

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Load today's attendance
        const todayRecords = await getAttendanceForDate(todayStr);
        setTodayAttendance(todayRecords);

        // Load Cash Log Overview Data (isolated by branch!)
        const allCashTx = await db.cashLog.where('branchId').equals(currentBranchId).toArray();
        const allTimeIncome = allCashTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const allTimeExpense = allCashTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        setCashBalance(allTimeIncome - allTimeExpense);

        const todayIn = allCashTx.filter(t => t.type === 'income' && t.date === todayStr).reduce((sum, t) => sum + t.amount, 0);
        const todayOut = allCashTx.filter(t => t.type === 'expense' && t.date === todayStr).reduce((sum, t) => sum + t.amount, 0);
        setTodayCashIncome(todayIn);
        setTodayCashExpense(todayOut);

        // Sort to get 3 most recent cash logs
        const sortedLogs = [...allCashTx].sort((a, b) => {
          const dateTimeA = `${a.date}T${a.time}`;
          const dateTimeB = `${b.date}T${b.time}`;
          return dateTimeB.localeCompare(dateTimeA);
        }).slice(0, 3);
        setRecentCashLogs(sortedLogs);

        // Load pending customer dues (isolated by branch!)
        const allDues = await db.customerDues.where('branchId').equals(currentBranchId).toArray();
        const pendingDues = allDues.filter(d => d.status === 'pending');
        setDuesList(pendingDues);

        // Load pending cost breakdowns count for sales from customer orders
        const allSales = await db.sales.where('branchId').equals(currentBranchId).toArray();
        const pendingSales = allSales.filter(s => s.orderId !== undefined && s.totalCost === 0);
        setPendingSalesCount(pendingSales.length);

      } catch (err) {
        console.error('Error loading dashboard data:', err);
      }
    }

    loadDashboardData();
  }, [activeStaff, todayStr, getAttendanceForDate, currentBranchId]);

  // Today's calculations filtered by active staff of the current branch
  const activeStaffIds = new Set(activeStaff.map(s => s.id));
  const branchTodayAttendance = todayAttendance.filter(r => activeStaffIds.has(r.staffId));

  const totalActiveCount = activeStaff.length;
  const markedCount = branchTodayAttendance.length;
  
  // Count how many are present (attendance value > 0)
  const presentCount = branchTodayAttendance.filter(r => r.attendanceValue > 0).length;
  const attendanceRate = totalActiveCount > 0 ? Math.round((presentCount / totalActiveCount) * 100) : 0;

  const unmarkedCount = totalActiveCount - markedCount;

  // Dues calculations for warnings
  const todayDues = duesList.filter(d => d.date === todayStr);
  const overdueDues = duesList.filter(d => d.date < todayStr);
  const totalDuesAlertCount = todayDues.length + overdueDues.length;
  const duesAlertSum = [...todayDues, ...overdueDues].reduce((sum, d) => sum + d.amount, 0);

  // Formatting currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency === '$' ? 'USD' : settings.currency === '₹' ? 'INR' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val).replace('USD', '$').replace('INR', '₹').replace('EUR', '€');
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16">
      
      {/* 1. Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Active Staff */}
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-2xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Active Staff
            </span>
            <span className="text-3xl font-bold text-primary dark:text-accent">
              {totalActiveCount}
            </span>
            <span className="text-3xs text-stone-400 dark:text-stone-500 mt-1">
              Currently in registry
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/5 dark:bg-accent/10 flex items-center justify-center text-primary dark:text-accent">
            <Users size={22} />
          </div>
        </div>

        {/* Card 2: Today's Attendance */}
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-2xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Today's Presence
            </span>
            <span className="text-3xl font-bold text-primary dark:text-accent">
              {attendanceRate}%
            </span>
            <span className="text-3xs text-stone-400 dark:text-stone-500 mt-1">
              {presentCount} of {totalActiveCount} marked present
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/5 dark:bg-accent/10 flex items-center justify-center text-primary dark:text-accent">
            <CalendarDays size={22} />
          </div>
        </div>

        {/* Card 3: Cash Balance */}
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-2xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Cash Balance
            </span>
            <span className="text-3xl font-bold text-primary dark:text-accent">
              {formatCurrency(cashBalance)}
            </span>
            <span className="text-3xs text-stone-400 dark:text-stone-500 mt-1">
              Total cash ledger balance
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/5 dark:bg-accent/10 flex items-center justify-center text-primary dark:text-accent font-bold">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* 2. Customer Dues Notification Alert Banner */}
      {totalDuesAlertCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl shadow-sm text-amber-800 dark:text-amber-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600">
              <AlertTriangle size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">
                {totalDuesAlertCount === 1 ? (
                  `Due Date Reminder: Payment of ${formatCurrency(duesAlertSum)} from ${todayDues.length === 1 ? todayDues[0].customerName : overdueDues[0].customerName} is ${todayDues.length === 1 ? 'due today' : 'overdue'}!`
                ) : (
                  `Outstanding Dues Reminder: You have ${totalDuesAlertCount} customer payments due today or overdue.`
                )}
              </span>
              <span className="text-3xs text-amber-650 dark:text-amber-500 font-medium mt-0.5">
                Total outstanding dues alert: {formatCurrency(duesAlertSum)}. Pending customers: {Array.from(new Set([...todayDues, ...overdueDues].map(d => d.customerName))).join(', ')}.
              </span>
            </div>
          </div>
          <button
            onClick={() => setView('payments')}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-3xs font-bold rounded-xl transition-all shrink-0 shadow-sm"
          >
            Collect Now
            <ArrowRight size={12} />
          </button>
        </div>
      )}
      {/* 2.5 Pending Sales Cost Breakdown Alert Banner */}
      {pendingSalesCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl shadow-sm text-amber-800 dark:text-amber-400 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600">
              <AlertTriangle size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">
                Cost Breakdown Pending Reminder
              </span>
              <span className="text-3xs text-amber-650 dark:text-amber-500 font-medium mt-0.5">
                You have {pendingSalesCount} new sale{pendingSalesCount > 1 ? 's' : ''} from customer orders with pending cost breakdowns. Please add material/labour costs to calculate correct profits.
              </span>
            </div>
          </div>
          <button
            onClick={() => setView('sales')}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-3xs font-bold rounded-xl transition-all shrink-0 shadow-sm"
          >
            Update Cost Breakdowns
            <ArrowRight size={12} />
          </button>
        </div>
      )}
      
      {/* 3. Main Row: Today's Attendance Overview */}
      <div className="w-full glass-card rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-stone-855 dark:text-stone-150 text-sm">
            Today's Attendance Status
          </h3>
          <span className="text-3xs px-2.5 py-1 rounded-full bg-stone-100 dark:bg-darkSecondary text-stone-550 dark:text-stone-400 font-medium">
            {formatDateToDMY(todayStr)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="bg-stone-50 dark:bg-darkSecondary/40 p-4 rounded-xl flex flex-col gap-1 border border-stone-200/20 dark:border-stone-800/10">
            <span className="text-3xs text-stone-400 dark:text-stone-500">Unmarked</span>
            <span className="text-xl font-bold text-amber-600">{unmarkedCount}</span>
          </div>
          <div className="bg-stone-50 dark:bg-darkSecondary/40 p-4 rounded-xl flex flex-col gap-1 border border-stone-200/20 dark:border-stone-800/10">
            <span className="text-3xs text-stone-400 dark:text-stone-500">Marked</span>
            <span className="text-xl font-bold text-stone-850 dark:text-stone-100">{markedCount}</span>
          </div>
        </div>

        {unmarkedCount > 0 ? (
          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                Unmarked staff members remaining
              </span>
              <span className="text-3xs text-amber-600 dark:text-amber-555">
                You have {unmarkedCount} staff members without marked attendance today.
              </span>
            </div>
            <button
              onClick={() => setView('attendance')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              Mark Now
              <ArrowRight size={13} />
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-semibold">
              Perfect! Today's attendance is fully marked and saved.
            </span>
          </div>
        )}
      </div>

      {/* 4. Consolidated Cash Log Overview Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions list */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-stone-855 dark:text-stone-150 text-sm">
              Recent Cash Transactions
            </h3>
            <button
              onClick={() => setView('cash')}
              className="flex items-center gap-1 text-3xs font-bold text-accent hover:underline"
            >
              View Full Cash Log
              <ArrowRight size={10} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {recentCashLogs.length === 0 ? (
              <div className="text-center py-8 text-3xs text-stone-400 dark:text-stone-500">
                No recorded cash transactions. Go to the Cash Log tab to add entries.
              </div>
            ) : (
              recentCashLogs.map(tx => {
                const isIncome = tx.type === 'income';
                return (
                  <div 
                    key={tx.id}
                    className={`p-3 rounded-xl flex items-center justify-between border-l-4 shadow-sm border border-stone-250/15 dark:border-stone-850/15 ${
                      isIncome ? 'border-l-emerald-500' : 'border-l-red-500'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600'
                      }`}>
                        {isIncome ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-2xs font-semibold text-stone-750 dark:text-stone-200 truncate">
                          {tx.category} {tx.partyName ? `(${tx.partyName})` : ''}
                        </span>
                        <span className="text-4xs text-stone-400 dark:text-stone-500">
                          {formatDateToDMY(tx.date)} at {tx.time}
                        </span>
                      </div>
                    </div>
                    <span className={`text-2xs font-bold ${
                      isIncome ? 'text-emerald-605 dark:text-emerald-400' : 'text-red-605 dark:text-red-405'
                    }`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Today's Cash Flow Card */}
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4 shadow-sm justify-between">
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-stone-855 dark:text-stone-150 text-sm">
              Today's Cash Flow
            </h3>
            
            <div className="flex flex-col gap-3.5 mt-2">
              <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <ArrowDownRight size={13} />
                  </div>
                  <span className="text-3xs text-stone-500 dark:text-stone-400 font-semibold">Today's Income</span>
                </div>
                <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-405">
                  +{formatCurrency(todayCashIncome)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-red-500/5 dark:bg-red-500/10 border border-red-500/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-red-500/10 text-red-655 flex items-center justify-center shrink-0">
                    <ArrowUpRight size={13} />
                  </div>
                  <span className="text-3xs text-stone-500 dark:text-stone-400 font-semibold">Today's Expenses</span>
                </div>
                <span className="text-2xs font-bold text-red-655 dark:text-red-405">
                  -{formatCurrency(todayCashExpense)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2.5 border-t border-stone-200/40 dark:border-stone-800/35 text-3xs text-stone-500">
            <span>Net Cash flow today:</span>
            <span className={`text-2xs font-bold ${
              (todayCashIncome - todayCashExpense) >= 0 ? 'text-emerald-605' : 'text-red-605'
            }`}>
              {(todayCashIncome - todayCashExpense) >= 0 ? '+' : ''}
              {formatCurrency(todayCashIncome - todayCashExpense)}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
