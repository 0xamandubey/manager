import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAlreadyStandalone, setIsAlreadyStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (already installed)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as any).standalone === true;
    
    setIsAlreadyStandalone(isStandalone);
    if (isStandalone) return;

    // 2. Check if user dismissed prompt recently
    const dismissedTime = localStorage.getItem('pwa_prompt_dismissed_at');
    if (dismissedTime) {
      const parsedTime = parseInt(dismissedTime, 10);
      const isWithin14Days = Date.now() - parsedTime < 14 * 24 * 60 * 60 * 1000;
      if (isWithin14Days) return;
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDetect = /iphone|ipad|ipod/.test(userAgent);
    const safariDetect = iosDetect && !/crios|fxios|opios|twitter|fbios/.test(userAgent) && /safari/.test(userAgent);
    
    setIsIOS(iosDetect);

    // 4. If iOS/Safari, we show custom instructions since beforeinstallprompt isn't supported
    if (iosDetect && safariDetect) {
      // Delay prompt slightly so it's not intrusive immediately
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    }

    // 5. For Chrome / Chromium browsers, listen to beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's default prompt
      e.preventDefault();
      // Store the event so we can trigger it later
      setDeferredPrompt(e);
      // Show the install banner
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the native browser install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // We no longer need the saved event
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    // Cache the dismissal time to avoid prompting again for 14 days
    localStorage.setItem('pwa_prompt_dismissed_at', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt || isAlreadyStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] z-[9999] animate-scale-up">
      <div className="glass-card bg-white/80 dark:bg-[#1C1A19]/80 backdrop-blur-md border border-stone-200/50 dark:border-stone-850/50 shadow-2xl rounded-2xl p-5 relative flex flex-col gap-3">
        {/* Top colored accent indicator */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#B08A4A]/20 via-[#B08A4A]/60 to-[#B08A4A]/20 rounded-t-2xl" />

        {/* Header section with Close Button */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary dark:bg-accent flex items-center justify-center text-white shadow-sm shrink-0">
              <Download size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xs font-bold text-stone-850 dark:text-stone-100 tracking-tight">
                Install Manager App
              </span>
              <span className="text-5xs text-stone-500 dark:text-stone-400 font-medium">
                Add to home screen for offline access
              </span>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer"
            aria-label="Dismiss install prompt"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Section */}
        <div className="text-4xs text-stone-600 dark:text-stone-350 leading-relaxed font-medium">
          {isIOS ? (
            <div className="flex flex-col gap-2">
              <p>Install this app on your iPhone or iPad for quick access and full offline capabilities.</p>
              <div className="p-2 bg-stone-100/50 dark:bg-stone-900/50 border border-stone-200/30 dark:border-stone-850/30 rounded-xl flex items-center gap-2 font-semibold">
                <Share size={12} className="text-[#B08A4A] shrink-0" />
                <span>Tap the share button and select <strong className="text-stone-850 dark:text-stone-100">"Add to Home Screen"</strong>.</span>
              </div>
            </div>
          ) : (
            <p>Access the manager directly from your home screen, save data offline, and enjoy a faster app experience.</p>
          )}
        </div>

        {/* Action Buttons (Chrome/Android/Desktop only) */}
        {!isIOS && (
          <div className="flex items-center justify-end gap-2 mt-1">
            <button 
              onClick={handleDismiss}
              className="px-3 py-1.5 border border-stone-200/60 dark:border-stone-800/60 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-3xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Later
            </button>
            <button 
              onClick={handleInstallClick}
              className="px-4 py-1.5 bg-primary hover:bg-[#2A1D14] dark:bg-accent dark:hover:bg-[#9B773E] text-white text-3xs font-bold rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              Install App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
