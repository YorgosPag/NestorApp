"""ADR-915 §37 — μεταλλάξεις: αλλαγή → jest → επαναφορά στο ΙΔΙΟ τρέξιμο, έλεγχος ίδιου sha1."""
import hashlib
import subprocess
import sys

ROOT = 'C:/Nestor_Pagonis/'
SVC = 'src/services/document-registry/'
T_SVC = 'src/services/document-registry/__tests__/upkeep-declaration.service.test.ts'
T_SUBJ = 'src/services/document-registry/__tests__/upkeep-subject.test.ts'
T_ROUTE = 'src/app/api/document-registry/upkeep-declarations/__tests__/upkeep-declarations-route.test.ts'
T_SECTION = 'src/components/document-registry/__tests__/property-upkeep-section.test.tsx'
T_PREVIEW = 'src/components/document-registry/__tests__/upkeep-create-preview.test.tsx'
T_FIELDS = 'src/features/property-details/components/__tests__/property-fields-create-upkeep.test.tsx'
T_MANDATE = 'src/components/mandate/__tests__/mandate-detail-screen.test.tsx'

MUTATIONS = [
    ('Μ1 κριτής χωρίς mayAdminister', SVC + 'registry-owner-properties.server.ts',
     '  if (!mayAdminister(custody, actor)) return null;\n', '', [T_SVC, T_SUBJ]),
    ('Μ2 βιβλίο από τον δρώντα, όχι από τη θεματοφυλακή', SVC + 'upkeep-declaration.service.ts',
     '    owner,\n', "    owner: { companyId: actor.companyId ?? 'none' },\n", [T_SVC]),
    ('Μ3 seed εταιρείας αλλαγμένο', SVC + 'upkeep-declaration-schema.ts',
     ': owner.companyId;', ': `company:${owner.companyId}`;', [T_SUBJ]),
    ('Μ4 οργανισμός χωρίς δικαίωμα', 'src/app/api/document-registry/upkeep-declarations/route.ts',
     'return (await checkPermission(actor.ctx, UPKEEP_DECIDE_PERMISSION)).granted;', 'return true;', [T_ROUTE]),
    ('Μ5 αναγνώστης δέχεται ξένο βιβλίο', SVC + 'upkeep-declarations.server.ts',
     'if (parsed !== null && isOwnedByCustody(parsed, owner)) return [parsed];', 'if (parsed !== null) return [parsed];', [T_SUBJ]),
    ('Μ6 δεν ελέγχεται εταιρεία ιδιώτη', SVC + 'upkeep-subject.server.ts',
     "  if (actor.companyId === null || actor.companyId === '') return null;\n", '', [T_SVC, T_SUBJ]),
    ('Μ7 ο πελάτης αγνοεί το canDecide', 'src/components/document-registry/PropertyUpkeepSection.tsx',
     'canDecide={view.canDecide}', 'canDecide={true}', [T_SECTION]),
    ('Μ8 συρτάρι χωρίς φρουρό κενού είδους', 'src/components/document-registry/UpkeepCreatePreview.tsx',
     "  if (type.trim() === '') return null;\n", '', [T_PREVIEW]),
    ('Μ9 συρτάρι με υπότιτλο μητρώου', 'src/components/document-registry/upkeep-labels.ts',
     'create: `${K}createLead`,', 'create: `${K}lead`,', [T_PREVIEW]),
    ('Μ10 συρτάρι αγνοεί τη φάση της φόρμας', 'src/features/property-details/components/PropertyFieldsBlock.tsx',
     'phase={formData.operationalStatus}', 'phase="draft"', [T_FIELDS]),
    ('Μ11 προεπισκόπηση και σε υπάρχον ακίνητο', 'src/features/property-details/components/PropertyFieldsBlock.tsx',
     '{isCreatingNewUnit && <UpkeepCreatePreview', '{<UpkeepCreatePreview', [T_FIELDS]),
    ('Μ12 ενότητα εντολής χωρίς φρουρό «βρέθηκε»', 'src/components/mandate/MandateDetailContent.tsx',
     "      {view.state === 'settled' && view.loaded.kind === MANDATE_FOUND && (\n        <PropertyUpkeepSection",
     "      {(\n        <PropertyUpkeepSection", [T_MANDATE]),
    ('Μ13 συρτάρι με «Εκκρεμούν»', 'src/components/document-registry/RegistryUpkeepPanel.tsx',
     "{place === 'create' ? null : (", "{false ? null : (", [T_PREVIEW]),
]


def sha(path):
    return hashlib.sha1(open(ROOT + path, 'rb').read()).hexdigest()


only = sys.argv[1:]
results = []
for name, path, old, new, tests in MUTATIONS:
    if only and not any(name.startswith(o) for o in only):
        continue
    original = open(ROOT + path, 'rb').read()
    before = sha(path)
    text = original.decode('utf-8')
    if text.count(old) != 1:
        results.append((name, 'ΔΕΝ ΒΡΕΘΗΚΕ το σημείο'))
        continue
    try:
        open(ROOT + path, 'wb').write(text.replace(old, new).encode('utf-8'))
        run = subprocess.run('npx jest ' + ' '.join(tests), cwd=ROOT, shell=True, capture_output=True, text=True,
                             encoding='utf-8', errors='replace')
        out = run.stdout + run.stderr
        failed = [line.strip() for line in out.splitlines() if line.strip().startswith('Tests:')]
        verdict = 'ΚΟΚΚΙΝΗ' if run.returncode != 0 else 'ΠΡΑΣΙΝΗ (!)'
    finally:
        open(ROOT + path, 'wb').write(original)
    after = sha(path)
    results.append((name, f'{verdict} · {failed[-1] if failed else "?"} · sha1 {"ίδιο" if before == after else "ΔΙΑΦΕΡΕΙ!"}'))

for name, verdict in results:
    print(f'{name}: {verdict}')
