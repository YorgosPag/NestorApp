"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, Building2, Landmark } from "lucide-react";
import { useTranslation } from "@/i18n";

export function QuickActions() {
  const { t } = useTranslation('dashboard');
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('quickActions.title')}</CardTitle>
        <CardDescription>
          {t('quickActions.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/contacts/new/individual">
            <Card className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg group">
              <CardContent className="p-6 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold">{t('quickActions.individual.title')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('quickActions.individual.description')}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/contacts/new/company">
            <Card className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg group">
              <CardContent className="p-6 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-3 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold">{t('quickActions.company.title')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('quickActions.company.description')}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/contacts/new/service">
            <Card className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg group">
              <CardContent className="p-6 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <Landmark className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold">{t('quickActions.service.title')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('quickActions.service.description')}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
