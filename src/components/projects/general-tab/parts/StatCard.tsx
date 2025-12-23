'use client';

import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIconSizes } from '@/hooks/useIconSizes';
import type { StatCardProps } from "../types";

export function StatCard({ icon: Icon, value, label, loading, colorClass, subtitle }: StatCardProps) {
  const iconSizes = useIconSizes();
  return (
    <Card className={cn("p-4", colorClass)}>
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-white/20">
          <Icon className={iconSizes.lg} />
        </div>
        <div>
          {loading ? (
            <>
              <Skeleton className={`${iconSizes.lg} w-16 mb-1 bg-white/50`} />
              <Skeleton className={`${iconSizes.sm} w-24 bg-white/50`} />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs">{label}</div>
              {subtitle && <div className="text-xs opacity-75">{subtitle}</div>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
