'use client';

/**
 * @fileoverview **Η ΠΗΓΗ ΤΟΥ ΑΝΑΓΛΥΦΟΥ** — «Τοπογράφος: … · αποτύπωση …» σε ΕΝΑ σημείο: κείμενο ΚΑΙ μορφή ημερομηνίας
 *   (ADR-920 Β6.6α).
 * @related lib/terrain/publication/listing-terrain-card (`ListingTerrainSurvey` — ποιος μέτρησε και πότε, Δ2 / Α3) ·
 *   ./TerrainStatsList (το ίδιο σχήμα για τους αριθμούς) · ./ListingTerrainPanel (δημόσια αγγελία) ·
 *   components/terrain/survey-import/PublishedTerrainSummary («Βελτίωσε»)
 * @module components/listing-detail/terrain/TerrainSurveyCredit
 *
 * 🔑 **Μία φωνή για την προέλευση**: ο αγοραστής και ο ιδιοκτήτης διαβάζουν την πηγή με τις ΙΔΙΕΣ λέξεις. Πριν υπήρχε
 *   δύο φορές (`terrain-survey` + `listing-detail`), και η μία θα μπορούσε να αλλάξει χωρίς την άλλη.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDate } from '@/lib/intl-formatting';
import type { ListingTerrainSurvey } from '@/lib/terrain/publication/listing-terrain-card';

export function TerrainSurveyCredit({ survey }: { readonly survey: ListingTerrainSurvey }) {
  const { t } = useTranslation(['listing-detail']);
  return (
    <p className="m-0 text-xs text-muted-foreground" data-listing-terrain-survey="">
      {t('listing-detail:terrain.survey', { name: survey.surveyorName, date: formatCalendarDate(survey.surveyedOn) })}
    </p>
  );
}
