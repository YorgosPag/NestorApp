'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function CrmTeamsPage() {
  const Teams = LazyRoutes.CrmTeams;
  return <Teams />;
}
