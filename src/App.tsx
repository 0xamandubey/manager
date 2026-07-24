import { useState } from 'react';
import { useAttendanceData } from './hooks/useAttendanceData';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DashboardView } from './views/DashboardView';
import { AttendanceView } from './views/AttendanceView';
import { StaffView } from './views/StaffView';
import { CashLogView } from './views/CashLogView';
import { PaymentsView } from './views/PaymentsView';
import { SalesView } from './views/SalesView';
import { SettingsView } from './views/SettingsView';
import { NotesView } from './views/NotesView';
import { ExpensesView } from './views/ExpensesView';
import { ProfitView } from './views/ProfitView';
import { CustomersView } from './views/CustomersView';
import { CFTCalculatorView } from './views/CFTCalculatorView';

function App() {
  const [currentView, setView] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const {
    activeStaff,
    archivedStaff,
    isLoading,
    cashTransactions,
    customCategories,
    customerDues,
    sales,
    branches,
    activeBranchId,
    changeActiveBranch,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCustomCategory,
    addDue,
    receiveDue,
    updateDue,
    deleteDue,
    addSale,
    updateSale,
    deleteSale,
    addBranch,
    renameBranch,
    deleteBranch,
    settings,
    getAttendanceForDate,
    saveAttendanceForDate,
    addStaff,
    updateStaff,
    updateSettings,
    getSalaryReport,
    importBackup,
    exportBackup,
    vendors,
    productionEntries,
    addVendor,
    updateVendor,
    deleteVendor,
    addProductionEntry,
    updateProductionEntry,
    deleteProductionEntry,
    payVendorDues,
    notes,
    addNote,
    updateNote,
    deleteNote,
    expenseGroups,
    addExpenseGroup,
    updateExpenseGroup,
    deleteExpenseGroup,
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    customerOrders,
    addCustomerOrder,
    updateCustomerOrder,
    deleteCustomerOrder,
    cftCalculations,
    addCftCalculation,
    deleteCftCalculation,
    clearCftCalculations,
  } = useAttendanceData();

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            activeStaff={activeStaff}
            settings={settings}
            setView={setView}
            getAttendanceForDate={getAttendanceForDate}
            currentBranchId={activeBranchId}
          />
        );
      case 'attendance':
        return (
          <AttendanceView
            activeStaff={activeStaff}
            settings={settings}
            isLoading={isLoading}
            getAttendanceForDate={getAttendanceForDate}
            saveAttendanceForDate={saveAttendanceForDate}
            getSalaryReport={getSalaryReport}
            addTransaction={addTransaction}
          />
        );
      case 'staff':
        return (
          <StaffView
            activeStaff={activeStaff}
            archivedStaff={archivedStaff}
            settings={settings}
            isLoading={isLoading}
            addStaff={addStaff}
            updateStaff={updateStaff}
            vendors={vendors}
            productionEntries={productionEntries}
            addVendor={addVendor}
            updateVendor={updateVendor}
            deleteVendor={deleteVendor}
            addProductionEntry={addProductionEntry}
            updateProductionEntry={updateProductionEntry}
            deleteProductionEntry={deleteProductionEntry}
            payVendorDues={payVendorDues}
          />
        );
      case 'cash':
        return (
          <CashLogView
            activeStaff={activeStaff}
            settings={settings}
            cashTransactions={cashTransactions}
            customCategories={customCategories}
            expenseGroups={expenseGroups}
            addTransaction={addTransaction}
            updateTransaction={updateTransaction}
            deleteTransaction={deleteTransaction}
            addCustomCategory={addCustomCategory}
          />
        );
      case 'expenses':
        return (
          <ExpensesView
            settings={settings}
            cashTransactions={cashTransactions}
            expenseGroups={expenseGroups}
            addExpenseGroup={addExpenseGroup}
            updateExpenseGroup={updateExpenseGroup}
            deleteExpenseGroup={deleteExpenseGroup}
            addTransaction={addTransaction}
            updateTransaction={updateTransaction}
            deleteTransaction={deleteTransaction}
          />
        );
      case 'profit':
        return (
          <ProfitView
            settings={settings}
            sales={sales}
            cashTransactions={cashTransactions}
            expenseGroups={expenseGroups}
          />
        );
      case 'customers':
        return (
          <CustomersView
            settings={settings}
            customers={customers}
            addCustomer={addCustomer}
            updateCustomer={updateCustomer}
            deleteCustomer={deleteCustomer}
            customerOrders={customerOrders}
            addCustomerOrder={addCustomerOrder}
            updateCustomerOrder={updateCustomerOrder}
            deleteCustomerOrder={deleteCustomerOrder}
            addTransaction={addTransaction}
          />
        );
      case 'cft':
        return (
          <CFTCalculatorView
            cftCalculations={cftCalculations}
            addCftCalculation={addCftCalculation}
            deleteCftCalculation={deleteCftCalculation}
            clearCftCalculations={clearCftCalculations}
          />
        );
      case 'payments':
        return (
          <PaymentsView
            settings={settings}
            customerDues={customerDues}
            addDue={addDue}
            receiveDue={receiveDue}
            updateDue={updateDue}
            deleteDue={deleteDue}
          />
        );
      case 'sales':
        return (
          <SalesView
            settings={settings}
            sales={sales}
            addSale={addSale}
            updateSale={updateSale}
            deleteSale={deleteSale}
          />
        );
      case 'notes':
        return (
          <NotesView
            notes={notes}
            addNote={addNote}
            updateNote={updateNote}
            deleteNote={deleteNote}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            updateSettings={updateSettings}
            exportBackup={exportBackup}
            importBackup={importBackup}
            branches={branches}
            addBranch={addBranch}
            renameBranch={renameBranch}
            deleteBranch={deleteBranch}
            activeBranchId={activeBranchId}
          />
        );
      default:
        return (
          <div className="p-8 text-center text-xs text-stone-500">
            View not found.
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background dark:bg-darkBg transition-colors duration-200">
      {/* Navigation (Sidebar on Desktop, Hamburger Drawer on Mobile) */}
      <Navigation 
        currentView={currentView} 
        setView={setView} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden pb-4 md:pb-0">
        {/* Top Header */}
        <Header
          settings={settings}
          currentView={currentView}
          branches={branches}
          currentBranchId={activeBranchId}
          setCurrentBranchId={changeActiveBranch}
          onMenuToggle={() => setIsMobileMenuOpen(true)}
        />

        {/* View Component container */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}

export default App;
