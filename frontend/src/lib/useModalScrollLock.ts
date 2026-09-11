import { useEffect } from 'react';

interface UseModalScrollLockOptions {
  isOpen: boolean;
  onClose?: () => void;
}

/**
 * Universal scroll lock & modal escape/back button handler.
 * Locks both `document.body` and `<main>` scrolling containers
 * to eliminate mobile dual-scrolling, and binds Android back button & Escape key.
 */
export function useModalScrollLock({ isOpen, onClose }: UseModalScrollLockOptions) {
  useEffect(() => {
    if (!isOpen) return;

    const mainEl = document.querySelector('main');
    const originalMainOverflow = mainEl ? mainEl.style.overflow : '';
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    if (mainEl) {
      mainEl.style.overflow = 'hidden';
    }
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Android hardware back button (Capacitor / Cordova WebView)
    const handleBackButton = (e: Event) => {
      e.preventDefault();
      if (onClose) {
        onClose();
      }
    };

    // Keyboard ESC key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    document.addEventListener('backbutton', handleBackButton);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (mainEl) {
        mainEl.style.overflow = originalMainOverflow;
      }
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.removeEventListener('backbutton', handleBackButton);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
}
