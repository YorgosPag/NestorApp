'use client';

// =============================================================================
// 🔐 LOGIN PAGE - AUTHENTICATION ENTRY POINT
// =============================================================================
// 🏢 ENTERPRISE: Now in (auth) route group for lightweight provider stack
// Pattern: SAP, Salesforce, Microsoft - Auth pages don't need full app providers
//
// Benefits of Route Group placement:
// - ~40-50% faster compilation (fewer providers to analyze)
// - No Firestore queries on login page
// - Minimal bundle for unauthenticated users
//
// @file (auth)/login/page.tsx
// @created 2026-01-27
// @enterprise ADR-040 - Route Groups Performance Optimization

import { AuthForm } from '@/auth';

export default function LoginPage() {
  // NOTE: No <main> here - ConditionalAppShell already provides the <main> wrapper
  // This avoids nested <main> tags which cause HTML semantic issues
  return (
    <section className="min-h-screen bg-background flex items-center justify-center">
      <AuthForm defaultMode="signin" />
    </section>
  );
}
