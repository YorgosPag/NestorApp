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

import { Loader2 } from 'lucide-react';

/**
 * Static Loading Component (Server Component)
 *
 * Uses only Tailwind classes - no hooks, no client-side code
 * This ensures maximum compatibility with Next.js App Router
 */
export default function Loading() {
  return (
    <main
      className="min-h-screen w-full flex items-center justify-center bg-background"
      role="main"
      aria-label="Φόρτωση σελίδας"
    >
      <section
        className="flex flex-col gap-4 text-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {/* Spinner - Using Lucide directly for server component compatibility */}
        <figure className="mx-auto">
          <Loader2
            className="h-8 w-8 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        </figure>

        {/* Loading text */}
        <p className="text-base text-muted-foreground">
          Φόρτωση...
        </p>
      </section>
    </main>
  );
}
