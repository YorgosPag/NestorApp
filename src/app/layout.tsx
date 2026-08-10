import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, UserRoleProvider } from "@/auth";
import { cn } from "@/lib/utils";
import { I18nProvider } from '@/components/providers/I18nProvider';
import { TourProvider, TourRenderer } from '@/components/ui/ProductTour';
import { SuperAdminCompanyProvider } from '@/contexts/SuperAdminCompanyContext';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Root Layout - Minimal Provider Stack
 * =============================================================================
 *
 * Pattern: SAP, Salesforce, Microsoft Azure Portal, Google Cloud Console
 *
 * ESSENTIAL PROVIDERS ONLY (always needed):
 * - ThemeProvider: Dark/light mode
 * - I18nProvider: Translations
 * - TourProvider: Product tours (needed by ErrorBoundary)
 * - AuthProvider: Firebase authentication
 * - UserRoleProvider: Role-based access
 *
 * 🔑 ΤΑ ΒΑΡΙΑ PROVIDERS ΖΟΥΝ ΣΤΟ `(app)/layout.tsx` — ADR-777 §8.12.
 * WorkspaceProvider · FloorplanProvider · NotificationProvider · CacheProvider ·
 * WebSocketProvider · SharedPropertiesProvider · NavigationProvider ·
 * PhotoPreviewProvider · BuildingsNoUnitsProvider · ActiveJobProvider.
 *
 * Το «ποιος τα παίρνει» **δεν το αποφασίζει πλέον λίστα διαδρομών** αλλά η ιεραρχία
 * φακέλων του Next.js. Ο `ConditionalAppShell` που το έκρινε από `pathname` ήταν
 * **δομικά τυφλός** στα route groups (ένα group είναι ΦΑΚΕΛΟΣ, δεν εμφανίζεται ποτέ
 * στο `pathname`) και διαγράφηκε μαζί με τις τρεις λίστες του.
 *
 * ⚠️ Ό,τι μένει εδώ το φοράει **ΚΑΘΕ** διαδρομή, δημόσια ή όχι — γι' αυτό μένουν μόνο
 * όσα δεν έχουν νόημα να λείπουν: θέμα, μεταφράσεις, ταυτότητα, ρόλος, tours.
 *
 * @file layout.tsx
 * @updated 2026-08-10 - ADR-777 §8.12 μετακόμιση κελύφους σε route group
 */


const roboto = Roboto({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Nestor App",
  description: "Nestor — Enterprise Construction & Property Management Platform",
  icons: {
    icon: '/images/nestor-app-logo.png',
    apple: '/images/nestor-app-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el" className="overflow-x-hidden" suppressHydrationWarning>
      <head>
        <Script src="/react-bugfix-guards.js" strategy="beforeInteractive" />
      </head>
      <body className={cn("font-sans overflow-x-hidden", roboto.variable)}>
        {/* 🏢 ENTERPRISE: Minimal provider stack - essential providers only */}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          storageKey="theme-preference"
        >
          <I18nProvider>
            {/* 🏢 ENTERPRISE: TourProvider needed by ErrorBoundary's useTour() */}
            <TourProvider>
              <AuthProvider>
                <SuperAdminCompanyProvider>
                <UserRoleProvider>
                  {/* 🔑 ΚΑΝΕΝΑ ΚΕΛΥΦΟΣ ΕΔΩ. Το layout του route group αποφασίζει
                      (ADR-777 §8.12): `(app)` φοράει · `(auth)`/`(light)`/`(bare)` όχι. */}
                  {children}
                </UserRoleProvider>
                </SuperAdminCompanyProvider>
              </AuthProvider>
              {/* 🏢 ENTERPRISE: TourRenderer needs TourProvider, stays at root */}
              <TourRenderer />
            </TourProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
