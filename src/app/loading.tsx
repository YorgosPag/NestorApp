/**
 * =============================================================================
 * ENTERPRISE LOADING STATE - APP ROUTER PAGE TRANSITIONS (SERVER COMPONENT)
 * =============================================================================
 *
 * Next.js App Router shows this during:
 * - Server-side page loads
 * - Link navigation (not router.push!)
 * - Initial route rendering
 *
 * IMPORTANT: This must be a Server Component (no 'use client')
 * For client-side router.push() transitions, use component-level loading states.
 *
 * Enterprise Pattern: SAP, Salesforce use static loading screens
 *
 * @module app/loading
 * @version 2.0.0
 * @enterprise ADR-021 - Centralized Loading States
 */

import { StaticPageLoading } from '@/core/states';

/**
 * Static Loading Component (Server Component)
 *
 * Uses only Tailwind classes - no hooks, no client-side code
 * This ensures maximum compatibility with Next.js App Router
 */
export default function Loading() {
  return <StaticPageLoading />;
}
