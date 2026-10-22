#!/usr/bin/env python3
"""
Hémicycle — eurodéputés des législatures 1 à 8 (1979–2019)

Source : jeu de données « meps » d'Eric Persson et al. (licence MIT),
https://github.com/expersso/meps — d'après le site du Parlement européen.

Usage :
    pip install rdata
    git clone https://github.com/expersso/meps /tmp/meps
    python3 scripts/build-old-terms.py /tmp/meps/data/meps.rda site/data/old.json
"""
import datetime as dt
import json
import re
import sys

import rdata

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/meps/data/meps.rda'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'site/data/old.json'

# nom du groupe -> (sigle, famille politique)
GROUPS = {
    'Communist and Allies Group': ('COM', 'left'),
    'Left Unity': ('LU', 'left'),
    'Group for the European United Left': ('EUL', 'left'),
    'Confederal Group of the European United Left': ('GUE', 'left'),
    'Confederal Group of the European United Left/Nordic Green Left': ('GUE/NGL', 'left'),
    'The Green Group in the European Parliament': ('V', 'green'),
    'Group of the Greens/European Free Alliance': ('Greens/EFA', 'green'),
    'Rainbow Group in the European Parliament': ('ARC', 'green'),
    'Socialist Group': ('SOC', 'soc'),
    'Group of the Party of European Socialists': ('PES', 'soc'),
    'Socialist Group in the European Parliament': ('PES', 'soc'),
    'Group of the Progressive Alliance of Socialists and Democrats in the European Parliament': ('S&D', 'soc'),
    'Group of the European Radical Alliance': ('ERA', 'radical'),
    'Liberal and Democratic Group': ('LD', 'lib'),
    'Liberal and Democratic Reformist Group': ('LDR', 'lib'),
    'Group of the European Liberal, Democrat and Reform Party': ('ELDR', 'lib'),
    'Group of the Alliance of Liberals and Democrats for Europe': ('ALDE', 'lib'),
    "Group of the European People's Party (Christian-Democratic Group)": ('EPP', 'epp'),
    "Group of the European People's Party (Christian Democrats) and European Democrats": ('EPP-ED', 'epp'),
    "Group of the European People's Party (Christian Democrats)": ('EPP', 'epp'),
    'Forza Europa Group': ('FE', 'epp'),
    'European Democratic Group': ('ED', 'cons'),
    'European Conservatives and Reformists Group': ('ECR', 'cons'),
    'Group of European Progressive Democrats': ('EPD', 'natcons'),
    'Group of the European Democratic Alliance': ('EDA', 'natcons'),
    'Group Union for Europe': ('UFE', 'natcons'),
    'Union for Europe of the Nations Group': ('UEN', 'natcons'),
    'Europe of Nations Group (Coordination Group)': ('EN', 'sov'),
    'Group of Independents for a Europe of Nations': ('I-EN', 'sov'),
    'Group for a Europe of Democracies and Diversities': ('EDD', 'sov'),
    'Independence/Democracy Group': ('IND/DEM', 'sov'),
    'Europe of freedom and democracy Group': ('EFD', 'sov'),
    'Europe of Freedom and Direct Democracy Group': ('EFDD', 'sov'),
    'Group of the European Right': ('DR', 'nat'),
    'Technical Group of the European Right': ('DR', 'nat'),
    'Identity, Tradition and Sovereignty Group': ('ITS', 'nat'),
    'Europe of Nations and Freedom Group': ('ENF', 'nat'),
    'Group for the Technical Coordination and Defence of Independent Groups and Members': ('CDI', 'tech'),
    'Technical Coordination and Defence of Independent Groups and Members': ('CDI', 'tech'),
    'Technical Group of Independent Members': ('TGI', 'tech'),
    'Non-attached': ('NI', 'ni'),
    'Non-attached Members': ('NI', 'ni'),
}
FAMILY_ORDER = ['left', 'green', 'soc', 'radical', 'lib', 'epp', 'cons', 'natcons', 'sov', 'nat', 'tech', 'ni']
YEARS = {1: '1979–1984', 2: '1984–1989', 3: '1989–1994', 4: '1994–1999', 5: '1999–2004', 6: '2004–2009', 7: '2009–2014', 8: '2014–2019'}
COUNTRY = {
    'Austria': 'AT', 'Belgium': 'BE', 'Bulgaria': 'BG', 'Croatia': 'HR', 'Cyprus': 'CY', 'Czechia': 'CZ', 'Denmark': 'DK',
    'Estonia': 'EE', 'Finland': 'FI', 'France': 'FR', 'Germany': 'DE', 'Greece': 'GR', 'Hungary': 'HU', 'Ireland': 'IE',
    'Italy': 'IT', 'Latvia': 'LV', 'Lithuania': 'LT', 'Luxembourg': 'LU', 'Malta': 'MT', 'Netherlands': 'NL', 'Poland': 'PL',
    'Portugal': 'PT', 'Romania': 'RO', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Spain': 'ES', 'Sweden': 'SE', 'United Kingdom': 'GB',
}


def group_of(name):
    if name in GROUPS:
        return GROUPS[name]
    if name.startswith('Rainbow Group'):
        return ('ARC', 'green')
    raise KeyError(f'Groupe inconnu : {name}')


END = {8: '2019-07-01'}  # date de fin si l'élu était encore en fonction lors de la collecte (législature 8)


def day(x, default=None):
    if x != x:  # NaN : mandat en cours au moment de la collecte des données
        return default
    return (dt.date(1970, 1, 1) + dt.timedelta(days=int(x))).isoformat()


def _cap(w):
    return '-'.join(x.capitalize() if len(x) > 1 and x.isupper() else x for x in w.split('-'))


def pretty(full):
    # « Victor ABENS » -> « Victor Abens » (les noms de famille sont en capitales)
    return ' '.join(_cap(w) for w in full.split())


def surname(full):
    caps = [w for w in full.split() if len(w) > 1 and not w.endswith('.') and w.replace('-', '').replace("'", '').isupper()]
    return ' '.join(caps).lower() or full.split()[-1].lower()


df = rdata.conversion.convert(rdata.parser.parse_file(SRC))['meps']
terms = []
for n in range(1, 9):
    sub = df[df.pterm == n]
    starts = [r.pg_full['from'].min() for r in sub.itertuples() if len(r.pg_full)]
    t0 = min(starts)
    groups = {}
    members = []
    for r in sub.itertuples():
        pg = r.pg_full
        if not len(pg):
            continue
        pg = pg.sort_values('from')
        first_from = pg['from'].min()
        code, fam = group_of(pg.iloc[0]['party'])
        history = []
        for _, row in pg.iterrows():
            c, f = group_of(row['party'])
            if not history or history[-1]['g'] != c:
                history.append({'g': c, 's': day(row['from']), 'e': day(row['to'], END.get(n))})
            else:
                history[-1]['e'] = day(row['to'], END.get(n))
        for _, row in pg.iterrows():
            groups.setdefault(GROUPS.get(row['party'], group_of(row['party']))[0], {'name': row['party'], 'fam': group_of(row['party'])[1]})
        initial = first_from <= t0 + 7  # élus présents dès la première semaine
        members.append({
            'id': int(r.id),
            'n': pretty(r.full_name),
            'k': surname(r.full_name),
            'c': COUNTRY.get(r.country, r.country),
            'g': code,
            'gh': history if len(history) > 1 else None,
            'p': r.np if isinstance(r.np, str) else None,
            's': day(first_from),
            'e': END.get(n) if pg['to'].isna().any() else day(pg['to'].max()),
            'i': 1 if initial else 0,
        })
    members.sort(key=lambda m: (m['k'], m['n']))
    for m in members:
        del m['k']
    seats = {}
    for m in members:
        if m['i']:
            seats[m['g']] = seats.get(m['g'], 0) + 1
    glist = [{'code': c, 'name': g['name'], 'fam': g['fam'], 'seats': seats.get(c, 0)} for c, g in groups.items()]
    glist.sort(key=lambda g: (FAMILY_ORDER.index(g['fam']), -g['seats']))
    for m in members:
        if not m['gh']:
            del m['gh']
        if not m['p']:
            del m['p']
    terms.append({'n': n, 'years': YEARS[n], 'start': day(t0), 'seats': sum(seats.values()), 'groups': glist, 'members': members})
    print(n, YEARS[n], len(members), 'eurodéputés,', sum(seats.values()), 'sièges au départ')

json.dump({'source': 'expersso/meps (MIT)', 'familyOrder': FAMILY_ORDER, 'terms': terms}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('Écrit dans', OUT)
