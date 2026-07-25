import { useEffect, useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  CheckCircle2, AlertTriangle, Save, FileDown, Eye, 
  DollarSign, CalendarCheck, X 
} from 'lucide-react';
import { formatDateToDMY, type Staff, type Attendance, type Settings, type CashTransaction } from '../db/db';

interface AttendanceViewProps {
  activeStaff: Staff[];
  settings: Settings;
  isLoading?: boolean;
  getAttendanceForDate: (date: string) => Promise<Attendance[]>;
  saveAttendanceForDate: (date: string, records: { staffId: string; value: number }[]) => Promise<void>;
  getSalaryReport: (startDate: string, endDate: string) => Promise<any[]>;
  addTransaction: (tx: Omit<CashTransaction, 'id'>) => Promise<any>;
}

export function AttendanceView({
  activeStaff,
  settings,
  isLoading = false,
  getAttendanceForDate,
  saveAttendanceForDate,
  getSalaryReport,
  addTransaction,
}: AttendanceViewProps) {
  // Mode Selection: 'today' (daily marking) | 'weekly' | 'monthly' | 'yearly' | 'custom' (reports)
  const [filterType, setFilterType] = useState<'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('today');

  // --- Daily Attendance Marking States ---
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [attendanceValues, setAttendanceValues] = useState<Record<string, number>>({});
  const [isModified, setIsModified] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Reports/Summaries States ---
  const getWeekStartDateString = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 && settings.weekStart === 1 ? -6 : settings.weekStart);
    const startOfWeek = new Date(today.setDate(diff));
    return startOfWeek.toISOString().split('T')[0];
  };

  const getMonthStartDateString = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return startOfMonth.toISOString().split('T')[0];
  };

  const getYearStartDateString = () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    return startOfYear.toISOString().split('T')[0];
  };

  const [reportStartDate, setReportStartDate] = useState(getMonthStartDateString());
  const [reportEndDate, setReportEndDate] = useState(getTodayDateString());
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [detailModalStaff, setDetailModalStaff] = useState<any | null>(null);

  // Pay Salary Modal States
  const [showPaySalaryModal, setShowPaySalaryModal] = useState(false);
  const [paySalaryStaff, setPaySalaryStaff] = useState<any | null>(null);
  const [paySalaryAmount, setPaySalaryAmount] = useState('');
  const [paySalaryNotes, setPaySalaryNotes] = useState('');

  // Sync date fields for Reports when preset changes
  useEffect(() => {
    const todayStr = getTodayDateString();
    if (filterType === 'weekly') {
      setReportStartDate(getWeekStartDateString());
      setReportEndDate(todayStr);
    } else if (filterType === 'monthly') {
      setReportStartDate(getMonthStartDateString());
      setReportEndDate(todayStr);
    } else if (filterType === 'yearly') {
      setReportStartDate(getYearStartDateString());
      setReportEndDate(todayStr);
    }
  }, [filterType]);

  // Load daily attendance
  useEffect(() => {
    if (filterType !== 'today') return;
    
    async function loadAttendance() {
      setDailyLoading(true);
      try {
        const records = await getAttendanceForDate(selectedDate);
        const valuesMap: Record<string, number> = {};
        
        records.forEach(rec => {
          valuesMap[rec.staffId] = rec.attendanceValue;
        });

        setAttendanceValues(valuesMap);
        setIsModified(false);
      } catch (err) {
        console.error('Error loading attendance:', err);
      } finally {
        setDailyLoading(false);
      }
    }
    loadAttendance();
  }, [selectedDate, activeStaff, getAttendanceForDate, filterType]);

  // Load report data
  useEffect(() => {
    if (filterType === 'today') return;

    async function loadReport() {
      setReportLoading(true);
      try {
        const data = await getSalaryReport(reportStartDate, reportEndDate);
        setReportData(data);
      } catch (err) {
        console.error('Error generating report:', err);
      } finally {
        setReportLoading(false);
      }
    }
    loadReport();
  }, [reportStartDate, reportEndDate, getSalaryReport, filterType]);

  // Daily Marking Actions
  const handleValueChange = (staffId: string, value: number) => {
    setAttendanceValues(prev => ({
      ...prev,
      [staffId]: value,
    }));
    setIsModified(true);
  };

  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleSaveClick = () => {
    const markedIds = Object.keys(attendanceValues);
    if (markedIds.length === 0) {
      setNotification({ type: 'error', message: 'Please mark attendance for at least one staff member.' });
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setDailyLoading(true);
    try {
      const recordsToSave = Object.entries(attendanceValues).map(([staffId, value]) => ({
        staffId,
        value,
      }));

      await saveAttendanceForDate(selectedDate, recordsToSave);
      setIsModified(false);
      setNotification({ type: 'success', message: 'Attendance saved successfully!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Error saving attendance:', err);
      setNotification({ type: 'error', message: 'Failed to save attendance. Please try again.' });
    } finally {
      setDailyLoading(false);
    }
  };

  // Report Metrics Calculations
  const totalSalaryAccrued = reportData.reduce((sum, item) => sum + item.totalSalary, 0);
  const totalAttendancePoints = reportData.reduce((sum, item) => sum + item.totalAttendance, 0);

  // CSV Report Exports
  const handleExportCSV = () => {
    const headers = ['Staff ID', 'Name', 'Phone', 'Daily Salary', 'Status', 'Days Logged', 'Attendance Score', 'Total Salary Owed'];
    const rows = reportData.map(item => [
      item.staffId,
      `"${item.name}"`,
      `"${item.phone || ''}"`,
      item.dailySalary,
      item.status,
      item.totalDays,
      item.totalAttendance,
      item.totalSalary,
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Staff_Attendance_Report_${reportStartDate}_to_${reportEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Staff_Attendance_Report_${reportStartDate}_to_${reportEndDate}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleOpenPaySalaryModal = (staffItem: any) => {
    setPaySalaryStaff(staffItem);
    setPaySalaryAmount(staffItem.totalSalary.toString());
    setPaySalaryNotes('');
    setShowPaySalaryModal(true);
  };

  const handleSaveSalaryPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySalaryStaff) return;

    const amtNum = parseFloat(paySalaryAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      alert('Please enter a valid payment amount greater than 0.');
      return;
    }

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const notesSummary = `Salary payment for period ${reportStartDate} to ${reportEndDate}${
        paySalaryNotes.trim() ? ' - ' + paySalaryNotes.trim() : ''
      }`;

      await addTransaction({
        type: 'expense',
        category: 'Salary',
        amount: amtNum,
        date: dateStr,
        time: timeStr,
        partyName: paySalaryStaff.name,
        notes: notesSummary,
        createdAt: Date.now(),
      });

      setNotification({ type: 'success', message: `Salary payment of ${formatCurrency(amtNum)} recorded for ${paySalaryStaff.name}.` });
      setTimeout(() => setNotification(null), 3000);
      setShowPaySalaryModal(false);
    } catch (err) {
      console.error('Error saving salary payment:', err);
      alert('Failed to log payment transaction.');
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

  const markedStaffCount = Object.keys(attendanceValues).length;
  const activeStaffCount = activeStaff.length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-16">
      
      {/* 1. Mode/Period Selection Switcher Panel */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        {/* Switch Options */}
        <div className="flex p-0.5 bg-stone-100 dark:bg-darkSecondary rounded-xl border border-stone-250/20 dark:border-stone-850/40 w-fit">
          {[
            { id: 'today', label: 'Today (Marking)' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'yearly', label: 'Yearly' },
            { id: 'custom', label: 'Custom Range' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterType(opt.id as any)}
              className={`px-3 py-1.5 rounded-lg text-3xs font-semibold transition-all ${
                filterType === opt.id
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-stone-500 hover:text-stone-750 dark:text-stone-450 dark:hover:text-stone-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Dynamic Context Header Controls */}
        {filterType === 'today' ? (
          // Daily Nav for Today View
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-xl border border-stone-200/50 dark:border-stone-850/50 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="relative flex items-center bg-stone-55 border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-2.5 py-1 text-3xs font-semibold text-stone-700 dark:text-stone-300 gap-1.5 cursor-pointer">
              <CalendarIcon size={12} className="text-stone-400" />
              <span>{formatDateToDMY(selectedDate)}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-xl border border-stone-200/50 dark:border-stone-850/50 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        ) : (
          // Range controls for Reports View
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-3xs font-semibold text-stone-500 dark:text-stone-450">
              <div className="relative flex items-center bg-stone-50 dark:bg-darkSecondary border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-3 py-1.5 text-stone-800 dark:text-stone-200 gap-1.5 cursor-pointer">
                <span>{formatDateToDMY(reportStartDate)}</span>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={e => {
                    setReportStartDate(e.target.value);
                    setFilterType('custom');
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              <span>to</span>
              <div className="relative flex items-center bg-stone-50 dark:bg-darkSecondary border border-stone-200/50 dark:border-stone-850/50 rounded-xl px-3 py-1.5 text-stone-800 dark:text-stone-200 gap-1.5 cursor-pointer">
                <span>{formatDateToDMY(reportEndDate)}</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={e => {
                    setReportEndDate(e.target.value);
                    setFilterType('custom');
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>

            {/* Range Exports */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportCSV}
                disabled={reportData.length === 0}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-3xs font-semibold border border-stone-200/60 dark:border-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 disabled:opacity-50"
              >
                <FileDown size={11} />
                CSV
              </button>
              <button
                onClick={handleExportJSON}
                disabled={reportData.length === 0}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-3xs font-semibold border border-stone-200/60 dark:border-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 disabled:opacity-50"
              >
                <FileDown size={11} />
                JSON
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Primary Sub-View Render */}
      {filterType === 'today' ? (
        // --- TODAY MARKING SHEET SUB-VIEW ---
        <div className="flex flex-col gap-5">
          {notification && (
            <div className={`flex items-center gap-3 p-4 rounded-xl border text-xs font-semibold ${
              notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-400'
            }`}>
              {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{notification.message}</span>
            </div>
          )}

          {/* Quick marking progress row */}
          <div className="flex items-center justify-between px-2 text-2xs font-semibold text-stone-500">
            <span>Progress: {markedStaffCount} marked of {activeStaffCount} active staff</span>
            <button
              onClick={handleSaveClick}
              disabled={!isModified || dailyLoading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all ${
                isModified && !dailyLoading
                  ? 'bg-accent text-white hover:bg-opacity-95 shadow-accent/20 cursor-pointer'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
              }`}
            >
              <Save size={13} />
              Save Today's Attendance
            </button>
          </div>

          <div className="glass-card rounded-2xl shadow-sm overflow-hidden border border-stone-200/40 dark:border-stone-850/40">
            {dailyLoading || isLoading ? (
              // Pulsing skeletons
              <div className="divide-y divide-stone-250/20 dark:divide-stone-800/20 animate-pulse">
                {[1, 2, 3, 4].map(idx => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-6 py-4 items-center">
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-800 shrink-0"></div>
                      <div className="flex flex-col gap-2 w-32">
                        <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-3/4"></div>
                        <div className="h-2 bg-stone-200 dark:bg-stone-800 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-16"></div>
                    </div>
                    <div className="col-span-5 flex justify-end gap-1.5">
                      {[1, 2, 3, 4, 5].map(b => (
                        <div key={b} className="h-8 bg-stone-200 dark:bg-stone-800 rounded-lg flex-1 sm:flex-initial sm:w-16"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : activeStaff.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <span className="text-xs text-stone-550 dark:text-stone-400 font-semibold">
                  No staff members registered.
                </span>
                <span className="text-3xs text-stone-400 dark:text-stone-500">
                  Please go to the Staff tab and add your team registry before recording attendance.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-stone-200/50 dark:divide-stone-800/40">
                {/* Desktop headers */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3.5 bg-stone-50/50 dark:bg-darkSecondary/30 text-2xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                  <div className="col-span-5">Staff Member</div>
                  <div className="col-span-2">Daily Salary</div>
                  <div className="col-span-5 text-right">Attendance Status</div>
                </div>

                {/* Rows */}
                {activeStaff.map(member => {
                  const currentValue = attendanceValues[member.id!];
                  return (
                    <div key={member.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-stone-50/20 dark:hover:bg-stone-800/10 transition-colors">
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-stone-205/60 dark:border-stone-800/55 overflow-hidden bg-stone-100 dark:bg-darkSecondary flex items-center justify-center shrink-0">
                          {member.photo ? (
                            <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xs font-bold text-accent">
                              {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">{member.name}</span>
                          <span className="text-3xs text-stone-400 dark:text-stone-500">{member.phone || 'No phone'}</span>
                        </div>
                      </div>

                      <div className="col-span-2 text-2xs font-semibold text-stone-600 dark:text-stone-400 flex items-center gap-1 sm:block">
                        <span className="sm:hidden text-stone-400 font-normal mr-2">Daily Pay:</span>
                        {settings.currency}{member.dailySalary}
                      </div>

                      <div className="col-span-5 flex flex-wrap sm:flex-nowrap sm:justify-end gap-1">
                        {[
                          { label: 'Absent', val: 0 },
                          { label: '0.5 Day', val: 0.5 },
                          { label: 'Present', val: 1.0 },
                          { label: '1.5 Days', val: 1.5 },
                          { label: 'Double', val: 2.0 },
                        ].map(opt => {
                          const isSelected = currentValue === opt.val;
                          return (
                            <button
                              key={opt.val}
                              onClick={() => handleValueChange(member.id!, opt.val)}
                              className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-3xs font-semibold transition-all ${
                                isSelected
                                  ? 'bg-primary text-white dark:bg-accent dark:text-white shadow-sm'
                                  : 'bg-stone-100 dark:bg-darkSecondary text-stone-500 dark:text-stone-400 border border-stone-200/20 dark:border-stone-800/30 hover:bg-stone-200/40 dark:hover:bg-stone-850'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        // --- RANGE REPORTS & LEDGER SUB-VIEW ---
        <div className="flex flex-col gap-6">
          {notification && (
            <div className={`flex items-center gap-3 p-4 rounded-xl border text-xs font-semibold ${
              notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-805 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-400'
            }`}>
              {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{notification.message}</span>
            </div>
          )}

          {/* Aggregated Summaries Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="glass-card rounded-2xl p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <DollarSign size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
                  Accrued Payroll (Period)
                </span>
                <span className="text-xl font-bold text-primary dark:text-accent mt-0.5">
                  {formatCurrency(totalSalaryAccrued)}
                </span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 shadow-sm border border-stone-200/30 dark:border-stone-800/30 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <CalendarCheck size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-3xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
                  Total Attendance Score
                </span>
                <span className="text-xl font-bold text-primary dark:text-accent mt-0.5">
                  {totalAttendancePoints.toFixed(1)} Points
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Ledger Table */}
          <div className="glass-card rounded-2xl shadow-sm overflow-hidden border border-stone-200/40 dark:border-stone-850/40">
            {reportLoading ? (
              <div className="p-8 flex items-center justify-center text-xs text-stone-450 dark:text-stone-500">
                Generating summary tables...
              </div>
            ) : reportData.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-1.5">
                <span className="text-xs text-stone-550 dark:text-stone-400 font-semibold">
                  No attendance logs found in this range.
                </span>
                <span className="text-3xs text-stone-400 dark:text-stone-500">
                  Select "Today" from presets to record new logs, or widen your date filter.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-stone-200/50 dark:divide-stone-800/40 overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-stone-50/50 dark:bg-darkSecondary/30 text-2xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Staff Member</th>
                      <th className="px-4 py-3.5">Daily Pay</th>
                      <th className="px-4 py-3.5">Days Worked</th>
                      <th className="px-4 py-3.5">Total Points</th>
                      <th className="px-4 py-3.5">Calculated Salary</th>
                      <th className="px-6 py-3.5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/40 dark:divide-stone-800/40 text-xs text-stone-750 dark:text-stone-300">
                    {reportData.map(item => (
                      <tr key={item.staffId} className="hover:bg-stone-50/20 dark:hover:bg-stone-800/10 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-stone-805 dark:text-stone-105 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full border border-stone-200/50 dark:border-stone-800/40 overflow-hidden bg-stone-100 dark:bg-darkSecondary flex items-center justify-center text-2xs text-accent shrink-0">
                            {item.photo ? (
                              <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              item.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span>{item.name}</span>
                            {item.status === 'archived' && (
                              <span className="text-4xs text-stone-400 dark:text-stone-550 font-normal">Archived</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium">{settings.currency}{item.dailySalary}</td>
                        <td className="px-4 py-3.5">{item.totalDays} Days</td>
                        <td className="px-4 py-3.5">{item.totalAttendance.toFixed(1)}</td>
                        <td className="px-4 py-3.5 font-bold text-stone-850 dark:text-stone-100">{formatCurrency(item.totalSalary)}</td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenPaySalaryModal(item)}
                              className="p-2 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white border border-stone-200/10 dark:border-stone-800/10"
                              title="Pay Salary"
                            >
                              <DollarSign size={12} />
                            </button>
                            <button
                              onClick={() => setDetailModalStaff(item)}
                              className="p-2 rounded-xl bg-stone-100 dark:bg-darkSecondary text-stone-500 dark:text-stone-400 hover:text-accent border border-stone-200/10 dark:border-stone-800/10"
                              title="Inspect log breakdown"
                            >
                              <Eye size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODALS & DAILY LOG DETAIL MODALS --- */}
      
      {/* 1. Daily mark confirmation Modal */}
      {showConfirmModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <h4 className="text-base font-bold text-primary dark:text-accent">Confirm Attendance Submission</h4>
            <p className="text-2xs text-stone-500 dark:text-stone-400 leading-relaxed">
              Please double check that you are logging records for the correct date.
            </p>
            <div className="bg-stone-50 dark:bg-darkSecondary p-4 rounded-xl flex flex-col gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300 border border-stone-200/20 dark:border-stone-800/10">
              <div className="flex justify-between">
                <span className="text-stone-400">Date:</span>
                <span>{formatDateToDMY(selectedDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Staff Marked:</span>
                <span>{markedStaffCount} / {activeStaffCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-opacity-95 shadow-sm shadow-accent/25"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Detailed Log inspect modal (Reports view details) */}
      {detailModalStaff && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl max-w-lg w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/30 dark:border-stone-800/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-100 dark:bg-darkSecondary flex items-center justify-center text-xs font-bold text-accent shrink-0">
                  {detailModalStaff.photo ? (
                    <img src={detailModalStaff.photo} alt={detailModalStaff.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    detailModalStaff.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                  )}
                </div>
                <div className="flex flex-col">
                  <h4 className="text-xs font-bold text-stone-850 dark:text-stone-100">{detailModalStaff.name}</h4>
                  <span className="text-3xs text-stone-450 dark:text-stone-500">
                    Detailed Logs ({formatDateToDMY(reportStartDate)} to {formatDateToDMY(reportEndDate)})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetailModalStaff(null)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-450 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                title="Close Dialog"
                aria-label="Close Dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 max-h-[280px] overflow-y-auto no-scrollbar pr-1 flex flex-col gap-2">
              {detailModalStaff.records.length === 0 ? (
                <div className="text-center py-8 text-3xs text-stone-400 dark:text-stone-500">
                  No logged attendance records in this range.
                </div>
              ) : (
                detailModalStaff.records
                  .sort((a: Attendance, b: Attendance) => b.date.localeCompare(a.date))
                  .map((rec: Attendance) => (
                    <div
                      key={rec.id}
                      className="p-3 bg-stone-50 dark:bg-darkSecondary rounded-xl flex items-center justify-between border border-stone-200/20 dark:border-stone-800/10 text-3xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-stone-705 dark:text-stone-300">{formatDateToDMY(rec.date)}</span>
                        <span className="text-4xs text-stone-400 dark:text-stone-550">
                          Rate: {settings.currency}{detailModalStaff.dailySalary}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-md font-semibold ${
                          rec.attendanceValue === 0 ? 'bg-red-500/10 text-red-650' :
                          rec.attendanceValue === 0.5 ? 'bg-amber-500/10 text-amber-650' :
                          rec.attendanceValue === 1.0 ? 'bg-emerald-500/10 text-emerald-650' :
                          'bg-blue-505/10 text-blue-650'
                        }`}>
                          {rec.attendanceValue === 0 ? 'Absent' :
                           rec.attendanceValue === 0.5 ? '0.5 Day' :
                           rec.attendanceValue === 1.0 ? 'Present' :
                           `${rec.attendanceValue} Days`}
                        </span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {formatCurrency(rec.attendanceValue * detailModalStaff.dailySalary)}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-200/30 dark:border-stone-800/30 text-3xs text-stone-500 dark:text-stone-405">
              <span>Total Accrued:</span>
              <span className="text-xs font-bold text-primary dark:text-accent">
                {formatCurrency(detailModalStaff.totalSalary)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Record Salary Payment popup Dialog */}
      {showPaySalaryModal && paySalaryStaff && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-2">
                <DollarSign size={16} />
                <span>Pay Salary: {paySalaryStaff.name}</span>
              </h4>
              <button
                onClick={() => setShowPaySalaryModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSalaryPayment} className="flex flex-col gap-4">
              
              {/* Daily Rate Info */}
              <div className="text-3xs text-stone-500 dark:text-stone-405 font-semibold bg-stone-50 dark:bg-darkSecondary p-3 rounded-xl border border-stone-200/20 dark:border-stone-800/10 flex justify-between">
                <span>Daily Wage Rate:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">{settings.currency}{paySalaryStaff.dailySalary} / day</span>
              </div>

              {/* Payment Amount */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Payment Amount
                  </label>
                  <span className="text-[10px] text-stone-400 font-semibold italic">
                    Accrued: {formatCurrency(paySalaryStaff.totalSalary)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 dark:text-stone-400 font-bold">{settings.currency}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={paySalaryAmount}
                    onChange={e => setPaySalaryAmount(e.target.value)}
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
                  placeholder="e.g. Month end payroll, advance adjustment..."
                  value={paySalaryNotes}
                  onChange={e => setPaySalaryNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Submit Actions */}
              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowPaySalaryModal(false)}
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
