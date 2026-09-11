'use client';

/**
 * CompanySwitcher — ADR-340 · ADR-849 Β1
 *
 * Visible ONLY for super_admin users.
 *
 * 🔑 **Μέσα σε χώρο, ο επιλογέας ΠΛΟΗΓΕΙ** (Linear · Vercel · Slack: ο οργανισμός ζει
 * στη διεύθυνση). Μέχρι το ADR-849 Β1 άλλαζε **κρυφή** κατάσταση (`localStorage`) ενώ η
 * διεύθυνση έμενε ίδια — η σελίδα `/o/<ΠΑΓΩΝΗΣ>/…` έδειχνε δεδομένα άλλης εταιρείας, και
 * δύο καρτέλες δεν μπορούσαν να δείχνουν δύο εταιρείες. Εκτός χώρου (σελίδες
 * διαχείρισης) αλλάζει την επιλογή, όπως πάντα.
 */

import { useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSuperAdminCompany } from '@/contexts/SuperAdminCompanyContext';
import { usePathname, useRouter, useWorkspaceAlias } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { workspacePath } from '@/lib/workspace/workspace-path';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Ο **τομέας** της σελίδας (`/properties/prop_x` → `/properties`).
 *
 * ⚠️ Οι ταυτότητες οντοτήτων πέφτουν επίτηδες: ανήκουν στην **παλιά** εταιρεία, και το
 * `/o/<νέα>/properties/prop_x` θα έδειχνε «δεν βρέθηκε» — ακριβώς το σύμπτωμα του Β1.
 */
function sectionOf(pathname: string): string {
  const first = pathname.split('/').find(Boolean);
  return first ? `/${first}` : '/';
}

/** Τι κάνει η επιλογή μιας εταιρείας — **πλοήγηση** μέσα σε χώρο, αλλιώς επιλογή. */
export type SwitchTarget =
  | { readonly kind: 'navigate'; readonly href: string }
  | { readonly kind: 'select' };

/**
 * Καθαρή απόφαση, ελέγξιμη χωρίς React/Radix.
 *
 * @param alias — ο χώρος της διεύθυνσης (`useWorkspaceAlias`), `null` εκτός `/o/`
 * @param pathname — η διαδρομή **χωρίς** χώρο (`usePathname` του συνόρου)
 */
export function switchTarget(alias: string | null, pathname: string, companyId: string): SwitchTarget {
  if (alias === null) return { kind: 'select' };
  return { kind: 'navigate', href: workspacePath(companyId, sectionOf(pathname)) };
}

export function CompanySwitcher() {
  const { t } = useTranslation(['admin']);
  const { isSuperAdmin, activeCompanyId, companies, loading, setActiveCompanyId } = useSuperAdminCompany();
  const alias = useWorkspaceAlias();
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = useCallback(
    (companyId: string) => {
      const target = switchTarget(alias, pathname, companyId);
      if (target.kind === 'select') {
        setActiveCompanyId(companyId);
        return;
      }
      router.push(
        declaredHref(
          'ADR-849 Β1 — ο επιλογέας πλοηγεί στον ίδιο τομέα της εταιρείας που διάλεξε ο άνθρωπος· η ταυτότητα έρχεται από επιλογή, όχι από μητρώο',
          target.href,
        ),
      );
    },
    [alias, pathname, router, setActiveCompanyId],
  );

  if (!isSuperAdmin || (!loading && companies.length <= 1)) return null;

  return (
    <div className="flex items-center gap-1.5 px-2">
      <Building2 className="h-4 w-4 shrink-0 text-[hsl(var(--text-warning))]" />
      <Select
        value={activeCompanyId ?? ''}
        onValueChange={handleChange}
        disabled={loading || companies.length === 0}
      >
        <SelectTrigger
          className={cn(
            'h-8 min-w-[140px] max-w-[200px] text-xs border-[hsl(var(--text-warning))]/40',
            'bg-[hsl(var(--bg-warning))]/10 text-[hsl(var(--text-warning))] hover:bg-[hsl(var(--bg-warning))]/20',
            'focus:ring-[hsl(var(--text-warning))]/50'
          )}
        >
          <SelectValue placeholder={t('companySwitcher.selectCompany')} />
        </SelectTrigger>
        <SelectContent>
          {companies.length === 0 && (
            <SelectItem value="__none__" disabled>
              {loading ? '…' : t('companySwitcher.noCompanies')}
            </SelectItem>
          )}
          {companies.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
