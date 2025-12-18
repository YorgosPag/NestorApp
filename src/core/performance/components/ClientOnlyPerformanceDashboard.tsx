"use client";

import { useEffect, useState } from 'react';
import { GlobalPerformanceDashboard } from './GlobalPerformanceDashboard';
import type { GlobalPerformanceDashboardProps } from './GlobalPerformanceDashboard';

/**
 * Client-only wrapper για το GlobalPerformanceDashboard
 * Αποφεύγει hydration mismatches
 */
export const ClientOnlyPerformanceDashboard: React.FC<GlobalPerformanceDashboardProps> = (props) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <GlobalPerformanceDashboard {...props} />;
};