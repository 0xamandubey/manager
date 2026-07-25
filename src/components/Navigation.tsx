import { LayoutDashboard, Calendar, Users, Wallet, Coins, Settings, TrendingUp, X, StickyNote, Receipt, LineChart, HeartHandshake, Calculator } from 'lucide-react';

interface NavigationProps {
  currentView: string;
  setView: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Navigation({ currentView, setView, isOpen, onClose }: NavigationProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'cash', label: 'Cash Log', icon: Wallet },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'profit', label: 'Profit', icon: LineChart },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'customers', label: 'Customers', icon: HeartHandshake },
    { id: 'payments', label: 'Payments', icon: Coins },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'cft', label: 'CFT Calculator', icon: Calculator },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 bg-stone-50 dark:bg-darkCard border-r border-stone-200/50 dark:border-stone-850/50 h-screen sticky top-0 py-6 px-4 shrink-0 justify-between">
        <div className="flex flex-col gap-6">
          <div className="px-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary dark:bg-accent flex items-center justify-center text-white font-bold text-base">
              M
            </div>
            <span className="font-semibold text-sm tracking-wide text-stone-855 dark:text-stone-100">
              Manager
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary dark:bg-accent text-white shadow-sm shadow-primary/20 dark:shadow-accent/20'
                      : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-105 hover:bg-stone-200/40 dark:hover:bg-stone-800/40'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-stone-400 dark:text-stone-500'} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Spacer */}
      </aside>

      {/* Mobile Sidebar Hamburger Drawer */}
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <div
            onClick={onClose}
            className="md:hidden fixed inset-0 bg-black/45 backdrop-blur-3xs z-[999] animate-fade-in"
          />

          {/* Drawer Panel */}
          <aside className="md:hidden fixed top-0 left-0 bottom-0 w-64 bg-stone-50 dark:bg-darkCard border-r border-stone-200/50 dark:border-stone-850/50 z-[1000] pt-safe pb-safe py-6 px-4 flex flex-col gap-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between px-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary dark:bg-accent flex items-center justify-center text-white font-bold text-base">
                  M
                </div>
                <span className="font-semibold text-sm tracking-wide text-stone-855 dark:text-stone-100">
                  Manager
                </span>
              </div>
              
              <button
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-250/50 dark:hover:bg-stone-800/50 transition-colors shrink-0"
                title="Close Menu"
                aria-label="Close Menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      onClose();
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary dark:bg-accent text-white shadow-sm shadow-primary/20 dark:shadow-accent/20'
                        : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-105 hover:bg-stone-200/40 dark:hover:bg-stone-800/40'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-white' : 'text-stone-400 dark:text-stone-500'} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
