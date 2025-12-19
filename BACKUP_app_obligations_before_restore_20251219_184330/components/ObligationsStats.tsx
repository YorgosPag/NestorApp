
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface ObligationsStatsProps {
  stats: {
    total: number;
    drafts: number;
    completed: number;
    approved: number;
  };
}

const StatCard = ({ title, value, icon: Icon, colorClass }: { title: string, value: number, icon: React.ElementType, colorClass?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={`h-4 w-4 text-muted-foreground ${colorClass}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export function ObligationsStats({ stats }: ObligationsStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard title="Σύνολο" value={stats.total} icon={FileText} />
      <StatCard title="Προσχέδια" value={stats.drafts} icon={FileText} colorClass="text-yellow-500" />
      <StatCard title="Ολοκληρωμένες" value={stats.completed} icon={FileText} colorClass="text-green-500" />
      <StatCard title="Εγκεκριμένες" value={stats.approved} icon={FileText} colorClass="text-blue-500" />
    </div>
  );
}

    