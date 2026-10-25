#!/usr/bin/env node
/*
 * Hemicycle — génération des données
 * ----------------------------------
 * Transforme l'export hebdomadaire de HowTheyVote.eu (CSV) en petits fichiers JSON
 * lus par le site. Seule la législature en cours (depuis le 16 juillet 2024) est gardée.
 *
 * Usage :
 *   node scripts/build-data.js <dossier-export> [dossier-sortie]
 *
 *   <dossier-export>  dossier où export.zip a été décompressé
 *                     (https://github.com/HowTheyVote/data/releases/latest/download/export.zip)
 *   [dossier-sortie]  par défaut : site/data
 *
 * Aucune dépendance : Node 18+.
 */

// abréviations officielles peu lisibles remplacées par le nom courant du parti
const PARTY_SHORT = { LesEng: 'Les Engagés' };
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i === -1) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const TERM = Number(flag('--term') || 10);
const MAIN_ONLY = args.includes('--main-only') ? (args.splice(args.indexOf('--main-only'), 1), true) : false;
const SRC = args[0];
const OUT = path.resolve(args[1] || path.join(__dirname, '..', 'site', 'data'));
// dates des législatures couvertes par les données (fin = début de la suivante)
const TERMS = { 9: { start: '2019-07-02', end: '2024-07-16' }, 10: { start: '2024-07-16', end: null } };
if (!TERMS[TERM]) { console.error(`Législature inconnue : ${TERM}`); process.exit(1); }
const TERM_START = TERMS[TERM].start;
const TERM_END = TERMS[TERM].end;

if (!SRC || !fs.existsSync(path.join(SRC, 'votes.csv'))) {
  console.error('Usage : node scripts/build-data.js <dossier-export> [dossier-sortie] [--term 10|9] [--main-only]');
  process.exit(1);
}

/* ------------------------------------------------------------------ CSV */

// Analyse un texte CSV complet (gère guillemets et retours à la ligne dans les champs)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', i = 0, q = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; i++; continue;
    }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, j) => [h, r[j] ?? ''])));
}
const readCSV = (name) => parseCSV(fs.readFileSync(path.join(SRC, name), 'utf8'));

// Lecture en flux d'un gros CSV, ligne par ligne (member_votes.csv fait ~800 Mo)
async function streamCSV(name, onRow) {
  const stream = fs.createReadStream(path.join(SRC, name), { encoding: 'utf8', highWaterMark: 1 << 20 });
  let rest = '';
  let head = null;
  const splitLine = (line) => {
    if (line.indexOf('"') === -1) return line.split(',');
    const out = []; let f = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { out.push(f); f = ''; }
      else f += c;
    }
    out.push(f);
    return out;
  };
  for await (const chunk of stream) {
    const data = rest + chunk;
    let start = 0, nl;
    while ((nl = data.indexOf('\n', start)) !== -1) {
      let line = data.slice(start, nl);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      start = nl + 1;
      if (!line) continue;
      if (!head) { head = line.split(','); continue; }
      onRow(splitLine(line));
    }
    rest = data.slice(start);
  }
  if (rest.trim() && head) onRow(splitLine(rest.trim()));
  return head;
}

/* --------------------------------------------------------------- tables */

async function main() {
  console.time('build');
  const updated = fs.readFileSync(path.join(SRC, 'last_updated.txt'), 'utf8').trim();

  const countries = readCSV('countries.csv');
  const groups = readCSV('groups.csv');
  const members = readCSV('members.csv');
  // un même groupe peut apparaître sous deux codes (ancien nom de La Gauche) : on les fusionne
  const normG = (g) => (g === 'GUE_NGL_1995_0' ? 'GUE_NGL' : g);
  const gms = readCSV('group_memberships.csv').filter((g) => Number(g.term) === TERM).map((g) => ({ ...g, group_code: normG(g.group_code) }));
  const parties = new Map(readCSV('national_parties.csv').map((p) => [p.id, p]));
  const pms = readCSV('national_party_memberships.csv');
  const committees = new Map(readCSV('committees.csv').map((c) => [c.code, c]));
  const geoAreas = new Map(readCSV('geo_areas.csv').map((g) => [g.code, g]));

  const votesAll = readCSV('votes.csv');
  const votes = votesAll.filter((v) => v.timestamp >= TERM_START && (!TERM_END || v.timestamp < TERM_END))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || Number(b.id) - Number(a.id));
  const voteIdx = new Map(votes.map((v, i) => [v.id, i]));
  console.log(`Législature ${TERM} : ${votes.length} votes${MAIN_ONLY ? ' (seuls les votes finaux seront publiés)' : ''}`);

  const byVote = (file, key) => {
    const m = new Map();
    for (const r of readCSV(file)) {
      if (!voteIdx.has(r.vote_id)) continue;
      if (!m.has(r.vote_id)) m.set(r.vote_id, []);
      m.get(r.vote_id).push(r[key]);
    }
    return m;
  };
  const voteCommittees = byVote('responsible_committee_votes.csv', 'committee_code');
  const voteGeo = byVote('geo_area_votes.csv', 'geo_area_code');
  const voteAuthors = new Map();
  for (const r of readCSV('amendment_authors_votes.csv')) {
    if (!voteIdx.has(r.vote_id)) continue;
    const label = r.author_type === 'GROUP' ? r.group_code : r.author_type === 'COMMITTEE' ? 'COMMITTEE:' + r.committee_code : r.author_type;
    if (!voteAuthors.has(r.vote_id)) voteAuthors.set(r.vote_id, []);
    voteAuthors.get(r.vote_id).push(label);
  }
  const amendUrls = new Map();
  for (const r of readCSV('amendment_urls.csv')) {
    if (!voteIdx.has(r.vote_id) || amendUrls.has(r.vote_id)) continue;
    amendUrls.set(r.vote_id, r.url);
  }

  /* -------- eurodéputés de la législature (d'après leurs appartenances à un groupe) */
  const termIds = new Set(gms.map((g) => g.member_id));
  const lastDay = TERM_END ? new Date(Date.parse(TERM_END) - 864e5).toISOString().slice(0, 10) : null;
  let mList = members.filter((m) => termIds.has(m.id)).map((m) => {
    const memberships = gms.filter((g) => g.member_id === m.id).sort((a, b) => a.start_date.localeCompare(b.start_date));
    const current = memberships[memberships.length - 1];
    const active = Boolean(current && (!current.end_date || (lastDay && current.end_date >= lastDay)));
    const partyM = pms.filter((p) => p.member_id === m.id && (p.end_date === '' || p.end_date >= TERM_START) && (!TERM_END || p.start_date < TERM_END))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const pm = partyM[partyM.length - 1];
    const party = pm && parties.get(pm.national_party_id);
    return {
      id: Number(m.id), fn: m.first_name, ln: m.last_name, c: m.country_code,
      g: current ? current.group_code : 'NI',
      gh: memberships.length > 1 ? memberships.map((x) => ({ g: x.group_code, s: x.start_date, e: x.end_date || null })) : undefined,
      p: party ? (PARTY_SHORT[party.short_label] || party.short_label) : null, pl: party ? party.label : null,
      dob: m.date_of_birth || null, a: active,
      since: memberships[0] ? memberships[0].start_date : null,
      until: active ? null : (current && current.end_date) || null,
      em: m.email || null, // réseaux sociaux non repris : liens souvent périmés, la fiche officielle du Parlement fait foi
    };
  }).sort((a, b) => a.ln.localeCompare(b.ln, 'fr') || a.fn.localeCompare(b.fn, 'fr'));
  let memIdx = new Map(mList.map((m, i) => [String(m.id), i]));

  /* -------- votes individuels (gros fichier, en flux), stockés de façon compacte */
  const CODE = { FOR: 1, AGAINST: 2, ABSTENTION: 3, DID_NOT_VOTE: 4 };
  const LETTER = ['.', 'F', 'A', 'X', 'N'];
  const gCodes = []; const gIndex = new Map();
  const gid = (g) => { if (!gIndex.has(g)) { gIndex.set(g, gCodes.length + 1); gCodes.push(g); } return gIndex.get(g); };
  const nM = mList.length;
  const posArr = votes.map(() => new Uint8Array(nM));
  const grpArr = votes.map(() => new Uint8Array(nM));
  const seen = new Uint8Array(nM);
  let rows = 0;
  await streamCSV('member_votes.csv', (r) => {
    const vi = voteIdx.get(r[0]);
    if (vi === undefined) return;
    const i = memIdx.get(r[1]);
    if (i === undefined) return;
    rows++; seen[i] = 1;
    posArr[vi][i] = CODE[r[2]] || 4;
    grpArr[vi][i] = gid(normG(r[4] || 'NI'));
  });
  console.log(`${rows} positions individuelles`);
  // on retire les élus sans aucun vote enregistré
  const keepM = mList.map((_, i) => seen[i] === 1);
  const remap = [];
  mList = mList.filter((_, i) => { if (keepM[i]) remap.push(i); return keepM[i]; });
  memIdx = new Map(mList.map((m, i) => [String(m.id), i]));
  console.log(`${mList.length} eurodéputés`);

  /* -------- calculs : majorité de chaque groupe, présence, loyauté */
  const isOut = (v) => !MAIN_ONLY || v.is_main === 'True';
  const outVotes = votes.filter(isOut);
  const outIdx = new Map(outVotes.map((v, i) => [v.id, i]));
  const stats = mList.map(() => ({ n: 0, F: 0, A: 0, X: 0, N: 0, loyal: 0, loyalN: 0, mainN: 0, mainP: 0 }));
  const memberStrings = mList.map(() => new Array(outVotes.length).fill('.'));
  const groupCoh = {};
  const voteOut = [];
  const groupsSeen = new Set();
  const agree = {};

  fs.rmSync(path.join(OUT, 'v'), { recursive: true, force: true });
  fs.rmSync(path.join(OUT, 'm'), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'v'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'm'), { recursive: true });

  votes.forEach((v, vi) => {
    const P = posArr[vi], G = grpArr[vi];
    const gCount = {};
    for (let k = 0; k < mList.length; k++) {
      const i = remap[k];
      if (!P[i]) continue;
      const g = gCodes[G[i] - 1];
      if (!gCount[g]) gCount[g] = { F: 0, A: 0, X: 0, N: 0 };
      gCount[g][LETTER[P[i]]]++;
    }
    const gMaj = {};
    for (const [g, c] of Object.entries(gCount)) {
      const part = c.F + c.A + c.X;
      if (!part) continue;
      const best = ['F', 'A', 'X'].sort((x, y) => c[y] - c[x])[0];
      gMaj[g] = best;
      if (g !== 'NI') {
        if (!groupCoh[g]) groupCoh[g] = { sum: 0, n: 0 };
        groupCoh[g].sum += c[best] / part; groupCoh[g].n++;
      }
    }
    const oi = outIdx.get(v.id);
    const chars = oi !== undefined ? new Array(mList.length).fill('.') : null;
    for (let k = 0; k < mList.length; k++) {
      const i = remap[k];
      if (!P[i]) continue;
      const p = LETTER[P[i]], g = gCodes[G[i] - 1];
      if (chars) {
        chars[k] = p;
        // minuscule = vote différent de la majorité de son groupe
        memberStrings[k][oi] = p !== 'N' && g !== 'NI' && gMaj[g] && p !== gMaj[g] ? p.toLowerCase() : p;
      }
      const s = stats[k];
      s.n++; s[p]++;
      if (v.is_main === 'True') { s.mainN++; if (p !== 'N') s.mainP++; }
      if (p !== 'N' && g !== 'NI' && gMaj[g]) { s.loyalN++; if (p === gMaj[g]) s.loyal++; }
    }
    for (const g of Object.keys(gCount)) groupsSeen.add(g);
    if (v.is_main === 'True') {
      const gs = Object.keys(gMaj).filter((g) => g !== 'NI');
      for (const a of gs) for (const b of gs) {
        if (a >= b) continue;
        const k = a + '|' + b;
        if (!agree[k]) agree[k] = [0, 0];
        agree[k][1]++; if (gMaj[a] === gMaj[b]) agree[k][0]++;
      }
    }
    posArr[vi] = null; grpArr[vi] = null; // libère la mémoire
    if (!chars) return;
    const gOut = Object.fromEntries(Object.entries(gCount).map(([g, c]) => [g, [c.F, c.A, c.X, c.N]]));
    fs.writeFileSync(path.join(OUT, 'v', `${v.id}.json`), JSON.stringify({ p: chars.join(''), g: gOut }));

    const com = voteCommittees.get(v.id);
    const geo = voteGeo.get(v.id);
    const aut = voteAuthors.get(v.id);
    voteOut.push(clean({
      id: Number(v.id),
      t: v.timestamp.replace(' ', 'T'),
      ti: v.display_title || v.procedure_title || 'Vote sans titre',
      ref: v.reference || undefined,
      d: v.description || undefined,
      as: v.amendment_subject || undefined,
      an: v.amendment_number || undefined,
      mn: v.is_main === 'True' ? 1 : undefined,
      pr: v.procedure_reference || undefined,
      pt: v.procedure_title && v.procedure_title !== v.display_title ? v.procedure_title : undefined,
      ty: v.procedure_type || undefined,
      st: v.procedure_stage || undefined,
      c: [Number(v.count_for), Number(v.count_against), Number(v.count_abstention), Number(v.count_did_not_vote)],
      r: v.result || undefined,
      ta: v.texts_adopted_reference || undefined,
      cm: com && com.length ? [...new Set(com)] : undefined,
      geo: geo && geo.length ? [...new Set(geo)] : undefined,
      au: aut && aut.length ? [...new Set(aut)] : undefined,
      au_url: amendUrls.get(v.id) || undefined,
    }));
  });

  mList.forEach((m, i) => {
    const s = stats[i];
    const part = s.F + s.A + s.X;
    m.s = {
      n: s.n, f: s.F, a: s.A, x: s.X, nv: s.N,
      att: s.n ? round(part / s.n) : null,
      attMain: s.mainN ? round(s.mainP / s.mainN) : null,
      loy: s.loyalN ? round(s.loyal / s.loyalN) : null,
    };
    fs.writeFileSync(path.join(OUT, 'm', `${m.id}.json`), JSON.stringify({ p: memberStrings[i].join('') }));
  });

  /* -------- métadonnées */
  const usedCountries = new Set(mList.map((m) => m.c));
  const usedGroups = new Set(mList.map((m) => m.g));
  for (const g of groupsSeen) usedGroups.add(g);
  const usedCommittees = new Set(voteOut.flatMap((v) => v.cm || []));
  const usedGeo = new Set(voteOut.flatMap((v) => v.geo || []));
  const meta = {
    updated,
    built: new Date().toISOString(),
    termStart: TERM_START,
    termEnd: TERM_END,
    term: TERM,
    mainOnly: MAIN_ONLY,
    counts: { votes: votes.length, published: voteOut.length, main: voteOut.filter((v) => v.mn).length, members: mList.length, active: mList.filter((m) => m.a).length },
    countries: countries.filter((c) => usedCountries.has(c.code)).map((c) => ({ code: c.code, a2: c.iso_alpha_2, en: c.label })),
    groups: groups.filter((g) => usedGroups.has(g.code)).map((g) => ({
      code: g.code, label: g.label, short: g.short_label,
      seats: mList.filter((m) => m.a && m.g === g.code).length,
      coh: groupCoh[g.code] ? round(groupCoh[g.code].sum / groupCoh[g.code].n) : null,
    })),
    committees: [...usedCommittees].map((c) => ({ code: c, en: committees.get(c)?.label || c })),
    agree: Object.fromEntries(Object.entries(agree).filter(([, [, n]]) => n >= 20).map(([k, [a, n]]) => [k, round(a / n)])),
    geo: [...usedGeo].map((g) => ({ code: g, en: geoAreas.get(g)?.label || g, a2: geoAreas.get(g)?.iso_alpha_2 || null })),
  };

  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta));
  fs.writeFileSync(path.join(OUT, 'members.json'), JSON.stringify(mList.map(clean)));
  fs.writeFileSync(path.join(OUT, 'votes.json'), JSON.stringify(voteOut));
  console.log(`Écrit dans ${OUT}`);
  console.timeEnd('build');
}

function round(x) { return Math.round(x * 1000) / 1000; }
function clean(o) { for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null) delete o[k]; return o; }

main().catch((e) => { console.error(e); process.exit(1); });
