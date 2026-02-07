'use client';

import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import type { StatCardProps } from "../types";

export function StatCard({ icon: Icon, value, label, loading, colorClass, subtitle }: StatCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  return (
    <Card className={cn(spacing.padding.sm, colorClass)}>
      <div className={cn("flex items-center", spacing.gap.md)}>
        <div className={`p-3 rounded-lg ${colors.bg.secondary} opacity-60`}>
          <Icon className={iconSizes.lg} />
        </div>
        <div>
          {loading ? (
            <>
              <Skeleton className={cn(iconSizes.lg, "w-16", spacing.margin.bottom.xs, colors.bg.secondary, "opacity-50")} />
              <Skeleton className={`${iconSizes.sm} w-24 ${colors.bg.secondary} opacity-50`} />
            </>
          ) : (
            <>
              <div className={typography.heading.lg}>{value}</div>
              <div className={typography.body.xs}>{label}</div>
              {subtitle && <div className={cn(typography.body.xs, "opacity-75")}>{subtitle}</div>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
