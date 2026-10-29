'use client';
/**
 * **«Μετάβαση σε κωδικό»** — βρίσκει μοντέλο ή SKU σε **όλο** τον κατάλογο, όχι μόνο στο φορτωμένο παράθυρο
 * (ADR-923 §5.10.4 Β2). Η λογική ζει στο καθαρό `resolveCatalogCode`· εδώ ο αναγνώστης της Firestore.
 *
 * @module components/catalog/products/CodeJumpField
 */

import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompanyId } from '@/hooks/useCompanyId';

import { useCatalogText } from '../shared/catalog-ui-hooks';
import { resolveCatalogCode, type CodeJumpTarget, type UniqueAttributeRef } from './catalog-code-jump';
import { catalogCodeReader } from './use-catalog-code-resolver';

export interface CodeJumpFieldProps {
  readonly uniqueAttributes: readonly UniqueAttributeRef[];
  readonly onFound: (target: CodeJumpTarget) => void;
}

export function CodeJumpField({ uniqueAttributes, onFound }: CodeJumpFieldProps) {
  const { t } = useCatalogText();
  const companyId = useCompanyId()?.companyId ?? null;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId || code.trim() === '') return;
    setBusy(true);
    setMissing(null);
    try {
      const target = await resolveCatalogCode(companyId, code, uniqueAttributes, catalogCodeReader);
      if (target) { onFound(target); setCode(''); } else setMissing(code.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <form role="search" className="flex flex-wrap items-center gap-2" onSubmit={(event) => void submit(event)}>
      <Input aria-label={t('products.jump.label')} placeholder={t('products.jump.placeholder')} value={code}
        onChange={(event) => { setCode(event.target.value); setMissing(null); }} className="w-60 font-mono" />
      <Button type="submit" variant="outline" disabled={busy || code.trim() === ''}>
        <Search className="mr-1 h-4 w-4" aria-hidden />{t('products.jump.go')}
      </Button>
      <p className="m-0 text-sm text-muted-foreground" role="status">{missing ? t('products.jump.notFound', { code: missing }) : ''}</p>
    </form>
  );
}
