export {};

declare global {
  interface Window {
    /** Toast helper you already call around the app */
    showNotification?: (message: string, type?: 'success' | 'error' | 'info') => void;
    /** Simple loading state toggler used by some buttons */
    setLoading?: (element: HTMLElement, isLoading: boolean) => void;
    /** Emitted by cart mutations; listened by CartBadge */
    triggerCartUpdate?: () => void;
  }
}
