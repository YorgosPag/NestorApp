/**
 * @related ADR-759 Φ3γ — **ποιο** έγγραφο διαβάζουμε, και ποιο από αυτά ισχύει
 *
 * Δύο πράγματα που η καρτέλα δεν έλεγε ποτέ, και τα δύο απαραίτητα από τη στιγμή που η
 * πινακίδα άρχισε να γράφει εδώ:
 *
 * 1. **Η ταυτότητα του εγγράφου** — από ποιο αρχείο μεταγράφηκε και ποιος το υπογράφει.
 *    Τα πεδία `sourceFileName` / `surveyorContactId` υπάρχουν από τη Φ2 και **δεν
 *    αποδίδονταν πουθενά**: το `SURVEY_CARD_ORDER` ξεκινούσε από την ενότητα Α.
 * 2. **Ποιο τοπογραφικό ισχύει** — ο δείκτης `project.activeSurveyRecordId`, που μέχρι τη
 *    Φ3γ **κανείς δεν έγραφε ποτέ**. Χωρίς αυτό, ένα έργο με δύο τοπογραφικά δεν έχει τρόπο
 *    να δηλώσει ποιο είναι το αυθεντικό, και η προσγείωση από την πινακίδα μπλοκάρει ορατά
 *    (`survey-record-undecided`) χωρίς ο μηχανικός να έχει κουμπί να το λύσει.
 *
 * 🔑 Η λίστα εμφανίζεται **μόνο με ≥2 εγγραφές**. Με μία, «η ενεργή» και «η μοναδική» είναι
 * η ίδια πρόταση, και ένας επιλογέας ενός στοιχείου είναι θόρυβος — ADR-759 §5.8: ο θόρυβος
 * εκπαιδεύει τον μηχανικό να σταματά να διαβάζει.
 */
'use client';

import { CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { surveyRecordLabel } from '@/lib/survey-record/survey-record-label';
import { surveyRecordDisplayName } from '@/config/survey-record-labels';
import type { SurveyRecord } from '@/types/project-survey-record';

interface SurveyDocumentSectionProps {
  readonly records: readonly SurveyRecord[];
  readonly current: SurveyRecord;
  /** Ο **ρητός** δείκτης του έργου. `null` = δεν έχει δηλωθεί ποτέ. */
  readonly activeId: string | null;
  readonly disabled: boolean;
  readonly onSelect: (recordId: string) => void;
  readonly onSetActive: (recordId: string) => void;
}

export function SurveyDocumentSection({
  records,
  current,
  activeId,
  disabled,
  onSelect,
  onSetActive,
}: SurveyDocumentSectionProps) {
  const { t } = useTranslation('surveyRecord');

  return (
    <section className="space-y-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('header.sourceFile')}</dt>
        <dd className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {current.sourceFileName ?? (
            <span className="text-muted-foreground italic">{t('header.sourceFileNone')}</span>
          )}
        </dd>

        <dt className="text-muted-foreground">{t('header.surveyor')}</dt>
        <dd>
          {/*
            Δείχνεται ο **δεσμός**, όχι όνομα — το `surveyorContactId` είναι FK και η επίλυση
            σε όνομα θα έσερνε τον τομέα επαφών (και το γράφημα auth/realtime μαζί του) σε μια
            καρτέλα έργου. Ίδιο εύρημα με τη Φ2β §4.3.2(2), όπου ακριβώς αυτός ο στατικός
            δεσμός έσκασε στο φόρτωμα του jest.
          */}
          {current.surveyorContactId ?? (
            <span className="text-muted-foreground italic">{t('header.surveyorNone')}</span>
          )}
        </dd>
      </dl>

      {records.length > 1 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t('card.listTitle')}</h4>
          <ul className="space-y-1">
            {records.map((record) => (
              <SurveyRecordRow
                key={record.id}
                record={record}
                isShown={record.id === current.id}
                isActive={record.id === activeId}
                disabled={disabled}
                onSelect={onSelect}
                onSetActive={onSetActive}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Μία γραμμή τοπογραφικού.
 *
 * ⚠️ **«Εμφανιζόμενο» και «ενεργό» είναι ΔΥΟ διαφορετικά πράγματα** και φαίνονται χωριστά:
 * ο μηχανικός μπορεί να **κοιτάζει** ένα παλιό τοπογραφικό (`isShown`) ενώ **ισχύει** άλλο
 * (`isActive`). Ένα ενιαίο «επιλεγμένο» θα έκανε την ανάγνωση του ιστορικού να μοιάζει με
 * αλλαγή του τι ισχύει — και θα ήταν ακριβώς η σιωπηλή αλλαγή που ο δείκτης υπάρχει για να
 * αποτρέψει.
 */
function SurveyRecordRow({
  record,
  isShown,
  isActive,
  disabled,
  onSelect,
  onSetActive,
}: {
  readonly record: SurveyRecord;
  readonly isShown: boolean;
  readonly isActive: boolean;
  readonly disabled: boolean;
  readonly onSelect: (recordId: string) => void;
  readonly onSetActive: (recordId: string) => void;
}) {
  const { t } = useTranslation('surveyRecord');

  return (
    <li className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={isShown ? 'secondary' : 'ghost'}
        size="sm"
        className="justify-start gap-1.5"
        onClick={() => onSelect(record.id)}
      >
        {isActive ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : null}
        {surveyRecordDisplayName(surveyRecordLabel(record), t)}
      </Button>

      {isActive ? (
        <Badge variant="secondary">{t('card.activeBadge')}</Badge>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSetActive(record.id)}
        >
          {t('card.setActive')}
        </Button>
      )}
    </li>
  );
}
