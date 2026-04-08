'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function PrivacyPage() {
  const Privacy = LazyRoutes.AccountPrivacy;
  return <Privacy />;
}
