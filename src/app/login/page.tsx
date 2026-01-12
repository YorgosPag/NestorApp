'use client';

// =============================================================================
// 🔐 LOGIN PAGE - AUTHENTICATION ENTRY POINT
// =============================================================================
// 🏢 ENTERPRISE: Standalone layout handled by ConditionalAppShell (ADR-020.1)
// This page renders ONLY the AuthForm - centering is handled by the shell

import { AuthForm } from '@/auth';

export default function LoginPage() {
  return <AuthForm defaultMode="signin" />;
}
