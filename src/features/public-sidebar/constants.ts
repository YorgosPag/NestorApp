'use client';

import { Home, Search, Phone } from 'lucide-react';

export const publicNavItems = [
  { title: 'Αρχική', href: '/', icon: Home, description: 'Επιστροφή στην αρχική σελίδα' },
  { title: 'Αναζήτηση Ακινήτων', href: '/properties', icon: Search, description: 'Βρείτε διαθέσιμα ακίνητα' },
  { title: 'Επικοινωνία', href: '/contact', icon: Phone, description: 'Στοιχεία επικοινωνίας' },
] as const;

export const companyInfo = {
  city: 'Θεσσαλονίκη, Ελλάδα',
  phone: '+30 210 123 4567',
  email: 'info@pagonis.gr',
} as const;

export const quickStats = {
  availableLabel: 'Διαθέσιμα',
  availableValue: '5 ακίνητα',
  pricesFromLabel: 'Τιμές από',
  pricesFromValue: '€25.000',
} as const;
