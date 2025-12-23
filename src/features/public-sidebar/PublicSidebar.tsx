'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Home, User, LogIn } from 'lucide-react';

import { publicNavItems, companyInfo, quickStats } from './constants';
import { useActiveItem } from './hooks/useActiveItem';
import { NavButton } from './components/NavButton';
import { CompanyInfo } from './components/CompanyInfo';
import { QuickStats as QuickStatsComponent } from './components/QuickStats';
import { useIconSizes } from '@/hooks/useIconSizes';

interface PublicSidebarProps {
  isAuthenticated?: boolean;
  userEmail?: string;
}

export function PublicSidebar({ isAuthenticated = false, userEmail }: PublicSidebarProps) {
  const iconSizes = useIconSizes();
  const { isActive } = useActiveItem();

  return (
    <div className="flex h-screen w-64 flex-col bg-card border-r">
      {/* Logo Section */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className={`flex ${iconSizes.xl} items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600`}>
            <Home className={`${iconSizes.sm} text-white`} />
          </div>
          <span className="text-lg font-semibold">Pagonis Properties</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="px-3 space-y-2">
          {publicNavItems.map((item) => (
            <NavButton key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <Separator className="my-6 mx-3" />

        {/* Company Info */}
        <CompanyInfo city={companyInfo.city} phone={companyInfo.phone} email={companyInfo.email} />

        <Separator className="my-6 mx-3" />

        {/* Quick Stats */}
        <QuickStatsComponent
          availableLabel={quickStats.availableLabel}
          availableValue={quickStats.availableValue}
          pricesFromLabel={quickStats.pricesFromLabel}
          pricesFromValue={quickStats.pricesFromValue}
        />
      </div>

      {/* User Section */}
      <div className="border-t p-4">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className={`flex ${iconSizes.xl} items-center justify-center rounded-full bg-blue-100`}>
              <User className={`${iconSizes.sm} text-blue-600`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Επισκέπτης</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">
              <LogIn className={`mr-2 ${iconSizes.sm}`} />
              Σύνδεση
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
