/**
 * @fileoverview Single source of truth for communication-type icons.
 *
 * Extracted from inline `Globe`/`User`/`Briefcase` imports in
 * `CommunicationConfigs.ts` so that every communication subsystem
 * (form renderers, empty states, cards, audit displays) resolves icons
 * from one registry. Previously `website` and `social` both used `Globe`,
 * making them visually indistinguishable in the empty-state UI.
 *
 * Consumers should import `COMMUNICATION_ICONS[type]` rather than importing
 * Lucide icons directly — that way swapping an icon is a one-line change.
 *
 * @enterprise SSoT (ADR-294) — communication subsystem module
 */

import {
  Briefcase,
  Globe,
  Mail,
  MapPin,
  Phone,
  Share2,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { CommunicationType } from '../types/CommunicationTypes';

/**
 * Canonical icon per communication type.
 *
 * - `phone` → Phone (handset)
 * - `email` → Mail (envelope)
 * - `website` → Globe
 * - `social` → Share2 (distinct from website to avoid visual collision)
 * - `identity` → User (ID card surrogate)
 * - `professional` → Briefcase
 * - `address` → MapPin
 */
export const COMMUNICATION_ICONS: Record<CommunicationType, LucideIcon> = {
  phone: Phone,
  email: Mail,
  website: Globe,
  social: Share2,
  identity: User,
  professional: Briefcase,
  address: MapPin,
} as const;

/**
 * Tailwind color class per communication type — used by empty-state icons so
 * they stand out instead of blending into the muted foreground. All classes
 * have a dark-mode variant so contrast survives theme changes.
 */
export const COMMUNICATION_ICON_COLORS: Record<CommunicationType, string> = {
  phone: 'text-sky-600 dark:text-sky-400',
  email: 'text-rose-600 dark:text-rose-400',
  website: 'text-indigo-600 dark:text-indigo-400',
  social: 'text-violet-600 dark:text-violet-400',
  identity: 'text-amber-600 dark:text-amber-400',
  professional: 'text-emerald-600 dark:text-emerald-400',
  address: 'text-red-600 dark:text-red-400',
} as const;
