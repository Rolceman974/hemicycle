#!/usr/bin/env node
/*
 * Hemicycle — indicateurs d'analyse calculés à partir des fichiers produits par build-data.js
 *
 *   node scripts/build-extra.js site/data          (législature en cours)
 *   node scripts/build-extra.js site/data/t9       (2019–2024)
 *
 * Écrit dans le même dossier :
 *   extra.json      position majoritaire de chaque groupe sur chaque vote final (coalitions)
 *                   et cohésion mensuelle de chaque groupe
 *   countries.json  pour chaque vote final, nombre de voix pour / contre / abstention par pays
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || 'site/data';
const json = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const meta = json('meta.json');
const members = json('members.json');
const votes = json('votes.json');

const ORDER = ['GUE_NGL', 'GREEN_EFA', 'SD', 'RENEW', 'EPP', 'ECR', 'PFE', 'ESN', 'ID', 'NI'];
const G = [...new Set(meta.groups.map((g) => g.code))].filter((g) => g !== 'NI').sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
const C = [...new Set(members.map((m) => m.c))].sort();
const cIdx = new Map(C.map((c, i) => [c, i]));

const gm = {};          // id → une lettre par groupe : F pour, A contre, X abstention, - partagé / absent
const cv = {};          // id → [[pour, contre, abst.] × pays]
const coh = {};         // groupe → mois → [somme des parts majoritaires, nombre de votes]
let n = 0;

for (const v of votes) {
  const file = path.join(DIR, 'v', `${v.id}.json`);
  if (!fs.existsSync(file)) continue;
  const { p, g } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const month = v.t.slice(0, 7);
  for (const [code, c] of Object.entries(g)) {
    if (code === 'NI') continue;
    const part = c[0] + c[1] + c[2];
    if (part < 3) continue;
    const share = Math.max(c[0], c[1], c[2]) / part;
    ((coh[code] ||= {})[month] ||= [0, 0]);
    coh[code][month][0] += share; coh[code][month][1]++;
  }
  if (!v.mn) continue;
  n++;
  gm[v.id] = G.map((code) => {
    const c = g[code];
    if (!c || c[0] + c[1] + c[2] === 0) return '-';
    const top = Math.max(c[0], c[1], c[2]);
    if ([c[0], c[1], c[2]].filter((x) => x === top).length > 1) return '-';
    return 'FAX'[[c[0], c[1], c[2]].indexOf(top)];
  }).join('');
  const per = C.map(() => [0, 0, 0]);
  for (let i = 0; i < p.length && i < members.length; i++) {
    const k = 'FAX'.indexOf(p[i].toUpperCase());
    if (k >= 0) per[cIdx.get(members[i].c)][k]++;
  }
  cv[v.id] = per;
}

const months = [...new Set(Object.values(coh).flatMap((o) => Object.keys(o)))].sort();
const cohOut = Object.fromEntries(Object.entries(coh).map(([code, o]) =>
  [code, months.map((m) => (o[m] && o[m][1] >= 5 ? Math.round((o[m][0] / o[m][1]) * 1000) / 1000 : null))]));

fs.writeFileSync(path.join(DIR, 'extra.json'), JSON.stringify({ G, gm, months, coh: cohOut }));
fs.writeFileSync(path.join(DIR, 'countries.json'), JSON.stringify({ C, v: cv }));
console.log(`${DIR} : ${n} votes finaux, ${months.length} mois, ${C.length} pays`);
