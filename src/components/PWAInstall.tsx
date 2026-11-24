import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let swRegistered = false;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isHttp =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:');

    if (!swRegistered && isHttp) {
      swRegistered = true;
      try {
        registerSW({ immediate: true });
      } catch {
        // ignore SW registration failure in unsupported iframes
      }
    }

    const isStandalone =
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return { isInstallable: !!deferredPrompt, isInstalled, isIOS, install };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled || (typeof window !== 'undefined' && window.location.protocol === 'file:')) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Утас болон компьютерт апп болгон суулгах"
        className="h-8 px-2.5 rounded-lg border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Апп суулгах</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        title="Утасны дэлгэц дээр апп болгож нэмэх"
        className="h-8 px-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-emerald-500 text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1 whitespace-nowrap shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
        <span className="hidden lg:inline">Апп</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#131b18] p-5 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              PanelFlow-г утсан дээрээ Апп болгох
            </h3>
            {isIOS ? (
              <ol className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 list-decimal pl-4">
                <li>Safari-ийн доод цэснээс <b>Share (Хуваалцах)</b> товчийг дарна уу.</li>
                <li>Доош гүйлгээд <b>Add to Home Screen</b> сонголтыг дарна уу.</li>
                <li><b>Add</b> дарахад бүрэн дэлгэцийн апп шиг сууна.</li>
              </ol>
            ) : (
              <ol className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 list-decimal pl-4">
                <li>Хөтөчийн баруун дээд цэсийг (<b>⋮</b>) нээнэ үү.</li>
                <li><b>Install app</b> эсвэл <b>Add to Home screen</b> дээр дарна уу.</li>
                <li>Суулгасны дараа офлайн үед ч зураг, текст засах боломжтой.</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              Ойлголоо
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/95 px-3 py-1 text-[11px] font-medium text-amber-200 shadow-lg pointer-events-none">
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      Офлайн горим — Төсөл таны төхөөрөмжид хадгалагдана
    </div>
  );
};
