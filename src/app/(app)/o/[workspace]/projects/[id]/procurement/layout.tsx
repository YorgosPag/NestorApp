import { notFound } from 'next/navigation';
import { requireProjectForPage } from '@/server/auth/require-project-for-page';
import { ProjectProcurementTabs } from '@/components/projects/procurement/ProjectProcurementTabs';
import { BackToProjectLink } from '@/components/projects/procurement/BackToProjectLink';

interface ProjectProcurementLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

/**
 * @module /projects/[id]/procurement (layout)
 * @enterprise ADR-330 §5.1 S1+S2
 *   S1 — RBAC tenant guard via `requireProjectForPage`.
 *   S2 — RouteTabs SSoT (4 sub-tabs) + back link to project tab strip.
 *
 * ADR-928 §5.23 — **πλήρες πλάτος**. Ήταν `container mx-auto max-w-6xl`: χειρόγραφο ταβάνι 1.152 px που σε οθόνη 1920
 *   άφηνε ~550 px άδεια, ενώ ο επεξεργαστής συμφωνητικού στρίμωχνε φόρμα και έγγραφο. Το δόγμα του κελύφους (ADR-797,
 *   `ShellSurface`): το κενό στην άκρη το δίνει ο διάδρομος, και ταβάνι πλάτους **μόνο** ως `measure` σε σελίδα
 *   **ανάγνωσης** — εδώ ζουν πίνακες προσφορών/παραγγελιών και επεξεργαστές, δηλαδή εργαλείο πυκνών δεδομένων
 *   (Procore · Ironclad · ο σταθμός ελέγχου προσφορών, ADR-327 §8.5.4). ⚠️ Η πύλη 3.63 ελέγχει `page.tsx`, όχι ένθετα
 *   layouts — γι' αυτό το ταβάνι επέζησε αθέατο.
 * `div`, όχι `main`: το `<main>` το αποδίδει ήδη το κέλυφος (`MainContentBridge` → `ShellSurface as="main"`)· δεύτερο
 *   είναι παράβαση WCAG (ένα landmark `main` ανά σελίδα).
 */
export default async function ProjectProcurementLayout({
  children,
  params,
}: ProjectProcurementLayoutProps) {
  const { id } = await params;

  if (!id || id.startsWith('[')) {
    notFound();
  }

  try {
    await requireProjectForPage(id, `/projects/${id}/procurement`);
  } catch {
    notFound();
  }

  return (
    <div className="w-full space-y-4 py-4">
      <header className="space-y-2">
        <BackToProjectLink projectId={id} />
        <ProjectProcurementTabs projectId={id} />
      </header>
      <section>{children}</section>
    </div>
  );
}
