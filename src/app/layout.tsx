import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, UserRoleProvider } from "@/auth";
import { cn } from "@/lib/utils";
import { I18nProvider } from '@/components/providers/I18nProvider';
import { TourProvider, TourRenderer } from '@/components/ui/ProductTour';
import { ConditionalAppShell } from './components/ConditionalAppShell';

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
 * HEAVY PROVIDERS MOVED TO ConditionalAppShell (only for app routes):
 * - WorkspaceProvider: Firestore queries
 * - FloorplanProvider: Complex state
 * - NotificationProvider: Real-time subscriptions
 * - SharedPropertiesProvider: Data caching
 *
 * This architecture ensures auth routes (/login) have minimal bundle size
 * and don't trigger unnecessary Firestore queries.
 *
 * @file layout.tsx
 * @updated 2026-01-27 - ADR-040 Provider Separation
 */


const roboto = Roboto({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Pagonis",
  description: "Μια εφαρμογή για να αποτυπώσετε τις σκέψεις σας, ενισχυμένες με AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el" className="overflow-x-hidden" suppressHydrationWarning>
      <head>
        <Script src="/suppress-console.js" strategy="beforeInteractive" />
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
                <UserRoleProvider>
                  {/* 🏢 ENTERPRISE: ConditionalAppShell handles:
                      - Route-based layout (auth vs app)
                      - Heavy providers (Workspace, Floorplan, Notification, SharedProperties)
                      - Global components (NotificationDrawer, ToasterClient, GlobalErrorSetup) */}
                  <ConditionalAppShell>
                    {children}
                  </ConditionalAppShell>
                </UserRoleProvider>
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
