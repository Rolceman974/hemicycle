#!/usr/bin/env node
/*
 * Hemicycle — calendrier des prochaines sessions plénières et ordre du jour provisoire
 *
 *   node scripts/build-agenda.js site/data/agenda.json
 *
 * Sources :
 *   - dates des sessions : API de HowTheyVote.eu (https://howtheyvote.eu/api/sessions)
 *   - ordre du jour : API de données ouvertes du Parlement européen
 *     (https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-AAAA-MM-JJ/foreseen-activities),
 *     publié environ une semaine avant chaque session et modifiable jusqu'au jour du vote.
 *
 * En cas d'erreur réseau, le fichier existant est conservé.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'site/data/agenda.json';
const LANGS = ['en', 'fr', 'nl'];
const HORIZON_DAYS = 45; // au-delà, l'ordre du jour n'est pas encore publié

async function getJSON(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/ld+json, application/json' } });
      if (r.status === 204 || r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const txt = await r.text();
      return txt.trim() ? JSON.parse(txt) : null;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
}

// libellé multilingue : {en: "…"} ou [{"@language": "en", "@value": "…"}]
function label(x) {
  const out = {};
  if (!x) return out;
  if (Array.isArray(x)) { for (const v of x) if (v && v['@language']) out[v['@language'].toLowerCase()] = v['@value']; }
  else if (typeof x === 'object') for (const [k, v] of Object.entries(x)) out[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
  else out.en = String(x);
  const res = {};
  for (const l of LANGS) if (out[l]) res[l] = String(out[l]).replace(/\s+/g, ' ').trim();
  return res;
}
const asList = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const idOf = (x) => (typeof x === 'string' ? x : x && (x.id || x['@id'])) || '';

// points de procédure, sans intérêt pour le lecteur
const SKIP = /^(\(possibly\)\s*)?(resumption of|closure of|opening of|approval of the minutes|order of business|one-minute speeches|explanations of votes|question time|composition of|announcement|voting time|formal sitting|corrigend|calendar of part-sessions|votes on requests for urgent procedure|request for urgent procedure|decision on urgent procedure|agenda of the next sitting)/i;

// A-10-2026-0267 → A10-0267/2026
const docRef = (id) => { const m = /\/doc\/([ABC])-(\d+)-(\d{4})-(\d+)$/.exec(id); return m ? `${m[1]}${m[2]}-${m[4]}/${m[3]}` : null; };

async function dayAgenda(day) {
  const url = `https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-${day}/foreseen-activities?format=application%2Fld%2Bjson&offset=0&limit=500`;
  const j = await getJSON(url);
  const items = j ? asList(j.data || j['@graph']) : [];
  const votes = new Map(), debates = new Map();
  for (const it of items) {
    const type = idOf(it.had_activity_type);
    const m = /OJ-ITM-([DV])-(\d+)/.exec(idOf(it));
    if (!m) continue;
    const t = label(it.activity_label);
    if (!t.en || SKIP.test(t.en)) continue;
    const n = Number(it.notation_agendaPoint || m[2]) || Number(m[2]);
    const docs = [...new Set(asList(it.documented_by_a_realization_of).concat(asList(it.based_on_a_realization_of)).map((d) => docRef(idOf(d))).filter(Boolean))];
    const entry = { n, t, ...(docs.length ? { docs } : {}) };
    if (/PLENARY_VOTE/.test(type) || m[1] === 'V') votes.set(n, entry);
    else if (/PLENARY_DEBATE/.test(type)) debates.set(n, entry);
  }
  const byN = (a, b) => a.n - b.n;
  return { d: day, votes: [...votes.values()].sort(byN), debates: [...debates.values()].sort(byN) };
}

function daysBetween(a, b) {
  const out = [];
  for (let d = new Date(`${a}T12:00:00Z`); d <= new Date(`${b}T12:00:00Z`); d = new Date(d.getTime() + 864e5)) out.push(d.toISOString().slice(0, 10));
  return out;
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* premier passage */ }

  // 1. calendrier
  let sessions = [];
  try {
    for (let page = 1; page < 50; page++) {
      const j = await getJSON(`https://howtheyvote.eu/api/sessions?page=${page}`);
      if (!j) break;
      sessions.push(...asList(j.results));
      if (!j.has_next) break;
    }
  } catch (e) {
    console.warn('Calendrier indisponible :', e.message);
    if (previous) { console.log('Fichier existant conservé.'); return; }
    throw e;
  }
  sessions = sessions.filter((s) => s.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 14);

  // 2. ordre du jour des sessions proches
  const horizon = new Date(Date.now() + HORIZON_DAYS * 864e5).toISOString().slice(0, 10);
  const out = [];
  for (const s of sessions) {
    const row = { id: s.id, start: s.start_date, end: s.end_date, loc: s.location || null, days: null };
    if (s.start_date <= horizon) {
      try {
        const days = [];
        for (const d of daysBetween(s.start_date, s.end_date)) {
          const a = await dayAgenda(d);
          if (a.votes.length || a.debates.length) days.push(a);
        }
        row.days = days.length ? days : null;
      } catch (e) {
        console.warn(`Ordre du jour ${s.id} indisponible :`, e.message);
        const old = previous && previous.sessions.find((x) => x.id === s.id);
        if (old) row.days = old.days;
      }
    }
    out.push(row);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), sessions: out }));
  const withAgenda = out.filter((s) => s.days);
  console.log(`${out.length} sessions à venir, ${withAgenda.length} avec ordre du jour (${withAgenda.reduce((n, s) => n + s.days.reduce((k, d) => k + d.votes.length, 0), 0)} votes prévus)`);
})().catch((e) => { console.error(e); process.exit(1); });
