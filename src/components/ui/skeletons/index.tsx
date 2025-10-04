'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// Base skeleton component
export function Skeleton({ 
  className, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  );
}

// Text skeleton variations
export function SkeletonText({ 
  lines = 1, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

// Avatar skeleton
export function SkeletonAvatar({ 
  size = "md",
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12", 
    lg: "h-16 w-16",
    xl: "h-24 w-24"
  };

  return (
    <Skeleton
      className={cn(
        "rounded-full",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}

// Card skeleton
export function SkeletonCard({ 
  showHeader = true,
  showAvatar = false,
  lines = 3,
  showActions = true,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & {
  showHeader?: boolean;
  showAvatar?: boolean;
  lines?: number;
  showActions?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-6 shadow-sm",
        className
      )}
      {...props}
    >
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {showAvatar && <SkeletonAvatar size="sm" />}
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      )}
      
      <SkeletonText lines={lines} className="mb-4" />
      
      {showActions && (
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}

// Table skeleton
export function SkeletonTable({ 
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border",
        className
      )}
      {...props}
    >
      {showHeader && (
        <div className="border-b bg-muted/50 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
        </div>
      )}
      
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Form skeleton
export function SkeletonForm({ 
  fields = 4,
  showTitle = true,
  columns = 1,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & {
  fields?: number;
  showTitle?: boolean;
  columns?: 1 | 2;
}) {
  return (
    <div
      className={cn(
        "space-y-6",
        className
      )}
      {...props}
    >
      {showTitle && <Skeleton className="h-8 w-48" />}
      
      <div className={cn(
        "grid gap-4",
        columns === 2 ? "md:grid-cols-2" : "grid-cols-1"
      )}>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      
      <div className="flex justify-end space-x-3">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

// Chart skeleton
export function SkeletonChart({ 
  type = "bar",
  showLegend = true,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & {
  type?: "bar" | "line" | "pie" | "area";
  showLegend?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        {showLegend && (
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        )}
      </div>
      
      <div className="relative h-64 rounded border bg-muted/30">
        {type === "bar" && (
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between space-x-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-8"
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            ))}
          </div>
        )}
        
        {type === "line" && (
          <div className="absolute inset-4 flex items-center justify-center">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-muted-foreground to-transparent opacity-30" />
          </div>
        )}
        
        {type === "pie" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

// Navigation skeleton
export function SkeletonNavigation({ 
  items = 6,
  showLogo = true,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & {
  items?: number;
  showLogo?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-2 p-4",
        className
      )}
      {...props}
    >
      {showLogo && <Skeleton className="h-8 w-32 mb-6" />}
      
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

// Stats card skeleton
export function SkeletonStatsCard({ 
  showIcon = true,
  showTrend = true,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & {
  showIcon?: boolean;
  showTrend?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-6 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-20" />
          {showTrend && <Skeleton className="h-3 w-24" />}
        </div>
        {showIcon && <Skeleton className="h-8 w-8 rounded" />}
      </div>
    </div>
  );
}

// Modal skeleton
export function SkeletonModal({ 
  showHeader = true,
  showFooter = true,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & {
  showHeader?: boolean;
  showFooter?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={cn(
          "bg-card rounded-lg shadow-xl w-full max-w-2xl mx-4",
          className
        )}
        {...props}
      >
        {showHeader && (
          <div className="p-6 border-b">
            <Skeleton className="h-6 w-48" />
          </div>
        )}
        
        <div className="p-6 space-y-4">
          <SkeletonText lines={2} />
          <Skeleton className="h-32 w-full rounded" />
          <SkeletonText lines={1} />
        </div>
        
        {showFooter && (
          <div className="p-6 border-t flex justify-end space-x-3">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        )}
      </div>
    </div>
  );
}

export {
  Skeleton as default
};