import { useEffect } from 'react';

type AutoCollapseSidebarOptions = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  delayMs?: number;
  desktopMinWidth?: number;
};

export const SIDEBAR_AUTO_COLLAPSE_ENABLED_KEY = 'ui.sidebarAutoCollapseEnabled';
export const SIDEBAR_AUTO_COLLAPSE_DELAY_KEY = 'ui.sidebarAutoCollapseDelayMs';
export const DEFAULT_SIDEBAR_AUTO_COLLAPSE_ENABLED = true;
export const DEFAULT_SIDEBAR_AUTO_COLLAPSE_DELAY_MS = 60000;

function parseStoredNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function getSidebarAutoCollapseEnabled(defaultValue = DEFAULT_SIDEBAR_AUTO_COLLAPSE_ENABLED) {
  return defaultValue;
}

export function setSidebarAutoCollapseEnabled(value: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDEBAR_AUTO_COLLAPSE_ENABLED_KEY, String(value));
}

export function getSidebarAutoCollapseDelayMs(defaultValue = DEFAULT_SIDEBAR_AUTO_COLLAPSE_DELAY_MS) {
  return Math.min(Math.max(Math.round(defaultValue), 1000), 60000);
}

export function setSidebarAutoCollapseDelayMs(value: number) {
  if (typeof window === 'undefined') return;
  const bounded = Math.min(Math.max(Math.round(value), 1000), 60000);
  window.localStorage.setItem(SIDEBAR_AUTO_COLLAPSE_DELAY_KEY, String(bounded));
}

export function useAutoCollapseSidebar({
  sidebarOpen,
  setSidebarOpen,
  delayMs = DEFAULT_SIDEBAR_AUTO_COLLAPSE_DELAY_MS,
  desktopMinWidth = 1024,
}: AutoCollapseSidebarOptions) {
  useEffect(() => {
    if (!sidebarOpen) return;

    const autoCollapseEnabled = getSidebarAutoCollapseEnabled();
    if (!autoCollapseEnabled) return;

    const effectiveDelayMs = getSidebarAutoCollapseDelayMs(delayMs);

    const isDesktop = window.matchMedia(`(min-width: ${desktopMinWidth}px)`).matches;
    if (!isDesktop) return;

    const timeoutId = window.setTimeout(() => {
      setSidebarOpen(false);
    }, effectiveDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [sidebarOpen, setSidebarOpen, delayMs, desktopMinWidth]);
}
