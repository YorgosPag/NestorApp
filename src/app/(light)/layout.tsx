import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationDrawer } from "@/components/NotificationDrawer.enterprise";
import { ToasterClient } from "@/components/ToasterClient";
import { NotificationProvider } from "../../providers/NotificationProvider";
import { FirebaseAuthProvider } from "@/contexts/FirebaseAuthContext";
import { UserRoleProvider } from "@/contexts/UserRoleContext";
import { cn } from "@/lib/utils";
import { I18nProvider } from '@/components/providers/I18nProvider';
import { PhotoPreviewProvider } from '@/providers/PhotoPreviewProvider';
import { GlobalErrorSetup } from '@/components/GlobalErrorSetup';

const roboto = Roboto({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Pagonis - Light Layout",
  description: "Minimal layout για light pages χωρίς navigation.",
};

export default function LightLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el" className="overflow-x-hidden" suppressHydrationWarning>
      <head>
        {/* 🎯 ENTERPRISE: Same console suppression as main layout */}
        <script src="/suppress-console.js" async />
      </head>
      <body className={cn("font-sans overflow-x-hidden", roboto.variable)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
          storageKey="theme-preference"
        >
          <I18nProvider>
            <FirebaseAuthProvider>
              <UserRoleProvider>
                {/* 🏢 ENTERPRISE: Minimal providers - NO NavigationProvider, NO SharedPropertiesProvider */}
                <NotificationProvider>
                  <PhotoPreviewProvider>
                    {/* 🎯 LIGHT LAYOUT: Simple container without sidebar/navigation */}
                    <div className="min-h-screen w-full bg-background">
                      <main className="w-full max-w-full">
                        {children}
                      </main>
                    </div>
                  </PhotoPreviewProvider>

                  {/* ✅ Essential enterprise components */}
                  <NotificationDrawer />
                  <ToasterClient />
                  <GlobalErrorSetup />
                </NotificationProvider>
              </UserRoleProvider>
            </FirebaseAuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}