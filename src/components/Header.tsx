import { useEffect, useState } from 'react';
import { Download, Building, Menu } from 'lucide-react';
import type { Settings, Branch } from '../db/db';

interface HeaderProps {
  settings: Settings;
  currentView: string;
  branches: Branch[];
  currentBranchId: string;
  setCurrentBranchId: (id: string) => void;
  onMenuToggle: () => void;
}

export function Header({ 
  settings, 
  currentView,
  branches,
  currentBranchId,
  setCurrentBranchId,
  onMenuToggle
}: HeaderProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Listen for PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  // Sync theme changes with body class
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const body = window.document.body;
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const activeTheme = settings.theme === 'system' ? systemTheme : settings.theme;

      if (activeTheme === 'dark') {
        root.classList.add('dark');
        body.classList.add('dark');
      } else {
        root.classList.remove('dark');
        body.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen to system changes if theme is system
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, [settings.theme]);

  // Format view name for display
  const viewTitle = currentView === 'cash' ? 'Cash Log' : currentView.charAt(0).toUpperCase() + currentView.slice(1);

  return (
    <header className="glass sticky top-0 z-40 w-full border-b border-stone-200/50 dark:border-stone-800/50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Hamburger Menu button (Mobile Only) */}
        <button
          onClick={onMenuToggle}
          className="md:hidden w-12 h-12 flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
          title="Open Menu"
          aria-label="Open Menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight text-primary dark:text-accent">
            {settings.businessName}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {viewTitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* PWA Install Button */}
        {deferredPrompt && !isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-white hover:bg-opacity-95 transition-all shadow-sm shadow-accent/25"
          >
            <Download size={13} />
            Install App
          </button>
        )}

        {/* Global Branch Selector Dropdown */}
        {branches.length > 0 && (
          <div className="relative flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-darkSecondary rounded-xl border border-stone-200/40 dark:border-stone-800/40 text-3xs font-semibold">
            <Building size={12} className="text-stone-400" />
            <select
              value={currentBranchId}
              onChange={e => setCurrentBranchId(e.target.value)}
              className="bg-transparent border-none outline-none text-stone-850 dark:text-stone-200 font-bold cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </header>
  );
}
