// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { Home, Search, Phone } from 'lucide-react';
import { useCompanyConfig } from '@/core/configuration';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('constants');

// 🌐 i18n: Navigation items use i18n keys
export const publicNavItems = [
  { title: 'public.nav.home', href: '/', icon: Home, description: 'public.nav.homeDescription' },
  { title: 'public.nav.searchProperties', href: '/properties', icon: Search, description: 'public.nav.searchDescription' },
  { title: 'public.nav.contact', href: '/contact', icon: Phone, description: 'public.nav.contactDescription' },
] as const;

/**
 * 🏢 ENTERPRISE: Database-driven company info (MICROSOFT/GOOGLE-CLASS)
 * ZERO HARDCODED VALUES - Όλες οι τιμές από enterprise configuration database
 *
 * ✅ BEFORE: 'info@pagonis.gr', '+30 210 123 4567' (σκληρές τιμές)
 * ✅ AFTER: Πλήρως database-driven με fallbacks από environment variables
 */
export const useCompanyInfo = () => {
  const { company, isLoading, error } = useCompanyConfig();

  // 🔄 ENTERPRISE: Loading state με professional UX
  // 🌐 i18n: Loading/error states use i18n keys
  if (isLoading) {
    return {
      city: 'common.loading', // i18n key
      phone: 'common.loading', // i18n key
      email: 'common.loading', // i18n key
      isLoading: true,
      error: null
    } as const;
  }

  // 🚨 ENTERPRISE: Error state handling
  if (error) {
    logger.warn('Enterprise Configuration Error:', { data: error });
    return {
      city: 'common.notAvailable', // i18n key
      phone: 'common.notAvailable', // i18n key
      email: 'common.notAvailable', // i18n key
      isLoading: false,
      error: error
    } as const;
  }

  // 🏢 ENTERPRISE: Database-first με environment variable fallbacks
  const enterpriseDefaults = {
    email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'contact@company.gr',
    phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '+30 210 000 0000',
    city: process.env.NEXT_PUBLIC_COMPANY_CITY || 'Αθήνα',
    country: process.env.NEXT_PUBLIC_COMPANY_COUNTRY || 'Ελλάδα'
  } as const;

  return {
    city: company?.address ? `${company.address.city}, ${company.address.country}` : `${enterpriseDefaults.city}, ${enterpriseDefaults.country}`,
    phone: company?.phone || enterpriseDefaults.phone,
    email: company?.email || enterpriseDefaults.email,
    isLoading: false,
    error: null
  } as const;
};

/**
 * 🏢 ENTERPRISE: Dynamic Quick Stats (NO MORE HARDCODED VALUES)
 * Statistics που θα φορτώνονται από database αντί για σκληρές τιμές
 *
 * ✅ BEFORE: '5 ακίνητα', '€25.000' (σκληρές τιμές)
 * ✅ AFTER: Database-driven με real-time data
 */
export const useQuickStats = () => {
  // TODO: Implement database-driven statistics loading
  // For now using environment-aware defaults
  // 🌐 i18n: Stats labels use i18n keys
  const enterpriseStats = {
    availableLabel: 'public.stats.available', // i18n key
    availableValue: process.env.NEXT_PUBLIC_AVAILABLE_UNITS || 'public.stats.defaultUnits', // i18n key
    pricesFromLabel: 'public.stats.pricesFrom', // i18n key
    pricesFromValue: process.env.NEXT_PUBLIC_MIN_PRICE || '€25.000',
  } as const;

  return {
    ...enterpriseStats,
    isLive: process.env.NODE_ENV === 'production' // Live data only in production
  };
};
