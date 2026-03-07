"""Update administrative-hierarchy.json municipalities to 2024-2028 catalog."""
import sys, json, unicodedata
sys.stdout.reconfigure(encoding='utf-8')

INPUT = r'C:\Nestor_Pagonis\src\data\administrative-hierarchy.json'

with open(INPUT, 'r', encoding='utf-8') as f:
    data = json.load(f)

entities = data['data']

def norm(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().replace('.', '').replace('-', ' ').replace('  ', ' ').strip()

munis = {e['id']: e for e in entities if e['l'] == 5}
changes = []

# ============================================================
# 1. RENAMES
# ============================================================
renames = {
    'ΔΗΜΟΣ ΚΥΜΗΣ - ΑΛΙΒΕΡΙΟΥ': ('ΔΗΜΟΣ ΑΛΙΒΕΡΙΟΥ-ΚΥΜΗΣ', 'ΑΛΙΒΕΡΙΟΥ-ΚΥΜΗΣ'),
    'ΔΗΜΟΣ ΚΑΛΑΜΠΑΚΑΣ': ('ΔΗΜΟΣ ΜΕΤΕΩΡΩΝ', 'ΜΕΤΕΩΡΩΝ'),
    'ΔΗΜΟΣ ΟΡΕΣΤΙΔΟΣ': ('ΔΗΜΟΣ ΑΡΓΟΥΣ ΟΡΕΣΤΙΚΟΥ', 'ΑΡΓΟΥΣ ΟΡΕΣΤΙΚΟΥ'),
    'ΔΗΜΟΣ ΜΩΛΟΥ - ΑΓΙΟΥ ΚΩΝΣΤΑΝΤΙΝΟΥ': ('ΔΗΜΟΣ ΚΑΜΕΝΩΝ ΒΟΥΡΛΩΝ', 'ΚΑΜΕΝΩΝ ΒΟΥΡΛΩΝ'),
    'ΔΗΜΟΣ ΝΑΟΥΣΑΣ': ('ΔΗΜΟΣ ΗΡΩΙΚΗΣ ΠΟΛΕΩΣ ΝΑΟΥΣΑΣ', 'ΗΡΩΙΚΗΣ ΠΟΛΕΩΣ ΝΑΟΥΣΑΣ'),
    'ΔΗΜΟΣ ΒΥΡΩΝΟΣ': ('ΔΗΜΟΣ ΒΥΡΩΝΑ', 'ΒΥΡΩΝΑ'),
    'ΔΗΜΟΣ ΗΛΙΟΥΠΟΛΕΩΣ': ('ΔΗΜΟΣ ΗΛΙΟΥ', 'ΗΛΙΟΥ'),
    'ΔΗΜΟΣ ΦΙΛΑΔΕΛΦΕΙΑΣ - ΧΑΛΚΗΔΟΝΟΣ': ('ΔΗΜΟΣ ΝΕΑΣ ΦΙΛΑΔΕΛΦΕΙΑΣ-ΝΕΑΣ ΧΑΛΚΗΔΟΝΟΣ', 'ΝΕΑΣ ΦΙΛΑΔΕΛΦΕΙΑΣ-ΝΕΑΣ ΧΑΛΚΗΔΟΝΟΣ'),
    'ΔΗΜΟΣ ΛΕΣΒΟΥ': ('ΔΗΜΟΣ ΜΥΤΙΛΗΝΗΣ', 'ΜΥΤΙΛΗΝΗΣ'),
    'ΔΗΜΟΣ ΚΑΣΟΥ': ('ΔΗΜΟΣ ΗΡΩΙΚΗΣ ΝΗΣΟΥ ΚΑΣΟΥ', 'ΗΡΩΙΚΗΣ ΝΗΣΟΥ ΚΑΣΟΥ'),
    'ΔΗΜΟΣ ΣΑΜΟΥ': ('ΔΗΜΟΣ ΑΝΑΤΟΛΙΚΗΣ ΣΑΜΟΥ', 'ΑΝΑΤΟΛΙΚΗΣ ΣΑΜΟΥ'),
    'ΔΗΜΟΣ ΔΙΟΥ - ΟΛΥΜΠΟΥ': ('ΔΗΜΟΣ ΔΙΟΥ-ΟΛΥΜΠΟΥ', 'ΔΙΟΥ-ΟΛΥΜΠΟΥ'),
}

for eid, e in munis.items():
    if e['n'] in renames:
        new_name, new_short = renames[e['n']]
        old = e['n']
        e['n'] = new_name
        e['sn'] = new_short
        e['nn'] = norm(new_name)
        changes.append(f'RENAME: {old} -> {new_name}')

# ============================================================
# 2. SPLITS - Kefalonia -> 3
# ============================================================
kef = next((e for e in munis.values() if 'ΚΕΦΑΛΟΝΙΑΣ' in e['n']), None)
if kef:
    parent = kef['p']
    kef['n'] = 'ΔΗΜΟΣ ΑΡΓΟΣΤΟΛΙΟΥ'
    kef['sn'] = 'ΑΡΓΟΣΤΟΛΙΟΥ'
    kef['nn'] = norm('ΔΗΜΟΣ ΑΡΓΟΣΤΟΛΙΟΥ')
    changes.append(f'SPLIT: ΚΕΦΑΛΟΝΙΑΣ -> ΑΡΓΟΣΤΟΛΙΟΥ (reused {kef["id"]})')

    for code, name, short in [('3502', 'ΔΗΜΟΣ ΛΗΞΟΥΡΙΟΥ', 'ΛΗΞΟΥΡΙΟΥ'),
                               ('3503', 'ΔΗΜΟΣ ΣΑΜΗΣ', 'ΣΑΜΗΣ')]:
        entities.append({'id': f'municipality:{code}', 'n': name, 'sn': short,
                         'nn': norm(name), 'c': code, 'p': parent, 'l': 5})
        changes.append(f'ADD: {name}')

# Kerkyra -> 3
kerk = next((e for e in munis.values() if e['n'] == 'ΔΗΜΟΣ ΚΕΡΚΥΡΑΣ'), None)
if kerk:
    parent = kerk['p']
    kerk['n'] = 'ΔΗΜΟΣ ΚΕΝΤΡΙΚΗΣ ΚΕΡΚΥΡΑΣ ΚΑΙ ΔΙΑΠΟΝΤΙΩΝ ΝΗΣΩΝ'
    kerk['sn'] = 'ΚΕΝΤΡΙΚΗΣ ΚΕΡΚΥΡΑΣ & ΔΙΑΠΟΝΤΙΩΝ ΝΗΣΩΝ'
    kerk['nn'] = norm(kerk['n'])
    changes.append(f'SPLIT: ΚΕΡΚΥΡΑΣ -> ΚΕΝΤΡΙΚΗΣ ΚΕΡΚΥΡΑΣ (reused {kerk["id"]})')

    for code, name, short in [('3202', 'ΔΗΜΟΣ ΒΟΡΕΙΑΣ ΚΕΡΚΥΡΑΣ', 'ΒΟΡΕΙΑΣ ΚΕΡΚΥΡΑΣ'),
                               ('3203', 'ΔΗΜΟΣ ΝΟΤΙΑΣ ΚΕΡΚΥΡΑΣ', 'ΝΟΤΙΑΣ ΚΕΡΚΥΡΑΣ')]:
        entities.append({'id': f'municipality:{code}', 'n': name, 'sn': short,
                         'nn': norm(name), 'c': code, 'p': parent, 'l': 5})
        changes.append(f'ADD: {name}')

# Lesvos split -> add Dytikis Lesvou
entities.append({'id': 'municipality:5302', 'n': 'ΔΗΜΟΣ ΔΥΤΙΚΗΣ ΛΕΣΒΟΥ', 'sn': 'ΔΥΤΙΚΗΣ ΛΕΣΒΟΥ',
                 'nn': norm('ΔΗΜΟΣ ΔΥΤΙΚΗΣ ΛΕΣΒΟΥ'), 'c': '5302', 'p': 'regional_unit:53', 'l': 5})
changes.append('ADD: ΔΗΜΟΣ ΔΥΤΙΚΗΣ ΛΕΣΒΟΥ')

# Samos split -> add Dytikis Samou
entities.append({'id': 'municipality:5602', 'n': 'ΔΗΜΟΣ ΔΥΤΙΚΗΣ ΣΑΜΟΥ', 'sn': 'ΔΥΤΙΚΗΣ ΣΑΜΟΥ',
                 'nn': norm('ΔΗΜΟΣ ΔΥΤΙΚΗΣ ΣΑΜΟΥ'), 'c': '5602', 'p': 'regional_unit:56', 'l': 5})
changes.append('ADD: ΔΗΜΟΣ ΔΥΤΙΚΗΣ ΣΑΜΟΥ')

# ============================================================
# 3. NEW MUNICIPALITIES
# ============================================================
new_munis = [
    ('1502', 'ΔΗΜΟΣ ΒΕΛΒΕΝΤΟΥ', 'ΒΕΛΒΕΝΤΟΥ', 'regional_unit:15'),           # Kozani
    ('0502', 'ΔΗΜΟΣ ΝΟΤΙΩΝ ΤΖΟΥΜΕΡΚΩΝ', 'ΝΟΤΙΩΝ ΤΖΟΥΜΕΡΚΩΝ', 'regional_unit:05'),  # Arta
]

for code, name, short, parent in new_munis:
    entities.append({'id': f'municipality:{code}', 'n': name, 'sn': short,
                     'nn': norm(name), 'c': code, 'p': parent, 'l': 5})
    changes.append(f'ADD: {name}')

# ============================================================
# 4. Update counts and save
# ============================================================
muni_count = sum(1 for e in entities if e['l'] == 5)
data['meta']['counts']['municipalities'] = muni_count

with open(INPUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

print(f'=== ΑΛΛΑΓΕΣ ({len(changes)}) ===')
for c in changes:
    print(f'  {c}')
print(f'\nΔήμοι τωρα: {muni_count}')
print(f'Συνολικες εγγραφες: {len(entities)}')
