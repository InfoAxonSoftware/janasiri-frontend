import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { systemConfigApi } from '../services/api/systemConfigApi';

const FALLBACK_PRIMARY = '#4f46e5';
const FALLBACK_SECONDARY = '#0ea5e9';

function normalizeColor(input: string | null | undefined, fallback: string) {
  if (!input) return fallback;
  const trimmed = input.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : fallback;
}

export function useSystemBranding() {
  const query = useQuery({
    queryKey: ['system-config-branding'],
    queryFn: () => systemConfigApi.getConfig().then((r) => r.data.data || r.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const config = query.data;
    const root = document.documentElement;

    const primary = normalizeColor(config?.brandPrimaryColor, FALLBACK_PRIMARY);
    const secondary = normalizeColor(config?.brandSecondaryColor, FALLBACK_SECONDARY);

    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-secondary', secondary);
  }, [query.data]);

  const config = query.data
    ? {
        ...query.data,
        companyName: query.data.companyName || 'Janasiri',
        companyLogo: query.data.companyLogo || '/logo.png',
      }
    : {
        companyName: 'Janasiri',
        companyLogo: '/logo.png',
        brandPrimaryColor: FALLBACK_PRIMARY,
        brandSecondaryColor: FALLBACK_SECONDARY,
      };

  return {
    config,
    isLoading: query.isLoading,
  };
}
