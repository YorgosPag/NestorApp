/* eslint-disable design-system/prefer-design-system-imports -- Uses useDesignTokens (semantic colors + icon sizes) */
/**
 * TrashActionsBar — Generic toolbar for trash view
 *
 * Reusable across ALL entities: contacts, properties, buildings, etc.
 *
 * 🔑 ΜΙΑ διάταξη (ADR-867 2026-09-22 · N.0.2): οι επαφές και τα ακίνητα είχαν ΔΙΚΟ τους αντίγραφο αυτού του
 * JSX (jscpd: δίδυμοι 23 γραμμών), μόνο και μόνο επειδή τα κείμενά τους είναι ανά οντότητα («Πίσω στις Επαφές»).
 * Τα γενικά κείμενα (μετρητής, «Επαναφορά επιλεγμένων», «Οριστική διαγραφή») λέγονται ΙΔΙΑ σε κάθε οντότητα·
 * η οντότητα υπερβαίνει ΜΟΝΟ ό,τι έχει νόημα (`back`, `warning`) μέσω `labels`. Η επαναφορά μένει στον καλούντα.
 *
 * 🗄️ ΔΥΟ κάδοι, ΜΙΑ μπάρα (ADR-329 §3.9): το ΑΡΧΕΙΟ είναι η δεύτερη κατάσταση απόσυρσης και έχει την ίδια
 * διάταξη — με δύο διαφορές που εδώ είναι **προαιρετικές**, όχι δεύτερο component: (α) δεν έχει εκκαθάριση,
 * άρα χωρίς `onPermanentDelete` το κουμπί **δεν αποδίδεται καν** (ανενεργό κουμπί θα υποσχόταν πράξη που δεν
 * υπάρχει)· (β) το κείμενό του είναι εξήγηση, όχι προειδοποίηση ⇒ `noticeTone="info"`.
 *
 * @component
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIconSizes } from "@/hooks/useIconSizes";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import { TrashNotice, type TrashNoticeTone } from "./TrashNotice";

interface TrashActionsBarProps {
  /** Selected entity IDs in trash view */
  selectedIds: string[];
  /** Navigate back to active view */
  onBack: () => void;
  /** Restore selected items */
  onRestore: (ids: string[]) => void;
  /** Permanently delete selected items. Παράλειψη ⇒ ο κάδος δεν έχει εκκαθάριση (αρχείο) και το κουμπί λείπει. */
  onPermanentDelete?: (ids: string[]) => void;
  /** Ο τόνος της ταινίας πάνω από τα κουμπιά. Default `warning` (η εκκαθάριση των 30 ημερών). */
  noticeTone?: TrashNoticeTone;
  /** Total number of items in trash */
  trashCount: number;
  /** Entity type label for display (e.g., "Contacts", "Properties") */
  entityLabel?: string;
  /** Υπέρβαση κειμένων ανά οντότητα (ήδη μεταφρασμένα) πάνω στα γενικά του namespace `trash`. */
  labels?: Partial<TrashActionsBarLabels>;
}

export interface TrashActionsBarLabels {
  readonly view: string;
  readonly back: string;
  readonly count: string;
  readonly warning: string;
  readonly restore: string;
  readonly permanentDelete: string;
}

export function TrashActionsBar({
  selectedIds,
  onBack,
  onRestore,
  onPermanentDelete,
  noticeTone = "warning",
  trashCount,
  labels,
}: TrashActionsBarProps) {
  const { t } = useTranslation("trash");
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const text: TrashActionsBarLabels = {
    view: t("trashView"),
    back: t("backToList"),
    count: t("trashCount", { count: trashCount }),
    warning: t("autoDeleteWarning"),
    restore: t("restoreSelected"),
    permanentDelete: t("permanentDelete"),
    ...labels,
  };

  return (
    <section
      className="flex flex-col gap-2 px-3 py-2 border-b"
      role="toolbar"
      aria-label={text.view}
    >
      {/* Ταινία: προειδοποίηση (κάδος) ή εξήγηση (αρχείο) — η ΜΙΑ λωρίδα, κοινή με το κλειδωμένο πλαίσιο */}
      <TrashNotice tone={noticeTone}>
        <p>{text.warning}</p>
      </TrashNotice>

      {/* Action buttons */}
      <nav className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={onBack}
          className="gap-1.5"
        >
          <ArrowLeft className={iconSizes.xs} />
          {text.back}
        </Button>

        <span className={`text-sm ${colors.text.muted} px-2`}>
          {text.count}
        </span>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={() => onRestore(selectedIds)}
          disabled={selectedIds.length === 0}
          className="gap-1.5"
        >
          <RotateCcw className={iconSizes.xs} />
          {text.restore}
          {selectedIds.length > 0 && ` (${selectedIds.length})`}
        </Button>

        {onPermanentDelete && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onPermanentDelete(selectedIds)}
            disabled={selectedIds.length === 0}
            className="gap-1.5"
          >
            <Trash2 className={iconSizes.xs} />
            {text.permanentDelete}
          </Button>
        )}
      </nav>
    </section>
  );
}
