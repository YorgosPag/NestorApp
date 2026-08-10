'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function ProfilePage() {
  const Profile = LazyRoutes.AccountProfile;
  return <Profile />;
}
