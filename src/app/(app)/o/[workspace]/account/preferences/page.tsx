'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function PreferencesPage() {
  const Preferences = LazyRoutes.AccountPreferences;
  return <Preferences />;
}
