'use client';

import React from 'react';
import { LazyRoutes } from '@/utils/lazyRoutes';

export default function MainPage() {
  const Landing = LazyRoutes.Landing;
  return <Landing />;
}