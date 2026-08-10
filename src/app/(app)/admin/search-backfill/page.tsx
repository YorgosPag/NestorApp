'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function SearchBackfillPage() {
  const SearchBackfill = LazyRoutes.AdminSearchBackfill;
  return <SearchBackfill />;
}
