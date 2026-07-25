import React, { useRef, useState } from 'react';
import { 
  Settings as SettingsIcon, Download, Upload, Info, 
  AlertTriangle, ShieldCheck, Check, Building, Edit2, Trash2, X, Printer
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { db, formatDateToDMY } from '../db/db';
import type { Settings, Branch } from '../db/db';

interface SettingsViewProps {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  exportBackup: () => Promise<string>;
  importBackup: (jsonData: string) => Promise<boolean>;
  branches: Branch[];
  addBranch: (name: string) => Promise<any>;
  renameBranch: (id: string, newName: string) => Promise<any>;
  deleteBranch: (id: string) => Promise<any>;
  activeBranchId: string;
}

export function SettingsView({ 
  settings, 
  updateSettings, 
  exportBackup, 
  importBackup,
  branches,
  addBranch,
  renameBranch,
  deleteBranch,
  activeBranchId
}: SettingsViewProps) {
  const { user, signOut } = useAuth();

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [currency, setCurrency] = useState(settings.currency);
  const [weekStart, setWeekStart] = useState(settings.weekStart);
  const [theme, setTheme] = useState(settings.theme);
  
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Branch States
  const [newBranchName, setNewBranchName] = useState('');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchName, setEditingBranchName] = useState('');
  const [branchError, setBranchError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSaved(false);

    if (!businessName.trim()) {
      setErrorMsg('Business name cannot be empty.');
      return;
    }

    try {
      await updateSettings({
        businessName: businessName.trim(),
        currency,
        weekStart: Number(weekStart),
        theme,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error('Error saving settings:', err);
      setErrorMsg('Failed to save settings. Please try again.');
    }
  };

  const handleAddBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchError('');
    if (!newBranchName.trim()) return;

    try {
      await addBranch(newBranchName.trim());
      setNewBranchName('');
    } catch (err) {
      console.error('Add branch error:', err);
      setBranchError('Failed to create branch.');
    }
  };

  const handleStartRename = (id: string, name: string) => {
    setEditingBranchId(id);
    setEditingBranchName(name);
  };

  const handleSaveBranchRename = async (id: string) => {
    if (!editingBranchName.trim()) return;
    try {
      await renameBranch(id, editingBranchName.trim());
      setEditingBranchId(null);
    } catch (err) {
      console.error('Rename branch error:', err);
      setBranchError('Failed to rename branch.');
    }
  };

  const handleDeleteBranchClick = async (id: string) => {
    if (branches.length <= 1) {
      alert('Cannot delete the only remaining branch.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this branch? WARNING: This will permanently delete all staff registry, attendance logs, cash transactions, and customer dues associated with this branch! This action cannot be undone.')) {
      try {
        await deleteBranch(id);
      } catch (err) {
        console.error('Delete branch error:', err);
        alert('Failed to delete branch.');
      }
    }
  };

  const handleExport = async () => {
    try {
      const dataStr = await exportBackup();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      const date = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Staff_Attendance_Backup_${date}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error during backup export:', err);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await importBackup(text);
        
        setImportStatus({
          type: 'success',
          message: 'Backup imported successfully! Reloading application...',
        });

        // Reload window after 1.5 seconds to refresh Live Queries
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error('Import error:', err);
        setImportStatus({
          type: 'error',
          message: 'Invalid backup file. Ensure the file was generated by this system.',
        });
      }
    };
    reader.readAsText(file);
    
    // Clear value to allow re-upload of same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportCashLogCSV = async () => {
    try {
      const data = await db.cashLog.where('branchId').equals(activeBranchId).toArray();
      data.sort((a, b) => b.date.localeCompare(a.date));

      const headers = ['Date', 'Category', 'Party Name', 'Type', 'Amount', 'Notes'];
      const rows = data.map(item => [
        item.date,
        `"${item.category}"`,
        `"${item.partyName || ''}"`,
        item.type.toUpperCase(),
        item.amount,
        `"${item.notes || ''}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      downloadCSV(csvContent, `Cash_Ledger_Branch_${activeBranchId}.csv`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportSalesCSV = async () => {
    try {
      const data = await db.sales.where('branchId').equals(activeBranchId).toArray();
      data.sort((a, b) => b.date.localeCompare(a.date));

      const headers = ['Date', 'Product Name', 'Sold For', 'Total Cost', 'Net Profit', 'Description'];
      const rows = data.map(item => [
        item.date,
        `"${item.productName}"`,
        item.soldFor,
        item.totalCost,
        item.profit,
        `"${item.description || ''}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      downloadCSV(csvContent, `Sales_Ledger_Branch_${activeBranchId}.csv`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportDuesCSV = async () => {
    try {
      const data = await db.customerDues.where('branchId').equals(activeBranchId).toArray();
      data.sort((a, b) => b.date.localeCompare(a.date));

      const headers = ['Date', 'Customer Name', 'Phone', 'Amount', 'Status', 'Received Date', 'Notes'];
      const rows = data.map(item => [
        item.date,
        `"${item.customerName}"`,
        `"${item.customerPhone || ''}"`,
        item.amount,
        item.status.toUpperCase(),
        item.receivedDate || '',
        `"${item.notes || ''}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      downloadCSV(csvContent, `Customer_Credit_Dues_Branch_${activeBranchId}.csv`);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = async (type: 'cash' | 'sales' | 'dues') => {
    try {
      let title = '';
      let headers: string[] = [];
      let rows: string[][] = [];

      if (type === 'cash') {
        title = 'Cash Log Ledger Report';
        headers = ['Date', 'Category', 'Party Name', 'Type', 'Amount', 'Notes'];
        const data = await db.cashLog.where('branchId').equals(activeBranchId).toArray();
        data.sort((a, b) => b.date.localeCompare(a.date));
        rows = data.map(item => [
          formatDateToDMY(item.date),
          item.category,
          item.partyName || '-',
          item.type.toUpperCase(),
          `${settings.currency}${item.amount}`,
          item.notes || '-'
        ]);
      } else if (type === 'sales') {
        title = 'Product Sales Ledger Report';
        headers = ['Date', 'Product Name', 'Sold For', 'Total Cost', 'Gross Profit', 'Specs'];
        const data = await db.sales.where('branchId').equals(activeBranchId).toArray();
        data.sort((a, b) => b.date.localeCompare(a.date));
        rows = data.map(item => [
          formatDateToDMY(item.date),
          item.productName,
          `${settings.currency}${item.soldFor}`,
          `${settings.currency}${item.totalCost}`,
          `${settings.currency}${item.profit}`,
          item.description || '-'
        ]);
      } else if (type === 'dues') {
        title = 'Customer Credit Dues Report';
        headers = ['Date', 'Customer Name', 'Phone', 'Amount', 'Status', 'Received Date', 'Notes'];
        const data = await db.customerDues.where('branchId').equals(activeBranchId).toArray();
        data.sort((a, b) => b.date.localeCompare(a.date));
        rows = data.map(item => [
          formatDateToDMY(item.date),
          item.customerName,
          item.customerPhone || '-',
          `${settings.currency}${item.amount}`,
          item.status.toUpperCase(),
          formatDateToDMY(item.receivedDate) || '-',
          item.notes || '-'
        ]);
      }

      // Generate HTML for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print reports.');
        return;
      }

      const branchName = branches.find(b => b.id === activeBranchId)?.name || 'Main Branch';
      
      printWindow.document.write(`
        <html>
          <head>
            <title>${title} - ${settings.businessName}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #111111;
                margin: 40px;
                font-size: 12px;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #3A281C;
                padding-bottom: 15px;
                margin-bottom: 30px;
              }
              .business-name {
                font-size: 20px;
                font-weight: bold;
                color: #3A281C;
              }
              .report-title {
                font-size: 14px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .meta-info {
                font-size: 11px;
                color: #555555;
                margin-bottom: 20px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
              }
              th, td {
                border: 1px solid #ECE8E1;
                padding: 10px 12px;
                text-align: left;
              }
              th {
                background-color: #F6F2EB;
                color: #3A281C;
                font-weight: bold;
              }
              tr:nth-child(even) {
                background-color: #FAF8F5;
              }
              .footer {
                margin-top: 50px;
                text-align: center;
                font-size: 10px;
                color: #888888;
                border-top: 1px dashed #ECE8E1;
                padding-top: 15px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="business-name">${settings.businessName}</div>
                <div class="report-title">${title}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: bold;">Branch: ${branchName}</div>
                <div>Generated: ${formatDateToDMY(new Date())}</div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  ${headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rows.map(row => `
                  <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="footer">
              Generated by Manager
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error('Print report error:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16 max-w-2xl">
      {/* General Settings Card */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-stone-200/40 dark:border-stone-850/40">
        <h3 className="font-semibold text-sm text-stone-855 dark:text-stone-150 flex items-center gap-2 pb-3 border-b border-stone-200/20 dark:border-stone-800/20">
          <SettingsIcon size={16} className="text-accent" />
          General System Settings
        </h3>

        <form onSubmit={handleSaveSettings} className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              Business Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800/80 bg-white dark:bg-darkSecondary/40 text-xs text-stone-850 dark:text-stone-100 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                Currency Symbol
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800/80 bg-white dark:bg-darkSecondary/40 text-xs text-stone-850 dark:text-stone-100 focus:outline-none focus:border-accent transition-colors"
              >
                <option value="$">US Dollar ($)</option>
                <option value="₹">Indian Rupee (₹)</option>
                <option value="€">Euro (€)</option>
                <option value="£">Pound Sterling (£)</option>
                <option value="¥">Japanese Yen (¥)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                First Day of the Week
              </label>
              <select
                value={weekStart}
                onChange={e => setWeekStart(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800/80 bg-white dark:bg-darkSecondary/40 text-xs text-stone-850 dark:text-stone-100 focus:outline-none focus:border-accent transition-colors"
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                Display Mode (Theme)
              </label>
              <select
                value={theme}
                onChange={e => setTheme(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800/80 bg-white dark:bg-darkSecondary/40 text-xs text-stone-850 dark:text-stone-100 focus:outline-none focus:border-accent transition-colors"
              >
                <option value="system">Follow System Preferences</option>
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>
          </div>

          {errorMsg && (
            <span className="text-3xs text-red-500 font-semibold">{errorMsg}</span>
          )}

          <div className="flex items-center gap-3 justify-end mt-2">
            {isSaved && (
              <span className="text-3xs text-emerald-600 dark:text-emerald-450 font-semibold flex items-center gap-1 animate-fade-in">
                <Check size={12} />
                Settings saved!
              </span>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-opacity-95 shadow-sm shadow-accent/25 transition-all"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>

      {/* Manage Branches Section */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-stone-200/40 dark:border-stone-850/40 flex flex-col gap-4">
        <h3 className="font-semibold text-sm text-stone-855 dark:text-stone-150 flex items-center gap-2 pb-3 border-b border-stone-200/20 dark:border-stone-800/20">
          <Building size={16} className="text-accent" />
          Manage Business Branches
        </h3>

        {/* Add Branch Inline Form */}
        <form onSubmit={handleAddBranchSubmit} className="flex gap-2 mt-1">
          <input
            type="text"
            placeholder="e.g. Warehouse, Uptown Branch..."
            value={newBranchName}
            onChange={e => setNewBranchName(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-850 dark:text-stone-205 focus:outline-none focus:border-accent"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-xl hover:bg-opacity-95 shadow-sm shadow-accent/25 transition-all shrink-0"
          >
            Add Branch
          </button>
        </form>

        {branchError && (
          <span className="text-3xs text-red-500 font-semibold">{branchError}</span>
        )}

        {/* Branches list */}
        <div className="flex flex-col gap-2.5 mt-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
          {branches.map(b => {
            const isEditing = editingBranchId === b.id;
            return (
              <div 
                key={b.id} 
                className="p-3 bg-stone-50/55 dark:bg-darkCard/55 border border-stone-200/35 dark:border-stone-850/35 rounded-xl flex items-center justify-between gap-3 shadow-3xs"
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingBranchName}
                      onChange={e => setEditingBranchName(e.target.value)}
                      className="flex-1 px-3 py-1 text-xs border border-accent bg-transparent rounded-lg text-stone-800 dark:text-stone-200 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveBranchRename(b.id!)}
                      className="p-1 text-emerald-600 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingBranchId(null)}
                      className="p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-2">
                      <Building size={13} className="text-stone-400" />
                      {b.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartRename(b.id!, b.name)}
                        className="p-1.5 text-stone-450 hover:text-accent rounded-lg border border-transparent hover:border-stone-200/35 dark:hover:border-stone-800/35 hover:bg-white dark:hover:bg-stone-800"
                        title="Rename Branch"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteBranchClick(b.id!)}
                        className="p-1.5 text-stone-455 hover:text-red-500 rounded-lg border border-transparent hover:border-stone-200/35 dark:hover:border-stone-800/35 hover:bg-white dark:hover:bg-stone-800"
                        title="Delete Branch"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Backup Utilities Card */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-stone-200/40 dark:border-stone-850/40 flex flex-col gap-4">
        <h3 className="font-semibold text-sm text-stone-855 dark:text-stone-150 flex items-center gap-2 pb-3 border-b border-stone-200/20 dark:border-stone-800/20">
          <ShieldCheck size={16} className="text-accent" />
          Offline Database Backups
        </h3>

        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          Since this is an offline PWA, all database records are stored only in your browser storage. We recommend exporting periodic backups to protect against data clearing or device changes.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary dark:bg-accent text-white rounded-xl text-xs font-semibold hover:bg-opacity-95 transition-all shadow-sm"
          >
            <Download size={14} />
            Export Database Backup
          </button>
          
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-stone-250/50 dark:border-stone-800/60 rounded-xl text-xs font-semibold text-stone-750 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
          >
            <Upload size={14} />
            Import Database Backup
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFileChange}
            accept=".json"
            className="hidden"
          />
        </div>

        {importStatus && (
          <div
            className={`flex items-center gap-2.5 p-3 rounded-xl border text-3xs font-semibold ${
              importStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-400'
            }`}
          >
            {importStatus.type === 'success' ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
            <span>{importStatus.message}</span>
          </div>
        )}
      </div>

      {/* Export & Print Reports Card */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-stone-200/40 dark:border-stone-850/40">
        <h3 className="font-semibold text-sm text-stone-855 dark:text-stone-150 flex items-center gap-2 pb-3 border-b border-stone-200/20 dark:border-stone-800/20">
          <Download size={16} className="text-accent" />
          Export & Print Reports
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {/* CSV Export Box */}
          <div className="bg-stone-50/50 dark:bg-darkSecondary/20 p-4 rounded-xl border border-stone-200/20 dark:border-stone-800/10 flex flex-col gap-3">
            <span className="text-2xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              Export CSV Reports
            </span>
            <p className="text-3xs text-stone-500 dark:text-stone-400 leading-normal">
              Download your branch data directly as spreadsheet-compatible CSV files.
            </p>
            <div className="flex flex-col gap-2 mt-1">
              <button
                onClick={handleExportCashLogCSV}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-darkCard hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-3xs font-semibold border border-stone-200/50 dark:border-stone-800/60 text-stone-700 dark:text-stone-300 transition-colors"
              >
                <span>Cash Log Ledger</span>
                <Download size={12} className="text-stone-400" />
              </button>
              <button
                onClick={handleExportSalesCSV}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-darkCard hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-3xs font-semibold border border-stone-200/50 dark:border-stone-800/60 text-stone-700 dark:text-stone-300 transition-colors"
              >
                <span>Product Sales Ledger</span>
                <Download size={12} className="text-stone-400" />
              </button>
              <button
                onClick={handleExportDuesCSV}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-darkCard hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-3xs font-semibold border border-stone-200/50 dark:border-stone-800/60 text-stone-700 dark:text-stone-300 transition-colors"
              >
                <span>Customer Credit Dues</span>
                <Download size={12} className="text-stone-400" />
              </button>
            </div>
          </div>

          {/* Print PDF Box */}
          <div className="bg-stone-50/50 dark:bg-darkSecondary/20 p-4 rounded-xl border border-stone-200/20 dark:border-stone-800/10 flex flex-col gap-3">
            <span className="text-2xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              Print Ledger Reports
            </span>
            <p className="text-3xs text-stone-500 dark:text-stone-400 leading-normal">
              Generate print-ready layouts of your ledgers to save as PDF or print.
            </p>
            <div className="flex flex-col gap-2 mt-1">
              <button
                onClick={() => handlePrintReport('cash')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-darkCard hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-3xs font-semibold border border-stone-200/50 dark:border-stone-800/60 text-stone-700 dark:text-stone-300 transition-colors"
              >
                <span>Print Cash Ledger</span>
                <Printer size={12} className="text-stone-400" />
              </button>
              <button
                onClick={() => handlePrintReport('sales')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-darkCard hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-3xs font-semibold border border-stone-200/50 dark:border-stone-800/60 text-stone-700 dark:text-stone-300 transition-colors"
              >
                <span>Print Sales Ledger</span>
                <Printer size={12} className="text-stone-400" />
              </button>
              <button
                onClick={() => handlePrintReport('dues')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-darkCard hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-3xs font-semibold border border-stone-200/50 dark:border-stone-800/60 text-stone-700 dark:text-stone-300 transition-colors"
              >
                <span>Print Credit Dues</span>
                <Printer size={12} className="text-stone-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Profile & Account */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-stone-200/40 dark:border-stone-850/40 flex flex-col gap-4">
        <h3 className="font-semibold text-sm text-stone-855 dark:text-stone-150 flex items-center gap-2 pb-3 border-b border-stone-200/20 dark:border-stone-800/20">
          <ShieldCheck size={16} className="text-accent" />
          User Profile & Authentication
        </h3>

        {user && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-3">
              <img
                src={user.picture || ''}
                alt={user.name || 'User'}
                className="w-12 h-12 rounded-xl object-cover border border-stone-200/50 dark:border-stone-800/50"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-stone-850 dark:text-stone-100">
                  {user.name || 'Owner/Admin'}
                </span>
                <span className="text-3xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">
                  {user.email}
                </span>
                <span className="text-4xs text-[#B08A4A] font-bold tracking-wider uppercase mt-1">
                  Connected via Google OAuth 2.0
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to sign out? Your local business data will remain safely cached on this device.')) {
                  signOut();
                }
              }}
              className="px-4 py-2 border border-red-200 dark:border-red-950 bg-red-50/10 hover:bg-red-50/20 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400 text-xs font-bold rounded-xl transition-all"
            >
              Sign Out Account
            </button>
          </div>
        )}
      </div>

      {/* About App Info */}
      <div className="glass-card rounded-2xl p-5 shadow-sm border border-stone-200/40 dark:border-stone-850/40 flex items-start gap-4">
        <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-darkSecondary text-stone-550 dark:text-stone-400 flex items-center justify-center shrink-0">
          <Info size={16} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-bold text-stone-850 dark:text-stone-100">
            About Manager
          </h4>
          <p className="text-2xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Built using React, Vite, Tailwind CSS, and Dexie IndexedDB. Designed with a luxury minimal aesthetic, supporting modern high-end features including dynamic salary multipliers, real-time filters, CSV spreadsheet exporting, and installable service-workers for reliable offline access.
          </p>
        </div>
      </div>
    </div>
  );
}
