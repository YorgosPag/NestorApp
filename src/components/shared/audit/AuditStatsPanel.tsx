"use client";

/**
 * AuditStatsPanel — οι τέσσερις κάρτες στατιστικών πάνω από κάθε χρονολόγιο ιστορικού.
 *
 * 🔑 ADR-770 §18 — ΟΥΔΕΤΕΡΕΣ ΚΑΡΤΕΣ. Ήταν μπλε · γκρι · πορτοκαλί · «teal» (ανύπαρκτο ⇒
 * λευκό) χωρίς καμία σημασία πίσω από το χρώμα — και το πορτοκαλί ΣΗΜΑΙΝΕΙ «προσοχή»
 * εκεί που δεν υπάρχει τίποτα για προσοχή. Το χρώμα σε στατιστικό είναι κατάσταση, ποτέ
 * ποικιλία (GitHub Insights · Linear · Stripe Dashboard).
 *
 * SSoT: ήταν δύο αντίγραφα (`AuditTimelineView` + `ContactHistoryTab`) με τα ίδια λάθη.
 *
 * @enterprise ADR-195 — Entity Audit Trail
 */

import type React from "react";
import { BarChart3, Clock, FileEdit, Users } from "lucide-react";
import { StatsCard } from "@/components/property-management/dashboard/StatsCard";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { COMMON_NAMESPACES } from "@/i18n/namespace-bundles";
import type { Stats } from "./activity-tab-helpers";

/** Η τέταρτη κάρτα, όταν ο καταναλωτής έχει κάτι πιο σημαντικό από «Χρήστες». */
export interface AuditStatsExtraCard {
  title: string;
  value: number;
  icon: React.ElementType;
}

export interface AuditStatsPanelProps {
  stats: Stats;
  fourthCard?: AuditStatsExtraCard;
}

export function AuditStatsPanel({ stats, fourthCard }: AuditStatsPanelProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatsCard title={t("audit.totalLabel")} value={stats.total} icon={BarChart3} color="gray" />
      <StatsCard
        title={t("audit.stats.lastChange")}
        value={stats.lastChangeRelative ?? "—"}
        icon={Clock}
        color="gray"
      />
      <StatsCard
        title={t("audit.stats.fieldsChanged")}
        value={stats.uniqueFieldsChanged}
        icon={FileEdit}
        color="gray"
      />
      {fourthCard ? (
        <StatsCard title={fourthCard.title} value={fourthCard.value} icon={fourthCard.icon} color="gray" />
      ) : (
        <StatsCard title={t("audit.stats.users")} value={stats.uniqueUsers} icon={Users} color="gray" />
      )}
    </section>
  );
}
