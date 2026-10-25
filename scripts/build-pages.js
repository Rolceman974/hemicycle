#!/usr/bin/env node
/*
 * Hemicycle — pages statiques pour les moteurs de recherche et le partage
 *
 *   node scripts/build-pages.js site _site
 *
 * Copie le site dans le dossier de sortie, puis y ajoute :
 *   - une vraie page HTML par eurodéputé et par vote final (titre, description, contenu lisible
 *     par Google, balises de partage), aux adresses depute/<id>/ et vote/<id>/ (archives : archive/9/…) ;
 *   - une image de partage par page (og/…png), affichée sur WhatsApp, LinkedIn, X… ;
 *   - sitemap.xml et robots.txt.
 * Le navigateur charge ensuite l'application normale, qui reprend la main sur la page.
 *
 * L'adresse publique du site (SITE_URL, par ex. https://myhemicycle.eu) sert aux liens absolus
 * exigés par les réseaux sociaux et le sitemap. GitHub Actions la fournit automatiquement.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const [, , SRC = 'site', OUT = '_site'] = process.argv;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const abs = (p) => (SITE_URL ? `${SITE_URL}/${p}` : p);

global.window = {};
require(path.resolve(SRC, 'i18n.js'));
require(path.resolve(SRC, 'explain.js'));
require(path.resolve(SRC, 'themes.js'));
const EN = window.HEMI_I18N.en;
const EX = window.HEMI_EXPLAIN;

/* ------------------------------------------------------------ utilitaires */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (a, b, c) => b + c.toUpperCase());
const fullName = (m) => `${m.fn} ${titleCase(m.ln)}`;
const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const fmt = (n) => Number(n).toLocaleString('en-GB');
const dateLong = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const json = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const rssDate = (t) => new Date(`${t}${/Z|[+-]\d\d:?\d\d$/.test(t) ? '' : 'Z'}`).toUTCString();
// mise en page lisible quand un flux est ouvert dans un navigateur (site/feed.xsl)
const XSL = `${SITE_URL ? new URL(SITE_URL).pathname.replace(/\/$/, '') : ''}/feed.xsl`;
function rss({ title, link, desc, items }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="${XSL}"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
  <title>${esc(title)}</title><link>${esc(link)}</link><description>${esc(desc)}</description><language>en</language>
${items.map((it) => `  <item><title>${esc(it.title)}</title><link>${esc(it.link)}</link><guid isPermaLink="true">${esc(it.link)}</guid><pubDate>${rssDate(it.date)}</pubDate><description>${esc(it.desc)}</description></item>`).join('\n')}
</channel></rss>
`;
}

/* ------------------------------------------------------------ copie du site */
const CHILD = Boolean(process.env.HEMI_SKIP_PAGES);
if (!CHILD) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.cpSync(SRC, OUT, { recursive: true });
}
/* ------------------------------------------------------------ fichiers allégés et versionnés */
// Les scripts et la feuille de style sont minifiés (esbuild) et reçoivent un numéro de version
// tiré de leur contenu : après chaque mise à jour, les navigateurs chargent la nouvelle version.
const ASSETS = ['styles.css', 'i18n.js', 'groups-info.js', 'groups-old.js', 'explain.js', 'themes.js', 'guide.js', 'about.js', 'europe.js', 'app.js'];
if (!CHILD) {
  let esbuild = null;
  try { esbuild = require('esbuild'); } catch { console.warn('esbuild absent : fichiers copiés sans minification.'); }
  const crypto = require('crypto');
  let html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  for (const f of ASSETS) {
    const file = path.join(OUT, f);
    if (!fs.existsSync(file)) continue;
    if (esbuild) {
      const src = fs.readFileSync(file, 'utf8');
      const r = esbuild.transformSync(src, { loader: f.endsWith('.css') ? 'css' : 'js', minify: true, target: f.endsWith('.css') ? ['chrome100', 'safari15', 'firefox100'] : 'es2020', legalComments: 'none' });
      fs.writeFileSync(file, r.code);
    }
    const v = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
    html = html.replace(new RegExp(`(src|href)="${f.replace('.', '\\.')}"`, 'g'), `$1="${f}?v=${v}"`);
    if (f === 'europe.js') {
      // chargé à la demande par app.js
      const app = path.join(OUT, 'app.js');
      fs.writeFileSync(app, fs.readFileSync(app, 'utf8').replace(/(['"`])europe\.js\1/g, `$1europe.js?v=${v}$1`));
    }
  }
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  // application hors connexion : le service worker reçoit la liste exacte des fichiers versionnés
  const swFile = path.join(OUT, 'sw.js');
  // version « application » coupée (site/about.js : HEMI_APP = false) : ni service worker ni manifeste publiés
  const appOn = /window\.HEMI_APP\s*=\s*true/.test(fs.readFileSync(path.join(SRC, 'about.js'), 'utf8'));
  if (!appOn) for (const f of ['sw.js', 'manifest.webmanifest']) fs.rmSync(path.join(OUT, f), { force: true });
  if (appOn && fs.existsSync(swFile)) {
    const versioned = [...html.matchAll(/(?:src|href)="([^"]+\?v=[0-9a-f]+)"/g)].map((m) => m[1]);
    const europe = (fs.readFileSync(path.join(OUT, 'app.js'), 'utf8').match(/europe\.js\?v=[0-9a-f]+/) || [])[0];
    const shellList = ['./', 'index.html', ...versioned, ...(europe ? [europe] : []), 'favicon.svg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
      ...[400, 500, 600, 700, 800].map((w) => `fonts/manrope-latin-${w}-normal.woff2`), 'data/meta.json', 'data/members.json'];
    const swVersion = crypto.createHash('sha1').update(shellList.join('|')).digest('hex').slice(0, 10);
    let sw = fs.readFileSync(swFile, 'utf8')
      .replace(/const VERSION = '[^']*';/, `const VERSION = '${swVersion}';`)
      .replace(/const SHELL = \[[^\]]*\];/, `const SHELL = ${JSON.stringify(shellList)};`);
    if (esbuild) sw = esbuild.transformSync(sw, { loader: 'js', minify: true, target: 'es2020', legalComments: 'none' }).code;
    fs.writeFileSync(swFile, sw);
  }
}
const shell = fs.readFileSync(path.join(CHILD ? SRC : OUT, 'index.html'), 'utf8');

/* page générée : même coquille que index.html, avec ses propres balises et son contenu */
function page({ route, depth, title, desc, image, body }) {
  const base = '../'.repeat(depth);
  const url = abs(`${route}/`);
  let h = shell
    .replace('<html lang="fr"', `<html lang="en" data-route="${esc(route)}"`)
    .replace(/<html lang="([a-z]+)"(?! data-route)/, `<html lang="$1" data-route="${esc(route)}"`)
    .replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <base href="${base}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} — Hemicycle</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(abs(image))}">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">`)
    .replace('<meta property="og:locale" content="fr_BE">', '<meta property="og:locale" content="en_GB">')
    .replace(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="article">${SITE_URL ? `\n  <meta property="og:url" content="${esc(url)}">\n  <link rel="canonical" href="${esc(url)}">` : ''}\n  <meta name="hemi-pages" content="1">`);
  h = h.replace(/<main id="main"([^>]*)>[\s\S]*?<\/main>/, `<main id="main"$1>\n${body}\n  </main>`);
  return h;
}

/* ------------------------------------------------------------ images de partage (1200 × 630) */
let Resvg = null; let fontFiles = [];
try {
  ({ Resvg } = require('@resvg/resvg-js'));
  const dir = path.dirname(require.resolve('@expo-google-fonts/manrope/package.json'));
  fontFiles = ['500Medium/Manrope_500Medium.ttf', '700Bold/Manrope_700Bold.ttf', '800ExtraBold/Manrope_800ExtraBold.ttf'].map((f) => path.join(dir, f));
} catch (e) {
  console.warn('Images de partage désactivées (installez les dépendances avec « npm install ») :', e.message);
  Resvg = null;
}
module.exports.fontsReady = Promise.resolve();

const NAVY = '#0B1F4D', GOLD = '#F5C400', MUTED = '#B9C4E4';
function seatsMark(x, y, s) {
  // logo : 27 sièges dorés (un par État membre), sur trois rangées de 7, 9 et 11
  let out = '';
  for (const [r, n] of [[11, 7], [17.5, 9], [24, 11]]) for (let k = 0; k < n; k++) {
    const a = Math.PI - (k * Math.PI) / (n - 1);
    out += `<circle cx="${(x + s * (32 + r * Math.cos(a))).toFixed(1)}" cy="${(y + s * (44 - r * Math.sin(a))).toFixed(1)}" r="${(s * 2.5).toFixed(1)}" fill="${GOLD}"/>`;
  }
  return out;
}
// découpe un texte en lignes d'environ maxCh caractères
function lines(text, maxCh, maxLines) {
  const words = String(text).split(/\s+/); const out = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxCh && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}
// « (c) » serait remplacé par « © » (ligature de la police) : on intercale un antiliant invisible
const noLig = (t) => String(t).replace(/\((c|r|tm)\)/gi, '(\u200C$1)');
const tspan = (ls, x, y0, lh) => ls.map((l, i) => `<tspan x="${x}" y="${y0 + i * lh}">${esc(noLig(l))}</tspan>`).join('');

function cardSvg({ kicker, title, sub, badge, badgeColor, figures, bar }) {
  const tl = lines(title, title.length > 70 ? 34 : 28, 3);
  const size = tl.length > 2 ? 54 : 62;
  let y = 250;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${NAVY}"/>`;
  s += `<g>${seatsMark(72, 46, 1.25)}</g><text x="168" y="104" font-family="Manrope" font-weight="800" font-size="34" fill="#fff">Hemicycle</text>`;
  s += `<text x="80" y="190" font-family="Manrope" font-weight="500" font-size="28" fill="${MUTED}">${esc(kicker)}</text>`;
  s += `<text font-family="Manrope" font-weight="800" font-size="${size}" fill="#fff" letter-spacing="-1">${tspan(tl, 80, y, size * 1.14)}</text>`;
  y += (tl.length - 1) * size * 1.14 + 62;
  if (sub) { const sl = lines(sub, 62, 2); s += `<text font-family="Manrope" font-weight="500" font-size="28" fill="${MUTED}">${tspan(sl, 80, y, 38)}</text>`; y += sl.length * 38 + 10; }
  if (badge) {
    const w = 30 + badge.length * 19;
    s += `<rect x="80" y="${520}" width="${w}" height="56" rx="10" fill="${badgeColor}"/><text x="${80 + w / 2}" y="${558}" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="30" fill="#fff">${esc(badge)}</text>`;
  }
  if (bar) {
    const [f, a, x] = bar; const tot = f + a + x || 1; const X0 = 80 + (badge ? 60 + badge.length * 19 : 0) + 30, W = 1120 - X0;
    let cx = X0;
    for (const [v, c] of [[f, '#1F9D6B'], [x, '#D89A16'], [a, '#D23F4A']]) { const w = (v / tot) * W; s += `<rect x="${cx.toFixed(1)}" y="532" width="${w.toFixed(1)}" height="14" fill="${c}"/>`; cx += w; }
    s += `<text x="${X0}" y="${578}" font-family="Manrope" font-weight="700" font-size="24" fill="#fff">${fmt(f)} for · ${fmt(a)} against · ${fmt(x)} abstentions</text>`;
  }
  if (figures) {
    let fx = 80;
    for (const [v, l] of figures) {
      s += `<text x="${fx}" y="540" font-family="Manrope" font-weight="800" font-size="58" fill="#fff">${esc(v)}</text><text x="${fx}" y="580" font-family="Manrope" font-weight="500" font-size="24" fill="${MUTED}">${esc(l)}</text>`;
      fx += 330;
    }
  }
  return s + '</svg>';
}
const images = [];
function image(file, spec) {
  images.push([file, spec]);
  return file;
}

/* ------------------------------------------------------------ données */
const TERMS = [
  { n: 10, dir: 'data', prefix: '', years: '2024–2029' },
  { n: 9, dir: 'data/t9', prefix: 'archive/9/', years: '2019–2024' },
];
const sitemap = [''];
let nPages = 0;

for (const T of CHILD ? [] : TERMS) {
  const base = path.join(SRC, T.dir);
  if (!fs.existsSync(path.join(base, 'votes.json'))) continue;
  const meta = json(path.join(base, 'meta.json'));
  const members = json(path.join(base, 'members.json'));
  const votes = json(path.join(base, 'votes.json'));
  const topics = fs.existsSync(path.join(base, 'topics.json')) ? json(path.join(base, 'topics.json')) : {};
  const details = fs.existsSync(path.join(base, 'details.json')) ? json(path.join(base, 'details.json')) : {};
  const cName = (c) => meta.countries.find((x) => x.code === c)?.en || c;
  const gLong = (g) => (EN.groupsMap[g] || [])[1] || meta.groups.find((x) => x.code === g)?.label || g;
  const gShort = (g) => (EN.groupsMap[g] || [])[0] || meta.groups.find((x) => x.code === g)?.short || g;
  const depthOf = (route) => route.split('/').length;
  const termLabel = `European Parliament, ${T.years} term`;
  const byId = new Map(members.map((m) => [m.id, m]));

  /* ---- eurodéputés */
  for (const m of members) {
    const route = `${T.prefix}depute/${m.id}`;
    const name = fullName(m);
    const s = m.s || {};
    const desc = `How ${name} (${gShort(m.g)}, ${cName(m.c)}) votes in the European Parliament: attendance ${pct(s.att)}, loyalty to the group ${pct(s.loy)}, and every roll-call vote of the ${T.years} term.`;
    const img = image(`og/${T.prefix}depute/${m.id}.png`, {
      kicker: `${gLong(m.g)} · ${cName(m.c)}`, title: name, sub: m.pl || m.p || '',
      figures: [[pct(s.att), 'attendance'], [pct(s.loy), 'group loyalty'], [fmt((s.f || 0) + (s.a || 0) + (s.x || 0)), 'votes cast']],
    });
    const body = `    <article class="static">
      <p class="kicker">${esc(termLabel)}</p>
      <h1 class="h1">${esc(name)}</h1>
      <p class="lede">${esc(gLong(m.g))} · ${esc(cName(m.c))}${m.pl ? ` · ${esc(m.pl)}` : ''}</p>
      <ul>
        <li>Voting attendance: ${pct(s.att)}</li>
        <li>Loyalty to the political group: ${pct(s.loy)}</li>
        <li>Roll-call votes during the term: ${fmt(s.n || 0)} (${fmt(s.f || 0)} for, ${fmt(s.a || 0)} against, ${fmt(s.x || 0)} abstentions)</li>
      </ul>
      <p><a href="#/${T.prefix}depute/${m.id}">See all votes by ${esc(name)}</a></p>
    </article>`;
    write(path.join(OUT, route, 'index.html'), page({ route, depth: depthOf(route), title: `${name} — votes in the European Parliament`, desc, image: img, body }));
    sitemap.push(`${route}/`); nPages++;
  }

  /* ---- votes finaux */
  for (const v of votes) {
    if (!v.mn) continue;
    const route = `${T.prefix}vote/${v.id}`;
    const tp = topics[v.pr || v.ti];
    const topic = tp ? cap(tp[1]) : '';
    const R = v.r || (v.c[0] > v.c[1] ? 'ADOPTED' : 'REJECTED');
    const res = EN.result[R] || R;
    const desc = clip(`${topic ? `${topic}. ` : ''}${res} by the European Parliament on ${dateLong(v.t)}: ${fmt(v.c[0])} for, ${fmt(v.c[1])} against, ${fmt(v.c[2])} abstentions. See how each MEP and political group voted.`, 300);
    const img = image(`og/${T.prefix}vote/${v.id}.png`, {
      kicker: `European Parliament · ${dateLong(v.t)}`, title: topic || v.ti, sub: topic ? v.ti : '',
      badge: res, badgeColor: R === 'ADOPTED' ? '#1F9D6B' : R === 'REJECTED' ? '#D23F4A' : '#6B7280', bar: v.c,
    });
    const body = `    <article class="static">
      <p class="kicker">Votes · ${esc(dateLong(v.t))}</p>
      <h1 class="h1">${esc(v.ti)}</h1>
      ${topic ? `<p class="lede">${esc(EX.en.about(tp[1]))}</p>` : ''}
      ${details[v.pr] ? `<h2>Background</h2><p>${esc(details[v.pr].en.c)}</p><ul>${details[v.pr].en.p.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p><strong>${esc(res)}</strong>: ${fmt(v.c[0])} for, ${fmt(v.c[1])} against, ${fmt(v.c[2])} abstentions, ${fmt(v.c[3] || 0)} did not vote.</p>
      ${v.ref ? `<p>Reference: ${esc(v.ref)}</p>` : ''}
      <p><a href="#/${T.prefix}vote/${v.id}">See how each MEP voted</a></p>
    </article>`;
    write(path.join(OUT, route, 'index.html'), page({ route, depth: depthOf(route), title: topic ? clip(`${topic}`, 90) : clip(v.ti, 90), desc, image: img, body }));
    sitemap.push(`${route}/`); nPages++;
  }
  void byId;

  if (T.n !== 10) continue;
  const resOf = (v) => v.r || (v.c[0] > v.c[1] ? 'ADOPTED' : 'REJECTED');
  const vTitle = (v) => { const tp = topics[v.pr || v.ti]; return tp ? cap(tp[1]) : v.ti; };
  const finals = votes.filter((v) => v.mn);

  /* ---- flux RSS : derniers votes finaux, et votes de chaque eurodéputé en fonction */
  write(path.join(OUT, 'feed.xml'), rss({
    title: 'Hemicycle — latest final votes in the European Parliament', link: abs(''), desc: 'Every final roll-call vote in the European Parliament, with the result and how each group voted.',
    items: finals.slice(0, 60).map((v) => ({ title: vTitle(v), link: abs(`vote/${v.id}/`), date: v.t,
      desc: `${EN.result[resOf(v)] || resOf(v)}: ${fmt(v.c[0])} for, ${fmt(v.c[1])} against, ${fmt(v.c[2])} abstentions. ${v.ti}` })),
  }));
  const POS = { F: 'voted for', A: 'voted against', X: 'abstained', N: 'did not vote' };
  let nFeeds = 1;
  for (const m of members) {
    if (!m.a) continue;
    const f = path.join(base, 'm', `${m.id}.json`);
    if (!fs.existsSync(f)) continue;
    const P = json(f).p;
    const items = [];
    for (let i = 0; i < votes.length && items.length < 40; i++) {
      const v = votes[i], ch = (P[i] || '.').toUpperCase();
      if (!v.mn || ch === '.') continue;
      items.push({ title: `${POS[ch] ? cap(POS[ch]) : ch}: ${vTitle(v)}`, link: abs(`vote/${v.id}/`), date: v.t,
        desc: `${fullName(m)} ${POS[ch] || ''}. Result: ${EN.result[resOf(v)] || resOf(v)} (${fmt(v.c[0])} for, ${fmt(v.c[1])} against, ${fmt(v.c[2])} abstentions). ${v.ti}` });
    }
    write(path.join(OUT, 'depute', String(m.id), 'feed.xml'), rss({ title: `${fullName(m)} — votes in the European Parliament (Hemicycle)`, link: abs(`depute/${m.id}/`), desc: `Final roll-call votes cast by ${fullName(m)}.`, items }));
    nFeeds++;
  }
  console.log(`${nFeeds} flux RSS`);

  /* ---- pages thèmes et pays (contenu statique pour les moteurs de recherche) */
  for (const th of window.HEMI_THEMES) {
    const list = finals.filter((v) => { const tp = topics[v.pr || v.ti]; return (v.cm || []).some((c) => th.cm.includes(c)) || th.re.test(`${v.ti} ${v.pt || ''} ${tp ? tp[1] : ''}`); });
    const route = `theme/${th.id}`;
    const body = `    <article class="static">
      <p class="kicker">Topics</p>
      <h1 class="h1">${esc(th.name.en)}</h1>
      <p class="lede">${esc(th.intro.en)}</p>
      <p>${fmt(list.length)} final votes in the European Parliament since July 2024.</p>
      <ul>${list.slice(0, 20).map((v) => `<li><a href="#/vote/${v.id}">${esc(vTitle(v))}</a> (${esc(dateLong(v.t))})</li>`).join('')}</ul>
    </article>`;
    write(path.join(OUT, route, 'index.html'), page({ route, depth: 2, title: `${th.name.en} — votes in the European Parliament`, desc: `${th.intro.en} ${fmt(list.length)} final votes, and where each political group stood.`, image: 'og-image.png', body }));
    sitemap.push(`${route}/`); nPages++;
  }
  // partis nationaux
  const realParty = (p) => !!p && !/^(independ|indépend|onafhankelijk|-)/i.test(p);
  const partyKeys = [...new Set(members.filter((m) => m.a && realParty(m.p)).map((m) => `${m.c}~${m.p}`))];
  for (const key of partyKeys) {
    const [c, p] = [key.slice(0, key.indexOf('~')), key.slice(key.indexOf('~') + 1)];
    const act = members.filter((m) => m.a && m.c === c && m.p === p);
    const name = act.find((m) => m.pl)?.pl || p;
    const route = `parti/${encodeURIComponent(key)}`;
    const body = `    <article class="static">
      <p class="kicker">${esc(cName(c))} · National party</p>
      <h1 class="h1">${esc(name)}${name !== p ? ` (${esc(p)})` : ''}</h1>
      <p class="lede">${act.length} ${act.length > 1 ? 'MEPs' : 'MEP'} in the ${esc(gLong(act[0].g))} group.</p>
      <ul>${act.map((m) => `<li><a href="#/depute/${m.id}">${esc(fullName(m))}</a></li>`).join('')}</ul>
    </article>`;
    write(path.join(OUT, 'parti', key.replace(/[\/\\?%*:|"<>]/g, '_'), 'index.html'), page({ route, depth: 2, title: `${name} (${cName(c)}) — MEPs and votes`, desc: `How the ${act.length} MEPs of ${name} (${cName(c)}, ${gShort(act[0].g)}) vote in the European Parliament: cohesion, agreement with their group and every final vote.`, image: 'og-image.png', body }));
    sitemap.push(`parti/${encodeURIComponent(key)}/`); nPages++;
  }
  for (const c of [...new Set(members.filter((m) => m.a).map((m) => m.c))]) {
    const act = members.filter((m) => m.a && m.c === c);
    const route = `pays/${c}`;
    const body = `    <article class="static">
      <p class="kicker">Countries · national delegation</p>
      <h1 class="h1">${esc(cName(c))}</h1>
      <p class="lede">${act.length} MEPs from ${esc(cName(c))} in the European Parliament.</p>
      <ul>${act.map((m) => `<li><a href="#/depute/${m.id}">${esc(fullName(m))}</a> (${esc(gShort(m.g))}${m.p ? `, ${esc(m.p)}` : ''})</li>`).join('')}</ul>
    </article>`;
    write(path.join(OUT, route, 'index.html'), page({ route, depth: 2, title: `${cName(c)} — MEPs and votes in the European Parliament`, desc: `The ${act.length} MEPs from ${cName(c)}: their political groups, attendance and how the delegation votes.`, image: 'og-image.png', body }));
    sitemap.push(`${route}/`); nPages++;
  }
  // pages fixes : le test « Qui me ressemble ? » et la Belgique en détail
  for (const [route, title, desc, h] of [
    ['quiz', 'Qui me ressemble ? — the European Parliament voting quiz', 'Take a position on texts actually voted on by the European Parliament and find the political groups, national parties and MEPs who vote like you.', 'Who matches me? The European Parliament voting quiz'],
    ['belgique', 'Belgium in the European Parliament — how the 22 Belgian MEPs vote', 'The French-speaking, Dutch-speaking and German-speaking colleges: how Belgian MEPs vote, when they agree and which votes split them.', 'Belgium in the European Parliament'],
  ]) {
    const body = `    <article class="static"><h1 class="h1">${esc(h)}</h1><p class="lede">${esc(desc)}</p></article>`;
    write(path.join(OUT, route, 'index.html'), page({ route, depth: 1, title, desc, image: 'og-image.png', body }));
    sitemap.push(`${route}/`); nPages++;
  }
}

/* ------------------------------------------------------------ racine, sitemap, robots */
// la page d'accueil signale aussi que les adresses « jolies » existent (utilisé par le bouton Partager)
if (!CHILD) {
const rootHtml = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8')
  .replace(/<meta property="og:image" content="og-image.png">/, `<meta property="og:image" content="${esc(abs('og-image.png'))}">`)
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="hemi-pages" content="1">\n  <link rel="alternate" type="application/rss+xml" title="Hemicycle — latest final votes" href="feed.xml">');
const ld = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Hemicycle', url: abs(''), inLanguage: ['en', 'fr', 'nl'],
  description: 'Every roll-call vote in the European Parliament, MEP by MEP, explained in plain language.', author: { '@type': 'Person', name: 'Semih Biondolillo' } };
write(path.join(OUT, 'index.html'), rootHtml.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(SITE_URL ? abs('og-image.png') : 'og-image.png')}">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">`).replace('<meta name="hemi-pages" content="1">', SITE_URL ? `<meta name="hemi-pages" content="1">\n  <link rel="canonical" href="${esc(abs(''))}">\n  <meta property="og:url" content="${esc(abs(''))}">` : '<meta name="hemi-pages" content="1">').replace('</head>', `  <script type="application/ld+json">${JSON.stringify(ld)}</script>\n</head>`));
// page d'erreur de GitHub Pages : l'application affiche « page introuvable » avec le menu du site
const base404 = SITE_URL ? new URL(`${SITE_URL}/`).pathname : '/';
write(path.join(OUT, '404.html'), rootHtml.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <base href="${base404}">\n  <meta name="robots" content="noindex">`).replace(/<html lang="([a-z]+)"/, '<html lang="$1" data-route="404"'));
if (SITE_URL) {
  write(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((u) => `  <url><loc>${esc(abs(u))}</loc></url>`).join('\n')}\n</urlset>\n`);
  // nom de domaine personnalisé (hors github.io) : fichier CNAME pour GitHub Pages
  const host = new URL(SITE_URL).hostname;
  if (!/github\.io$/.test(host) && !/^(localhost|127\.)/.test(host)) write(path.join(OUT, 'CNAME'), `${host}\n`);
  write(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
} else {
  console.warn('SITE_URL non défini : pas de sitemap.xml, et les liens de partage restent relatifs.');
}
}

// Les images sont rendues par lots dans des processus séparés : resvg garde sa mémoire native
// jusqu'à la fin du processus, ce qui ferait déborder la mémoire sur des milliers d'images.
if (process.env.HEMI_RENDER_BATCH) {
  (async () => {
    await module.exports.fontsReady;
    const batch = JSON.parse(fs.readFileSync(process.env.HEMI_RENDER_BATCH, 'utf8'));
    for (const [file, spec] of batch) {
      const png = new Resvg(cardSvg(spec), { fitTo: { mode: 'width', value: 1200 }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Manrope' } }).render().asPng();
      write(path.join(OUT, file), png);
    }
  })();
} else {
  (async () => {
    if (Resvg) {
      await module.exports.fontsReady;
      const { execFileSync } = require('child_process');
      const os = require('os');
      const t0 = Date.now();
      const SIZE = 250;
      for (let i = 0; i < images.length; i += SIZE) {
        const f = path.join(os.tmpdir(), `hemicycle-batch-${process.pid}.json`);
        fs.writeFileSync(f, JSON.stringify(images.slice(i, i + SIZE)));
        execFileSync(process.execPath, [__filename, SRC, OUT], { env: { ...process.env, HEMI_RENDER_BATCH: f, HEMI_SKIP_PAGES: '1' }, stdio: 'inherit' });
        fs.rmSync(f, { force: true });
      }
      console.log(`${images.length} images de partage en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    console.log(`${nPages} pages générées dans ${OUT}/`);
  })();
}
