'use client';

/**
 * Ισοπαλία με άλλη σύμβαση του προμηθευτή — ΠΟΥ και ΑΠΟ ΠΟΤΕ (ADR-923 §5.11 «3γ», Βήμα 2).
 * Τα σημεία έρχονται από τον ίδιο επιλογέα με την τιμολόγηση PO (`findAgreementTies`). Ενεργή σύμβαση ⇒
 * η αποθήκευση μπλοκάρεται (`role="alert"`)· πρόχειρη ⇒ πληροφορία «αν ενεργοποιηθεί».
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { AgreementScopeOptions } from '@/hooks/procurement/useAgreementScopeOptions';
import type { AgreementTie, AgreementTiePoint } from '@/subapps/procurement/utils/framework-agreement-ambiguity';

const NS = 'hub.frameworkAgreements.form.tie';

interface AgreementTieWarningProps {
  readonly ties: readonly AgreementTie[];
  readonly blocking: boolean;
  readonly options: AgreementScopeOptions;
}

function useTiePointText(options: AgreementScopeOptions): (agreement: string, point: AgreementTiePoint) => string {
  const { t } = useTranslation('procurement');
  return (agreement, point) => {
    const item =
      point.materialId !== null
        ? options.labelOfMaterial(point.materialId)
        : point.categoryCode !== null
          ? options.labelOfCategory(point.categoryCode)
          : t(`${NS}.anyItem`);
    const project = point.projectId !== null ? options.labelOfProject(point.projectId) : t(`${NS}.anyProject`);
    return t(`${NS}.point`, { agreement, item, project, date: formatDate(new Date(point.fromMs)) });
  };
}

export function AgreementTieWarning({ ties, blocking, options }: AgreementTieWarningProps) {
  const { t } = useTranslation('procurement');
  const pointText = useTiePointText(options);
  if (ties.length === 0) return null;

  const tone = blocking
    ? 'border-destructive/60 bg-destructive/10 text-destructive'
    : 'border-[hsl(var(--text-warning))]/60 bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]';
  return (
    <aside role={blocking ? 'alert' : 'status'} className={cn('space-y-1 rounded-md border px-3 py-2 text-sm', tone)}>
      <p className="font-medium">{t(blocking ? `${NS}.activeTitle` : `${NS}.draftTitle`)}</p>
      <ul className="list-disc space-y-0.5 pl-5">
        {ties.flatMap((tie) =>
          tie.points.map((point) => (
            <li key={`${tie.agreementId}:${point.materialId}:${point.categoryCode}:${point.projectId}`}>
              {pointText(tie.agreementNumber, point)}
            </li>
          )),
        )}
      </ul>
      <p className="text-xs">{t(`${NS}.explanation`)}</p>
    </aside>
  );
}
