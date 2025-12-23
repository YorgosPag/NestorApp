"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/dashboard";
import { INTERACTIVE_PATTERNS } from "@/components/ui/effects";
import { useIconSizes } from '@/hooks/useIconSizes';

interface RecentActivitiesProps {
  activities: Activity[];
}

export function RecentActivities({ activities }: RecentActivitiesProps) {
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Πρόσφατες Δραστηριότητες</CardTitle>
          <CardDescription>
            Οι τελευταίες ενέργειες στο σύστημα
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/activities">
            Προβολή όλων
            <ArrowRight className={`ml-1 ${iconSizes.sm}`} />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`flex items-start gap-4 p-3 rounded-lg ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} transition-colors`}
            >
              <div
                className={cn(
                  `${iconSizes['2xl']} rounded-full flex items-center justify-center flex-shrink-0`,
                  activity.color
                )}
              >
                <activity.icon className={iconSizes.md} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{activity.title}</p>
                <p className="text-sm text-muted-foreground">
                  {activity.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
