'use client';

/**
 * @module /spaces/common
 * @enterprise Common Spaces Dashboard
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SpacesCommon = LazyRoutes.SpacesCommon;

export default function CommonSpacesPage() {
  return <SpacesCommon />;
}
