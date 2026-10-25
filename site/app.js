/* Hemicycle — application (JavaScript sans dépendance). Textes de l'interface : i18n.js */
(() => {
  'use strict';

  const I18N = window.HEMI_I18N;

  /* ================================================================ langue */
  const LANGS = ['fr', 'en', 'nl'];
  const LOCALE = { fr: 'fr-BE', en: 'en-GB', nl: 'nl-BE' };
  let lang = (() => {
    try { const s = localStorage.getItem('hemi-lang'); if (LANGS.includes(s)) return s; } catch { /* stockage indisponible */ }
    // première visite : la langue de l'appareil (Wallonie et Bruxelles → français, Flandre → néerlandais, ailleurs → anglais).
    // On se fie à la langue réglée sur l'appareil plutôt qu'à l'adresse IP : rien n'est envoyé à un service de localisation.
    try {
      const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map((x) => String(x).toLowerCase());
      for (const p of prefs) {
        if (p.startsWith('fr') || p === 'wa' || p.startsWith('wa-')) return 'fr';
        if (p.startsWith('nl') || p === 'vls' || p === 'li') return 'nl';
        if (p.startsWith('en')) return 'en';
      }
    } catch { /* ignore */ }
    return 'en'; // langue par défaut
  })();
  function t(key, ...args) {
    const v = I18N[lang][key] ?? I18N.fr[key];
    if (v === undefined) return key;
    return typeof v === 'function' ? v(...args) : v;
  }
  const loc = () => LOCALE[lang];
  let regionNames = null;
  function setRegionNames() { try { regionNames = new Intl.DisplayNames([lang], { type: 'region' }); } catch { regionNames = null; } }
  setRegionNames();

  /* ================================================================ libellés de référence */
  const GROUP_ORDER = ['GUE_NGL', 'GREEN_EFA', 'SD', 'RENEW', 'EPP', 'ECR', 'PFE', 'ESN', 'ID', 'NI'];
  const POS_ORDER = ['F', 'X', 'A', 'N'];

  /* ================================================================ outils */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // « (c) » deviendrait « © » avec la police Manrope : un antiliant invisible l'empêche
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/\((c|r)\)/gi, '(&zwnj;$1)');
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const main = $('#main');
  const pct = (x, d = 0) => (x == null ? '–' : new Intl.NumberFormat(loc(), { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(x));
  const fmt = (n) => new Intl.NumberFormat(loc()).format(n);
  const dateLong = (d) => new Date(d).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' });
  const dateShort = (d) => new Date(d).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' });
  const collate = (a, b) => a.localeCompare(b, lang);

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(t('fileMissing', url));
    return r.json();
  }

  /* ================================================================ données (une réserve par législature) */
  const CURRENT = 10;
  const TERMS = { 10: { base: 'data/', years: '2024–2029' }, 9: { base: 'data/t9/', years: '2019–2024' } };
  const stores = {};
  let term = CURRENT;
  let D = null;
  function storeOf(tn) {
    if (!stores[tn]) {
      stores[tn] = {
        t: tn, base: TERMS[tn].base, meta: null, members: null, votes: null,
        mById: new Map(), vById: new Map(), vIdx: new Map(), groups: new Map(), countries: new Map(),
        mFiles: new Map(), vFiles: new Map(), avg: null, boot: null, votesP: null,
      };
    }
    return stores[tn];
  }
  function useTerm(tn) { term = tn; D = storeOf(tn); }
  useTerm(CURRENT);
  const TP = () => (term === CURRENT ? '' : `archive/${term}/`); // préfixe des liens internes
  const archived = () => term !== CURRENT;

  function loadBase(S = D) {
    if (!S.boot) {
      S.boot = Promise.all([getJSON(`${S.base}meta.json`), getJSON(`${S.base}members.json`)]).then(([meta, members]) => {
        S.meta = meta; S.members = members;
        members.forEach((m, i) => { m.i = i; S.mById.set(m.id, m); m.key = norm(`${m.fn} ${m.ln}`); });
        for (const g of meta.groups) S.groups.set(g.code, g);
        for (const c of meta.countries) S.countries.set(c.code, c);
        const act = members.filter((m) => m.a && m.s.att != null);
        S.avg = { att: act.reduce((x, m) => x + m.s.att, 0) / act.length };
        if (S.t === CURRENT) paintChrome();
      });
    }
    return S.boot;
  }
  function loadVotes(S = D) {
    if (!S.votesP) {
      // sujets des votes en langage courant (topics.json), facultatifs
      const topicsP = getJSON(`${S.base}topics.json`).catch(() => ({}));
      // explications détaillées des votes clés (details.json), facultatives
      const detailsP = getJSON(`${S.base}details.json`).catch(() => ({}));
      // intitulés traduits en français et en néerlandais (titles.json), facultatifs
      const titlesP = getJSON(`${S.base}titles.json`).catch(() => ({}));
      S.votesP = Promise.all([getJSON(`${S.base}votes.json`), topicsP, detailsP, titlesP]).then(([votes, topics, details, titles]) => {
        S.votes = votes;
        votes.forEach((v, i) => {
          S.vById.set(v.id, v); S.vIdx.set(v.id, i);
          v.tp = topics[v.pr || v.ti] || null;
          v.dt = (v.pr && details[v.pr]) || null;
          v.tf = titles[v.ti] || null;
          v.key = norm(`${v.ti} ${v.tf ? v.tf.join(' ') : ''} ${v.pt || ''} ${v.ref || ''} ${v.pr || ''} ${v.tp ? v.tp.join(' ') : ''}`);
        });
        return votes;
      });
    }
    return S.votesP;
  }
  async function memberFile(id, S = D) {
    if (!S.mFiles.has(id)) S.mFiles.set(id, getJSON(`${S.base}m/${id}.json`));
    return S.mFiles.get(id);
  }
  async function voteFile(id, S = D) {
    if (!S.vFiles.has(id)) S.vFiles.set(id, getJSON(`${S.base}v/${id}.json`));
    return S.vFiles.get(id);
  }

  const groupNames = (g) => I18N[lang].groupsMap[g] || I18N.en.groupsMap[g] || [D.groups.get(g)?.short || g, D.groups.get(g)?.label || g];
  const gShort = (g) => groupNames(g)[0];
  const gLong = (g) => groupNames(g)[1];
  const gColor = (g) => `var(--g-${GROUP_ORDER.includes(g) ? g : 'NI'})`;
  const cName = (c) => {
    const x = D.countries.get(c);
    if (x && x.a2 && regionNames) { try { return regionNames.of(x.a2 === 'EL' ? 'GR' : x.a2); } catch { /* ignore */ } }
    return x ? x.en : c;
  };
  const comName = (c) => I18N[lang].committees[c] || D.meta.committees.find((x) => x.code === c)?.en || c;
  const geoName = (code) => {
    const g = D.meta.geo.find((x) => x.code === code);
    if (g && g.a2 && regionNames) { try { return regionNames.of(g.a2); } catch { /* ignore */ } }
    return g ? g.en : code;
  };
  const posName = (p) => t('pos')[p];
  const resName = (r) => t('result')[r];
  const ageOf = (dob) => { if (!dob) return null; const d = new Date(dob), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  const fullName = (m) => `${m.fn} ${titleCase(m.ln)}`;
  function titleCase(s) {
    return String(s).toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (a, b, c) => b + c.toUpperCase());
  }
  const initials = (m) => (m.fn[0] || '') + (m.ln[0] || '');
  const epLang = () => lang; // le site du Parlement existe dans les trois langues
  const epUrl = (id) => `https://www.europarl.europa.eu/meps/${epLang()}/${id}`;

  function photo(m, size = '') {
    // l'image est posée dans un rond qui recadre sur le visage ; tant qu'elle charge (ou si elle manque), on voit les initiales
    return `<span class="photo ${size}" aria-hidden="true">${esc(initials(m))}<img src="https://www.europarl.europa.eu/mepphoto/${m.id}.jpg" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')" onerror="this.remove()"></span>`;
  }

  const gdot = (g) => `<i class="gdot" style="background:${gColor(g)}"></i>`;

  // couleurs propres des partis nationaux (législature actuelle) ; sinon la couleur du groupe européen
  const PARTY_COLORS = {
    AUT: { 'FPÖ': '#005DA8', 'ÖVP': '#63C3D0', 'SPÖ': '#E31E2D', NEOS: '#E84188', 'Die Grünen': '#88B626' },
    BEL: { MR: '#0047AB', PS: '#E2001A', LesEng: '#00B2A9', ECOLO: '#3AAA35', 'PVDA-PTB': '#A3001E', CSP: '#F28C00', 'Vlaams Belang': '#FFE500', 'N-VA': '#F5B800', 'CD&V': '#FF7F00', Vooruit: '#FF2900', GROEN: '#83C341', Anders: '#0087DC' },
    BGR: { GERB: '#0054A6', DPS: '#0072BC', BSP: '#DB0F28' },
    CYP: { 'DI.SY.': '#1569C7', 'AKEL-ARISTERA-ND': '#C00000' },
    CZE: { 'ANO 2011': '#261060', ODS: '#004494', 'TOP09/STAN': '#7C0C7F', PIR: '#1A1A1A', 'KSČM': '#CC0000', 'KDU-ČSL': '#F7C600' },
    DEU: { CDU: '#1A1A1A', CSU: '#0080C8', AfD: '#009EE0', SPD: '#E3000F', 'GRÜNE.': '#46962B', FDP: '#FFED00', BSW: '#792351', 'DIE LINKE.': '#BE3075', 'Freie Wähler': '#F7A800', V: '#502379', 'Die PARTEI': '#B5152B', 'ÖDP': '#FF6600' },
    DNK: { A: '#A82721', F: '#E07EA8', V: '#254264', O: '#EAC73E', M: '#B48CD2', Enhedslisten: '#E6801A', I: '#3FB2BE', B: '#733280', C: '#00583C' },
    ESP: { PP: '#1D84CE', PSOE: '#E30613', 'PSC-PSOE': '#E30613', VOX: '#63BE21', PODEMOS: '#6A2E68', PNV: '#2D8E3D', 'Compromís': '#F07F00', BNG: '#76B4DD', ERC: '#FFB232', SMR: '#E51C55' },
    EST: { ER: '#FFE200', KE: '#007557', SDE: '#E10600' },
    FIN: { KOK: '#006288', VAS: '#F00A64', SDP: '#F54B4B', KESK: '#01954B', VIHR: '#61BF1A', SFP: '#FFDD00', Perus: '#FFDE55' },
    FRA: { RN: '#0D378A', PS: '#ED1651', LFI: '#CC2443', Ren: '#FFD600', 'Les Républicains': '#0066CC', 'Les Écologistes': '#00A85A', MoDem: '#FF9900' },
    GRC: { 'N.D.': '#005BAC', KINAL: '#00A651', KKE: '#E50000' },
    HRV: { HDZ: '#005BAA', SDP: '#E10E1A' },
    HUN: { 'Fidesz-KDNP': '#FD8204', DK: '#0067AA', MHM: '#688D1B' },
    IRL: { FF: '#66BB66', FG: '#6699FF', SF: '#326760', LABOUR: '#CC0000' },
    ITA: { FdL: '#003366', PD: '#EF1C27', M5S: '#FFEB3B', FI: '#0087DC', L: '#1E8F3A' },
    LTU: { LSDP: '#E10514' },
    LUX: { CSV: '#F28C00', LSAP: '#E3000F', DP: '#00A2E1', 'Déi Gréng': '#83C341' },
    MLT: { PN: '#1A4D9C', PL: '#E30613' },
    NLD: { PVV: '#1F3B73', VVD: '#FF7F0E', PRO: '#D7182A', D66: '#00AE41', CDA: '#007B5F', BBB: '#95C11F', Volt: '#502379', PvdD: '#006C2E', SGP: '#EA5B0C' },
    POL: { PiS: '#263778', KO: '#F68F2D', Konfederacja: '#122746', PSL: '#1BB100' },
    PRT: { PS: '#FF66C4', PSD: '#FF9000', AD: '#FF9000', IL: '#00ADEF', Chega: '#202056', BE: '#C90535', PCP: '#E30613', 'CDS-PP': '#0093DD' },
    ROU: { PSD: '#ED1B24', PNL: '#FFDD00', AUR: '#F2B705', USR: '#00A6FF', UDMR: '#15803C' },
    SVK: { PS: '#00BDFF', 'SMER-SD': '#D82222' },
    SWE: { S: '#E8112D', M: '#52BDEC', SD: '#DDDD00', MP: '#83CF39', C: '#009933', V: '#DA291C', FP: '#006AB3', KD: '#000077' },
  };
  const pcolor = (c, p, g) => (PARTY_COLORS[c] && p && PARTY_COLORS[c][p]) || gColor(g);
  const pdot = (c, p, g) => `<i class="gdot pdot" style="background:${pcolor(c, p, g)}"></i>`;
  const pos = (p) => { const P = p.toUpperCase(); return `<span class="pos ${P}">${posName(P) || '—'}</span>`; };

  function resultOf(v) {
    if (v.r) return v.r;
    return v.c[0] > v.c[1] ? 'ADOPTED' : 'REJECTED';
  }
  function voteSub(v) {
    const parts = [];
    if (v.an) parts.push(`${t('amendment')} ${v.an}${v.as ? ` · ${v.as}` : ''}`);
    else if (v.d) parts.push(v.d);
    if (v.ref) parts.push(v.ref);
    return parts.join(' · ');
  }
  function bar(c, wide = false) {
    const tot = c[0] + c[1] + c[2] + (c[3] || 0) || 1;
    const w = (x) => ((x / tot) * 100).toFixed(2);
    return `<span class="bar ${wide ? 'wide' : ''}" role="img" aria-label="${esc(t('barLabel', c))}">
      <i class="f" style="width:${w(c[0])}%"></i><i class="x" style="width:${w(c[2])}%"></i><i class="a" style="width:${w(c[1])}%"></i>${c[3] != null ? `<i class="n" style="width:${w(c[3])}%"></i>` : ''}</span>`;
  }

  /* ---- partage d'une page : lien « joli » (depute/<id>/, vote/<id>/) quand le site publié le fournit */
  const SHARE_ICON = '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M10 13V3M6 7l4-4 4 4M4 11v5h12v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function shareUrl(route) {
    if (document.querySelector('meta[name="hemi-pages"]')) return new URL(`${route}/`, new URL('./', document.baseURI)).href;
    return `${location.href.split('#')[0]}#/${route}`;
  }
  // signaler une erreur : un courriel prérempli vers l'adresse de contact, avec le vote concerné
  const REPORT_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><path d="M4.5 17.5v-14M4.5 3.5h9l-2 3.5 2 3.5h-9"/></svg>';
  function reportLink(v) {
    const to = window.HEMI_CONTACT;
    if (!to) return '';
    const sub = t('reportSubject', tiOf(v));
    const body = t('reportBody', shareUrl(`${TP()}vote/${v.id}`), v.ti);
    return `<a class="btn report" href="mailto:${to}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}">${REPORT_ICON}<span>${t('reportError')}</span></a>`;
  }
  function shareButton(route, title) {
    return `<div class="share" data-share-route="${esc(route)}" data-share-title="${esc(title)}">
      <button type="button" class="btn share-btn" aria-haspopup="true" aria-expanded="false">${SHARE_ICON}<span>${t('share')}</span></button>
      <div class="share-menu" hidden>
        <button type="button" data-share="copy">${t('copyLink')}</button>
        <a data-share="whatsapp" target="_blank" rel="noopener">WhatsApp</a>
        <a data-share="linkedin" target="_blank" rel="noopener">LinkedIn</a>
        <a data-share="x" target="_blank" rel="noopener">X</a>
        <a data-share="mail">${t('byEmail')}</a>
        ${/(^|\/)vote\/\d+$/.test(route) ? `<button type="button" data-share="embed">${t('embed')}</button>` : ''}
      </div>
    </div>`;
  }
  function embedCode(route, title) {
    const base = new URL('./', document.baseURI).href.split('#')[0];
    return `<iframe src="${base}#/embed/${route}?lang=${lang}" title="${esc(title)} — Hemicycle" width="100%" height="560" style="border:0;max-width:680px" loading="lazy"></iframe>`;
  }
  function openEmbed(route, title) {
    lastFocus = document.activeElement;
    drawer.dataset.id = '';
    drawer.setAttribute('aria-label', t('embedTitle'));
    drawer.innerHTML = `<button class="drawer-close" type="button" aria-label="${esc(t('close'))}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15"/></svg></button>
      <h2 class="h2" style="margin-top:8px;padding-right:44px">${t('embedTitle')}</h2>
      <p class="small muted">${t('embedHelp')}</p>
      <textarea class="embed-code" readonly rows="6">${esc(embedCode(route, title))}</textarea>
      <div class="drawer-actions"><button type="button" class="btn primary" data-copy-embed>${t('copyCode')}</button></div>`;
    showDrawer();
    document.body.classList.add('drawer-open');
    $('.drawer-close', drawer).focus();
    $('[data-copy-embed]', drawer).addEventListener('click', async (e) => {
      const b = e.currentTarget, ta = $('.embed-code', drawer);
      try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand('copy'); }
      b.textContent = t('codeCopied'); setTimeout(() => { b.textContent = t('copyCode'); }, 1400);
    });
  }
  document.addEventListener('click', async (e) => {
    const box = e.target.closest('.share');
    $$('.share-menu').forEach((mn) => { if (!box || !box.contains(mn)) { mn.hidden = true; mn.previousElementSibling?.setAttribute('aria-expanded', 'false'); } });
    if (!box) return;
    const url = shareUrl(box.dataset.shareRoute), title = box.dataset.shareTitle;
    const menu = $('.share-menu', box), btn = $('.share-btn', box);
    if (e.target.closest('.share-btn')) {
      // téléphone : feuille de partage du système ; ordinateur : petit menu
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title: `${title} — Hemicycle`, url }); } catch { /* annulé */ }
        return;
      }
      const enc = encodeURIComponent;
      $('[data-share="whatsapp"]', box).href = `https://wa.me/?text=${enc(`${title} ${url}`)}`;
      $('[data-share="linkedin"]', box).href = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
      $('[data-share="x"]', box).href = `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}`;
      $('[data-share="mail"]', box).href = `mailto:?subject=${enc(`${title} — Hemicycle`)}&body=${enc(url)}`;
      menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden));
      return;
    }
    if (e.target.closest('[data-share="copy"]')) {
      try { await navigator.clipboard.writeText(url); } catch {
        const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      const c = e.target.closest('[data-share="copy"]'); c.textContent = t('linkCopied');
      setTimeout(() => { c.textContent = t('copyLink'); menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }, 1400);
      return;
    }
    if (e.target.closest('[data-share="embed"]')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); openEmbed(box.dataset.shareRoute, title); return; }
    if (e.target.closest('a[data-share]')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  });

  /* ---- explication d'un vote en langage courant (voir explain.js) */
  const EX = window.HEMI_EXPLAIN;
  const authorLabel = (a) => (a.startsWith('COMMITTEE:') ? t('committeeX', comName(a.slice(10))) : GROUP_ORDER.includes(a) ? gShort(a) : t('authors')[a] || a);
  const andList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} ${{ fr: 'et', en: 'and', nl: 'en' }[lang]} ${a[a.length - 1]}`);
  const voteAuthors = (v) => andList((v.au || []).filter((a) => a !== 'ORIGINAL_TEXT').map(authorLabel));
  function shortLabel(v) {
    const L = EX[lang], K = EX.kind(v);
    if (K.k === 'amend') { const by = voteAuthors(v); return `${L.short.amend} ${K.n}${by ? ` · ${by}` : ''}`; }
    if (v.mn && ['whole', 'commission', 'council'].includes(K.k)) return '';
    return L.short[K.k];
  }
  function explainVote(v, g) {
    const L = EX[lang], K = EX.kind(v), by = voteAuthors(v);
    const W = L.what;
    const what = K.k === 'amend' ? (K.loc ? (K.add ? W.amendAdd : W.amendMod)(K.n, L.loc(K.loc), by) : W.amend(K.n, by))
      : K.k === 'split' ? W.split(K.part, L.loc(K.loc))
      : K.k === 'part' ? W.part(L.loc(K.loc))
      : K.k === 'reject' || K.k === 'alt' || K.k === 'voteAms' ? W[K.k](by)
      : K.k === 'oral' ? W.oral(L.loc(K.loc), K.add)
      : K.k === 'budgetLine' ? W.budgetLine(K.line, by)
      : W[K.k];
    const ty = v.ty || '';
    let nk = null;
    if (K.k === 'objection') nk = ty === 'DEA' || ty === 'RPS' ? 'objBinding' : 'objSoft';
    else if (K.k === 'censure') nk = 'censure';
    else if (K.k === 'agenda' || K.k === 'urgency' || K.k === 'voteAms' || K.k === 'referral' || K.k === 'postpone') nk = null;
    else if (!ty && /budget/i.test(v.ti)) nk = 'BUD';
    else if (ty === 'BUD' && /Mobili[sz]ation|Globali[sz]ation/i.test(v.ti)) nk = 'EGF';
    else if (ty === 'APP' || /approbation/i.test(v.d || '')) nk = 'consent';
    else if (L.nature[ty]) nk = ty;
    const map = { deal: 'deal', reject: 'reject', alt: 'alt', amend: 'amend', budgetLine: 'amend', committeeAm: 'amend', part: 'part', split: 'part', agenda: 'agenda', urgency: 'urgency', voteAms: 'voteAms', oral: 'amend', referral: 'referral', postpone: 'postpone', censure: 'censure', mandate: 'mandate', other: 'other' };
    let rk = map[K.k];
    if (K.k === 'objection') rk = nk;
    if (!rk) {
      if (K.k === 'joint') rk = 'law';
      else if (ty === 'COD') rk = v.st === 'OLP_SECOND_READING' ? 'lawSecond' : 'lawFirst';
      else if (ty === 'CNS') rk = 'cns';
      else if (nk === 'consent' || ty === 'NLE') rk = 'consent';
      else if (ty === 'BUD' || ty === 'DEC') rk = 'budget';
      else rk = ty ? 'soft' : 'other';
    }
    const R = resultOf(v);
    let outcome;
    if (v.r === 'LAPSED') outcome = L.lapsed;
    else {
      const F = v.c[0], A = v.c[1], tot = F + A;
      const abs = R === 'REJECTED' && F > A;
      const how = !tot || abs ? '' : Math.max(F, A) / tot >= 0.7 ? L.margin.large : Math.abs(F - A) <= Math.max(12, tot * 0.03) ? L.margin.close : '';
      outcome = L.outcome(R, how, v.c, L.res[rk]) + (abs ? ` ${W.absMaj}` : '');
    }
    let who = '';
    if (g) {
      const by3 = { F: [], A: [], X: [] };
      for (const [code, c] of Object.entries(g).sort((a, b) => byGroupOrder(a[0], b[0]))) {
        if (code === 'NI') continue;
        const top = Math.max(c[0], c[1], c[2]);
        if (!top || [c[0], c[1], c[2]].filter((x) => x === top).length > 1) continue;
        by3[['F', 'A', 'X'][[c[0], c[1], c[2]].indexOf(top)]].push(gShort(code));
      }
      if (by3.F.length + by3.A.length + by3.X.length) who = L.who(by3.F, by3.A, by3.X);
    }
    // explication détaillée (votes clés) : contexte et contenu du texte, rédigés à partir de sources officielles
    const dt = v.dt && (v.dt[lang] || v.dt.en);
    const detail = dt ? `<div class="ex-detail">
        <h3 class="ex-h">${esc(L.ctxT)}</h3><p class="ex-ctx">${esc(dt.c)}</p>
        ${dt.p && dt.p.length ? `<h3 class="ex-h">${esc(L.ptsT)}</h3><ul class="ex-pts">${dt.p.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </div>` : '';
    const mn = v.r !== 'LAPSED' && L.means[rk];
    const means = mn ? `<div class="ex-means" role="list" aria-label="${esc(L.meansT)}">
        <div class="em F" role="listitem"><b>${esc(L.forL)}</b><span>${esc(mn[0])}</span></div>
        <div class="em A" role="listitem"><b>${esc(L.againstL)}</b><span>${esc(mn[1])}</span></div>
        <div class="em X" role="listitem"><b>${esc(L.abstL)}</b><span>${esc(L.abstM)}</span></div>
      </div>` : '';
    const srcs = v.dt && v.dt.s ? v.dt.s.map(([, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(/oeil/.test(url) ? L.oeilL : L.pressL)}</a>`).join(', ') : '';
    return `<section class="explain${dt ? ' rich' : ''}" aria-labelledby="ex-title">
      <h2 class="kicker" id="ex-title">${esc(L.title)}</h2>
      ${extraTopic(v) ? `<p class="ex-topic">${esc(L.about(extraTopic(v)))}</p>` : ''}
      ${detail}
      ${dt ? `<h3 class="ex-h">${esc(L.whatT)}</h3>` : ''}
      <p class="ex-what">${esc(what)}${nk ? ` ${esc(L.nature[nk])}` : ''}</p>
      ${means}
      <p class="ex-out ${R}">${esc(outcome)}</p>
      ${g ? voteSides(g) : who ? `<p class="ex-who">${esc(who)}</p>` : ''}
      <p class="note">${dt && srcs ? L.srcDetail(srcs) : esc(L.source)}</p>
    </section>`;
  }

  // intitulé dans la langue de l'interface (l'officiel anglais en repli)
  const tiOf = (v) => (v.tf && lang !== 'en' ? v.tf[lang === 'nl' ? 1 : 0] : v.ti);
  const topicOf = (v) => (v.tp ? v.tp[{ fr: 0, en: 1, nl: 2 }[lang]] : '');
  // le sujet en langage courant n'est affiché sous l'intitulé que s'il apporte quelque chose (sinon il répète le titre)
  const STOP = new Set(['pour', 'dans', 'avec', 'sans', 'dont', 'leur', 'leurs', 'entre', 'vers', 'from', 'with', 'that', 'this', 'their', 'into', 'voor', 'naar', 'over', 'door', 'zijn', 'deze', 'van', 'een']);
  const stems = (x) => new Set(norm(x).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.slice(0, 6)));
  function extraTopic(v) {
    const tp = topicOf(v);
    if (!tp) return '';
    const a = stems(tp), b = stems(tiOf(v));
    let k = 0; a.forEach((w) => { if (b.has(w)) k++; });
    const ra = a.size ? k / a.size : 1, rb = b.size ? k / b.size : 0;
    return ra >= 0.7 || (ra >= 0.65 && rb >= 0.85) ? '' : tp;
  }

  /* ---- grands thèmes (themes.js) : rattachement calculé une fois par vote */
  const THEMES = window.HEMI_THEMES || [];
  const themeById = new Map(THEMES.map((x) => [x.id, x]));
  const thName = (id) => (themeById.get(id) ? themeById.get(id).name[lang] : id);
  function themesOf(v) {
    if (!v.th) {
      const txt = `${v.ti} ${v.pt || ''} ${v.tp ? v.tp[1] : ''}`;
      v.th = THEMES.filter((x) => (v.cm || []).some((c) => x.cm.includes(c)) || x.re.test(txt)).map((x) => x.id);
    }
    return v.th;
  }
  const themesSorted = () => THEMES.slice().sort((a, b) => collate(a.name[lang], b.name[lang]));
  const themesOfText = (txt) => THEMES.filter((x) => x.re.test(txt)).map((x) => x.id);

  /* ---- partis nationaux : clé « pays~sigle » */
  const partyHref = (c, p) => `#/${TP()}parti/${encodeURIComponent(`${c}~${p}`)}`;
  const realParty = (p) => !!p && !/^(independ|indépend|onafhankelijk|-)/i.test(p);
  const partyName = (p) => (realParty(p) ? p : t('independent'));
  const partyLink = (m, txt) => (realParty(m.p) ? `<a href="${partyHref(m.c, m.p)}">${esc(txt || m.p)}</a>` : esc(realParty(m.p) ? txt || '' : t('independent')));

  /* ---- sessions plénières passées, déduites des dates des votes (plus de trois jours d'écart = nouvelle session) */
  function sessionsOf(S = D) {
    if (S.sessions) return S.sessions;
    const asc = S.votes.slice().sort((a, b) => a.t.localeCompare(b.t));
    const out = [];
    let cur = null;
    for (const v of asc) {
      const day = v.t.slice(0, 10);
      if (!cur || (new Date(day) - new Date(cur.end)) / 864e5 > 3) { cur = { id: day, start: day, end: day, votes: [] }; out.push(cur); }
      cur.end = day; cur.votes.push(v);
    }
    S.vSession = new Map();
    for (const x of out) { x.votes.reverse(); for (const v of x.votes) S.vSession.set(v.id, x.id); }
    S.sessions = out.reverse(); // la plus récente d'abord
    return S.sessions;
  }

  /* ---- scripts chargés à la demande (carte) */
  const scripts = new Map();
  function loadScript(src) {
    if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.append(el); }));
    return scripts.get(src);
  }

  /* ---- agenda des prochaines sessions (build-agenda.js), législature en cours uniquement */
  let agendaP = null;
  const loadAgenda = () => (agendaP = agendaP || getJSON('data/agenda.json').catch(() => null));
  // date du jour du visiteur (heure locale, pas UTC : à Bruxelles, minuit n'est pas minuit UTC)
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const upcoming = (A) => (A ? A.sessions.filter((x) => x.end >= todayISO()) : []);
  const itemTitle = (it) => it.t[lang] || it.t.en || '';
  function sessionDates(x) {
    try { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(new Date(`${x.start}T12:00:00`), new Date(`${x.end}T12:00:00`)); } catch { return dateLong(x.start); }
  }
  const sessionPlace = (x) => [x.loc ? t('locName')[x.loc] || x.loc : '', x.start === x.end || (new Date(x.end) - new Date(x.start)) / 864e5 < 2 ? t('miniSession') : ''].filter(Boolean).join(' · ');
  function sessionWhen(x) {
    const now = todayISO();
    if (x.start === now) return t('agendaToday');
    if (x.start < now) return t('agendaOngoing');
    return t('agendaIn', Math.round((new Date(`${x.start}T12:00:00`) - new Date(`${now}T12:00:00`)) / 864e5));
  }
  // votes de la session regroupés par point de l'ordre du jour (un même texte peut être annoncé sur deux jours)
  function sessionItems(x) {
    const votes = new Map(), debates = new Map();
    for (const d of x.days || []) {
      for (const it of d.votes) if (!votes.has(it.n)) votes.set(it.n, { ...it, d: d.d });
      for (const it of d.debates) if (!debates.has(it.n)) debates.set(it.n, { ...it, d: d.d });
    }
    return { votes: [...votes.values()], debates: [...debates.values()] };
  }
  function sessionThemes(items) {
    const c = new Map();
    for (const it of items) for (const th of themesOfText(it.t.en || '')) c.set(th, (c.get(th) || 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]);
  }

  /* ---- indicateurs calculés à l'avance (build-extra.js), chargés à la demande */
  const loadExtra = (S = D) => (S.extraP = S.extraP || getJSON(`${S.base}extra.json`).catch(() => null));
  const loadCountryVotes = (S = D) => (S.cvP = S.cvP || getJSON(`${S.base}countries.json`).catch(() => null));
  const winLetter = (v) => (resultOf(v) === 'ADOPTED' ? 'F' : resultOf(v) === 'REJECTED' ? 'A' : null);
  const monthLabel = (m, long = false) => new Date(`${m}-15`).toLocaleDateString(loc(), long ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' });

  /* ---- graphiques : tracé en SVG étiré, libellés en HTML (lisibles à toutes les tailles) */
  function lineChart(months, series, { min = 0, max = 1, ticks = [0, 0.5, 1], h = 200, mini = false } = {}) {
    const n = months.length;
    const X = (i) => (n < 2 ? 50 : (i / (n - 1)) * 100);
    const Y = (v) => 100 - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100;
    const paths = series.map((s) => {
      let d = '', pen = false;
      s.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(2)} ${Y(v).toFixed(2)}`; pen = true; });
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2}" ${s.dash ? 'stroke-dasharray="4 4"' : ''} vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`;
    }).join('');
    const cols = months.map((m, i) => {
      const vals = series.filter((s) => s.values[i] != null && !s.noTip).map((s) => `${s.label ? `${s.label} ` : ''}${pct(s.values[i])}`);
      const w = 100 / n;
      return vals.length ? `<rect x="${Math.max(0, X(i) - w / 2).toFixed(2)}" y="0" width="${w.toFixed(2)}" height="100" fill="transparent" data-tip="${esc(`${monthLabel(m, true)} · ${vals.join(' · ')}`)}"/>` : '';
    }).join('');
    const grid = ticks.map((v) => `<line x1="0" x2="100" y1="${Y(v)}" y2="${Y(v)}" class="gl" vector-effect="non-scaling-stroke"/>`).join('');
    const step = Math.max(1, Math.ceil(n / (mini ? 3 : 7)));
    let kx = 0;
    const xl = months.map((m, i) => ((i % step === 0 || i === n - 1) && !(i !== n - 1 && n - 1 - i < step / 2)
      ? `<span style="left:${X(i)}%"${kx++ % 2 && i !== n - 1 ? ' class="alt"' : ''}>${esc(monthLabel(m))}</span>` : '')).join('');
    return `<div class="chart${mini ? ' mini' : ''}" style="--h:${h}px">
      <div class="chart-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${grid}${paths}${cols}</svg>
        ${ticks.map((v) => `<span class="cy" style="top:${Y(v)}%">${pct(v)}</span>`).join('')}</div>
      <div class="chart-x">${xl}</div></div>`;
  }
  function barChart(months, values, { color = 'var(--accent)', h = 160 } = {}) {
    const n = months.length;
    const step = Math.max(1, Math.ceil(n / 7));
    return `<div class="chart bars" style="--h:${h}px">
      <div class="chart-plot"><div class="cols">${values.map((v, i) => `<i data-tip="${esc(t('attTip', monthLabel(months[i], true), v == null ? '–' : pct(v)))}"><b style="height:${v == null ? 0 : (v * 100).toFixed(1)}%;background:${color}"></b></i>`).join('')}</div>
        ${[0, 0.5, 1].map((v) => `<span class="cy" style="top:${100 - v * 100}%">${pct(v)}</span>`).join('')}</div>
      <div class="chart-x">${months.map((m, i) => (i % step === 0 ? `<span style="left:${((i + 0.5) / n) * 100}%"${(i / step) % 2 ? ' class="alt"' : ''}>${esc(monthLabel(m))}</span>` : '')).join('')}</div></div>`;
  }

  /* ---- export CSV de la liste affichée */
  function downloadCSV(name, rows) {
    const cell = (c) => { const s = String(c ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const blob = new Blob([`﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const DL_ICON = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 3v10M6 9l4 4 4-4M4 16h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const RSS_ICON = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M4 4a12 12 0 0 1 12 12M4 9a7 7 0 0 1 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="5" cy="15" r="1.6" fill="currentColor"/></svg>';
  const csvButton = () => `<button type="button" class="btn sm" data-csv>${DL_ICON}<span>${t('csv')}</span></button>`;
  const hasPages = () => !!document.querySelector('meta[name="hemi-pages"]');
  const rssLink = (path, label = t('rss')) => (hasPages() && !archived() ? `<a class="btn sm" href="${path}" type="application/rss+xml">${RSS_ICON}<span>${label}</span></a>` : '');
  const csvDate = (d) => d.slice(0, 10);
  function voteRow(v, extra = '') {
    const r = resultOf(v);
    return `<a class="vrow" href="#/${TP()}vote/${v.id}">
      <div class="vd"><b>${esc(new Date(v.t).toLocaleDateString(loc(), { day: 'numeric', month: 'short' }))}</b>${new Date(v.t).getFullYear()}</div>
      <div><div class="vt">${esc(tiOf(v))}</div>${extraTopic(v) ? `<div class="vtp">${esc(cap(extraTopic(v)))}</div>` : ''}
        <div class="vs">${v.dt && v.mn ? `<span class="tag tag-dt">${t('detailedTag')}</span>` : ''}${shortLabel(v) ? `<span>${esc(shortLabel(v))}</span>` : ''}${extra}</div></div>
      <div class="vr"><span class="res ${r}">${resName(r)}</span>${bar([v.c[0], v.c[1], v.c[2]])}<span class="small muted">${v.c[0]} – ${v.c[1]} – ${v.c[2]}</span></div>
    </a>`;
  }

  function meter(x) {
    if (x == null) return '<span class="muted">–</span>';
    return `<span class="meter"><i><b style="width:${(x * 100).toFixed(1)}%"></b></i><span>${pct(x)}</span></span>`;
  }

  /* ================================================================ en-tête, pied de page, sélecteur de langue */
  function paintChrome() {
    const navEl = $('.mainnav'); if (navEl) navEl.dataset.k = '';
    document.documentElement.lang = lang;
    for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of $$('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
    for (const el of $$('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
    $('#lang-btn').innerHTML = `${flag(lang)}<span>${lang.toUpperCase()}</span><svg class="caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg>`;
    for (const b of $$('[data-lang]')) {
      b.innerHTML = `${flag(b.dataset.lang)}<span>${LANG_NAMES[b.dataset.lang]}</span>`;
      b.setAttribute('aria-current', String(b.dataset.lang === lang));
    }
    const fc = $('#footer-credit'); if (fc) fc.innerHTML = t('footSources');
    const fct = $('#f-contact'); if (fct) { const m = (window.HEMI_CONTACT || '').trim(); fct.hidden = !m; if (m) fct.href = `mailto:${m}`; }
    paintTheme();
    const cur = stores[CURRENT];
  }
  /* ---- thème clair / sombre (par défaut : celui du système) */
  const themeBtn = $('#theme-btn');
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (document.documentElement.dataset.theme || (darkMQ.matches ? 'dark' : 'light')) === 'dark';
  function paintTheme() {
    if (!themeBtn) return;
    themeBtn.setAttribute('aria-label', t(isDark() ? 'themeLight' : 'themeDark'));
    themeBtn.title = themeBtn.getAttribute('aria-label');
    themeBtn.classList.toggle('dark', isDark());
    $$('meta[name="theme-color"]').forEach((mt) => mt.setAttribute('content', isDark() ? '#0f1114' : '#ffffff'));
  }
  themeBtn?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('hemi-theme', next); } catch { /* ignore */ }
    paintTheme();
  });
  darkMQ.addEventListener?.('change', paintTheme);
  /* ---- arborescence du site : sous-rubriques de chaque section (menu déroulant et barre de section) */
  function menuDef() {
    const nT = shownTerm();
    if (nT != null && nT < 9) return { guide: menuDefFull().guide }; // législatures anciennes : une seule page, pas de sous-menus
    const full = menuDefFull();
    if (nT !== 9) return full;
    // législature 2019-2024 : mêmes rubriques, liens vers les archives, sans les outils réservés à la législature en cours
    const pre = (x) => (x.h && x.h.startsWith('#/') && !/^#\/(guide|a-propos|archive)/.test(x.h) ? { ...x, h: `#/archive/9/${x.h.slice(2)}` } : x);
    const keep = (x) => !/^#\/(comparer|sessions\?s=(prochaine|calendrier))/.test(x.h);
    const out = {};
    for (const [k, m] of Object.entries(full)) {
      out[k] = { ...m, all: m.all && pre(m.all), cols: m.cols.map((c) => ({ ...c, items: c.items.filter(keep).map(pre) })).filter((c) => c.items.length) };
    }
    return out;
  }
  function menuDefFull() {
    const M = t('mn');
    const it = (h, k) => ({ h, t: M[k][0], d: M[k][1] });
    const cur = stores[term] && stores[term].members ? stores[term] : stores[CURRENT];
    const groups = cur && cur.members ? [...new Set(cur.members.filter((m) => m.a).map((m) => m.g))].sort(byGroupOrder) : [];
    const countries = cur && cur.members ? [...new Set(cur.members.filter((m) => m.a).map((m) => m.c))].sort((a, b) => collate(cName(a), cName(b))) : [];
    const G = (window.HEMI_GUIDE || {})[lang] || (window.HEMI_GUIDE || {}).en;
    const A = (window.HEMI_ABOUT || {})[lang] || (window.HEMI_ABOUT || {}).en;
    const terms = [[10, '2024–2029', '#/'], [9, '2019–2024', '#/archive/9/'], ...[8, 7, 6, 5, 4, 3, 2, 1].map((n, i) => [n, ['2014–2019', '2009–2014', '2004–2009', '1999–2004', '1994–1999', '1989–1994', '1984–1989', '1979–1984'][i], `#/archive/old/${n}`])]
      .map(([n, y, h]) => ({ h, t: t('termName', n), y }));
    const groupItems = groups.map((g) => ({ h: `#/groupe/${g}`, t: gLong(g), dot: g }));
    return {
      deputes: { lede: M.deputes, cols: [
        { t: M.hFind, items: [it('#/deputes', 'all'), it('#/pays', 'byCountry')] },
        { t: M.hRank, items: [it('#/deputes?tri=presence&sens=desc', 'present'), it('#/deputes?tri=fidelite&sens=asc', 'rebels')] },
        { t: M.hTools, items: [it('#/quiz', 'quiz'), it('#/comparer', 'compare')] }] },
      votes: { lede: M.votes, cols: [
        { t: M.hVotes, items: [it('#/votes', 'allVotes'), it('#/session/derniere', 'lastSess')] },
        { t: M.hSessions, items: [it('#/sessions?s=prochaine', 'next'), it('#/sessions?s=calendrier', 'calendar'), it('#/sessions?s=passees', 'sessions')] }] },
      themes: { lede: M.themes, all: it('#/themes', 'allThemes'), cols: [{ t: M.hThemes, n: 3, items: themesSorted().map((x) => ({ h: `#/theme/${x.id}`, t: x.name[lang] })) }] },
      groupes: { lede: M.groupes, all: it('#/groupes', 'overview'), cols: [{ t: M.hGroups, n: 2, items: groupItems },
        { t: M.hAnalyses, items: [it('#/groupes?s=coalitions', 'coalitions'), it('#/groupes?s=majorites', 'winners'), it('#/groupes?s=cohesion', 'cohesion'), it('#/groupes?s=changements', 'switches')] }],
        bar: [it('#/groupes', 'overview'), ...groups.map((g) => ({ h: `#/groupe/${g}`, t: gShort(g), dot: g }))] },
      pays: { lede: M.pays, all: it('#/pays', 'allCountries'), cols: [{ t: M.hCountries, n: 4, items: countries.map((c) => ({ h: `#/pays/${c}`, t: cName(c) })) },
        { t: M.hParties, items: [it('#/partis', 'parties'), it('#/belgique', 'belgium')] }] },
      guide: { lede: M.guide, cols: [{ t: M.hChapters, n: 2, items: G ? G.sections.map((x) => ({ h: `#/guide?s=${x.id}`, t: x.t })) : [] },
        { t: M.hAbout, items: A ? A.sections.map((x) => ({ h: `#/a-propos?s=${x.id}`, t: x.t })) : [] }] },
    };
  }

  // menu déroulant : la liste des sous-rubriques s'ouvre sous l'entrée survolée (souris) ou touchée (téléphone)
  // le panneau fait partie de l'en-tête : en s'ouvrant, il pousse la page vers le bas
  const mega = document.createElement('div');
  mega.className = 'mega';
  mega.innerHTML = '<div class="mega-clip"><div class="wrap mega-body" role="menu"></div></div>';
  $('.masthead').append(mega);
  const megaBody = $('.mega-body', mega);
  const megaOpen = () => mega.classList.contains('show');
  let megaTimer = 0, megaFor = '';
  function megaHTML(key) {
    const m = menuDef()[key];
    if (!m) return '';
    const nav = $(`.mainnav [data-nav="${key}"]`);
    const all = m.all || { h: nav.getAttribute('href'), t: t('mn').seeAll };
    let n = 0;
    const link = (x) => `<a role="menuitem" href="${x.h}" style="--i:${Math.min(n++, 14)}">${x.dot ? gdot(x.dot) : ''}<span class="mg-t">${esc(x.t)}${x.y ? ` <span class="mg-y">${esc(x.y)}</span>` : ''}</span>${x.d ? `<span class="mg-d">${esc(x.d)}</span>` : ''}</a>`;
    // largeur de chaque colonne : une liste dense prend la place de ses sous-colonnes
    const tracks = m.cols.map((c) => `${c.n || 1}fr`).join(' ');
    return `<div class="mega-head"><b>${esc(nav.textContent)}</b><span class="mega-lede">${esc(m.lede)}</span><a href="${all.h}">${esc(all.t)} →</a></div>
      <div class="mega-grid" style="grid-template-columns:${tracks}">${m.cols.map((c) => `<div class="mg-col">
        <p class="mg-h">${esc(c.t)}</p>
        <div class="mg-list${c.n > 1 ? ' multi' : ''}" style="--n:${c.n || 1}">${c.items.map(link).join('')}</div></div>`).join('')}</div>`;
  }
  function openMega(key) {
    clearTimeout(megaTimer);
    const link = $(`.mainnav [data-nav="${key}"]`);
    if (!link || !menuDef()[key]) return;
    if (megaFor !== key) {
      const html = megaHTML(key);
      if (megaOpen() && megaFor) {
        // passage d'une rubrique à l'autre : la hauteur glisse vers la nouvelle taille et le contenu apparaît en fondu
        megaFor = key;
        const clip = $('.mega-clip', mega);
        const h0 = clip.getBoundingClientRect().height;
        megaBody.innerHTML = html;
        megaBody.classList.remove('swapin'); void megaBody.offsetWidth; megaBody.classList.add('swapin');
        const h1 = megaBody.getBoundingClientRect().height;
        if (!reduceMotion() && Math.abs(h1 - h0) > 1) {
          clip.style.transition = 'none'; clip.style.height = `${h0}px`; void clip.offsetHeight;
          clip.style.transition = 'height .42s cubic-bezier(.4, 0, .2, 1)'; clip.style.height = `${h1}px`;
          clearTimeout(clip._t);
          clip._t = setTimeout(() => { clip.style.height = ''; clip.style.transition = ''; }, 460);
        }
      } else { megaBody.classList.remove('swapin'); megaBody.innerHTML = html; megaFor = key; }
    }
    mega.classList.add('show');
    $$('.mainnav [data-nav]').forEach((a) => { const on = a.dataset.nav === key; a.classList.toggle('open', on); a.setAttribute('aria-expanded', String(on)); });
  }
  function closeMega(now) {
    clearTimeout(megaTimer);
    const done = () => { mega.classList.remove('show'); megaFor = ''; $$('.mainnav [data-nav]').forEach((a) => { a.classList.remove('open'); a.setAttribute('aria-expanded', 'false'); }); };
    if (now) done(); else megaTimer = setTimeout(done, 350);
  }
  $$('.mainnav [data-nav]').forEach((a) => { a.setAttribute('aria-haspopup', 'true'); a.setAttribute('aria-expanded', 'false'); });
  $('.mainnav').addEventListener('pointerover', (e) => {
    const a = e.target.closest('[data-nav]');
    if (!a || e.pointerType === 'touch') return;
    clearTimeout(megaTimer);
    megaTimer = setTimeout(() => openMega(a.dataset.nav), megaFor ? 120 : 220);
  });
  mega.addEventListener('pointerenter', () => clearTimeout(megaTimer));
  $('.masthead').addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') closeMega(); });
  $('.masthead').addEventListener('pointerenter', () => { if (megaFor) clearTimeout(megaTimer); });
  // un clic (ou un toucher) sur une entrée fermée ouvre d'abord sa liste ; un second clic mène à la page
  $('.mainnav').addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (!a) return;
    if (megaFor !== a.dataset.nav && menuDef()[a.dataset.nav]) { e.preventDefault(); openMega(a.dataset.nav); }
    else closeMega(true);
  });
  $('.mainnav').addEventListener('keydown', (e) => {
    const a = e.target.closest('[data-nav]');
    if (a && e.key === 'ArrowDown') { e.preventDefault(); openMega(a.dataset.nav); $('a', megaBody)?.focus(); }
  });
  mega.addEventListener('keydown', (e) => {
    const items = $$('a', mega), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
  });
  mega.addEventListener('click', (e) => { if (e.target.closest('a')) closeMega(true); });
  document.addEventListener('click', (e) => { if (megaOpen() && !e.target.closest('.mega') && !e.target.closest('.mainnav')) closeMega(true); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && megaOpen()) { const k = megaFor; closeMega(true); $(`.mainnav [data-nav="${k}"]`)?.focus(); } });
  $('.mainnav').addEventListener('scroll', () => closeMega(true), { passive: true });
  window.addEventListener('resize', () => closeMega(true));
  window.addEventListener('hashchange', () => closeMega(true));

  // barre de section : les sous-rubriques, en haut des pages de la section
  const SECTION_OF = { deputes: 'deputes', partis: 'deputes', comparer: 'deputes', parti: 'deputes', votes: 'votes', agenda: 'votes', calendrier: 'votes', sessions: 'votes', session: 'votes', themes: 'themes', theme: 'themes', groupes: 'groupes', groupe: 'groupes', pays: 'pays' };
  function sectionBar(p0, p1, q) {
    const key = SECTION_OF[p0];
    const m = key && menuDef()[key];
    if (!m) return '';
    let list = m.bar || (m.all ? [m.all] : []).concat(...m.cols.map((c) => c.items));
    const latest = D.sessions ? D.sessions[0].id : null;
    const isOn = (h) => {
      const [path, qs] = h.replace(/^#\//, '').split('?');
      const [a, b] = path.split('/');
      if (a === 'session' && b === 'derniere') return p0 === 'session' && (p1 === 'derniere' || p1 === latest);
      if (a !== p0 || (b || '') !== (p1 || '')) return false;
      const want = new URLSearchParams(qs || '');
      if (a === 'deputes') return ['tri', 'sens'].every((k) => (want.get(k) || '') === (q.get(k) || ''));
      return [...want].every(([k, v]) => q.get(k) === v);
    };
    return `<nav class="secbar" aria-label="${esc(t('mn').sectionNav)}"><div class="secbar-in">${list.map((x) => `<a href="${x.h}"${isOn(x.h) ? ' aria-current="page" class="on"' : ''}>${x.dot ? gdot(x.dot) : ''}${esc(x.t)}</a>`).join('')}</div></nav>`;
  }

  const LANG_NAMES = { en: 'English', fr: 'Français', nl: 'Nederlands' };
  let flagN = 0;
  function flag(l) {
    const id = `fl${++flagN}`;
    if (l === 'fr') return '<svg class="flag" viewBox="0 0 3 2" aria-hidden="true"><path fill="#0055A4" d="M0 0h1v2H0z"/><path fill="#fff" d="M1 0h1v2H1z"/><path fill="#EF4135" d="M2 0h1v2H2z"/></svg>';
    if (l === 'nl') return '<svg class="flag" viewBox="0 0 3 2" aria-hidden="true"><path fill="#AE1C28" d="M0 0h3v.67H0z"/><path fill="#fff" d="M0 .67h3v.66H0z"/><path fill="#21468B" d="M0 1.33h3V2H0z"/></svg>';
    // drapeau britannique au même format 3:2 que les deux autres, sans déformation
    return `<svg class="flag" viewBox="0 0 30 20" aria-hidden="true"><clipPath id="${id}"><path d="M0 0h30v20H0z"/></clipPath><g clip-path="url(#${id})"><path fill="#012169" d="M0 0h30v20H0z"/><path d="M0 0 30 20M30 0 0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 30 20M30 0 0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#C8102E" stroke-width="3.4"/></g></svg>`;
  }
  const langList = $('#lang-list'), langBtn = $('#lang-btn');
  function toggleLangs(open) {
    langList.hidden = !open;
    langBtn.setAttribute('aria-expanded', String(open));
    if (open) { const cur = $('[aria-current="true"]', langList); (cur || $('button', langList)).focus({ preventScroll: true }); }
  }
  langBtn.addEventListener('click', () => toggleLangs(langList.hidden));
  document.addEventListener('click', (e) => { if (!e.target.closest('#lang-menu')) toggleLangs(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !langList.hidden) { toggleLangs(false); langBtn.focus({ preventScroll: true }); } });
  langList.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = $$('button', langList); const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) { toggleLangs(false); langBtn.focus({ preventScroll: true }); }
    if (!b || b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    try { localStorage.setItem('hemi-lang', lang); } catch { /* ignore */ }
    setRegionNames();
    paintChrome();
    const openId = drawer.hidden ? null : Number(drawer.dataset.id);
    rerender().then(() => { if (openId) openDrawer(openId, true); paintAppChrome(); });
  });

  /* ---- drapeaux des 27 (dessins simplifiés, sans armoiries) */
  const A2TO3 = { AT: 'AUT', BE: 'BEL', BG: 'BGR', CY: 'CYP', CZ: 'CZE', DE: 'DEU', DK: 'DNK', EE: 'EST', ES: 'ESP', FI: 'FIN', FR: 'FRA', GR: 'GRC', EL: 'GRC', HR: 'HRV', HU: 'HUN', IE: 'IRL', IT: 'ITA', LT: 'LTU', LU: 'LUX', LV: 'LVA', MT: 'MLT', NL: 'NLD', PL: 'POL', PT: 'PRT', RO: 'ROU', SE: 'SWE', SI: 'SVN', SK: 'SVK', GB: 'GBR', UK: 'GBR' };
  const hS = (...c) => c.map((x, i) => `<rect y="${(20 / c.length) * i}" width="30" height="${20 / c.length + 0.1}" fill="${x}"/>`).join('');
  const vS = (...c) => c.map((x, i) => `<rect x="${(30 / c.length) * i}" width="${30 / c.length + 0.1}" height="20" fill="${x}"/>`).join('');
  const nord = (bg, cr) => `<rect width="30" height="20" fill="${bg}"/><rect x="8" width="4" height="20" fill="${cr}"/><rect y="8" width="30" height="4" fill="${cr}"/>`;
  const FLAGS = {
    AUT: hS('#C8102E', '#fff', '#C8102E'), BEL: vS('#111', '#FDDA24', '#EF3340'), BGR: hS('#fff', '#00966E', '#D62612'),
    CYP: '<rect width="30" height="20" fill="#fff"/><path d="M8 9.5c2.5-2 6-2.6 9.5-2.2 2.3.3 3.7-.5 5-1.6-.4 1.6-1.6 2.7-3.2 3.3-2.6 1-5.5 1.8-8.5 1.6-1.2-.1-2.2-.5-2.8-1.1z" fill="#D57800"/><path d="M11 14.5c2.3 1 5.7 1 8 0" stroke="#4E5B31" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
    CZE: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#D7141A"/><path d="M0 0l15 10L0 20z" fill="#11457E"/>',
    DEU: hS('#111', '#DD0000', '#FFCE00'), DNK: nord('#C8102E', '#fff'), ESP: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
    EST: hS('#0072CE', '#111', '#fff'), FIN: nord('#fff', '#002F6C'), FRA: vS('#002395', '#fff', '#ED2939'),
    GRC: `${[...Array(9)].map((_, i) => `<rect y="${i * 20 / 9}" width="30" height="${20 / 9 + 0.05}" fill="${i % 2 ? '#fff' : '#0D5EAF'}"/>`).join('')}<rect width="11.1" height="11.1" fill="#0D5EAF"/><rect x="4.45" width="2.2" height="11.1" fill="#fff"/><rect y="4.45" width="11.1" height="2.2" fill="#fff"/>`,
    HRV: `${hS('#FF0000', '#fff', '#171796')}<g transform="translate(12.2 4.6)"><rect width="5.6" height="6.4" rx="0.6" fill="#fff" stroke="#FF0000" stroke-width="0.5"/>${[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => ((r + c) % 2 ? '' : `<rect x="${c * 1.87}" y="${r * 1.6}" width="1.87" height="1.6" fill="#FF0000"/>`)).join('')).join('')}</g>`,
    HUN: hS('#CD2A3E', '#fff', '#436F4D'), IRL: vS('#169B62', '#fff', '#FF883E'), ITA: vS('#009246', '#fff', '#CE2B37'),
    LTU: hS('#FDB913', '#006A44', '#C1272D'), LUX: hS('#EF3340', '#fff', '#00A3E0'),
    LVA: '<rect width="30" height="20" fill="#9E3039"/><rect y="8" width="30" height="4" fill="#fff"/>',
    MLT: '<rect width="15" height="20" fill="#fff"/><rect x="15" width="15" height="20" fill="#CF142B"/><rect x="2.2" y="2.2" width="3.2" height="3.2" fill="#C0C0C0" stroke="#CF142B" stroke-width="0.4"/>',
    NLD: hS('#AE1C28', '#fff', '#21468B'), POL: hS('#fff', '#DC143C'),
    PRT: '<rect width="12" height="20" fill="#006600"/><rect x="12" width="18" height="20" fill="#FF0000"/><circle cx="12" cy="10" r="4.2" fill="#FFCC00"/><path d="M10 7.6h4v3.6a2 2 0 0 1-4 0z" fill="#fff" stroke="#FF0000" stroke-width="0.7"/>',
    ROU: vS('#002B7F', '#FCD116', '#CE1126'), SWE: nord('#006AA7', '#FECC02'),
    SVN: `${hS('#fff', '#0000FF', '#FF0000')}<path d="M6 4.2h5v4.2c0 1.6-1.2 2.6-2.5 3-1.3-.4-2.5-1.4-2.5-3z" fill="#0000FF" stroke="#FF0000" stroke-width="0.5"/><path d="M6.6 9.6l1.9-2 1.9 2" stroke="#fff" stroke-width="0.6" fill="none"/>`,
    SVK: `${hS('#fff', '#0B4EA2', '#EE1C25')}<path d="M6.5 4.5h6v5.2c0 2.2-1.6 3.6-3 4-1.4-.4-3-1.8-3-4z" fill="#EE1C25" stroke="#fff" stroke-width="0.6"/><path d="M9.5 6v6M8 7.6h3M7.4 9.5h4.2" stroke="#fff" stroke-width="0.8"/>`,
  };
  function cflag(code) {
    const c = FLAGS[code] ? code : A2TO3[String(code).toUpperCase()];
    return c && FLAGS[c] ? `<svg class="cflag" viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">${FLAGS[c]}<rect class="cf-frame" x=".5" y=".5" width="29" height="19" rx="2.6"/></svg>` : '';
  }

  /* ---- listes déroulantes du site : un menu dessiné à la place du menu natif (drapeaux, couleurs de groupe, recherche) */
  const CHEV = '<svg class="fx-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>';
  const FX_COUNTRY = new Set(['hl-country', 'my-c', 'f-pays', 'va-pays', 'o-c', 'v-geo']);
  const FX_GROUP = new Set(['f-groupe']);
  let fxN = 0;
  function fxIcon(sel, v) {
    if (!v) return '';
    if (FX_COUNTRY.has(sel.id)) return cflag(v);
    if (FX_GROUP.has(sel.id)) return gdot(v);
    return '';
  }
  function enhanceSelects(root = main) {
    for (const sel of $$('select', root)) {
      if (sel.dataset.fx || sel.closest('.lang-menu')) continue;
      sel.dataset.fx = '1';
      const id = `fx${++fxN}`;
      const wrap = document.createElement('div');
      wrap.className = `fx${sel.id === 'my-c' || sel.closest('.stage-controls') ? ' fx-pill' : ''}`;
      sel.parentNode.insertBefore(wrap, sel);
      wrap.append(sel);
      sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true'); sel.classList.add('fx-native');
      const lab = sel.id && $(`label[for="${sel.id}"]`, root);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'fx-btn'; btn.id = `${id}-b`;
      btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
      if (lab) { btn.setAttribute('aria-label', lab.textContent); lab.setAttribute('for', btn.id); }
      wrap.append(btn);
      const sync = () => {
        const o = sel.options[sel.selectedIndex] || sel.options[0];
        btn.innerHTML = `<span class="fx-v${o && !o.value ? ' fx-ph' : ''}">${fxIcon(sel, o && o.value)}<span class="fx-t">${esc(o ? o.textContent : '')}</span></span>${CHEV}`;
      };
      // une valeur posée par le code (retour sur une page, filtre depuis la carte) met aussi le bouton à jour
      const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      Object.defineProperty(sel, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); sync(); } });
      sel.addEventListener('change', sync);
      sync();
    }
  }
  let fxOpen = null;
  function fxClose(focus) {
    if (!fxOpen) return;
    const { wrap, pop } = fxOpen;
    if (reduceMotion()) pop.remove(); else { pop.classList.add('closing'); pop.style.pointerEvents = 'none'; setTimeout(() => pop.remove(), 130); }
    wrap.classList.remove('open');
    const b = $('.fx-btn', wrap); b.setAttribute('aria-expanded', 'false');
    if (focus) b.focus();
    fxOpen = null;
  }
  function fxOpenMenu(wrap) {
    fxClose();
    const sel = $('select', wrap), btn = $('.fx-btn', wrap);
    const opts = [...sel.options];
    const pop = document.createElement('div');
    pop.className = 'fx-pop';
    const many = opts.length > 10;
    pop.innerHTML = `${many ? `<div class="fx-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4.5 4.5"/></svg><input type="search" placeholder="${esc(t('fxSearch'))}" aria-label="${esc(t('fxSearch'))}" autocomplete="off" spellcheck="false"></div>` : ''}
      <ul role="listbox" tabindex="-1" aria-label="${esc(btn.getAttribute('aria-label') || '')}">${opts.map((o, i) => `<li role="option" data-i="${i}" aria-selected="${i === sel.selectedIndex}"${o.value ? '' : ' class="fx-all"'}>${fxIcon(sel, o.value)}<span>${esc(o.textContent)}</span>${i === sel.selectedIndex ? '<svg class="fx-ok" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>' : ''}</li>`).join('')}</ul>`;
    // le menu est posé au-dessus de toute la page (pas de conflit avec les blocs voisins)
    document.body.append(pop); wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    const place = () => {
      const r = btn.getBoundingClientRect();
      const w = Math.min(Math.max(r.width, 240), 360, innerWidth - 24);
      pop.style.width = `${w}px`;
      pop.style.left = `${Math.max(12, Math.min(r.left, innerWidth - w - 12))}px`;
      const up = innerHeight - r.bottom < 320 && r.top > innerHeight - r.bottom;
      pop.classList.toggle('up', up);
      pop.style.top = up ? '' : `${r.bottom + 8}px`;
      pop.style.bottom = up ? `${innerHeight - r.top + 8}px` : '';
    };
    if (!matchMedia('(max-width: 560px)').matches) place();
    pop._place = place;
    fxOpen = { wrap, pop, sel };
    const list = $('ul', pop);
    let act = sel.selectedIndex;
    const items = () => $$('li:not([hidden])', list);
    const mark = (li) => { $$('li', list).forEach((x) => x.classList.toggle('act', x === li)); if (li) li.scrollIntoView({ block: 'nearest' }); };
    mark($(`li[data-i="${act}"]`, list));
    const pick = (li) => {
      const i = Number(li.dataset.i);
      if (i !== sel.selectedIndex) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      fxClose(true);
    };
    list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) pick(li); });
    list.addEventListener('pointermove', (e) => { const li = e.target.closest('li'); if (li && !li.classList.contains('act')) mark(li); });
    const q = $('input', pop);
    const onKey = (e) => {
      const its = items(); const cur = its.indexOf($('li.act', list));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); mark(its[(cur + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]); }
      else if (e.key === 'Enter') { e.preventDefault(); const li = $('li.act', list) || its[0]; if (li) pick(li); }
      else if (e.key === 'Escape') { e.preventDefault(); fxClose(true); }
      else if (e.key === 'Tab') fxClose();
      else if (q && e.target !== q && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) q.focus(); // taper une lettre lance la recherche
    };
    pop.addEventListener('keydown', onKey);
    if (q) {
      q.addEventListener('input', () => {
        const k = norm(q.value);
        for (const li of $$('li', list)) li.hidden = k && !norm(li.textContent).includes(k);
        mark(items()[0]);
      });
      if (matchMedia('(pointer: fine)').matches) q.focus(); else list.focus();
    } else list.focus();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.fx-btn');
    if (b) { const w = b.parentNode; if (fxOpen && fxOpen.wrap === w) fxClose(); else fxOpenMenu(w); return; }
    if (fxOpen && !e.target.closest('.fx-pop')) fxClose();
  });
  document.addEventListener('keydown', (e) => {
    const b = e.target.closest && e.target.closest('.fx-btn');
    if (b && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') && !(fxOpen && fxOpen.wrap === b.parentNode)) { e.preventDefault(); fxOpenMenu(b.parentNode); }
  });
  window.addEventListener('hashchange', () => fxClose());
  window.addEventListener('resize', () => { if (fxOpen && fxOpen.pop._place && !matchMedia('(max-width: 560px)').matches) fxOpen.pop._place(); });
  window.addEventListener('scroll', () => { if (fxOpen && fxOpen.pop._place && !matchMedia('(max-width: 560px)').matches) fxOpen.pop._place(); }, { passive: true });

  /* ---- choix de la législature, à côté du logo */
  const TERM_LIST = [[10, '2024–2029', '#/'], [9, '2019–2024', '#/archive/9/'], [8, '2014–2019'], [7, '2009–2014'], [6, '2004–2009'], [5, '1999–2004'], [4, '1994–1999'], [3, '1989–1994'], [2, '1984–1989'], [1, '1979–1984']]
    .map(([n, y, h]) => ({ n, y, h: h || `#/archive/old/${n}` }));
  const termBtn = $('#term-btn'), termList = $('#term-list');
  function shownTerm() {
    const { parts } = parseHash();
    if (parts[0] !== 'archive') return CURRENT;
    if (parts[1] === 'old') return Number(parts[2]) || null;
    return Number(parts[1]) || null;
  }
  // menu principal : les rubriques disponibles pour la législature affichée
  function paintNav() {
    const n = shownTerm();
    const nav = $('.mainnav');
    let items;
    if (n != null && n < 9) {
      const base = `#/archive/old/${n}`;
      items = [['hemi', base, t('inHemicycle')], ['groupes', `${base}?s=groupes`, t('navGroups')], ['deputes', `${base}?s=deputes`, t('navMeps')]];
    } else {
      const pre = n === 9 ? '#/archive/9/' : '#/';
      items = [['deputes', `${pre}deputes`, t('navMeps')], ['votes', `${pre}votes`, t('navVotes')], ['themes', `${pre}themes`, t('navThemes')], ['groupes', `${pre}groupes`, t('navGroups')], ['pays', `${pre}pays`, t('navCountriesParties')]];
    }
    const key = items.map((x) => x[0]).join() + n;
    if (nav.dataset.k !== key) {
      const act = $('.mainnav .active')?.dataset.nav;
      nav.innerHTML = items.map(([k, h, l]) => `<a href="${h}" data-nav="${k}"${k === act ? ' class="active"' : ''}>${esc(l)}</a>`).join('')
        + `<a href="#/guide" data-nav="guide" class="nav-end${act === 'guide' ? ' active' : ''}">${esc(t('navUnderstand'))}</a>`;
      nav.dataset.k = key;
      const md = menuDef();
      $$('[data-nav]', nav).forEach((a) => { if (md[a.dataset.nav]) { a.setAttribute('aria-haspopup', 'true'); a.setAttribute('aria-expanded', 'false'); } });
    }
  }
  function paintTerm() {
    if (!termBtn) return;
    paintNav();
    const n = shownTerm();
    const cur = TERM_LIST.find((x) => x.n === n);
    $('#term-cur').textContent = cur ? cur.y : t('navArchive');
    termBtn.classList.toggle('past', n !== CURRENT);
    termBtn.setAttribute('aria-label', `${t('termPick')} (${cur ? cur.y : t('navArchive')})`);
    termList.innerHTML = `<p class="term-h">${esc(t('termPick'))}</p>${TERM_LIST.map((x) => `<a href="${x.h}"${x.n === n ? ' aria-current="true"' : ''}><b>${x.y}</b><span>${esc(t('termName', x.n))}${x.n === CURRENT ? ` · ${esc(t('ongoing'))}` : ''}</span></a>`).join('')}
      <a class="term-all" href="#/archive">${esc(t('allTerms'))} →</a>`;
  }
  function toggleTerms(open) {
    termList.hidden = !open;
    termBtn.setAttribute('aria-expanded', String(open));
    if (open) ($('[aria-current]', termList) || $('a', termList)).focus({ preventScroll: true });
  }
  if (termBtn) {
    termBtn.addEventListener('click', () => toggleTerms(termList.hidden));
    termList.addEventListener('click', (e) => { if (e.target.closest('a')) toggleTerms(false); });
    document.addEventListener('click', (e) => { if (!e.target.closest('#term-menu')) toggleTerms(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !termList.hidden) { toggleTerms(false); termBtn.focus({ preventScroll: true }); } });
    termList.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = $$('a', termList), i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    });
  }

  /* ---- fil d'Ariane : Accueil › rubrique › page parente */
  function crumbs(...list) {
    const items = [[`#/${TP()}`, t('crumbHome')], ...list.filter(Boolean)];
    return `<nav class="crumbs" aria-label="${esc(t('crumbNav'))}"><ol>${items.map(([h, txt]) => `<li><a href="${h}">${esc(txt)}</a></li>`).join('')}</ol></nav>`;
  }
  const CR = {
    deputes: () => [`#/${TP()}deputes`, t('navMeps')],
    votes: () => [`#/${TP()}votes`, t('navVotes')],
    sessions: () => [`#/${TP()}sessions`, t('hubTitle')],
    themes: () => [`#/${TP()}themes`, t('navThemes')],
    groupes: () => [`#/${TP()}groupes`, t('navGroups')],
    pays: () => [`#/${TP()}pays`, t('navCountriesParties')],
    guide: () => ['#/guide', t('navUnderstand')],
  };

  /* ================================================================ hémicycle */
  function seatLayout(n) {
    const r0 = 0.38;
    const rows = Math.max(3, Math.round(Math.sqrt((2 * n * (1 - r0)) / (Math.PI * (1 + r0)))));
    const radii = Array.from({ length: rows }, (_, i) => r0 + ((1 - r0) * i) / (rows - 1));
    const sum = radii.reduce((s, r) => s + r, 0);
    const per = radii.map((r) => Math.floor((n * r) / sum));
    let rest = n - per.reduce((s, x) => s + x, 0);
    for (let i = rows - 1; rest > 0; i = (i - 1 + rows) % rows) { per[i]++; rest--; }
    const seats = [];
    radii.forEach((r, i) => {
      const k = per[i];
      for (let j = 0; j < k; j++) {
        const th = k === 1 ? Math.PI / 2 : Math.PI * (1 - j / (k - 1));
        seats.push({ x: 100 + r * 96 * Math.cos(th), y: 100 - r * 96 * Math.sin(th), th, r });
      }
    });
    seats.sort((a, b) => b.th - a.th || a.r - b.r);
    const rowGap = ((1 - r0) * 96) / (rows - 1);
    const arc = Math.min(...radii.map((r, i) => (per[i] > 1 ? (Math.PI * r * 96) / (per[i] - 1) : rowGap)));
    return { seats, dot: 0.43 * Math.min(arc, rowGap) };
  }

  // items : [{color, title, m}] déjà triés de gauche à droite (m = eurodéputé)
  function hemicycle(items, center = '', cls = '') {
    const { seats, dot } = seatLayout(items.length);
    const circles = items.map((it, i) => {
      const s = seats[i];
      return `<circle cx="${s.x.toFixed(2)}" cy="${s.y.toFixed(2)}" r="${dot.toFixed(2)}" fill="${it.color}" style="--d:${Math.round((1 - s.th / Math.PI) * 700 + (s.r - 0.38) * 120)}ms" data-tip="${esc(it.title)}" data-mep="${it.m.id}" data-g="${esc(it.m.g)}" data-c="${esc(it.m.c)}"></circle>`;
    }).join('');
    return `<div class="hemi-wrap ${cls}"><svg class="hemi" viewBox="-2 -1 204 104" role="img" aria-label="${esc(t('hemiAria'))}">${circles}</svg>${center ? `<div class="hemi-center">${center}</div>` : ''}</div>`;
  }

  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true; document.body.appendChild(tip);
  document.addEventListener('pointerover', (e) => {
    const c = e.target.closest('[data-tip]');
    if (!c || e.pointerType === 'touch') { tip.hidden = true; return; }
    tip.textContent = c.dataset.tip; tip.hidden = false;
  });
  document.addEventListener('pointermove', (e) => {
    if (tip.hidden) return;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = `${x}px`; tip.style.top = `${e.clientY + 16}px`;
  });
  document.addEventListener('click', (e) => {
    const c = e.target.closest('circle[data-mep]');
    if (c) {
      tip.hidden = true;
      const id = Number(c.dataset.mep);
      if (oldCtx && oldCtx.byId.has(id)) openOldDrawer(oldCtx.byId.get(id)); else openDrawer(id);
    }
  });

  /* ================================================================ fiche rapide (panneau latéral) */
  const scrim = document.createElement('div');
  scrim.className = 'scrim'; scrim.hidden = true;
  const drawer = document.createElement('aside');
  drawer.className = 'drawer'; drawer.hidden = true;
  drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true');
  document.body.append(scrim, drawer);
  let drawerExtra = null;
  let oldCtx = null; // législature 1979–2019 affichée : { term, byId }
  let lastFocus = null;

  function openDrawer(id, keep = false) {
    const m = D.mById.get(id);
    if (!m) return;
    if (!keep) lastFocus = document.activeElement;
    drawer.dataset.id = String(id);
    drawer.setAttribute('aria-label', t('drawerAria'));
    drawer.innerHTML = `
      <button class="drawer-close" type="button" aria-label="${esc(t('close'))}">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15"/></svg>
      </button>
      <div class="drawer-head">
        ${photo(m, 'lg')}
        <div>
          <p class="kicker">${esc(cName(m.c))}${m.a ? '' : ` · ${t('formerMandate')}`}</p>
          <h2 class="h2">${esc(fullName(m))}</h2>
          <a class="gpill" href="#/${TP()}groupe/${m.g}">${gdot(m.g)}${esc(gLong(m.g))}</a>
          ${m.pl ? `<div class="small muted" style="margin-top:4px">${esc(m.pl)}</div>` : ''}
        </div>
      </div>
      ${drawerExtra ? drawerExtra(m) : ''}
      <div class="drawer-kpis">
        <div><span>${t('attendance')}</span><b>${pct(m.s.att)}</b></div>
        <div><span>${t('loyalty')}</span><b>${m.g === 'NI' ? '–' : pct(m.s.loy)}</b></div>
        <div><span>${t('votesCast')}</span><b>${fmt(m.s.f + m.s.a + m.s.x)}</b></div>
      </div>
      <div class="drawer-bio" id="drawer-bio"><p class="muted small">${t('bioLoading')}</p></div>
      <div class="drawer-actions">
        <a class="btn primary" href="#/${TP()}depute/${m.id}">${t('fullProfile')}</a>
        ${archived() ? '' : `<a class="btn" href="#/comparer?a=${m.id}">${t('compare')}</a>`}
      </div>`;
    showDrawer();
    document.body.classList.add('drawer-open');
    if (!keep) $('.drawer-close', drawer).focus();
    loadBio(m.id).then((b) => {
      const el = $('#drawer-bio');
      if (!el || drawer.dataset.id !== String(id)) return;
      el.innerHTML = b ? shortBio(b) : '';
    }).catch(() => { const el = $('#drawer-bio'); if (el) el.innerHTML = ''; });
  }
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let closeTimer = null;
  function showDrawer() {
    clearTimeout(closeTimer);
    drawer.classList.remove('closing'); scrim.classList.remove('closing');
    drawer.hidden = false; scrim.hidden = false;
  }
  function closeDrawer() {
    if (drawer.hidden || drawer.classList.contains('closing')) return;
    document.body.classList.remove('drawer-open');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    const done = () => { drawer.hidden = true; scrim.hidden = true; drawer.classList.remove('closing'); scrim.classList.remove('closing'); };
    if (reduceMotion()) return done();
    drawer.classList.add('closing'); scrim.classList.add('closing');
    closeTimer = setTimeout(done, 220);
  }
  scrim.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (e) => { if (e.target.closest('.drawer-close')) closeDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  window.addEventListener('hashchange', closeDrawer);

  /* ================================================================ biographies (Wikidata + Wikipédia, chargées par le navigateur) */
  const bioCache = new Map();
  const WD = 'https://query.wikidata.org/sparql?format=json&query=';

  async function sparql(q) {
    const r = await fetch(WD + encodeURIComponent(q), { headers: { accept: 'application/sparql-results+json' } });
    if (!r.ok) throw new Error('Wikidata');
    return (await r.json()).results.bindings;
  }

  function loadBio(id) {
    const ck = `${id}|${lang}`;
    if (bioCache.has(ck)) return bioCache.get(ck);
    const L = lang;
    const p = (async () => {
      const eid = String(id).replace(/\D/g, '');
      const facts = await sparql(`SELECT ?item ?desc ?descEn ?birth ?bpLabel ?frwiki ?enwiki ?nlwiki ?site WHERE {
        ?item wdt:P1186 "${eid}" .
        OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "${L}") }
        OPTIONAL { ?item schema:description ?descEn FILTER(LANG(?descEn) = "en") }
        OPTIONAL { ?item wdt:P569 ?birth }
        OPTIONAL { ?item wdt:P19 ?bp . OPTIONAL { ?bp rdfs:label ?bpLabel FILTER(LANG(?bpLabel) = "${L}") } }
        OPTIONAL { ?frwiki schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> }
        OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
        OPTIONAL { ?nlwiki schema:about ?item ; schema:isPartOf <https://nl.wikipedia.org/> }
        OPTIONAL { ?item wdt:P856 ?site }
      } LIMIT 1`);
      if (!facts.length) return null;
      const f = facts[0];
      const val = (k) => (f[k] ? f[k].value : null);
      const wikis = { fr: val('frwiki'), en: val('enwiki'), nl: val('nlwiki') };
      const wl = wikis[L] ? L : wikis.en ? 'en' : wikis.fr ? 'fr' : wikis.nl ? 'nl' : null;
      const bio = {
        desc: val('desc') || val('descEn'), birth: val('birth'), birthPlace: val('bpLabel'), site: val('site'),
        wikidata: val('item'), article: wl ? wikis[wl] : null, lang: wl,
        pos: [], edu: [], job: [], party: [], ideo: [], langs: [], sections: null,
      };
      const lists = await sparql(`SELECT ?kind ?valLabel ?start ?end ?degLabel ?degEn WHERE {
        ?item wdt:P1186 "${eid}" .
        { ?item p:P39 ?st . ?st ps:P39 ?val . BIND("pos" AS ?kind) OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } }
        UNION { ?item p:P69 ?st . ?st ps:P69 ?val . BIND("edu" AS ?kind) OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?st pq:P512 ?deg . OPTIONAL { ?deg rdfs:label ?degEn FILTER(LANG(?degEn) = "en") } } }
        UNION { ?item wdt:P106 ?val . BIND("job" AS ?kind) }
        UNION { ?item p:P102 ?st . ?st ps:P102 ?val . BIND("party" AS ?kind) OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } }
        UNION { ?item wdt:P102 ?pty . ?pty wdt:P1142 ?val . BIND("ideo" AS ?kind) }
        UNION { ?item wdt:P1412 ?val . BIND("langs" AS ?kind) }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${L},en,fr". }
      }`).catch(() => []);
      const seen = new Set();
      for (const b of lists) {
        const kind = b.kind.value, label = b.valLabel && b.valLabel.value;
        if (!label || /^Q\d+$/.test(label)) continue;
        const item = { label, start: b.start ? b.start.value.slice(0, 4) : null, end: b.end ? b.end.value.slice(0, 4) : null, deg: degName(b.degEn && b.degEn.value, b.degLabel && !/^Q\d+$/.test(b.degLabel.value) ? b.degLabel.value : null) };
        const key = `${kind}|${label}|${item.start}|${item.end}`;
        if (seen.has(key) || !bio[kind]) continue;
        seen.add(key); bio[kind].push(item);
      }
      if (bio.article) {
        try {
          const title = decodeURIComponent(bio.article.split('/wiki/')[1]);
          const r = await fetch(`https://${bio.lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`);
          const j = await r.json();
          const page = Object.values((j.query && j.query.pages) || {})[0];
          if (page && page.extract) bio.sections = splitSections(page.extract);
        } catch { /* pas de texte */ }
      }
      return bio;
    })();
    bioCache.set(ck, p);
    p.catch(() => bioCache.delete(ck));
    return p;
  }

  // diplômes : les libellés de Wikidata sont souvent mal traduits (« baccalauréat des arts » pour Bachelor of Arts) ;
  // on reconnaît les grands types de diplômes à partir du libellé anglais et on les nomme simplement
  const DEG = {
    fr: { ba: 'Bachelier (lettres, sciences humaines)', bsc: 'Bachelier (sciences)', bach: 'Bachelier', ma: 'Master (lettres, sciences humaines)', msc: 'Master (sciences)', llm: 'Master en droit', llb: 'Bachelier en droit', mba: 'MBA (gestion)', master: 'Master', phd: 'Doctorat', md: 'Doctorat en médecine', dipl: 'Diplôme' },
    nl: { ba: 'Bachelor (letteren, menswetenschappen)', bsc: 'Bachelor (wetenschappen)', bach: 'Bachelor', ma: 'Master (letteren, menswetenschappen)', msc: 'Master (wetenschappen)', llm: 'Master in de rechten', llb: 'Bachelor in de rechten', mba: 'MBA (bedrijfskunde)', master: 'Master', phd: 'Doctoraat', md: 'Doctor in de geneeskunde', dipl: 'Diploma' },
  };
  function degName(en, local) {
    if (lang === 'en') return en || local;
    const D = DEG[lang] || DEG.fr, x = (en || '').toLowerCase();
    const k = !x ? null
      : /master of laws|\bllm\b|ll\.m/.test(x) ? 'llm'
      : /bachelor of laws|\bllb\b|ll\.b/.test(x) ? 'llb'
      : /business administration|\bmba\b/.test(x) ? 'mba'
      : /doctor of medicine|\bm\.?d\.?\b/.test(x) ? 'md'
      : /doctor|ph\.?\s?d|doctorate|habilitation/.test(x) ? 'phd'
      : /master of arts|\bm\.?a\.?\b/.test(x) ? 'ma'
      : /master of science|\bm\.?sc\b/.test(x) ? 'msc'
      : /master|magister|licentiate|candidate of sciences/.test(x) ? 'master'
      : /bachelor of arts|\bb\.?a\.?\b/.test(x) ? 'ba'
      : /bachelor of science|\bb\.?sc\b/.test(x) ? 'bsc'
      : /bachelor|baccalaureate/.test(x) ? 'bach'
      : /diploma|degree/.test(x) ? 'dipl' : null;
    return k ? D[k] : local;
  }

  const SKIP_SECTION = /^(notes?|références|sources|voir aussi|liens externes|bibliographie|annexes|publications|ouvrages|œuvres|filmographie|résultats électoraux|historique électoral|references|see also|external links|further reading|bibliography|electoral history|works|notes and references|bronnen|externe links|zie ook|literatuur|noten|referenties|publicaties|bibliografie)/i;
  function splitSections(text) {
    const out = [{ title: null, level: 1, paras: [] }];
    let skipLevel = 0;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      const h = /^(={2,})\s*(.+?)\s*=+$/.exec(line);
      if (h) {
        const level = h[1].length;
        if (skipLevel && level > skipLevel) continue;
        skipLevel = SKIP_SECTION.test(h[2]) ? level : 0;
        if (!skipLevel) out.push({ title: h[2], level, paras: [] });
        continue;
      }
      if (skipLevel || !line) continue;
      out[out.length - 1].paras.push(line);
    }
    return out.filter((s) => s.paras.length);
  }

  /* ---- présentation d'un parti national (Wikidata + Wikipédia, chargés par le navigateur) */
  const partyCache = new Map();
  function loadPartyInfo(ids) {
    const ck = `${ids.join(',')}|${lang}`;
    if (partyCache.has(ck)) return partyCache.get(ck);
    const L = lang;
    const p = (async () => {
      // 1. le parti actuel de ses eurodéputés (le plus fréquent)
      const vals = ids.slice(0, 25).map((x) => `"${String(x).replace(/\D/g, '')}"`).join(' ');
      const rows = await sparql(`SELECT ?party (COUNT(DISTINCT ?mep) AS ?n) WHERE {
        VALUES ?eid { ${vals} } ?mep wdt:P1186 ?eid ; p:P102 ?st . ?st ps:P102 ?party .
        FILTER NOT EXISTS { ?st pq:P582 ?end } } GROUP BY ?party ORDER BY DESC(?n) LIMIT 1`);
      if (!rows.length) return null;
      const Q = rows[0].party.value.split('/').pop();
      // 2. ses caractéristiques
      const facts = await sparql(`SELECT ?kind ?valLabel ?val ?start WHERE {
        BIND(wd:${Q} AS ?p)
        { ?p schema:description ?val FILTER(LANG(?val) = "${L}") BIND("desc" AS ?kind) }
        UNION { ?p schema:description ?val FILTER(LANG(?val) = "en") BIND("descEn" AS ?kind) }
        UNION { ?p wdt:P571 ?val BIND("founded" AS ?kind) }
        UNION { ?p p:P488 ?s . ?s ps:P488 ?val . FILTER NOT EXISTS { ?s pq:P582 ?e } OPTIONAL { ?s pq:P580 ?start } BIND("leader" AS ?kind) }
        UNION { ?p p:P3975 ?s . ?s ps:P3975 ?val . FILTER NOT EXISTS { ?s pq:P582 ?e } OPTIONAL { ?s pq:P580 ?start } BIND("secgen" AS ?kind) }
        UNION { ?p wdt:P1142 ?val BIND("ideo" AS ?kind) }
        UNION { ?p wdt:P1387 ?val BIND("align" AS ?kind) }
        UNION { ?p wdt:P112 ?val BIND("founder" AS ?kind) }
        UNION { ?p wdt:P159 ?val BIND("seat" AS ?kind) }
        UNION { ?p wdt:P856 ?val BIND("site" AS ?kind) }
        UNION { ?p p:P463 ?s . ?s ps:P463 ?val . ?val wdt:P31 wd:Q1781616 . FILTER NOT EXISTS { ?s pq:P582 ?e } BIND("euparty" AS ?kind) }
        UNION { ?art schema:about ?p ; schema:isPartOf <https://${L}.wikipedia.org/> BIND(STR(?art) AS ?val) BIND("wiki" AS ?kind) }
        UNION { ?art schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> BIND(STR(?art) AS ?val) BIND("wikiEn" AS ?kind) }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${L},en,fr". }
      }`).catch(() => []);
      const P = { q: Q, item: `https://www.wikidata.org/wiki/${Q}`, ideo: [], align: [], founder: [], leader: [], euparty: [] };
      const lab = (b) => (b.valLabel && !/^Q\d+$/.test(b.valLabel.value) ? b.valLabel.value : null);
      for (const b of facts) {
        const k = b.kind.value, v = b.val && b.val.value;
        if (k === 'desc' || k === 'descEn' || k === 'site' || k === 'wiki' || k === 'wikiEn') { if (!P[k]) P[k] = v; }
        else if (k === 'founded') { if (!P.founded) P.founded = v.slice(0, 4); }
        else if (k === 'seat') { if (!P.seat) P.seat = lab(b); }
        else if (k === 'leader' || k === 'secgen') { const n = lab(b); if (n && !P.leader.some((x) => x.n === n)) P.leader.push({ n, since: b.start ? b.start.value.slice(0, 4) : null, sec: k === 'secgen' }); }
        else if (P[k]) { const n = lab(b); if (n && !P[k].includes(n)) P[k].push(n); }
      }
      P.leader.sort((a, b) => a.sec - b.sec);
      // 3. le texte de Wikipédia : introduction, puis histoire et idées
      const art = P.wiki || P.wikiEn;
      if (art) {
        P.article = art; P.artLang = P.wiki ? L : 'en';
        try {
          const title = decodeURIComponent(art.split('/wiki/')[1]);
          const r = await fetch(`https://${P.artLang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`);
          const j = await r.json();
          const page = Object.values((j.query && j.query.pages) || {})[0];
          if (page && page.extract) P.sections = splitSections(page.extract);
        } catch { /* pas de texte */ }
      }
      return P;
    })();
    partyCache.set(ck, p);
    p.catch(() => partyCache.delete(ck));
    return p;
  }
  function renderPartyInfo(P) {
    if (!P) return `<p class="muted">${t('partyNone')}</p>`;
    const secs = P.sections || [];
    const intro = secs[0] && !secs[0].title ? secs[0].paras : [];
    const pick = (re) => { const x = secs.find((y) => y.title && re.test(y.title)); return x ? x.paras.slice(0, 3) : []; };
    const hist = pick(/^(histo|history|geschiedenis|historiek|origin|origine|fondation|foundation)/i);
    const ideas = pick(/^(idéolog|ideolog|programme|program|positions?|politi(que|cal|ek) (positions|standpunten)|standpunten|valeurs|values|beginselen|principes)/i);
    const desc = P.desc || P.descEn;
    const fact = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
    const leaders = P.leader.slice(0, 3).map((x) => `${esc(x.n)}${x.since ? ` <span class="muted">(${esc(t('pSince', x.since))})</span>` : ''}`).join('<br>');
    const chips = (a) => (a.length ? `<span class="chips static">${a.slice(0, 6).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</span>` : '');
    const site = P.site ? `<a href="${esc(P.site)}" target="_blank" rel="noopener">${esc(P.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))} ↗</a>` : '';
    const note = P.artLang && P.artLang !== lang ? `<p class="note">${t('bioOtherLang', t('langName')[P.artLang])}</p>` : '';
    const paras = (a) => a.map((x) => `<p>${esc(x)}</p>`).join('');
    return `<div class="party-about">
      <div class="pa-text">
        ${desc && !intro.length ? `<p class="lede" style="margin-top:0">${esc(cap(desc))}.</p>` : ''}
        ${note}${paras(intro.slice(0, 4))}
        ${hist.length ? `<h3 class="h3">${t('partyHistory')}</h3>${paras(hist)}` : ''}
        ${ideas.length ? `<h3 class="h3">${t('partyIdeas')}</h3>${paras(ideas)}` : ''}
        ${P.article ? `<p><a href="${esc(P.article)}" target="_blank" rel="noopener">${t('readMoreWiki')} ↗</a></p>` : ''}
      </div>
      <dl class="pa-facts">
        ${fact(t('pLeader'), leaders)}${fact(t('pFounded'), P.founded ? esc(P.founded) : '')}${fact(t('pIdeology'), chips(P.ideo))}
        ${fact(t('pPosition'), chips(P.align))}${fact(t('pEuParty'), esc(P.euparty.join(', ')))}${fact(t('pFounders'), esc(P.founder.slice(0, 4).join(', ')))}
        ${fact(t('pSeat'), esc(P.seat || ''))}${fact(t('pSite'), site)}
      </dl>
    </div>
    <p class="credit">${t('partyCredit', P.article ? `<a href="${esc(P.article)}" target="_blank" rel="noopener">Wikipedia</a>` : '', `<a href="${esc(P.item)}" target="_blank" rel="noopener">Wikidata</a>`)}</p>`;
  }

  const yr = (it) => (it.start && !it.end ? t('since', it.start) : it.start || it.end ? `${it.start || '…'} – ${it.end}` : '');
  function bornLine(b) {
    if (!b.birth && !b.birthPlace) return '';
    const d = b.birth ? new Date(b.birth).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
    return `${t('born')}${col()}${esc(d)}${b.birthPlace ? `${d ? ', ' : ''}${esc(b.birthPlace)}` : ''}`;
  }
  function firstSentences(text, max = 380) {
    const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
    let out = '';
    for (const p of parts) { if ((out + p).length > max && out) break; out += p; }
    return out.trim();
  }
  const col = () => (lang === 'fr' ? '\u00a0: ' : ': ');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const otherLangNote = (b) => (b.lang && b.lang !== lang ? ` ${t('inLang')[b.lang]}` : '');
  function shortBio(b) {
    const intro = b.sections && b.sections[0] && !b.sections[0].title ? b.sections[0].paras.join(' ') : '';
    const born = bornLine(b);
    if (!intro && !b.desc && !born) return '';
    return `${born ? `<p class="small muted">${born}</p>` : ''}
      ${intro ? `<p>${esc(firstSentences(intro))}</p>` : b.desc ? `<p>${esc(cap(b.desc))}.</p>` : ''}
      ${b.article ? `<p class="credit">${t('source')}${col()}<a href="${esc(b.article)}" target="_blank" rel="noopener">Wikipedia</a>${otherLangNote(b)}, CC BY-SA</p>` : ''}`;
  }

  const byGroupOrder = (a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b);

  /* ================================================================ routeur */
  let token = 0;
  let embedMode = false;
  function parseHash() {
    // pages statiques (depute/<id>/, vote/<id>/…) : la route est indiquée sur <html data-route>
    const h = location.hash ? location.hash.replace(/^#\/?/, '') : (document.documentElement.dataset.route || '');
    const [p, q = ''] = h.split('?');
    return { parts: p.split('/').filter(Boolean), q: new URLSearchParams(q) };
  }
  function setQuery(params) {
    const { parts } = parseHash();
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== '' && v != null && v !== false) q.set(k, v);
    const s = q.toString();
    try { history.replaceState(history.state, '', `#/${parts.join('/')}${s ? `?${s}` : ''}`); } catch { /* ignore */ }
    // la barre de section suit les filtres (ex. tri par présence)
    const bar = $('.secbar', main);
    if (bar) {
      const tmp = document.createElement('div');
      tmp.innerHTML = sectionBar(parts[0], parts[1], new URLSearchParams(s));
      const fresh = $$('a', tmp);
      $$('a', bar).forEach((a, i) => { const on = fresh[i] && fresh[i].classList.contains('on'); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    }
  }
  function setNav(name) { const n = name; $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === n)); }
  function setTitle(x) { document.title = x ? `${x} — Hemicycle` : `Hemicycle — ${t('tagline')}`; }

  // état de chaque page (filtres, sélection…), conservé quand on change de langue, remis à zéro quand on change de page
  let PS = {};
  /* retour arrière / avant : on retrouve la page comme on l'avait laissée (défilement, onglet, filtres)
     au lieu de repartir en haut de page. Chaque entrée de l'historique reçoit une clé. */
  try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }
  const SCR = (() => { try { return JSON.parse(sessionStorage.getItem('hemi-scroll')) || {}; } catch { return {}; } })();
  const PSS = {};
  let navKey = null, restoreY = null, scrSave = 0;
  function markEntry() {
    const st = history.state;
    if (st && st.hk) { navKey = st.hk; restoreY = SCR[navKey] != null ? SCR[navKey] : null; return true; }
    navKey = Math.random().toString(36).slice(2, 10); restoreY = null;
    try { history.replaceState({ ...(st && typeof st === 'object' ? st : {}), hk: navKey }, ''); } catch { /* ignore */ }
    return false;
  }
  markEntry();
  window.addEventListener('scroll', () => {
    if (!navKey) return;
    SCR[navKey] = Math.round(window.scrollY);
    clearTimeout(scrSave);
    scrSave = setTimeout(() => { try { const k = Object.keys(SCR); if (k.length > 80) k.slice(0, k.length - 80).forEach((x) => delete SCR[x]); sessionStorage.setItem('hemi-scroll', JSON.stringify(SCR)); } catch { /* ignore */ } }, 200);
  }, { passive: true });
  window.addEventListener('hashchange', () => {
    if (navKey) PSS[navKey] = PS;
    const back = markEntry();
    PS = back && PSS[navKey] ? PSS[navKey] : {};
  });
  let keepScroll = false;
  async function rerender() {
    const y = window.scrollY;
    const focusId = document.activeElement && document.activeElement.id;
    keepScroll = true; handlers.forEach((f) => f()); handlers = [];
    await route();
    window.scrollTo(0, y);
    if (focusId && focusId !== 'lang-btn') { const el = document.getElementById(focusId); if (el) el.focus({ preventScroll: true }); }
  }

  // anciennes adresses, regroupées sur d'autres pages
  const ALIASES = { agenda: 'sessions?s=prochaine', calendrier: 'sessions?s=calendrier', archive: null };
  async function route() {
    const my = ++token;
    const h0 = parseHash();
    if (ALIASES[h0.parts[0]] && h0.parts.length === 1) { try { history.replaceState(history.state, '', `#/${ALIASES[h0.parts[0]]}`); } catch { /* ignore */ } }
    const { parts, q } = parseHash();
    closeSearch();
    drawerExtra = null;
    oldCtx = null;
    try {
      let sub = parts;
      if (parts[0] === 'archive' && parts[1] === 'old') {
        useTerm(CURRENT); oldCtx = null;
        await loadBase();
        if (my === token) {
          await pageOldTerm(my, Number(parts[2])); animateEnter(); enhanceSelects(main); paintTerm();
          const sid = q.get('s');
          setNav(sid === 'groupes' ? 'groupes' : sid === 'deputes' ? 'deputes' : 'hemi');
          const target = sid && document.getElementById(`s-${sid}`);
          if (target && !keepScroll) requestAnimationFrame(() => window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - (getComputedStyle($('.masthead')).position === 'sticky' ? $('.masthead').offsetHeight : 0) - 12 }));
        }
        keepScroll = false;
        return;
      }
      if (parts[0] === 'archive' && parts[1]) {
        const tn = Number(parts[1]);
        if (!TERMS[tn] || tn === CURRENT) { useTerm(CURRENT); notFound(); return; }
        useTerm(tn); sub = parts.slice(2);
      } else if (parts[0] === 'archive') useTerm(9); // page d'accueil des archives : législature précédente
      else useTerm(CURRENT);
      await loadBase();
      if (my !== token) return;
      const [p0, p1] = sub;
      embedMode = p0 === 'embed';
      document.documentElement.classList.toggle('embed', embedMode);
      if (embedMode && LANGS.includes(q.get('lang')) && q.get('lang') !== lang) { lang = q.get('lang'); setRegionNames(); paintChrome(); }
      if (parts[0] === 'archive' && !parts[1]) await pageArchive(my);
      else if (!p0) await pageHome(my);
      else if (p0 === 'deputes') await pageMembers(my, q);
      else if (p0 === 'depute') await pageMember(my, Number(p1), q);
      else if (p0 === 'votes') await pageVotes(my, q);
      else if (p0 === 'vote') await pageVote(my, Number(p1), q);
      else if (p0 === 'groupes') await pageGroups(my);
      else if (p0 === 'groupe') await pageGroup(my, p1);
      else if (p0 === 'comparer' && !archived()) await pageCompare(my, q);
      else if (p0 === 'themes') await pageThemes(my);
      else if (p0 === 'theme') await pageTheme(my, p1);
      else if (p0 === 'belgique' && !archived()) await pageBelgium(my);
      else if (p0 === 'suivi' && !archived()) await pageFollow(my);
      else if ((p0 === 'quiz' || p0 === 'qui-me-ressemble') && !archived()) await pageQuiz(my, q);
      else if (p0 === 'pays' && p1) await pageCountry(my, p1);
      else if (p0 === 'pays') await pageCountries(my);
      else if (p0 === 'guide' && !archived()) pageGuide();
      else if (p0 === 'parti' && p1) await pageParty(my, decodeURIComponent(p1));
      else if (p0 === 'session' && p1) await pageSession(my, p1);
      else if (p0 === 'partis') await pagePartiesIndex(my);
      else if (p0 === 'sessions') await pageSessions(my, q);
      else if (p0 === 'embed' && sub[1] === 'vote') await pageEmbed(my, Number(sub[2]), q);
      else if (p0 === 'a-propos') pageGuide('about');
      else notFound();
    } catch (err) {
      console.error(err);
      if (my === token) main.innerHTML = `<div class="callout"><strong>${t('loadError')}</strong><br>${esc(err.message)}<br><br>${t('loadErrorHint')}</div>`;
    }
    if (my === token && archived() && parts[1] && !embedMode && !$('.archive-bar', main)) {
      main.insertAdjacentHTML('afterbegin', `<div class="archive-bar"><span>${t('archiveBar', TERMS[term].years)}</span><a href="#/archive">${t('allTerms')}</a><a href="#/">${t('backToCurrent')}</a></div>`);
    }
    if (my === token) { enhanceSelects(main); paintTerm(); paintInstall(); paintFollowBadge(); endSplash(); }
    if (my === token && (['groupe', 'guide', 'a-propos', 'theme', 'groupes', 'parti', 'session', 'sessions'].includes(parts[archived() ? 2 : 0]) || (parts[archived() ? 2 : 0] === 'pays' && parts[archived() ? 3 : 1]) || parts[1] === 'old')) sectionNav();
    if (my === token) animateEnter();
    // lien vers une partie de la page : ?s=identifiant
    const sid = q.get('s');
    if (restoreY != null && my === token && !keepScroll) restoreScroll();
    else if (my === token && sid && !keepScroll && !restoredNow()) {
      const target = document.getElementById(`s-${sid}`) || document.getElementById(`g-${sid}`);
      if (target) requestAnimationFrame(() => {
        const nav = $('.subnav', main);
        const off = (getComputedStyle($('.masthead')).position === 'sticky' ? $('.masthead').offsetHeight : 0) + (nav ? nav.offsetHeight : 0) + 12;
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - off });
      });
    }
    keepScroll = false;
  }
  let lastRestore = 0;
  const restoredNow = () => performance.now() - lastRestore < 1500;

  // onglets : chaque bloc [data-tab] devient un onglet ; un seul est visible à la fois
  function tabify(q) {
    const panels = $$('.tabpanel[data-tab]', main);
    if (panels.length < 2) return { show() {} };
    const bar = document.createElement('div');
    bar.className = 'tabs';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', t('tabsLabel'));
    bar.innerHTML = `<div class="tabs-in">${panels.map((p) => `<button type="button" role="tab" id="tab-${p.id}" aria-controls="${p.id}" data-tab-go="${p.id}">${esc(p.dataset.tab)}</button>`).join('')}<span class="tabs-ink" aria-hidden="true"></span></div>`;
    panels[0].before(bar);
    panels.forEach((p) => { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', `tab-${p.id}`); });
    const btns = $$('[data-tab-go]', bar);
    const tin = $('.tabs-in', bar), ink = $('.tabs-ink', bar);
    const placeInk = (b) => {
      ink.style.transform = `translateX(${b.offsetLeft}px)`; ink.style.width = `${b.offsetWidth}px`;
      if (b.offsetLeft < tin.scrollLeft || b.offsetLeft + b.offsetWidth > tin.scrollLeft + tin.clientWidth) tin.scrollTo({ left: b.offsetLeft - 24, behavior: 'smooth' });
    };
    if (document.fonts) document.fonts.ready.then(() => { const b = btns.find((x) => x.getAttribute('aria-selected') === 'true'); if (b) { ink.classList.add('no-anim'); placeInk(b); void ink.offsetWidth; ink.classList.remove('no-anim'); } });
    const show = (id, focus) => {
      if (!panels.some((p) => p.id === id)) id = panels[0].id;
      PS.tab = id;
      panels.forEach((p) => { p.hidden = p.id !== id; });
      btns.forEach((b) => { const onIt = b.dataset.tabGo === id; b.setAttribute('aria-selected', String(onIt)); b.tabIndex = onIt ? 0 : -1; if (onIt) { placeInk(b); if (focus) b.focus(); } });
      const p = panels.find((x) => x.id === id);
      $$('[data-count]', p).forEach(countUp);
    };
    on(bar, 'click', '[data-tab-go]', (e, b) => show(b.dataset.tabGo));
    on(bar, 'keydown', '[data-tab-go]', (e, b) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const i = btns.indexOf(b);
      show(btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length].dataset.tabGo, true);
    });
    const want = q && q.get('s') ? `s-${q.get('s')}` : '';
    show(panels.some((p) => p.id === want) ? want : PS.tab || panels[0].id);
    return {
      show(id) {
        show(id);
        const mast = getComputedStyle($('.masthead')).position === 'sticky' ? $('.masthead').offsetHeight : 0;
        const top = bar.getBoundingClientRect().top - mast;
        if (top < 0 || top > innerHeight * 0.6) window.scrollTo({ top: top + window.scrollY - 12, behavior: reduceMotion() ? 'auto' : 'smooth' });
      },
    };
  }

  // sommaire collant des pages longues : une entrée par section, mise en évidence au défilement
  function sectionNav() {
    const secs = $$('section.section, .split.section > section', main).filter((x) => $('.section-head .h2', x) && !x.closest('.drawer'));
    if (secs.length < 3) return;
    secs.forEach((x, i) => { if (!x.id) x.id = `sec-${i}`; });
    secs[0].insertAdjacentHTML('beforebegin', `<nav class="subnav" aria-label="${esc(t('onThisPage'))}"><div class="subnav-in">${secs.map((x) => `<button type="button" data-goto="${x.id}">${esc($('.section-head .h2', x).textContent)}</button>`).join('')}</div></nav>`);
    const nav = $('.subnav', main);
    const offset = () => ($('.masthead').getBoundingClientRect().bottom > 0 && getComputedStyle($('.masthead')).position === 'sticky' ? $('.masthead').offsetHeight : 0) + nav.offsetHeight + 12;
    on(nav, 'click', '[data-goto]', (e, el) => {
      const target = document.getElementById(el.dataset.goto);
      $$('.rv:not(.in)', main).forEach((x) => { if (x === target || x.contains(target) || target.contains(x) || (x.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) revealNow(x); });
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset() + 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    const spy = () => {
      const y = offset() + 8;
      let cur = secs[0];
      for (const x of secs) if (x.getBoundingClientRect().top <= y) cur = x;
      $$('[data-goto]', nav).forEach((b) => { const onIt = b.dataset.goto === cur.id; b.classList.toggle('on', onIt); if (onIt) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    };
    window.addEventListener('scroll', spy, { passive: true });
    handlers.push(() => window.removeEventListener('scroll', spy));
    spy();
  }
  function animateEnter() {
    main.classList.remove('enter', 'still');
    polish();
    if (keepScroll) { main.classList.add('still'); return; } // changement de langue : pas d'animation
    void main.offsetWidth;
    main.classList.add('enter');
    reveal();
    // une fois l'entrée jouée, les mises à jour (filtres, tri, « afficher plus », surlignage) ne rejouent plus les animations
    clearTimeout(enterT);
    enterT = setTimeout(settleEnter, 1700);
  }
  let enterT = 0;
  function settleEnter() { clearTimeout(enterT); main.classList.remove('enter'); }
  main.addEventListener('input', settleEnter);
  main.addEventListener('change', settleEnter);

  // listes de définitions : chaque mot et sa définition forment une ligne, pour bien voir ce qui va avec quoi
  function polish() {
    for (const dl of $$('dl.glossary', main)) {
      if (dl.dataset.done) continue;
      dl.dataset.done = '1';
      for (const dt of $$(':scope > dt', dl)) {
        const row = document.createElement('div');
        row.className = 'gl-row';
        dt.before(row);
        row.append(dt);
        while (row.nextElementSibling && row.nextElementSibling.tagName === 'DD') row.append(row.nextElementSibling);
      }
    }
  }

  // apparition en douceur des blocs sous la ligne de flottaison, et chiffres qui défilent jusqu'à leur valeur
  let revealList = [], revealRaf = 0;
  function revealCheck() {
    revealRaf = 0;
    const lim = innerHeight * 0.92;
    revealList = revealList.filter((el) => {
      if (!el.isConnected) return false;
      if (el.getBoundingClientRect().top > lim) return true;
      el.classList.add('in');
      $$('[data-count]', el).forEach(countUp);
      return false;
    });
  }
  const revealSoon = () => { if (revealList.length && !revealRaf) revealRaf = requestAnimationFrame(revealCheck); };
  const revealNow = (el) => { if (!el.classList.contains('rv') || el.classList.contains('in')) return; el.classList.add('in'); $$('[data-count]', el).forEach(countUp); revealList = revealList.filter((x) => x !== el); };
  // filet de sécurité : quand la page est affichée dans un cadre (aperçu, intégration) le défilement se fait parfois hors de la page,
  // sans événement « scroll » : l'IntersectionObserver voit quand même le bloc arriver à l'écran
  const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { revealNow(e.target); revealIO.unobserve(e.target); } }), { rootMargin: '0px 0px -4% 0px' }) : null;
  // en capture : attrape aussi le défilement d'un conteneur (page affichée dans un cadre, appli)
  document.addEventListener('scroll', revealSoon, { passive: true, capture: true });
  window.addEventListener('resize', revealSoon);
  function reveal() {
    revealList = [];
    if (revealIO) revealIO.disconnect();
    if (reduceMotion()) return;
    const blocks = $$(':scope > .section, :scope > .split, :scope > .tabpanel:not([hidden]) > .section, :scope > .week, :scope > .kpis, :scope > .stage .stage-figures, :scope > .country-grid, :scope > .theme-grid', main);
    for (const el of blocks) {
      if (el.getBoundingClientRect().top < innerHeight * 0.92) continue;
      el.classList.add('rv');
      revealList.push(el);
      if (revealIO) revealIO.observe(el);
    }
    // chiffres déjà visibles
    $$('.kpi .val, .stage-figures .fig b, .tally b', main).forEach((el) => {
      if (!/^\s*[\d\s\u202f\u00a0.,]+\s*%?\s*$/.test(el.textContent)) return;
      el.dataset.count = '1';
      if (!el.closest('.rv')) countUp(el);
    });
  }
  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const txt = el.textContent;
    const m = /^(\s*)([\d\s\u202f\u00a0.,]*\d)(.*)$/.exec(txt);
    if (!m) return;
    const raw = m[2];
    const dec = /[.,]\d{1,2}$/.test(raw) && !/[.,]\d{3}$/.test(raw) ? raw.split(/[.,]/).pop().length : 0;
    const val = parseFloat(raw.replace(/[\s\u202f\u00a0]/g, '').replace(dec ? /[.,](?=\d{1,2}$)/ : /[.,]/g, dec ? '.' : '').replace(/,/g, ''));
    if (!isFinite(val) || val < 2) return;
    const nf = new Intl.NumberFormat(loc(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const t0 = performance.now(), dur = Math.min(1100, 500 + val * 2);
    el.style.fontVariantNumeric = 'tabular-nums';
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = `${m[1]}${nf.format(val * e)}${m[3]}`;
      if (k < 1) requestAnimationFrame(step); else el.textContent = txt;
    };
    requestAnimationFrame(step);
  }
  function notFound() {
    setNav(''); setTitle(t('notFound'));
    main.innerHTML = `<p class="kicker">404</p><h1 class="h1">${t('notFound')}</h1><p class="lede"><a href="#/">${t('backHome')}</a></p>`;
  }
  function scrollTop() {
    if (keepScroll) return;
    main.focus({ preventScroll: true });
    if (restoreY != null) { restoreScroll(); return; }
    window.scrollTo(0, 0);
  }
  // remet le défilement où il était ; si la page n'est pas encore assez longue (contenu qui arrive), on réessaie un peu plus tard
  function restoreScroll() {
    const y = restoreY; restoreY = null; lastRestore = performance.now();
    const my = token;
    window.scrollTo(0, y);
    let tries = 0;
    const again = () => {
      if (my !== token || Math.abs(window.scrollY - y) < 4 || tries++ > 8) return;
      if (document.documentElement.scrollHeight - innerHeight >= y - 4) { window.scrollTo(0, y); return; }
      setTimeout(again, 120);
    };
    setTimeout(again, 60);
  }

  /* ================================================================ accueil */
  async function pageHome(my) {
    setNav(''); setTitle('');
    await loadVotes();
    if (my !== token) return;
    const m = D.meta;
    const active = D.members.filter((x) => x.a).sort((a, b) => byGroupOrder(a.g, b.g) || a.ln.localeCompare(b.ln));
    const groups = [...new Set(active.map((x) => x.g))].sort(byGroupOrder);
    const countries = [...new Set(active.map((x) => x.c))].sort((a, b) => collate(cName(a), cName(b)));
    // dernière session plénière : les votes des derniers jours de séance (une session dure au plus quatre jours)
    const lastDay = D.votes[0] ? D.votes[0].t.slice(0, 10) : '';
    const fromDay = lastDay ? new Date(new Date(lastDay) - 4 * 864e5).toISOString().slice(0, 10) : '';
    const session = D.votes.filter((v) => v.t.slice(0, 10) >= fromDay);
    const sFinal = session.filter((v) => v.mn);
    const latest = (sFinal.length >= 3 ? sFinal : D.votes.filter((v) => v.mn)).slice(0, 6);
    const sFirst = session.length ? session[session.length - 1].t : lastDay;
    let sDates = '';
    try { sDates = new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(new Date(sFirst), new Date(lastDay)); } catch { sDates = dateLong(lastDay); }
    const yearAgo = archived() ? '' : new Date(Date.now() - 365 * 864e5).toISOString();
    const close = D.votes.filter((v) => v.mn && v.t >= yearAgo && v.c[0] + v.c[1] > 100)
      .sort((a, b) => Math.abs(a.c[0] - a.c[1]) - Math.abs(b.c[0] - b.c[1])).slice(0, 4);
    const myC0 = (() => { try { return localStorage.getItem('hemi-country') || ''; } catch { return ''; } })();
    const myC = countries.includes(myC0) ? myC0 : 'BEL';
    const splitHtml = `
      <div class="split section">
        ${archived() ? `<section>
          <div class="section-head"><h2 class="h2">${sFinal.length >= 3 ? t('lastSession') : t('latestFinal')}</h2><a class="more" href="#/${TP()}${sFinal.length >= 3 ? `session/${sessionsOf()[0].id}` : 'votes'}">${sFinal.length >= 3 ? t('seeRecap') : t('allVotes')}</a></div>
          <div class="vote-list compact">${latest.map((v) => voteRow(v)).join('')}</div>
        </section>` : `<section class="mycountry">
          <div class="section-head"><h2 class="h2">${t('myCountry')}</h2>
            <label class="sr" for="my-c">${t('myCountryPick')}</label>
            <select id="my-c">${countries.map((c) => `<option value="${c}"${c === myC ? ' selected' : ''}>${esc(cName(c))}</option>`).join('')}</select></div>
          <div id="my-box"></div>
        </section>`}
        <section>
          <div class="section-head"><h2 class="h2">${t('closest')}</h2><span class="small muted">${archived() ? t('wholeTerm') : t('last12')}</span></div>
          <div class="vote-list compact">${close.map((v) => voteRow(v, `<span class="tag">${t('marginVotes', Math.abs(v.c[0] - v.c[1]))}</span>`)).join('')}</div>
        </section>
      </div>`;
    main.innerHTML = `
      ${archived() ? '' : `<header class="home-hero">
        <p class="kicker">${t('homeKicker', TERMS[term].years)}</p>
        <h1 class="hero-t">${t('heroTitle')}</h1>
        <p class="hero-l">${t('heroLede')}</p>
        <div class="hero-go">
          <button type="button" class="btn primary" data-focus-search>${t('heroFind')}</button>
          <a class="btn" href="#/belgique">${cflag('BEL')}${t('heroBelgium')}</a>
          <a class="btn" href="#/votes">${t('heroVotes')}</a>
          <a class="btn qz-cta" href="#/quiz"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><circle cx="10" cy="10" r="7.5"/><path d="m6.8 10.2 2.2 2.2 4.2-4.6"/></svg>${t('qzTitle')}</a>
          <button type="button" class="btn" data-install hidden><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><rect x="5.5" y="2.5" width="9" height="15" rx="2"/><path d="M10 6.5v6M7.5 10l2.5 2.5 2.5-2.5"/></svg>${t('installApp')}</button>
        </div>
      </header>
      <section class="week" aria-labelledby="week-t">
        <h2 class="week-t" id="week-t">${t('weekTitle')}</h2>
        <div class="week-grid">
          <div class="week-card week-next" id="week-next"><p class="wk-k">${t('agendaNext')}</p><p class="muted">…</p></div>
          <div class="week-card week-dec">
            <div class="wk-row"><p class="wk-k">${t('weekDecisions')}${sFinal.length >= 3 ? ` · ${esc(sDates)}` : ''}</p>${sFinal.length >= 3 ? `<a class="more" href="#/session/${sessionsOf()[0].id}">${t('weekSeeSession')}</a>` : ''}</div>
            <div class="vote-list compact">${latest.slice(0, 4).map((v) => voteRow(v)).join('')}</div>
          </div>
        </div>
      </section>`}
      ${archived() ? '' : splitHtml}

      <section class="stage">
        <div class="stage-title">
          ${archived() ? `<p class="kicker">${t('homeKicker', TERMS[term].years)}</p>
          <h1 class="h1">${t('archiveTitle', TERMS[term].years)}</h1>` : `<h2 class="h1 stage-h">${t('stageTitle')}</h2>
          <p class="stage-sub">${t('stageSub', active.length, groups.length, countries.length)}</p>`}
        </div>
        <div class="stage-controls">
          <div class="chips" role="group" aria-label="${esc(t('hlGroup'))}">
            ${groups.map((g) => `<button type="button" class="chip" data-hl-group="${g}" aria-pressed="false"><i style="background:${gColor(g)}"></i>${esc(gShort(g))} <b>${active.filter((x) => x.g === g).length}</b></button>`).join('')}
          </div>
        </div>
        <div class="stage-main" id="stage-main">
          <div class="ginfo-slot" id="group-info" aria-live="polite"></div>
          <div class="stage-hemi">${hemicycle(active.map((x) => ({ color: gColor(x.g), title: `${fullName(x)} · ${gShort(x.g)} · ${cName(x.c)}`, m: x })), `<b id="hl-count">${active.length}</b><span id="hl-label">${t('centerMeps')}</span>`, 'big')}</div>
        </div>
        ${archived() ? `<p class="stage-hint">${t('clickSeat')}</p>` : ''}
        <div class="stage-figures">
          <div class="fig"><b>${fmt(m.counts.votes)}</b><span>${t('figVotes')}</span></div>
          <div class="fig"><b>${fmt(m.counts.main)}</b><span>${t('figMain')}</span></div>
          <div class="fig"><b>${pct(D.avg.att)}</b><span>${t('figAtt')}</span></div>
        </div>
      </section>
      ${archived() ? splitHtml : ''}`;

    const svg = $('.hemi', main);
    const hl = PS.home || (PS.home = { c: '', g: '' });
    const applyHL = () => {
      const any = hl.c || hl.g;
      let n = 0;
      for (const c of svg.querySelectorAll('circle')) {
        const on = (!hl.c || c.dataset.c === hl.c) && (!hl.g || c.dataset.g === hl.g);
        c.classList.toggle('hl', any && on);
        if (on) n++;
      }
      svg.classList.toggle('dim', !!any);
      $('#hl-count').textContent = n;
      $('#hl-label').textContent = any ? [hl.g ? gShort(hl.g) : '', hl.c ? cName(hl.c) : ''].filter(Boolean).join(' · ') : t('centerMeps');
    };
    on(main, 'change', '#hl-country', (e) => { hl.c = e.target.value; applyHL(); });
    on(main, 'click', '[data-hl-group]', (e, el) => {
      hl.g = hl.g === el.dataset.hlGroup ? '' : el.dataset.hlGroup;
      $$('[data-hl-group]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.hlGroup === hl.g));
      sideInfo($('#stage-main'), hl.g ? groupInfo(hl.g, true) : '');
      // les sièges changent de couleur une image plus tard : le déplacement de l'hémicycle démarre sans à-coup
      requestAnimationFrame(() => requestAnimationFrame(applyHL));
    });
    on(main, 'click', '[data-open]', (e, el) => openDrawer(Number(el.dataset.open)));
    on(main, 'click', '[data-focus-search]', () => { const q = $('#q'); q.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); q.focus({ preventScroll: true }); q.closest('.search').classList.add('pulse'); setTimeout(() => q.closest('.search').classList.remove('pulse'), 1200); });
    // mon pays : ses eurodéputés et ses partis, retenu sur l'appareil
    const drawMine = (c) => {
      const box = $('#my-box');
      if (!box) return;
      const l = active.filter((x) => x.c === c);
      const parties = [...new Set(l.map((x) => (realParty(x.p) ? x.p : '')))].map((p) => {
        const ms = l.filter((x) => (realParty(x.p) ? x.p : '') === p);
        return { p, n: ms.length, g: ms[0].g, pl: ms[0].pl };
      }).sort((a, b) => b.n - a.n || collate(a.p, b.p));
      const top = parties.slice(0, 8);
      box.innerHTML = `<p class="my-lede">${t('myCountryLede', l.length, cName(c))}</p>
        <ul class="my-parties">${top.map((x) => `<li>${x.p ? `<a href="${partyHref(c, x.p)}">` : '<span>'}${pdot(c, x.p, x.g)}<span class="my-p"><b>${esc(x.p || t('independent'))}</b>${x.pl && x.pl !== x.p ? `<small>${esc(x.pl)}</small>` : ''}</span><span class="my-n">${x.n}</span>${x.p ? '</a>' : '</span>'}</li>`).join('')}</ul>
        ${parties.length > top.length ? `<p class="small muted">${t('myCountryMore', parties.length - top.length)}</p>` : ''}
        <p class="my-links"><a class="btn primary" href="#/deputes?pays=${c}">${t('myCountrySeeMeps', l.length)}</a><a class="btn" href="${c === 'BEL' ? '#/belgique' : `#/pays/${c}`}">${c === 'BEL' ? t('beBanner') : t('myCountrySee')}</a></p>
        <p class="note">${t('myCountryNote')}</p>`;
    };
    if (!archived()) {
      drawMine(myC);
      on(main, 'change', '#my-c', (e) => { try { localStorage.setItem('hemi-country', e.target.value); } catch { /* ignore */ } drawMine(e.target.value); });
      loadAgenda().then((A) => {
        const box = $('#week-next');
        if (my !== token || !box) return;
        const x = upcoming(A)[0];
        if (!x) { box.innerHTML = `<p class="wk-k">${t('agendaNext')}</p><p class="muted">${t('agendaNone')}</p><a class="more" href="#/sessions?s=calendrier">${t('hubCal')}</a>`; return; }
        const { votes, debates } = x.days ? sessionItems(x) : { votes: [], debates: [] };
        const th = sessionThemes(votes).slice(0, 4);
        const now = x.start <= todayISO();
        box.innerHTML = `<p class="wk-k">${now ? t('hubNow') : `${t('agendaNext')} · <span class="wk-when">${esc(sessionWhen(x))}</span>`}</p>
          <p class="wk-d">${esc(sessionDates(x))}</p>
          <p class="wk-place"><i class="k-${(calKind(x, (new Date(x.end) - new Date(x.start)) / 864e5)).toLowerCase()}"></i>${esc(sessionPlace(x) || '')}</p>
          <p class="wk-s">${x.days ? t('agendaSummary', votes.length, debates.length) : t('weekNoAgenda')}</p>
          ${th.length ? `<div class="wk-th">${th.map(([id]) => `<a class="tag" href="#/theme/${id}">${esc(thName(id))}</a>`).join('')}</div>` : ''}
          <p class="wk-links"><a class="btn primary" href="#/sessions?s=prochaine">${t('seeAgenda')}</a><a class="more" href="#/sessions?s=calendrier">${t('hubCal')}</a></p>`;
      });
    }
    if (hl.c || hl.g) {
      $('#hl-country').value = hl.c;
      $$('[data-hl-group]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.hlGroup === hl.g));
      sideInfo($('#stage-main'), hl.g ? groupInfo(hl.g, true) : '', true);
      applyHL();
    }
    scrollTop();
  }

  // fiche d'un groupe à côté de l'hémicycle : la fiche glisse depuis la gauche, l'hémicycle se décale à droite
  function sideInfo(box, html, instant) {
    if (!box) return;
    const slot = $('.ginfo-slot', box);
    clearTimeout(box._t);
    if (html) {
      if (box.classList.contains('side') && slot.innerHTML && !instant) {
        slot.classList.add('swap');
        box._t = setTimeout(() => { slot.innerHTML = html; slot.classList.remove('swap'); }, 220);
      } else {
        slot.innerHTML = html;
        if (instant) { box.classList.add('no-anim'); box.classList.add('side'); void box.offsetWidth; box.classList.remove('no-anim'); }
        else { void box.offsetWidth; box.classList.add('side'); }
      }
    } else {
      box.classList.remove('side');
      box._t = setTimeout(() => { if (!box.classList.contains('side')) slot.innerHTML = ''; }, 700);
    }
  }

  // présentation d'un groupe : famille politique, description, principaux partis (calculés sur les données)
  function groupInfo(g, link = false) {
    const all = window.HEMI_GROUPS || {};
    const G = (all[lang] || {})[g] || (all.en || {})[g];
    if (!G) return '';
    const act = D.members.filter((m) => m.a && m.g === g);
    const count = new Map();
    for (const m of act) {
      const k = `${m.pl || m.p || '—'}|${m.c}`;
      count.set(k, (count.get(k) || 0) + 1);
    }
    const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, n]) => { const [p, c] = k.split('|'); return `${esc(p)} <span class="muted">(${esc(cName(c))}, ${n})</span>`; });
    const coh = D.groups.get(g)?.coh;
    if (!link) return `<div class="ginfo plain">
      <p class="lede">${esc(G.d)}</p>
      <p class="small muted">${esc(cap(G.f))}${G.y ? ` · ${t('founded', G.y)}` : ''}</p>
      ${top.length ? `<p class="small"><b>${t('mainParties')}</b>${col()}${top.join(' · ')}</p>` : ''}
    </div>`;
    return `<div class="ginfo" style="--gc:${gColor(g)}">
      <div class="ginfo-head">
        <div><h3 class="h3">${esc(gLong(g))}</h3>
          <p class="small muted">${esc(G.f)}${G.y ? ` · ${t('founded', G.y)}` : ''} · ${t('nSeats', act.length)}${coh != null && g !== 'NI' ? ` · ${t('cohesion').toLowerCase()} ${pct(coh)}` : ''}</p></div>
        ${link ? `<a class="more" href="#/${TP()}groupe/${g}">${t('seeGroup')}</a>` : ''}
      </div>
      <p>${esc(G.d)}</p>
      ${top.length ? `<p class="small"><b>${t('mainParties')}</b>${col()}${top.join(' · ')}</p>` : ''}
    </div>`;
  }

  // tableau croisé : part des votes finaux où deux groupes ont adopté la même position majoritaire
  function agreeMatrix() {
    const A = D.meta.agree || {};
    const gs = GROUP_ORDER.filter((g) => g !== 'NI' && D.members.some((m) => m.a && m.g === g));
    const get = (a, b) => (a === b ? 1 : A[a < b ? `${a}|${b}` : `${b}|${a}`]);
    return `<div class="table-wrap"><table class="matrix">
      <thead><tr><th></th>${gs.map((g) => `<th scope="col"><span class="gpill">${gdot(g)}${esc(gShort(g))}</span></th>`).join('')}</tr></thead>
      <tbody>${gs.map((a) => `<tr><th scope="row"><span class="gpill">${gdot(a)}${esc(gShort(a))}</span></th>${gs.map((b) => {
        const x = get(a, b);
        if (x == null) return '<td class="na">–</td>';
        if (a === b) return '<td class="self"></td>';
        return `<td style="--a:${Math.max(0, (x - 0.2) / 0.8).toFixed(2)}" title="${esc(t('agreeCell', gShort(a), gShort(b), pct(x)))}">${Math.round(x * 100)}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">${t('agreeNote')}</p>`;
  }

  /* ================================================================ liste des eurodéputés */
  async function pageMembers(my, q) {
    setNav('deputes'); setTitle(t('meps'));
    const st = PS.members || (PS.members = {
      q: q.get('q') || '', pays: q.get('pays') || '', groupe: q.get('groupe') || '',
      statut: q.get('statut') || 'actuels', tri: q.get('tri') || 'nom', sens: q.get('sens') || 'asc', n: 60,
    });
    const countries = [...D.countries.keys()].sort((a, b) => collate(cName(a), cName(b)));
    const groups = [...D.groups.keys()].filter((g) => D.members.some((m) => m.g === g)).sort(byGroupOrder);

    main.innerHTML = `
      <p class="kicker">${t('ep')}</p>
      <h1 class="h1" id="mem-title">${t('meps')}</h1>
      <p class="lede">${archived() ? t('mepsLedeArchive', TERMS[term].years) : t('mepsLede')}</p>
      <div class="toolbar">
        <label class="sr" for="f-q">${t('name')}</label><input id="f-q" type="search" placeholder="${esc(t('mepName'))}" value="${esc(st.q)}">
        <label class="sr" for="f-pays">${t('country')}</label><select id="f-pays"><option value="">${t('allCountries')}</option>${countries.map((c) => `<option value="${c}" ${c === st.pays ? 'selected' : ''}>${esc(cName(c))}</option>`).join('')}</select>
        <label class="sr" for="f-groupe">${t('group')}</label><select id="f-groupe"><option value="">${t('allGroups')}</option>${groups.map((g) => `<option value="${g}" ${g === st.groupe ? 'selected' : ''}>${esc(gShort(g))}</option>`).join('')}</select>
        <div class="seg" role="group" aria-label="${esc(t('status'))}">
          <button data-statut="actuels" aria-pressed="${st.statut === 'actuels'}">${t('inOffice')}</button>
          <button data-statut="anciens" aria-pressed="${st.statut === 'anciens'}">${t('former')}</button>
        </div>
      </div>
      <div class="list-tools"><p class="count-line" id="count"></p>${csvButton()}</div>
      <div class="table-wrap"><table class="t">
        <thead><tr>
          <th class="sortable" data-sort="nom">${t('mep')}</th>
          <th class="sortable col-g" data-sort="groupe">${t('group')}</th>
          <th class="sortable num" data-sort="presence" title="${esc(t('attTip'))}">${t('attendance')}</th>
          <th class="sortable num" data-sort="fidelite" title="${esc(t('loyTip'))}">${t('loyalty')}</th>
        </tr></thead><tbody id="rows"></tbody></table></div>
      <div class="more-row" id="more"></div>`;

    const draw = () => {
      setQuery({ q: st.q, pays: st.pays, groupe: st.groupe, statut: st.statut === 'actuels' ? '' : st.statut, tri: st.tri === 'nom' ? '' : st.tri, sens: st.sens === 'asc' ? '' : st.sens });
      const k = norm(st.q);
      const list = D.members.filter((m) => (st.statut === 'actuels' ? m.a : !m.a)
        && (!st.pays || m.c === st.pays) && (!st.groupe || m.g === st.groupe) && (!k || m.key.includes(k)));
      const dir = st.sens === 'asc' ? 1 : -1;
      const val = { nom: (m) => m.ln + m.fn, groupe: (m) => GROUP_ORDER.indexOf(m.g), presence: (m) => m.s.att ?? -1, fidelite: (m) => m.s.loy ?? -1 }[st.tri];
      list.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : a.ln.localeCompare(b.ln)) * dir; });
      $('#mem-title').textContent = st.pays ? `${t('meps')} · ${cName(st.pays)}` : st.groupe ? `${t('meps')} · ${gShort(st.groupe)}` : t('meps');
      $('#count').textContent = t('nMeps', list.length); shownM = list;
      $$('th[data-sort]').forEach((th) => th.setAttribute('aria-sort', th.dataset.sort === st.tri ? (st.sens === 'asc' ? 'ascending' : 'descending') : 'none'));
      $('#rows').innerHTML = list.slice(0, st.n).map((m) => `<tr class="click" data-href="#/${TP()}depute/${m.id}">
        <td><div class="who">${photo(m, 'sm')}<span><a href="#/${TP()}depute/${m.id}">${esc(fullName(m))}</a><small><span class="m-g">${gdot(m.g)}${esc(gShort(m.g))} · </span>${esc(m.p || '')}${m.p ? ' · ' : ''}${esc(cName(m.c))}</small></span></div></td>
        <td class="col-g"><span class="gpill">${gdot(m.g)}${esc(gShort(m.g))}</span></td>
        <td class="num">${meter(m.s.att)}</td>
        <td class="num">${m.g === 'NI' ? `<span class="muted" title="${esc(t('niNoGroup'))}">–</span>` : meter(m.s.loy)}</td></tr>`).join('')
        || `<tr><td colspan="4" class="muted">${t('noMepMatch')}</td></tr>`;
      $('#more').innerHTML = list.length > st.n ? `<button class="btn" data-more>${t('showMore', Math.min(60, list.length - st.n))}</button>` : '';
    };

    on(main, 'input', '#f-q', (e) => { st.q = e.target.value; st.n = 60; draw(); });
    on(main, 'change', '#f-pays', (e) => { st.pays = e.target.value; st.n = 60; draw(); });
    on(main, 'change', '#f-groupe', (e) => { st.groupe = e.target.value; st.n = 60; draw(); });
    on(main, 'click', '[data-statut]', (e, el) => { st.statut = el.dataset.statut; $$('[data-statut]').forEach((b) => b.setAttribute('aria-pressed', b === el)); draw(); });
    on(main, 'click', 'th[data-sort]', (e, el) => {
      const s = el.dataset.sort;
      if (st.tri === s) st.sens = st.sens === 'asc' ? 'desc' : 'asc'; else { st.tri = s; st.sens = s === 'nom' || s === 'groupe' ? 'asc' : 'desc'; }
      draw();
    });
    on(main, 'click', '[data-more]', () => { st.n += 60; draw(); });
    on(main, 'click', 'tr[data-href]', (e, el) => { if (!e.target.closest('a')) location.hash = el.dataset.href; });
    on(main, 'click', '[data-csv]', () => downloadCSV('hemicycle-meps.csv', [
      [t('mep'), t('group'), t('partyCol'), t('country'), t('attendance'), t('loyalty'), t('votesCast'), 'URL'],
      ...shownM.map((m) => [fullName(m), gShort(m.g), m.pl || m.p || '', cName(m.c), m.s.att ?? '', m.g === 'NI' ? '' : m.s.loy ?? '', m.s.f + m.s.a + m.s.x, shareUrl(`${TP()}depute/${m.id}`)])]));
    let shownM = [];
    draw(); scrollTop();
  }

  // délégation d'événements, nettoyée à chaque changement de page
  let handlers = [];
  function on(root, type, sel, fn) {
    const h = (e) => { const el = e.target.closest(sel); if (el && root.contains(el)) fn(e, el); };
    root.addEventListener(type, h);
    handlers.push(() => root.removeEventListener(type, h));
  }
  window.addEventListener('hashchange', () => { handlers.forEach((f) => f()); handlers = []; });

  /* ================================================================ fiche eurodéputé */
  async function pageMember(my, id, q) {
    setNav('deputes');
    const m = D.mById.get(id);
    if (!m) return notFound();
    setTitle(fullName(m));
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    const [file] = await Promise.all([memberFile(id), loadVotes()]);
    if (my !== token) return;
    const P = file.p;

    const sameGroup = D.members.filter((x) => x.a && x.g === m.g && x.s.loy != null);
    const gLoy = sameGroup.reduce((s, x) => s + x.s.loy, 0) / (sameGroup.length || 1);
    const sameCountry = D.members.filter((x) => x.a && x.c === m.c && x.s.att != null);
    const cAtt = sameCountry.reduce((s, x) => s + x.s.att, 0) / (sameCountry.length || 1);
    let rebels = 0;
    for (const ch of P) if (ch === 'f' || ch === 'a' || ch === 'x') rebels++;
    const age = ageOf(m.dob);

    const st = PS.member || (PS.member = { q: q.get('q') || '', type: q.get('type') || 'finaux', pos: q.get('pos') || '', theme: q.get('theme') || '', dissident: q.get('dissident') === '1', n: 40 });
    const themes = themesSorted().map((x) => ({ code: x.id, name: x.name[lang] }));
    // présence mois par mois
    const mAtt = new Map();
    for (let i = 0; i < D.votes.length; i++) {
      const ch = P[i];
      if (!ch || ch === '.') continue;
      const mo = D.votes[i].t.slice(0, 7);
      if (!mAtt.has(mo)) mAtt.set(mo, [0, 0]);
      const x = mAtt.get(mo); x[1]++; if (ch !== 'N') x[0]++;
    }
    const attMonths = [...mAtt.keys()].sort();

    const grpHist = m.gh ? `<p class="note">${t('groupHistory')}${col()}${m.gh.map((h) => `${esc(gShort(h.g))} (${esc(dateShort(h.s))}${h.e ? ` – ${esc(dateShort(h.e))}` : ` – ${t('today')}`})`).join(', ')}.</p>` : '';

    main.innerHTML = `
      ${crumbs(CR.deputes(), [`#/${TP()}deputes?pays=${m.c}`, cName(m.c)])}
      <div class="profile">
        ${photo(m, 'lg')}
        <div>
          <h1 class="h1">${esc(fullName(m))}</h1>
          <div class="facts">
            <a class="gpill" href="#/${TP()}groupe/${m.g}">${gdot(m.g)}${esc(gLong(m.g))}</a>
            ${m.pl ? `<span>${m.p ? partyLink(m, m.pl) : esc(m.pl)}${m.p && m.p !== m.pl ? ` (${esc(m.p)})` : ''}</span>` : ''}
            ${age ? `<span>${t('ageYears', age)}</span>` : ''}
            <span>${archived() ? t('servedFromTo', dateLong(m.since), dateLong(m.until || D.meta.termEnd.replace(/-16$/, '-15'))) : m.a ? t('inOfficeSince', dateLong(m.since)) : t('mandateEnded', dateLong(m.until))}</span>
          </div>
          <div class="links">
            <a href="${epUrl(m.id)}" target="_blank" rel="noopener">${t('officialProfile')} ↗</a>
            ${m.em && m.a && !archived() ? `<a class="email" href="mailto:${esc(m.em)}">${esc(m.em)}</a>` : ''}
            ${archived() ? '' : `<a href="#/comparer?a=${m.id}">${t('compareWith')}</a>`}
          </div>
          <div class="profile-tools">${archived() ? '' : followBtn(`m:${m.id}`)}${shareButton(`${TP()}depute/${m.id}`, fullName(m))}${m.a ? rssLink(`depute/${m.id}/feed.xml`, t('rssMep')) : ''}</div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="lab">${t('attendanceVotes')}</div><div class="val">${pct(m.s.att)}</div><div class="cmp">${t('epAverage')}${col()}${pct(D.avg.att)}<br>${t('delegation', cName(m.c))}${col()}${pct(cAtt)}</div></div>
        <div class="kpi"><div class="lab">${t('loyalty')}</div><div class="val">${m.g === 'NI' ? '–' : pct(m.s.loy)}</div><div class="cmp">${m.g === 'NI' ? t('niNoGroupLong') : `${t('average')} ${esc(gShort(m.g))}${col()}${pct(gLoy)}`}</div></div>
        <div class="kpi"><div class="lab">${t('votesCast')}</div><div class="val">${fmt(m.s.f + m.s.a + m.s.x)}</div><div class="cmp">${bar([m.s.f, m.s.a, m.s.x])}<br>${t('splitLine', fmt(m.s.f), fmt(m.s.a), fmt(m.s.x))}</div></div>
        <div class="kpi"><div class="lab">${t('againstGroup')}</div><div class="val">${m.g === 'NI' && !m.gh ? '–' : fmt(rebels)}</div><div class="cmp">${t('againstGroupNote')}</div></div>
      </div>
      ${m.s.att === 0 ? `<p class="callout">${t('presidentNote')}</p>` : ''}
      <p class="note">${t('attNote', fmt(m.s.n))}</p>
      ${grpHist}

      <div class="tabpanel" id="s-votes" data-tab="${esc(t('hisVotes'))}">
      <section class="section" id="ses-votes">
        <div class="section-head"><h2 class="h2">${t('hisVotes')}</h2></div>
        <div class="toolbar">
          <label class="sr" for="mv-q">${t('searchVote')}</label><input id="mv-q" type="search" placeholder="${esc(t('searchVotePh'))}" value="${esc(st.q)}">
          ${D.meta.mainOnly ? '' : `<div class="seg" role="group" aria-label="${esc(t('voteType'))}">
            <button data-type="finaux" aria-pressed="${st.type === 'finaux'}">${t('finalVotes')}</button>
            <button data-type="tous" aria-pressed="${st.type === 'tous'}">${t('allVotes')}</button>
          </div>`}
          <label class="sr" for="mv-pos">${t('position')}</label><select id="mv-pos"><option value="">${t('allPositions')}</option>${POS_ORDER.map((p) => `<option value="${p}" ${st.pos === p ? 'selected' : ''}>${posName(p)}</option>`).join('')}</select>
          <label class="sr" for="mv-theme">${t('theme')}</label><select id="mv-theme"><option value="">${t('allThemes')}</option>${themes.map((x) => `<option value="${x.code}" ${st.theme === x.code ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
          <label class="swchip"><input type="checkbox" role="switch" id="mv-diss" ${st.dissident ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span>${t('onlyAgainst')}</span></label>
        </div>
        <p class="count-line" id="mv-count"></p>
        <div class="vote-list" id="mv-list"></div>
        <div class="more-row" id="mv-more"></div>
      </section>
      </div>
      <div class="tabpanel" id="s-themes" data-tab="${esc(t('themesTitle'))}">
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('themesTitle')}</h2><span class="small muted">${t('finalVotesLc')}</span></div>
        ${themePositions(P)}
      </section>
      </div>
      ${attMonths.length > 1 && m.s.att ? `<div class="tabpanel" id="s-presence" data-tab="${esc(t('attTrend'))}"><section class="section">
        <div class="section-head"><h2 class="h2">${t('attTrend')}</h2><span class="small muted">${t('epAverage')}${col()}${pct(D.avg.att)}</span></div>
        ${barChart(attMonths, attMonths.map((mo) => mAtt.get(mo)[0] / mAtt.get(mo)[1]), { color: gColor(m.g) })}
        <p class="note">${t('attTrendNote')}</p>
      </section></div>` : ''}
      <div class="tabpanel" id="s-bio" data-tab="${esc(t('bioTitle'))}">
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('bioTitle')}</h2></div>
        <div id="bio"><p class="muted">${t('bioLoading')}</p></div>
      </section>
      </div>
`;

    const draw = () => {
      setQuery({ q: st.q, type: st.type === 'finaux' ? '' : st.type, pos: st.pos, theme: st.theme, dissident: st.dissident ? '1' : '' });
      const k = norm(st.q);
      const out = [];
      for (let i = 0; i < D.votes.length; i++) {
        const ch = P[i];
        if (!ch || ch === '.') continue;
        const v = D.votes[i];
        if (st.type === 'finaux' && !v.mn) continue;
        if (st.pos && ch.toUpperCase() !== st.pos) continue;
        if (st.dissident && !(ch === 'f' || ch === 'a' || ch === 'x')) continue;
        if (st.theme && !themesOf(v).includes(st.theme)) continue;
        if (k && !v.key.includes(k)) continue;
        out.push([v, ch]);
      }
      $('#mv-count').textContent = t('nVotes', out.length);
      $('#mv-list').innerHTML = out.slice(0, st.n).map(([v, ch]) =>
        voteRow(v, `${pos(ch)}${/[fax]/.test(ch) ? `<span class="tag rebel" title="${esc(t('rebelTip'))}">${t('againstGroupTag')}</span>` : ''}`)).join('')
        || `<p class="muted" style="padding:16px 0">${t('noVoteMatch')}</p>`;
      $('#mv-more').innerHTML = out.length > st.n ? `<button class="btn" data-more>${t('showMoreVotes', 40)}</button>` : '';
    };
    on(main, 'input', '#mv-q', (e) => { st.q = e.target.value; st.n = 40; draw(); });
    on(main, 'click', '[data-type]', (e, el) => { st.type = el.dataset.type; $$('[data-type]').forEach((b) => b.setAttribute('aria-pressed', b === el)); st.n = 40; draw(); });
    on(main, 'change', '#mv-pos', (e) => { st.pos = e.target.value; st.n = 40; draw(); });
    on(main, 'change', '#mv-theme', (e) => { st.theme = e.target.value; st.n = 40; draw(); });
    on(main, 'change', '#mv-diss', (e) => { st.dissident = e.target.checked; st.n = 40; draw(); });
    on(main, 'click', '[data-more]', () => { st.n += 40; draw(); });
    on(main, 'click', '[data-bio-more]', (e, el) => { const more = $('.bio-more', main); if (more) more.hidden = false; el.remove(); });
    on(main, 'click', '[data-theme-pick]', (e, el) => {
      st.theme = el.dataset.themePick; st.type = 'finaux'; st.n = 40;
      $('#mv-theme').value = st.theme; $$('[data-type]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.type === 'finaux'));
      draw(); tabs.show('s-votes');
    });
    const tabs = tabify(q);
    draw(); scrollTop();
    loadBio(m.id).then((b) => { if (my === token) $('#bio').innerHTML = renderBio(b, m); })
      .catch(() => { if (my === token) $('#bio').innerHTML = `<p class="muted">${t('bioFailed', epUrl(m.id))}</p>`; });
  }

  function renderBio(b, m) {
    const cvLink = epUrl(m.id);
    if (!b) return `<p class="muted">${t('bioNone', esc(fullName(m)), cvLink)}</p>`;

    let text = '';
    let shown = 0;
    let hiddenHtml = '';
    for (const s of b.sections || []) {
      const block = `${s.title ? `<h${s.level <= 2 ? 3 : 4} class="bio-h">${esc(s.title)}</h${s.level <= 2 ? 3 : 4}>` : ''}${s.paras.map((p) => `<p>${esc(p)}</p>`).join('')}`;
      const len = s.paras.join(' ').length;
      if (shown < 2200 || !s.title) { text += block; shown += len; } else hiddenHtml += block;
    }
    if (!text && b.desc) text = `<p>${esc(cap(b.desc))}.</p>`;
    if (b.lang && b.lang !== lang && text) text = `<p class="note">${t('bioOtherLang', t('langName')[b.lang])}</p>${text}`;
    if (hiddenHtml) text += `<div class="bio-more" hidden>${hiddenHtml}</div><button type="button" class="btn" data-bio-more>${t('readFullBio')}</button>`;
    if (!text) text = `<p class="muted">${t('bioNoText', cvLink)}</p>`;

    const sortDesc = (arr) => arr.slice().sort((x, y) => (y.start || y.end || '0').localeCompare(x.start || x.end || '0'));
    const posList = sortDesc(b.pos).slice(0, 14);
    const cvRow = (it, extra = '') => `<li><span class="when">${esc(yr(it))}</span><span>${esc(cap(it.label))}${extra}</span></li>`;
    const born = bornLine(b);
    const ideos = [...new Set(b.ideo.map((x) => x.label))];
    const cv = [
      born || b.langs.length ? `<div class="cv-block"><h4>${t('cvKey')}</h4>${born ? `<p>${born}</p>` : ''}${b.langs.length ? `<p>${t('languages')}${col()}${esc(b.langs.map((x) => x.label).join(', '))}</p>` : ''}</div>` : '',
      posList.length ? `<div class="cv-block"><h4>${t('cvPositions')}</h4><ul class="cv-list">${posList.map((x) => cvRow(x)).join('')}</ul></div>` : '',
      b.edu.length ? `<div class="cv-block"><h4>${t('cvEducation')}</h4><ul class="cv-list">${sortDesc(b.edu).map((x) => cvRow(x, x.deg ? ` <span class="muted">· ${esc(x.deg)}</span>` : '')).join('')}</ul></div>` : '',
      b.job.length ? `<div class="cv-block"><h4>${t('cvJobs')}</h4><p>${esc(b.job.map((x) => x.label).join(', '))}</p></div>` : '',
      b.party.length ? `<div class="cv-block"><h4>${t('cvParties')}</h4><ul class="cv-list">${sortDesc(b.party).map((x) => cvRow(x)).join('')}</ul></div>` : '',
      ideos.length ? `<div class="cv-block"><h4>${t('cvIdeology')}</h4><div class="chips static">${ideos.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div></div>` : '',
      b.site ? `<div class="cv-block"><h4>${t('cvSite')}</h4><p><a href="${esc(b.site)}" target="_blank" rel="noopener">${esc(b.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))} ↗</a></p></div>` : '',
    ].join('');

    return `<div class="bio-grid">
        <div class="bio-text">${text}</div>
        <aside class="cv">${cv || `<p class="muted small">${t('cvNone')}</p>`}
          <div class="cv-block"><a href="${cvLink}" target="_blank" rel="noopener">${t('officialProfile')} ↗</a></div></aside>
      </div>
      <p class="credit">${t('bioCredit', b.article ? `<a href="${esc(b.article)}" target="_blank" rel="noopener">Wikipedia</a>` : '', `<a href="${esc(b.wikidata)}" target="_blank" rel="noopener">Wikidata</a>`)}</p>`;
  }

  function themePositions(P) {
    const agg = new Map();
    for (let i = 0; i < D.votes.length; i++) {
      const v = D.votes[i];
      if (!v.mn) continue;
      const k = { F: 0, A: 1, X: 2 }[(P[i] || '.').toUpperCase()];
      if (k === undefined) continue;
      for (const c of themesOf(v)) { if (!agg.has(c)) agg.set(c, [0, 0, 0]); agg.get(c)[k]++; }
    }
    const rows = [...agg].filter(([, n]) => n[0] + n[1] + n[2] >= 5).sort((a, b) => (b[1][0] + b[1][1] + b[1][2]) - (a[1][0] + a[1][1] + a[1][2]));
    if (!rows.length) return `<p class="muted">${t('themesNone')}</p>`;
    return `<div class="table-wrap"><table class="t gtable themes"><thead><tr><th>${t('theme')}</th><th></th><th class="num">${posName('F')}</th><th class="num">${posName('A')}</th><th class="num">${t('abstShort')}</th></tr></thead><tbody>
      ${rows.map(([c, n]) => { const tt = n[0] + n[1] + n[2]; return `<tr><td><button type="button" class="linkish" data-theme-pick="${c}">${esc(thName(c))}</button></td><td class="barcell">${bar(n, true)}</td>
        <td class="num">${pct(n[0] / tt)}</td><td class="num">${pct(n[1] / tt)}</td><td class="num">${pct(n[2] / tt)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="note">${t('themesNote')}</p>`;
  }

  /* ================================================================ liste des votes */
  async function pageVotes(my, q) {
    setNav('votes'); setTitle(t('votes'));
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    await loadVotes();
    if (my !== token) return;
    const st = PS.votes || (PS.votes = { q: q.get('q') || '', type: q.get('type') || 'finaux', th: q.get('th') || '', com: q.get('com') || q.get('theme') || '', res: q.get('res') || '', geo: q.get('geo') || '', annee: q.get('annee') || '', n: 30 });
    const geos = D.meta.geo.map((g) => ({ code: g.code, name: geoName(g.code) })).sort((a, b) => collate(a.name, b.name));
    const years = [...new Set(D.votes.map((v) => v.t.slice(0, 4)))].sort().reverse();

    main.innerHTML = `
      <p class="kicker">${t('plenary')}</p>
      <h1 class="h1">${t('votes')}</h1>
      <p class="lede">${archived() ? t('votesLedeArchive', TERMS[term].years) : t('votesLede')}</p>
      <div class="toolbar">
        <label class="sr" for="v-q">${t('search')}</label><input id="v-q" type="search" placeholder="${esc(t('votesSearchPh'))}" value="${esc(st.q)}">
        ${D.meta.mainOnly ? '' : `<div class="seg" role="group" aria-label="${esc(t('voteType'))}">
          <button data-type="finaux" aria-pressed="${st.type === 'finaux'}">${t('finalVotes')}</button>
          <button data-type="tous" aria-pressed="${st.type === 'tous'}">${t('all')}</button>
        </div>`}
      </div>
      <div class="toolbar" style="margin-top:0">
        <label class="sr" for="v-theme">${t('theme')}</label><select id="v-theme"><option value="">${t('allThemes')}</option>${themesSorted().map((x) => `<option value="${x.id}" ${st.th === x.id ? 'selected' : ''}>${esc(x.name[lang])}</option>`).join('')}</select>
        <label class="sr" for="v-geo">${t('concernedCountry')}</label><select id="v-geo"><option value="">${t('allConcerned')}</option>${geos.map((g) => `<option value="${g.code}" ${st.geo === g.code ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
        <label class="sr" for="v-res">${t('resultLabel')}</label><select id="v-res"><option value="">${t('allResults')}</option><option value="ADOPTED" ${st.res === 'ADOPTED' ? 'selected' : ''}>${t('adoptedPl')}</option><option value="REJECTED" ${st.res === 'REJECTED' ? 'selected' : ''}>${t('rejectedPl')}</option></select>
        <label class="sr" for="v-annee">${t('year')}</label><select id="v-annee"><option value="">${t('allYears')}</option>${years.map((y) => `<option ${st.annee === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
      </div>
      <div id="v-com"></div>
      <div class="list-tools"><p class="count-line" id="v-count"></p><span class="tools">${rssLink('feed.xml')}${csvButton()}</span></div>
      <div class="vote-list" id="v-list"></div>
      <div class="more-row" id="v-more"></div>`;

    const draw = () => {
      setQuery({ q: st.q, type: st.type === 'finaux' ? '' : st.type, th: st.th, com: st.com, res: st.res, geo: st.geo, annee: st.annee });
      const k = norm(st.q);
      const list = D.votes.filter((v) => (st.type !== 'finaux' || v.mn) && (!st.th || themesOf(v).includes(st.th)) && (!st.com || (v.cm || []).includes(st.com))
        && (!st.geo || (v.geo || []).includes(st.geo)) && (!st.res || resultOf(v) === st.res)
        && (!st.annee || v.t.startsWith(st.annee)) && (!k || k.split(/\s+/).every((w) => v.key.includes(w))));
      shown = list;
      $('#v-com').innerHTML = st.com ? `<div class="chips static" style="margin:6px 0 4px"><button type="button" class="chip" data-clear-com aria-label="${esc(t('close'))}">${esc(t('committee'))}${col()}${esc(comName(st.com))} <span aria-hidden="true">×</span></button></div>` : '';
      $('#v-count').textContent = t('nVotes', list.length);
      $('#v-list').innerHTML = list.slice(0, st.n).map((v) => voteRow(v)).join('') || `<p class="muted" style="padding:16px 0">${t('noVoteMatch')}</p>`;
      $('#v-more').innerHTML = list.length > st.n ? `<button class="btn" data-more>${t('showMoreVotes', 30)}</button>` : '';
    };
    on(main, 'input', '#v-q', (e) => { st.q = e.target.value; st.n = 30; draw(); });
    on(main, 'click', '[data-type]', (e, el) => { st.type = el.dataset.type; $$('[data-type]').forEach((b) => b.setAttribute('aria-pressed', b === el)); st.n = 30; draw(); });
    let shown = [];
    for (const [sel, key] of [['#v-theme', 'th'], ['#v-geo', 'geo'], ['#v-res', 'res'], ['#v-annee', 'annee']]) on(main, 'change', sel, (e) => { st[key] = e.target.value; st.n = 30; draw(); });
    on(main, 'click', '[data-clear-com]', () => { st.com = ''; st.n = 30; draw(); });
    on(main, 'click', '[data-csv]', () => downloadCSV('hemicycle-votes.csv', [
      [t('date'), t('vote'), t('themeCol'), t('resultLabel'), posName('F'), posName('A'), posName('X'), t('didNotVotePl'), t('finalVote'), 'URL'],
      ...shown.map((v) => [csvDate(v.t), tiOf(v), topicOf(v), resName(resultOf(v)), v.c[0], v.c[1], v.c[2], v.c[3], v.mn ? 1 : 0, shareUrl(`${TP()}vote/${v.id}`)])]));
    on(main, 'click', '[data-more]', () => { st.n += 30; draw(); });
    draw(); scrollTop();
  }

  /* ================================================================ fiche d'un vote */
  // position majoritaire de chaque groupe, en pastilles : pour, contre, abstention, partagés
  function voteSides(g) {
    const side = { F: [], A: [], X: [], S: [] };
    for (const [k, c] of Object.entries(g || {}).sort((p, q) => byGroupOrder(p[0], q[0]))) {
      const ex = c[0] + c[1] + c[2];
      if (!ex) continue;
      const top = Math.max(c[0], c[1], c[2]);
      const tie = [c[0], c[1], c[2]].filter((y) => y === top).length > 1;
      side[tie ? 'S' : ['F', 'A', 'X'][[c[0], c[1], c[2]].indexOf(top)]].push(k);
    }
    const row = (key, lab, cls) => (side[key].length ? `<li class="${cls}"><span class="vs-l">${lab}</span><span class="vs-g">${side[key].map((k) => `<a class="gpill" href="#/${TP()}groupe/${k}">${gdot(k)}${esc(gShort(k))}</a>`).join('')}</span></li>` : '');
    return `<ul class="v-sides">${row('F', t('sumFor'), 'f')}${row('A', t('sumAgainst'), 'a')}${row('X', t('sumAbst'), 'x')}${row('S', t('sumSplit'), 's')}</ul>`;
  }
  async function pageVote(my, id, q) {
    setNav('votes');
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVote')}</p>`;
    await loadVotes();
    const v = D.vById.get(id);
    if (!v) return notFound();
    setTitle(tiOf(v));
    const file = await voteFile(id);
    if (my !== token) return;
    const P = file.p;
    const r = resultOf(v);
    const present = D.members.map((m, i) => ({ m, p: P[i] })).filter((x) => x.p && x.p !== '.');

    const seated = present.slice().sort((a, b) => byGroupOrder(a.m.g, b.m.g) || POS_ORDER.indexOf(a.p) - POS_ORDER.indexOf(b.p) || a.m.ln.localeCompare(b.m.ln));
    const colorPos = { F: 'var(--for)', A: 'var(--against)', X: 'var(--abst)', N: 'var(--absent)' };

    const gRows = Object.entries(file.g).sort((a, b) => byGroupOrder(a[0], b[0])).map(([g, c]) => {
      const exprimed = c[0] + c[1] + c[2];
      const top = Math.max(c[0], c[1], c[2]);
      const tie = [c[0], c[1], c[2]].filter((x) => x === top).length > 1;
      const maj = exprimed && !tie ? ['F', 'A', 'X'][[c[0], c[1], c[2]].indexOf(top)] : null;
      return `<tr><td><span class="gname">${gdot(g)}<a href="#/${TP()}groupe/${g}" style="color:inherit">${esc(gShort(g))}</a></span></td>
        <td class="barcell">${bar(c, true)}</td>
        <td class="num small"><span style="color:var(--for)">${c[0]}</span> · <span style="color:var(--against)">${c[1]}</span> · <span style="color:var(--abst)">${c[2]}</span> · <span class="muted">${c[3]}</span></td>
        <td>${maj ? pos(maj) : `<span class="muted small">${exprimed ? t('split') : '—'}</span>`}</td></tr>`;
    }).join('');

    const cAgg = new Map();
    for (const { m, p } of present) {
      if (!cAgg.has(m.c)) cAgg.set(m.c, [0, 0, 0, 0]);
      cAgg.get(m.c)[{ F: 0, A: 1, X: 2, N: 3 }[p]]++;
    }
    const cRows = [...cAgg].sort((a, b) => collate(cName(a[0]), cName(b[0]))).map(([c, n]) =>
      `<tr><td><a href="#/${TP()}vote/${v.id}?pays=${c}" data-country="${c}" style="color:inherit">${esc(cName(c))}</a></td><td class="barcell">${bar(n, true)}</td>
        <td class="num small">${n[0]} · ${n[1]} · ${n[2]} · <span class="muted">${n[3]}</span></td></tr>`).join('');

    const pAgg = new Map();
    for (const { m, p } of present) {
      const key = `${m.p || ''}|${m.c}`;
      if (!pAgg.has(key)) pAgg.set(key, { p: m.p, pl: m.pl, c: m.c, n: [0, 0, 0, 0], gs: new Map() });
      const x = pAgg.get(key); x.n[{ F: 0, A: 1, X: 2, N: 3 }[p]]++; x.gs.set(m.g, (x.gs.get(m.g) || 0) + 1);
    }
    const parties = [...pAgg.values()].sort((a, b) => (b.n[0] + b.n[1] + b.n[2] + b.n[3]) - (a.n[0] + a.n[1] + a.n[2] + a.n[3]) || collate(a.p || '', b.p || ''));
    const partyRow = (x) => {
      const c = x.n, top = Math.max(c[0], c[1], c[2]), ex = c[0] + c[1] + c[2];
      const maj = ex && [c[0], c[1], c[2]].filter((y) => y === top).length === 1 ? ['F', 'A', 'X'][[c[0], c[1], c[2]].indexOf(top)] : null;
      const g = [...x.gs].sort((a, b) => b[1] - a[1])[0][0];
      return `<tr><td><span class="pname"><b>${realParty(x.p) ? pdot(x.c, x.p, g) : ''}${realParty(x.p) ? `<a href="${partyHref(x.c, x.p)}" style="color:inherit">${esc(x.p)}</a>` : esc(t('independent'))}</b>${x.pl && x.pl !== x.p ? `<small>${esc(x.pl)}</small>` : ''}</span></td>
        <td class="small pc">${esc(cName(x.c))}</td><td><span class="gpill" style="font-weight:500">${gdot(g)}${esc(gShort(g))}</span></td>
        <td class="barcell">${bar(c, true)}</td>
        <td class="num small"><span style="color:var(--for)">${c[0]}</span> · <span style="color:var(--against)">${c[1]}</span> · <span style="color:var(--abst)">${c[2]}</span> · <span class="muted">${c[3]}</span></td>
        <td>${maj ? pos(maj) : `<span class="muted small">${ex ? t('split') : '—'}</span>`}</td></tr>`;
    };
    // parcours du texte : les autres votes de la même procédure
    const same = v.pr ? D.votes.filter((x) => x.pr === v.pr) : [];
    const path = same.filter((x) => x.mn || x.id === v.id).sort((a, b) => a.t.localeCompare(b.t) || a.id - b.id);
    const others = same.length - path.length;

    const oeilLang = lang === 'fr' ? 'fr' : 'en';
    const proc = v.pr ? `https://oeil.secure.europarl.europa.eu/oeil/${oeilLang}/procedure-file?reference=${encodeURIComponent(v.pr)}` : null;
    const ta = v.ta && /P(\d+)_TA\((\d{4})\)(\d+)/.exec(v.ta);
    const taUrl = ta ? `https://www.europarl.europa.eu/doceo/document/TA-${ta[1]}-${ta[2]}-${ta[3].padStart(4, '0')}_${lang.toUpperCase()}.html` : null;
    const exprimed = v.c[0] + v.c[1] + v.c[2];
    const margin = exprimed ? Math.abs(v.c[0] - v.c[1]) : null;
    const procName = (x) => I18N[lang].proc[x] || I18N.en.proc[x] || x;

    main.innerHTML = `
      ${crumbs(CR.votes(), (() => { const x = sessionsOf().find((y) => y.id === D.vSession.get(v.id)); return x ? [`#/${TP()}session/${x.id}`, `${t('sessKicker')} · ${sessionRange(x)}`] : null; })())}
      <p class="kicker">${esc(dateLong(v.t))}</p>
      <div class="vote-head">
        <div>
          <h1 class="h1">${esc(tiOf(v))}</h1>
          ${tiOf(v) !== v.ti ? `<p class="small muted ti-off">${t('officialTitle')} : <span lang="en">${esc(v.ti)}</span></p>` : ''}
          ${v.pt && lang === 'en' && norm(v.pt) !== norm(v.ti) ? `<p class="lede">${esc(v.pt)}</p>` : ''}
          ${explainVote(v, file.g)}
          <div class="vote-meta">
            ${v.mn ? `<span class="tag">${t('finalVote')}</span>` : ''}
            ${shortLabel(v) ? `<span>${esc(shortLabel(v))}</span>` : ''}${v.ref ? `<span>${esc(v.ref)}</span>` : ''}
            ${v.ty ? `<span>${esc(procName(v.ty))}${v.st ? ` · ${esc(t('stage')[v.st] || v.st)}` : ''}</span>` : ''}
            ${themesOf(v).map((x) => `<a href="#/${TP()}theme/${x}">${esc(thName(x))}</a>`).join('')}
            ${(v.cm || []).map((c) => `<a href="#/${TP()}votes?com=${c}&type=tous" title="${esc(t('committee'))}">${esc(comName(c))}</a>`).join('')}
            ${(v.geo || []).map((g) => `<a href="#/${TP()}votes?geo=${g}">${esc(geoName(g))}</a>`).join('')}
          </div>
          <div class="vote-tools">${shareButton(`${TP()}vote/${v.id}`, topicOf(v) ? cap(topicOf(v)) : tiOf(v))}${reportLink(v)}</div>
        </div>
        <div class="verdict">
          <div class="kicker">${t('resultLabel')}</div>
          <div class="big ${r}">${resName(r)}</div>
          ${bar(v.c, true)}
          <div class="tally">
            <div class="f"><b>${v.c[0]}</b><span>${posName('F')}</span></div>
            <div class="a"><b>${v.c[1]}</b><span>${posName('A')}</span></div>
            <div class="x"><b>${v.c[2]}</b><span>${posName('X')}</span></div>
            <div class="n"><b>${v.c[3]}</b><span>${t('didNotVotePl')}</span></div>
          </div>
          ${margin != null ? `<p class="note" style="margin-top:12px">${t('marginNote', margin)}</p>` : ''}
        </div>
      </div>

      <div class="tabpanel" id="s-hemicycle" data-tab="${esc(t('inHemicycle'))}"><section class="section">
        <div class="section-head"><h2 class="h2">${t('inHemicycle')}</h2><span class="small muted">${t('clickSeatShort')}</span></div>
        <div style="max-width:680px;margin:0 auto">
          ${hemicycle(seated.map(({ m, p }) => ({ color: colorPos[p], title: `${fullName(m)} · ${gShort(m.g)} · ${cName(m.c)} — ${posName(p)}`, m })))}
          <div class="legend" style="justify-content:center">${POS_ORDER.map((p) => `<span><i style="background:${colorPos[p]}"></i>${posName(p)}</span>`).join('')}</div>
          <p class="note" style="text-align:center;margin:8px auto 0">${t('leftToRight')}${col()}${[...new Set(seated.map((x) => x.m.g))].map(gShort).map(esc).join(', ')}.</p>
        </div>
      </section></div>

      <div class="tabpanel" id="s-groupes" data-tab="${esc(t('tabGroups'))}"><section class="section">
        <div class="section-head"><h2 class="h2">${t('byGroup')}</h2></div>
        <div class="table-wrap"><table class="t gtable vt-groups"><thead><tr><th>${t('group')}</th><th></th><th class="num">${t('tallyHead')}</th><th>${t('majority')}</th></tr></thead><tbody>${gRows}</tbody></table></div>
      </section></div>

      <div class="tabpanel" id="s-pays" data-tab="${esc(t('tabCountries'))}"><section class="section" id="v-map-sec">
        <div class="section-head"><h2 class="h2">${t('mapTitle')}</h2></div>
        <div id="v-map" class="vmap"></div>
        <p class="note">${t('mapNote')}</p>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('byCountry')}</h2></div>
        <div class="table-wrap"><table class="t gtable"><thead><tr><th>${t('country')}</th><th></th><th class="num">${t('tallyHead')}</th></tr></thead><tbody>${cRows}</tbody></table></div>
      </section></div>

      <div class="tabpanel" id="s-partis" data-tab="${esc(t('byParty'))}"><section class="section">
        <div class="section-head"><h2 class="h2">${t('byParty')}</h2><span class="small muted">${t('nParties', parties.length)}</span></div>
        <div class="table-wrap"><table class="t gtable parties"><thead><tr><th>${t('partyCol')}</th><th>${t('country')}</th><th>${t('group')}</th><th></th><th class="num">${t('tallyHead')}</th><th>${t('majority')}</th></tr></thead><tbody id="pt-rows"></tbody></table></div>
        <div class="more-row" id="pt-more"></div>
      </section></div>

      <div class="tabpanel" id="s-deputes" data-tab="${esc(t('tabMeps'))}"><section class="section" id="all">
        <div class="section-head"><h2 class="h2">${t('allMepsTitle')}</h2></div>
        <div class="toolbar">
          <label class="sr" for="va-q">${t('name')}</label><input id="va-q" type="search" placeholder="${esc(t('searchMep'))}">
          <label class="sr" for="va-pays">${t('country')}</label><select id="va-pays"><option value="">${t('allCountries')}</option>${[...cAgg.keys()].sort((a, b) => collate(cName(a), cName(b))).map((c) => `<option value="${c}" ${q.get('pays') === c ? 'selected' : ''}>${esc(cName(c))}</option>`).join('')}</select>
          <div class="seg" role="group" aria-label="${esc(t('position'))}">
            <button data-p="" aria-pressed="true">${t('all')}</button>${POS_ORDER.map((p) => `<button data-p="${p}" aria-pressed="false">${posName(p)}</button>`).join('')}
          </div>
        </div>
        <div class="list-tools"><p class="count-line" id="va-count"></p>${csvButton()}</div>
        <div class="table-wrap"><table class="t"><thead><tr><th>${t('mep')}</th><th>${t('group')}</th><th>${t('country')}</th><th>${t('vote')}</th></tr></thead><tbody id="va-rows"></tbody></table></div>
        <div class="more-row" id="va-more"></div>
      </section></div>

      ${same.length > 1 ? `<div class="tabpanel" id="s-texte" data-tab="${esc(t('textPath'))}"><section class="section">
        <div class="section-head"><h2 class="h2">${t('textPath')}</h2>${v.pr ? `<span class="small muted">${esc(v.pr)}</span>` : ''}</div>
        <p class="note" style="margin-top:0">${t('textPathLede', same.length)}</p>
        <div class="vote-list compact path">${path.map((x) => (x.id === v.id ? voteRow(x, `<span class="tag here">${t('textPathThis')}</span>`).replace('class="vrow"', 'class="vrow here" aria-current="page"') : voteRow(x))).join('')}</div>
        ${others > 0 && !D.meta.mainOnly ? `<p style="margin-top:12px"><a class="more" href="#/${TP()}votes?q=${encodeURIComponent(v.pr)}&type=tous">${t('textPathMore', others)}</a></p>` : ''}
      </section></div>` : ''}

      <section class="section">
        <div class="section-head"><h2 class="h2">${t('sources')}</h2></div>
        <div class="sources">
          <a href="https://howtheyvote.eu/votes/${v.id}" target="_blank" rel="noopener">${t('onHtv')} ↗</a>
          ${proc ? `<a href="${proc}" target="_blank" rel="noopener">${t('procedureLink', esc(v.pr))} ↗</a>` : ''}
          ${taUrl ? `<a href="${taUrl}" target="_blank" rel="noopener">${t('adoptedText')} ↗</a>` : ''}
          ${v.au_url ? `<a href="${esc(v.au_url)}" target="_blank" rel="noopener">${t('amendmentsPdf')} ↗</a>` : ''}
        </div>
        <p class="note">${t('titlesNote')}</p>
      </section>`;

    const posOf = new Map(present.map(({ m, p }) => [m.id, p]));
    drawerExtra = (mm) => (posOf.has(mm.id) ? `<div class="drawer-vote"><span>${t('onThisVote')}</span>${pos(posOf.get(mm.id))}</div>` : '');
    const st = PS.vote || (PS.vote = { q: '', p: '', pays: q.get('pays') || '', n: 50 });
    $('#va-q').value = st.q; $('#va-pays').value = st.pays;
    $$('[data-p]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === st.p)));
    const draw = () => {
      const k = norm(st.q);
      const list = seated.filter((x) => (!st.p || x.p === st.p) && (!st.pays || x.m.c === st.pays) && (!k || x.m.key.includes(k)))
        .sort((a, b) => collate(a.m.ln, b.m.ln));
      $('#va-count').textContent = t('nMeps', list.length);
      $('#va-rows').innerHTML = list.slice(0, st.n).map(({ m, p }) => `<tr class="click" data-href="#/${TP()}depute/${m.id}">
        <td><div class="who">${photo(m, 'xs')}<a href="#/${TP()}depute/${m.id}">${esc(fullName(m))}</a></div></td>
        <td><span class="gpill" style="font-weight:500">${gdot(m.g)}${esc(gShort(m.g))}</span></td><td>${esc(cName(m.c))}</td><td>${pos(p)}</td></tr>`).join('');
      $('#va-more').innerHTML = list.length > st.n ? `<button class="btn" data-more>${t('showMore', 50)}</button>` : '';
    };
    on(main, 'input', '#va-q', (e) => { st.q = e.target.value; st.n = 50; draw(); });
    on(main, 'change', '#va-pays', (e) => { st.pays = e.target.value; st.n = 50; draw(); });
    on(main, 'click', '[data-p]', (e, el) => { st.p = el.dataset.p; $$('[data-p]').forEach((b) => b.setAttribute('aria-pressed', b === el)); st.n = 50; draw(); });
    on(main, 'click', '[data-more]', () => { st.n += 50; draw(); });
    on(main, 'click', 'tr[data-href]', (e, el) => { if (!e.target.closest('a')) location.hash = el.dataset.href; });
    let ptN = 15;
    const drawParties = () => {
      $('#pt-rows').innerHTML = parties.slice(0, ptN).map(partyRow).join('');
      $('#pt-more').innerHTML = parties.length > ptN ? `<button class="btn" data-pt-more>${t('showMore', Math.min(30, parties.length - ptN))}</button>` : '';
    };
    drawParties();
    on(main, 'click', '[data-pt-more]', () => { ptN += 30; drawParties(); });
    on(main, 'click', '[data-csv]', () => {
      const k = norm(st.q);
      const list = seated.filter((x) => (!st.p || x.p === st.p) && (!st.pays || x.m.c === st.pays) && (!k || x.m.key.includes(k))).sort((a, b) => collate(a.m.ln, b.m.ln));
      downloadCSV(`hemicycle-vote-${v.id}.csv`, [[t('mep'), t('group'), t('partyCol'), t('country'), t('vote')], ...list.map(({ m, p }) => [fullName(m), gShort(m.g), m.p || '', cName(m.c), posName(p)])]);
    });
    loadScript('europe.js').then(() => { if (my === token && $('#v-map')) $('#v-map').innerHTML = voteMap(cAgg); }).catch(() => { $('#v-map-sec')?.remove(); });
    const tabs = tabify(q);
    on(main, 'click', '[data-map-c]', (e, el) => { st.pays = el.dataset.mapC; $('#va-pays').value = st.pays; draw(); tabs.show('s-deputes'); });
    on(main, 'click', 'a[data-country]', (e, el) => { e.preventDefault(); st.pays = el.dataset.country; $('#va-pays').value = st.pays; draw(); tabs.show('s-deputes'); });
    draw();
    if (q.get('pays') && !keepScroll) tabs.show('s-deputes'); else scrollTop();
  }

  /* ================================================================ groupes */
  async function pageGroups(my) {
    setNav('groupes'); setTitle(t('groups'));
    const [, extra] = await Promise.all([loadVotes(), loadExtra()]);
    if (my !== token) return;
    const active = D.members.filter((x) => x.a).sort((a, b) => byGroupOrder(a.g, b.g) || a.ln.localeCompare(b.ln));
    const groups = [...new Set(active.map((x) => x.g))].sort(byGroupOrder);

    // du côté gagnant, majorités les plus fréquentes (votes finaux)
    let winHtml = '', coalHtml = '', cohHtml = '';
    if (extra) {
      const live = extra.G.map((g, k) => [g, k]).filter(([g]) => groups.includes(g));
      const win = new Map(live.map(([g]) => [g, [0, 0]]));
      const combos = new Map();
      let nFinal = 0;
      for (const v of D.votes) {
        const s = extra.gm[v.id], wl = winLetter(v);
        if (!s || !wl) continue;
        nFinal++;
        const set = [];
        for (const [g, k] of live) { if (s[k] === '-') continue; const w = win.get(g); w[1]++; if (s[k] === wl) { w[0]++; set.push(g); } }
        const key = set.join('+');
        if (set.length) combos.set(key, (combos.get(key) || 0) + 1);
      }
      winHtml = `<div class="hbars">${[...win].filter(([, w]) => w[1]).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([g, w]) => `<div class="hbar">
        <span class="gname">${gdot(g)}<a href="#/${TP()}groupe/${g}" style="color:inherit">${esc(gShort(g))}</a></span>
        <span class="hb"><i style="width:${((w[0] / w[1]) * 100).toFixed(1)}%;background:${gColor(g)}"></i></span><b>${pct(w[0] / w[1])}</b></div>`).join('')}</div>
        <p class="note">${t('winningSideNote')}</p>`;
      coalHtml = `<ol class="coal">${[...combos].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, n]) => `<li>
        <span class="coal-g">${key.split('+').map((g) => `<span class="gpill">${gdot(g)}${esc(gShort(g))}</span>`).join('')}</span>
        <span class="coal-n"><b>${t('nTimes', n)}</b><small>${pct(n / nFinal)}</small></span></li>`).join('')}</ol>
        <p class="note">${t('topCoalitionsNote')}</p>`;
      const months = extra.months;
      const avg = months.map((m, i) => { const xs = live.map(([g]) => extra.coh[g] && extra.coh[g][i]).filter((x) => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; });
      cohHtml = `<div class="multiples">${live.filter(([g]) => extra.coh[g]).map(([g]) => `<div class="mult">
        <div class="mult-h"><span class="gname">${gdot(g)}${esc(gShort(g))}</span><b>${pct((D.groups.get(g) || {}).coh)}</b></div>
        ${lineChart(months, [{ values: avg, color: 'var(--muted)', w: 1, dash: true, label: t('cohAvg') }, { values: extra.coh[g], color: gColor(g), w: 2, label: gShort(g) }], { min: 0.6, max: 1, ticks: [0.6, 0.8, 1], h: 96, mini: true })}</div>`).join('')}</div>
        <p class="note">${t('cohTrendNote')} <span class="dash-key"></span> ${t('cohAvg')}.</p>`;
    }

    // changements de groupe en cours de législature
    const moves = [];
    for (const m of D.members) {
      if (!m.gh) continue;
      const seq = m.gh.filter((h, i, arr) => i === 0 || h.g !== arr[i - 1].g);
      // un passage de quelques jours (le temps que les groupes se constituent) n'est pas un changement de groupe
      for (let i = 1; i < seq.length; i++) if ((new Date(seq[i].s) - new Date(seq[i - 1].s)) / 864e5 >= 15) moves.push({ m, from: seq[i - 1].g, to: seq[i].g, d: seq[i].s });
    }
    moves.sort((a, b) => b.d.localeCompare(a.d));

    main.innerHTML = `
      <p class="kicker">${t('ep')}</p>
      <h1 class="h1">${t('groups')}</h1>
      <p class="lede">${t('groupsLede')}</p>
      <div class="split groups-top" style="margin-top:32px;align-items:center">
        <div class="group-grid" style="grid-template-columns:minmax(0,1fr)">
          ${groups.map((g) => { const G = D.groups.get(g) || {}; const n = active.filter((x) => x.g === g).length;
            return `<a class="group-card" data-hover-g="${g}" href="#/${TP()}groupe/${g}"><span class="stripe" style="background:${gColor(g)}"></span><span>
              <span class="nm">${esc(gLong(g))}</span>
              <span class="meta" style="display:block">${t('groupCardMeta', n, pct(n / active.length), G.coh != null ? pct(G.coh) : null)}</span></span></a>`; }).join('')}
        </div>
        <div class="groups-hemi">${hemicycle(active.map((x) => ({ color: gColor(x.g), title: `${fullName(x)} · ${gShort(x.g)} · ${cName(x.c)}`, m: x })), `<b id="gt-count">${active.length}</b><span id="gt-label">${t('seats')}</span>`)}</div>
      </div>
      <section class="section" id="s-coalitions">
        <div class="section-head"><h2 class="h2">${t('whoWithWhom')}</h2></div>
        ${agreeMatrix()}
      </section>
      ${extra ? `<div class="split section" id="s-majorites">
        <section>
          <div class="section-head"><h2 class="h2">${t('winningSide')}</h2></div>
          ${winHtml}
        </section>
        <section>
          <div class="section-head"><h2 class="h2">${t('topCoalitions')}</h2></div>
          ${coalHtml}
        </section>
      </div>
      <section class="section" id="s-cohesion">
        <div class="section-head"><h2 class="h2">${t('cohTrend')}</h2></div>
        ${cohHtml}
      </section>` : ''}
      <section class="section" id="s-changements">
        <div class="section-head"><h2 class="h2">${t('switches')}</h2><span class="small muted">${t('nMeps', new Set(moves.map((x) => x.m.id)).size)}</span></div>
        <p class="note" style="margin-top:0">${t('switchesNote')}</p>
        ${moves.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>${t('mep')}</th><th>${t('switchFrom')}</th><th>${t('switchTo')}</th><th>${t('date')}</th></tr></thead><tbody>
          ${moves.map((x) => `<tr class="click" data-href="#/${TP()}depute/${x.m.id}"><td><div class="who">${photo(x.m, 'xs')}<span><a href="#/${TP()}depute/${x.m.id}">${esc(fullName(x.m))}</a><small>${esc(cName(x.m.c))}</small></span></div></td>
            <td><span class="gpill" style="font-weight:500">${gdot(x.from)}${esc(gShort(x.from))}</span></td><td><span class="gpill" style="font-weight:500">${gdot(x.to)}${esc(gShort(x.to))}</span></td>
            <td class="small muted" style="white-space:nowrap">${esc(dateShort(x.d))}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${t('noSwitch')}</p>`}
      </section>`;
    on(main, 'click', 'tr[data-href]', (e, el) => { if (!e.target.closest('a')) location.hash = el.dataset.href; });
    // survol d'un groupe : ses sièges ressortent dans l'hémicycle
    const gsvg = $('.groups-hemi .hemi', main);
    const hoverG = (g) => {
      if (!gsvg) return;
      let n = 0;
      for (const c of gsvg.querySelectorAll('circle')) { const onIt = c.dataset.g === g; c.classList.toggle('hl', !!g && onIt); if (onIt) n++; }
      gsvg.classList.toggle('dim', !!g);
      $('#gt-count').textContent = g ? n : active.length;
      $('#gt-label').textContent = g ? gShort(g) : t('seats');
    };
    on(main, 'pointerover', '[data-hover-g]', (e, el) => hoverG(el.dataset.hoverG));
    on(main, 'pointerout', '[data-hover-g]', (e, el) => { if (!el.contains(e.relatedTarget)) hoverG(''); });
    on(main, 'focusin', '[data-hover-g]', (e, el) => hoverG(el.dataset.hoverG));
    on(main, 'focusout', '[data-hover-g]', () => hoverG(''));
    scrollTop();
  }

  async function pageGroup(my, code) {
    setNav('groupes');
    const G = D.groups.get(code);
    if (!G) return notFound();
    setTitle(gLong(code));
    const list = D.members.filter((m) => m.a && m.g === code);
    const byCountry = new Map();
    for (const m of list) byCountry.set(m.c, (byCountry.get(m.c) || 0) + 1);
    const att = list.reduce((s, m) => s + (m.s.att || 0), 0) / (list.length || 1);
    main.innerHTML = `
      ${crumbs(CR.groupes())}
      <h1 class="h1" style="display:flex;gap:14px;align-items:center"><span style="width:14px;height:44px;border-radius:4px;background:${gColor(code)};flex:none"></span>${esc(gLong(code))}</h1>
      <div style="margin-top:20px">${groupInfo(code)}</div>
      <div class="kpis">
        <div class="kpi"><div class="lab">${cap(t('seats'))}</div><div class="val">${list.length}</div><div class="cmp">${t('nCountries', byCountry.size)}</div></div>
        <div class="kpi"><div class="lab">${t('cohesion')}</div><div class="val">${G.coh != null ? pct(G.coh) : '–'}</div><div class="cmp">${code === 'NI' ? t('niNotGroup') : t('cohesionNote')}</div></div>
        <div class="kpi"><div class="lab">${t('avgAttendance')}</div><div class="val">${pct(att)}</div><div class="cmp">${t('parliament')}${col()}${pct(D.avg.att)}</div></div>
        ${(() => { const top = [...byCountry].sort((a, b) => (b[1].length ?? b[1]) - (a[1].length ?? a[1]))[0]; return top ? `<div class="kpi"><div class="lab">${t('largestDelegation')}</div><div class="val sm">${esc(cName(top[0]))}</div><div class="cmp">${t('nMeps', top[1].length ?? top[1])}</div></div>` : ''; })()}
      </div>
      <div id="g-coh"></div>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('nationalDelegations')}</h2><a class="more" href="#/${TP()}deputes?groupe=${code}">${t('sortFilter')}</a></div>
        <div class="deleg">${[...byCountry].sort((a, b) => b[1] - a[1] || collate(cName(a[0]), cName(b[0]))).map(([c, n]) => `<div class="deleg-row">
          <div class="deleg-c"><span>${esc(cName(c))}</span><b>${n}</b></div>
          <ul class="deleg-m">${list.filter((m) => m.c === c).sort((a, b) => (a.p || '').localeCompare(b.p || '') || a.ln.localeCompare(b.ln)).map((m) => `<li><a href="#/${TP()}depute/${m.id}">${esc(fullName(m))}</a>${m.p ? `<small>${realParty(m.p) ? `<a class="plink" href="${partyHref(m.c, m.p)}">${esc(m.p)}</a>` : esc(t('independent'))}</small>` : ''}</li>`).join('')}</ul>
        </div>`).join('')}</div>
      </section>`;
    scrollTop();
    if (code !== 'NI') loadExtra().then((extra) => {
      if (my !== token || !extra || !extra.coh[code]) return;
      const vals = extra.coh[code];
      const lo = Math.min(0.6, Math.floor(Math.min(...vals.filter((x) => x != null)) * 10) / 10);
      $('#g-coh').outerHTML = `<section class="section">
        <div class="section-head"><h2 class="h2">${t('cohTrend')}</h2></div>
        ${lineChart(extra.months, [{ values: vals, color: gColor(code), w: 2.5, label: gShort(code) }], { min: lo, max: 1, ticks: lo < 0.6 ? [lo, 0.75, 1] : [0.6, 0.8, 1], h: 200 })}
        <p class="note">${t('cohTrendNote')}</p></section>`;
    });
  }

  /* ================================================================ guide */
  function pageGuide(which) {
    setNav('guide');
    const SRC = which === 'about' ? window.HEMI_ABOUT : window.HEMI_GUIDE;
    const G = (SRC || {})[lang] || SRC.en;
    setTitle(G.title);
    const contact = which === 'about' && window.HEMI_CONTACT ? `<p class="lede" style="font-size:16px">${esc(G.contact)}${col()}<a href="mailto:${esc(window.HEMI_CONTACT)}">${esc(window.HEMI_CONTACT)}</a></p>` : '';
    main.innerHTML = `
      ${which === 'about' ? crumbs(CR.guide()) : `<p class="kicker">${t('navGuide')}</p>`}
      <h1 class="h1">${esc(G.title)}</h1>
      <p class="lede">${esc(G.lede)}</p>${contact}
      ${G.sections.map((x) => `<section class="section guide-sec" id="g-${x.id}">
        <div class="section-head"><h2 class="h2">${esc(x.t)}</h2></div>
        <div class="prose">${x.h}${x.id === 'methode' && stores[CURRENT] && stores[CURRENT].meta ? `<p class="note">${esc(t('updatedOn', dateLong(stores[CURRENT].meta.updated)))}</p>` : ''}</div></section>`).join('')}`;
    scrollTop();
  }

  /* ---- carte d'Europe colorée selon le vote de chaque délégation */
  function mapColor(n) {
    const tot = n[0] + n[1] + n[2];
    if (!tot) return 'var(--soft-2)';
    if (n[2] > n[0] && n[2] > n[1]) return 'color-mix(in srgb, var(--abst) 70%, var(--bg))';
    const sc = (n[0] - n[1]) / tot; // de -1 (tous contre) à 1 (tous pour)
    const k = Math.round(25 + Math.abs(sc) * 75);
    return `color-mix(in srgb, var(${sc >= 0 ? '--for' : '--against'}) ${k}%, var(--bg))`;
  }
  function voteMap(cAgg) {
    const M = window.HEMI_MAP;
    if (!M) return '';
    const tip = (c, n) => `${cName(c)} — ${posName('F')} ${n[0]} · ${posName('A')} ${n[1]} · ${posName('X')} ${n[2]}`;
    const shapes = Object.entries(M.c).map(([c, d]) => {
      const n = cAgg.get(c);
      return n ? `<path d="${d}" fill="${mapColor(n)}" data-tip="${esc(tip(c, n))}" data-map-c="${c}" class="on"/>` : `<path d="${d}" fill="var(--soft-2)"/>`;
    }).join('');
    const dots = Object.entries(M.dot).map(([c, [x, y]]) => { const n = cAgg.get(c); return n ? `<circle cx="${x}" cy="${y}" r="6" fill="${mapColor(n)}" data-tip="${esc(tip(c, n))}" data-map-c="${c}" class="on dot"/>` : ''; }).join('');
    return `<svg viewBox="0 0 ${M.w} ${M.h}" role="img" aria-label="${esc(t('mapTitle'))}"><path d="${M.bg}" class="bgc"/>${shapes}${dots}</svg>
      <div class="map-key"><span>${t('mapAgainst')}</span><i></i><span>${t('mapFor')}</span><span class="abst"><b></b>${t('mapAbst')}</span></div>`;
  }

  /* ================================================================ parti national */
  async function pageParty(my, key) {
    setNav('pays');
    const i = key.indexOf('~');
    const c = key.slice(0, i), p = key.slice(i + 1);
    const all = D.members.filter((m) => m.c === c && m.p === p);
    if (!all.length || !realParty(p)) return notFound();
    const act = all.filter((m) => m.a);
    const team = act.length ? act : all;
    const names = new Map();
    for (const m of all) if (m.pl) names.set(m.pl, (names.get(m.pl) || 0) + 1);
    const name = [...names].sort((a, b) => b[1] - a[1])[0]?.[0] || p;
    setTitle(`${name} (${cName(c)})`);
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    const [files, , extra] = await Promise.all([Promise.all(team.map((m) => memberFile(m.id))), loadVotes(), loadExtra()]);
    if (my !== token) return;
    const gCount = new Map();
    for (const m of team) gCount.set(m.g, (gCount.get(m.g) || 0) + 1);
    const g = [...gCount].sort((a, b) => b[1] - a[1])[0][0];
    const gk = extra ? extra.G.indexOf(g) : -1;
    const w = team.filter((m) => m.s.att != null);
    const att = w.reduce((x, m) => x + m.s.att, 0) / (w.length || 1);

    // votes finaux : décompte du parti, cohésion, accord avec le groupe
    let cohSum = 0, cohN = 0, agree = 0, agreeN = 0;
    const rows = [];
    for (let k = 0; k < D.votes.length; k++) {
      const v = D.votes[k];
      if (!v.mn) continue;
      const n = [0, 0, 0];
      files.forEach((f) => { const j = 'FAX'.indexOf((f.p[k] || '').toUpperCase()); if (j >= 0) n[j]++; });
      const tot = n[0] + n[1] + n[2];
      if (!tot) continue;
      const top = Math.max(...n);
      const maj = n.filter((x) => x === top).length === 1 ? 'FAX'[n.indexOf(top)] : null;
      if (tot >= 2) { cohSum += top / tot; cohN++; }
      const gl = gk >= 0 ? (extra.gm[v.id] || '')[gk] : null;
      if (maj && gl && gl !== '-') { agreeN++; if (gl === maj) agree++; }
      rows.push({ v, n, tot, maj, gl, split: tot >= 2 ? 1 - top / tot : 0 });
    }
    const tag = (r) => `<span class="tag">${t('countryVotesFor', r.n[0], r.n[1], r.n[2])}</span>`;
    const split = rows.filter((r) => r.split > 0).sort((a, b) => b.split - a.split || b.v.t.localeCompare(a.v.t)).slice(0, 6);
    const against = rows.filter((r) => r.maj && r.gl && ((r.maj === 'F' && r.gl === 'A') || (r.maj === 'A' && r.gl === 'F'))).slice(0, 6);
    const others = [...new Set(D.members.filter((m) => m.c === c && m.a && realParty(m.p) && m.p !== p).map((m) => m.p))]
      .map((x) => ({ p: x, n: D.members.filter((m) => m.c === c && m.a && m.p === x).length, g: D.members.find((m) => m.c === c && m.a && m.p === x).g }))
      .sort((a, b) => b.n - a.n);
    const memberLi = (m) => `<li><a href="#/${TP()}depute/${m.id}">${esc(fullName(m))}</a>${m.g !== g ? `<small>${esc(gShort(m.g))}</small>` : ''}</li>`;

    main.innerHTML = `
      ${crumbs(CR.pays(), [`#/${TP()}pays/${c}`, cName(c)])}
      <p class="kicker">${t('partyKicker')}</p>
      <h1 class="h1 party-h" style="--pc:${pcolor(c, p, g)}">${esc(name)}${name !== p ? ` <span class="muted" style="font-weight:600">(${esc(p)})</span>` : ''}</h1>
      <div class="facts" style="margin-top:14px"><a class="gpill" href="#/${TP()}groupe/${g}">${gdot(g)}${esc(gLong(g))}</a></div>
      <div class="profile-tools">${archived() ? '' : followBtn(`p:${key}`)}${shareButton(`${TP()}parti/${encodeURIComponent(key)}`, name)}</div>
      <div class="kpis">
        <div class="kpi"><div class="lab">${t('countrySeats')}</div><div class="val">${team.length}</div><div class="cmp">${esc(t('partyInGroup', gShort(g)))}</div></div>
        <div class="kpi"><div class="lab">${t('countryAtt')}</div><div class="val">${pct(att)}</div><div class="cmp">${t('parliament')}${col()}${pct(D.avg.att)}</div></div>
        <div class="kpi"><div class="lab">${t('partyCoh')}</div><div class="val">${team.length > 1 && cohN ? pct(cohSum / cohN) : '–'}</div><div class="cmp">${team.length > 1 ? t('partyCohNote') : t('partyOne')}</div></div>
        <div class="kpi"><div class="lab">${t('partyWithGroup')}</div><div class="val">${agreeN ? pct(agree / agreeN) : '–'}</div><div class="cmp">${esc(t('partyWithGroupNote', gShort(g)))}</div></div>
      </div>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('partyAbout')}</h2></div>
        <div id="party-about"><p class="muted">${t('partyLoading')}</p></div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('partyMeps')}</h2></div>
        <ul class="deleg-m">${team.slice().sort((a, b) => a.ln.localeCompare(b.ln)).map(memberLi).join('')}</ul>
        ${act.length && all.length > act.length ? `<p class="note">${t('partyFormer')}${col()}${all.filter((m) => !m.a).map((m) => `<a href="#/${TP()}depute/${m.id}">${esc(fullName(m))}</a>`).join(', ')}</p>` : ''}
      </section>
      ${split.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${t('partySplit')}</h2></div>
        <p class="note" style="margin-top:0">${t('partySplitNote')}</p>
        <div class="vote-list compact">${split.map((r) => voteRow(r.v, tag(r))).join('')}</div>
      </section>` : ''}
      ${against.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${t('partyAgainst')}</h2></div>
        <p class="note" style="margin-top:0">${esc(t('partyAgainstNote', gShort(g)))}</p>
        <div class="vote-list compact">${against.map((r) => voteRow(r.v, tag(r))).join('')}</div>
      </section>` : ''}
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('partyLatest')}</h2></div>
        <div class="vote-list compact">${rows.slice(0, 8).map((r) => voteRow(r.v, tag(r))).join('')}</div>
      </section>
      ${others.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${esc(t('partyOthers', cName(c)))}</h2></div>
        ${partyTable(c, others)}
      </section>` : ''}`;
    scrollTop();
    loadPartyInfo(team.map((m) => m.id)).then((P) => { if (my === token && $('#party-about')) $('#party-about').innerHTML = renderPartyInfo(P); })
      .catch(() => { if (my === token && $('#party-about')) $('#party-about').innerHTML = `<p class="muted">${t('partyNone')}</p>`; });
  }
  async function pagePartiesIndex(my) {
    setNav('pays'); setTitle(t('mn').parties[0]);
    const act = D.members.filter((m) => m.a && realParty(m.p));
    const codes = [...new Set(act.map((m) => m.c))].sort((a, b) => collate(cName(a), cName(b)));
    const byC = codes.map((c) => [c, [...new Set(act.filter((m) => m.c === c).map((m) => m.p))].map((x) => {
      const l = act.filter((m) => m.c === c && m.p === x);
      return { p: x, pl: l.find((m) => m.pl)?.pl || x, n: l.length, g: l[0].g };
    }).sort((a, b) => b.n - a.n || collate(a.p, b.p))]);
    const st = PS.parties || (PS.parties = { q: '' });
    main.innerHTML = `
      ${crumbs(CR.pays())}
      <h1 class="h1">${t('mn').parties[0]}</h1>
      <p class="lede">${t('mn').partiesLede}</p>
      <div class="toolbar"><label class="sr" for="pt-q">${t('mn').partiesSearch}</label><input id="pt-q" type="search" placeholder="${esc(t('mn').partiesSearch)}" value="${esc(st.q)}"></div>
      <p class="count-line" id="pt-count"></p>
      <div class="deleg" id="pt-list"></div>`;
    const draw = () => {
      const k = norm(st.q);
      let n = 0;
      $('#pt-list').innerHTML = byC.map(([c, list]) => {
        const l = k ? list.filter((x) => norm(`${x.p} ${x.pl} ${cName(c)}`).includes(k)) : list;
        n += l.length;
        return l.length ? `<div class="deleg-row"><div class="deleg-c"><a href="#/pays/${c}" style="color:inherit">${esc(cName(c))}</a><b>${l.length}</b></div>${partyTable(c, l)}</div>` : '';
      }).join('') || `<p class="muted">${t('noResult')}</p>`;
      $('#pt-count').textContent = t('nParties', n);
    };
    on(main, 'input', '#pt-q', (e) => { st.q = e.target.value; draw(); });
    draw(); scrollTop();
  }
  function partyTable(c, list) {
    return `<div class="party-list">${list.map((x) => `<a class="party-chip" href="${partyHref(c, x.p)}"${x.pl && x.pl !== x.p ? ` title="${esc(x.pl)}"` : ''}><span class="gname">${pdot(c, x.p, x.g)}${esc(x.p)}</span><small>${gdot(x.g)}${esc(gShort(x.g))}</small><b>${x.n}</b></a>`).join('')}</div>`;
  }

  /* ================================================================ bilan des sessions */
  const sessionRange = (x) => sessionDates({ start: x.start, end: x.end });
  const lawFirst = (v) => (v.ty === 'COD' ? 0 : ['BUD', 'APP', 'NLE', 'CNS'].includes(v.ty) ? 1 : 2);
  function sessionThemesV(votes) {
    const c = new Map();
    for (const v of votes) for (const th of themesOf(v)) c.set(th, (c.get(th) || 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]);
  }
  async function pageSession(my, id) {
    setNav('votes');
    const [, extra] = await Promise.all([loadVotes(), loadExtra()]);
    if (my !== token) return;
    const list = sessionsOf();
    const k = id === 'derniere' ? 0 : list.findIndex((x) => x.id === id);
    if (k < 0) return notFound();
    const x = list[k], prev = list[k + 1], next = list[k - 1];
    setTitle(t('sessOf', sessionRange(x)));
    const finals = x.votes.filter((v) => v.mn);
    const adopted = finals.filter((v) => resultOf(v) === 'ADOPTED').sort((a, b) => lawFirst(a) - lawFirst(b) || b.t.localeCompare(a.t));
    const rejected = finals.filter((v) => resultOf(v) === 'REJECTED');
    const laws = adopted.filter((v) => v.ty === 'COD').length;
    const close = finals.filter((v) => v.c[0] + v.c[1] > 100).sort((a, b) => Math.abs(a.c[0] - a.c[1]) - Math.abs(b.c[0] - b.c[1])).slice(0, 3);
    const th = sessionThemesV(finals);
    const stance = groupStance(finals, extra).sort((a, b) => byGroupOrder(a.g, b.g));
    const st = PS.session || (PS.session = { n: 10 });
    main.innerHTML = `
      ${crumbs(CR.votes(), CR.sessions())}
      <h1 class="h1">${esc(sessionRange(x))}</h1>
      <p class="lede">${t('sessRecap', fmt(x.votes.length), finals.length, adopted.length, rejected.length, laws)}</p>
      ${th.length ? `<div class="ag-themes" style="margin-top:16px"><span class="small muted">${t('agendaOn')}</span>${th.map(([tid, n]) => `<a class="chip" href="#/${TP()}theme/${tid}">${esc(thName(tid))} <b>${n}</b></a>`).join('')}</div>` : ''}
      <div class="profile-tools" style="margin-top:16px">${shareButton(`${TP()}session/${x.id}`, t('sessOf', sessionRange(x)))}</div>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('sessMain')}</h2><span class="small muted">${t('nVotes', adopted.length)}</span></div>
        <p class="note" style="margin-top:0">${t('sessMainNote')}</p>
        <div class="vote-list" id="ss-list"></div>
        <div class="more-row" id="ss-more"></div>
      </section>
      ${rejected.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${t('sessRejected')}</h2></div>
        <div class="vote-list compact">${rejected.map((v) => voteRow(v)).join('')}</div>
      </section>` : ''}
      ${close.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${t('sessClosest')}</h2></div>
        <div class="vote-list compact">${close.map((v) => voteRow(v, `<span class="tag">${t('marginVotes', Math.abs(v.c[0] - v.c[1]))}</span>`)).join('')}</div>
      </section>` : ''}
      ${stance.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${t('sessGroups')}</h2></div>
        ${stanceTable(stance)}
        <p class="note">${t('sessGroupsNote')}</p>
      </section>` : ''}
      <nav class="sess-nav">
        ${prev ? `<a class="btn" href="#/${TP()}session/${prev.id}">← ${t('sessPrev')}</a>` : '<span></span>'}
        <a class="btn" href="#/${TP()}sessions">${t('sessAll')}</a>
        ${next ? `<a class="btn" href="#/${TP()}session/${next.id}">${t('sessNext')} →</a>` : '<span></span>'}
      </nav>`;
    const draw = () => {
      $('#ss-list').innerHTML = adopted.slice(0, st.n).map((v) => voteRow(v)).join('');
      $('#ss-more').innerHTML = adopted.length > st.n ? `<button class="btn" data-more>${t('showMoreVotes', Math.min(20, adopted.length - st.n))}</button>` : '';
    };
    on(main, 'click', '[data-more]', () => { st.n += 20; draw(); });
    draw(); scrollTop();
  }

  /* ================================================================ vue intégrable (iframe) */
  async function pageEmbed(my, id) {
    await loadVotes();
    const v = D.vById.get(id);
    if (!v) return notFound();
    const file = await voteFile(id);
    if (my !== token) return;
    const P = file.p, r = resultOf(v);
    const colorPos = { F: 'var(--for)', A: 'var(--against)', X: 'var(--abst)', N: 'var(--absent)' };
    const seated = D.members.map((m, i) => ({ m, p: P[i] })).filter((x) => x.p && x.p !== '.')
      .map((x) => ({ m: x.m, p: x.p.toUpperCase() }))
      .sort((a, b) => byGroupOrder(a.m.g, b.m.g) || POS_ORDER.indexOf(a.p) - POS_ORDER.indexOf(b.p));
    setTitle(topicOf(v) ? cap(topicOf(v)) : tiOf(v));
    main.innerHTML = `<div class="embed-card">
      <div class="embed-head"><span class="small muted">${esc(dateLong(v.t))}</span><span class="res ${r}">${resName(r)}</span></div>
      <h1 class="embed-t">${esc(topicOf(v) ? cap(topicOf(v)) : tiOf(v))}</h1>
      ${topicOf(v) ? `<p class="small muted embed-sub">${esc(tiOf(v))}</p>` : ''}
      ${hemicycle(seated.map(({ m, p }) => ({ color: colorPos[p], title: `${fullName(m)} · ${gShort(m.g)} · ${cName(m.c)} — ${posName(p)}`, m })), `<b class="sm">${v.c[0]}–${v.c[1]}</b><span>${posName('F').toLowerCase()} · ${posName('A').toLowerCase()}</span>`)}
      <div class="legend" style="justify-content:center">${['F', 'A', 'X', 'N'].map((k, i) => `<span><i style="background:${colorPos[k]}"></i>${k === 'N' ? t('didNotVotePl') : posName(k)} <b>${v.c[i]}</b></span>`).join('')}</div>
      <a class="embed-link" href="${esc(shareUrl(`${TP()}vote/${v.id}`))}" target="_blank" rel="noopener">${t('embedMore')} ↗</a>
      <div class="embed-brand">${($('.wordmark .mark') || { outerHTML: '' }).outerHTML.replace(/width="\d+" height="\d+"/, 'width="18" height="18"')}Hemicycle</div>
    </div>`;
    // un clic sur un siège ouvre le vote complet plutôt que la fiche latérale
    on(main, 'click', 'circle[data-mep]', (e) => { e.stopPropagation(); window.open(shareUrl(`${TP()}vote/${v.id}`), '_blank', 'noopener'); });
  }

  /* ================================================================ agenda */
  /* ================================================================ calendrier des sessions */
  const isoAdd = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const dow = (d) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
  // lieu : donné par le calendrier officiel, sinon déduit de la durée (Strasbourg : du lundi au jeudi ; Bruxelles : un ou deux jours)
  const calKind = (x, span) => (x.loc === 'SXB' || x.loc === 'BRU' ? x.loc : span >= 2 ? 'SXB' : 'BRU');
  function calSessions(A) {
    const today = todayISO();
    const out = [];
    const up = upcoming(A).map((x) => {
      const span = (new Date(x.end) - new Date(x.start)) / 864e5;
      return { start: x.start, end: x.end, k: calKind(x, span), past: false, h: '#/sessions?s=prochaine', inferred: !x.loc };
    });
    for (const x of sessionsOf(D)) {
      if (x.end >= today || up.some((u) => u.start <= x.end && u.end >= x.start)) continue;
      const span = (new Date(x.end) - new Date(x.start)) / 864e5;
      const k = span >= 2 ? 'SXB' : 'BRU';
      // les votes de Strasbourg commencent le mardi : la session s'ouvre le lundi
      const start = k === 'SXB' && dow(x.start) > 0 && dow(x.start) <= 2 ? isoAdd(x.start, -dow(x.start)) : x.start;
      out.push({ start, end: x.end, k, past: true, h: `#/session/${x.id}`, inferred: true });
    }
    return out.concat(up).sort((a, b) => a.start.localeCompare(b.start));
  }

  // ordre du jour d'une session : les textes à voter, jour par jour
  function agendaHTML(x, open) {
    const dayName = (d) => cap(new Date(`${d}T12:00:00`).toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' }));
    const itemRow = (it) => {
      const th = themesOfText(it.t.en || '');
      return `<li class="ag-item"><span class="ag-t">${esc(itemTitle(it))}</span>
        <span class="ag-m">${th.map((y) => `<a class="tag" href="#/theme/${y}">${esc(thName(y))}</a>`).join('')}${(it.docs || []).map((r) => `<span class="small muted">${esc(r)}</span>`).join('')}</span></li>`;
    };
    const head = `<div class="ag-when"><h3 class="h3">${esc(sessionDates(x))}</h3><span class="small muted">${esc(sessionPlace(x))}${sessionPlace(x) ? ' · ' : ''}${esc(sessionWhen(x))}</span></div>`;
    if (!x.days) return `<div class="ag-session">${head}<p class="muted">${t('weekNoAgenda')}</p></div>`;
    const { votes, debates } = sessionItems(x);
    const th = sessionThemes(votes.concat(debates));
    return `<div class="ag-session">${head}
      <p class="session-line"><b>${t('agendaSummary', votes.length, debates.length)}</b></p>
      ${th.length ? `<div class="ag-themes"><span class="small muted">${t('agendaOn')}</span>${th.map(([id, n]) => `<a class="chip" href="#/theme/${id}">${esc(thName(id))} <b>${n}</b></a>`).join('')}</div>` : ''}
      <details class="ag-full"${open ? ' open' : ''}><summary>${t('agendaFull', votes.length)}</summary>
      ${x.days.map((d) => `<div class="ag-day">
        <h4 class="h3">${esc(dayName(d.d))}</h4>
        ${d.votes.length ? `<p class="kicker">${t('agendaVotes')}</p><ul class="ag-list">${d.votes.map(itemRow).join('')}</ul>` : ''}
        ${d.debates.length ? `<details class="ag-deb"><summary>${t('agendaDebates', d.debates.length)}</summary><ul class="ag-list">${d.debates.map(itemRow).join('')}</ul></details>` : ''}
      </div>`).join('')}</details>
      <p class="note">${t('agendaNote')}</p></div>`;
  }

  // calendrier d'une année : une grille par mois, les jours de session colorés selon le lieu
  function calendarHTML(all, year) {
    const today = todayISO();
    const byDay = new Map();
    for (const x of all) for (let d = x.start; d <= x.end; d = isoAdd(d, 1)) byDay.set(d, x);
    const inYear = all.filter((x) => x.start.startsWith(year) || x.end.startsWith(year));
    const nS = inYear.filter((x) => x.k === 'SXB').length;
    const L = loc();
    const wd = [...Array(7)].map((_, i) => new Date(Date.UTC(2024, 0, 1 + i, 12)).toLocaleDateString(L, { weekday: 'narrow', timeZone: 'UTC' }));
    const place = (x) => (x.k === 'SXB' ? t('locName').SXB : `${t('locName').BRU} · ${t('miniSession')}`);
    const month = (m) => {
      const first = `${year}-${String(m + 1).padStart(2, '0')}-01`;
      const n = new Date(Date.UTC(+year, m + 1, 0)).getUTCDate();
      const name = cap(new Date(`${first}T12:00:00Z`).toLocaleDateString(L, { month: 'long', timeZone: 'UTC' }));
      let cells = '<span class="cal-pad"></span>'.repeat(dow(first));
      for (let i = 1; i <= n; i++) {
        const d = isoAdd(first, i - 1), x = byDay.get(d);
        const cls = ['cal-d', x ? `k-${x.k.toLowerCase()}` : '', x && x.past ? 'past' : '', x && d === x.start ? 'first' : '', x && d === x.end ? 'last' : '', d === today ? 'today' : '', dow(d) > 4 ? 'we' : ''].filter(Boolean).join(' ');
        cells += x ? `<a class="${cls}" href="${x.h}" title="${esc(t('calTip', place(x), sessionDates(x)))}">${i}</a>` : `<span class="${cls}">${i}</span>`;
      }
      const ms = inYear.filter((x) => x.start.slice(5, 7) === first.slice(5, 7) && x.start.startsWith(year));
      return `<div class="cal-m"><h3 class="cal-h">${esc(name)}</h3>
        <div class="cal-g"><span class="cal-wd">${wd.join('</span><span class="cal-wd">')}</span>${cells}</div>
        <ul class="cal-list">${ms.map((x) => `<li><a href="${x.h}"><i class="k-${x.k.toLowerCase()}${x.past ? ' past' : ''}"></i><b>${esc(sessionDates(x))}</b> <span class="muted">${esc(x.k === 'SXB' ? t('locName').SXB : t('locName').BRU)}</span></a></li>`).join('')}</ul></div>`;
    };
    return `<p class="small muted cal-count">${t('calCount', inYear.length, nS, inYear.length - nS)}</p>
      <div class="cal-year">${[...Array(12)].map((_, m) => month(m)).join('')}</div>`;
  }

  // page des sessions : la prochaine session, le calendrier, puis le bilan des sessions passées
  async function pageSessions(my, q) {
    setNav('votes'); setTitle(t('hubTitle'));
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    const [, A] = await Promise.all([loadVotes(), archived() ? null : loadAgenda()]);
    if (my !== token) return;
    const past = sessionsOf();
    const up = archived() ? [] : upcoming(A);
    const first = up[0];
    const others = up.slice(1).filter((x) => x.days);
    const all = archived() ? [] : calSessions(A);
    const today = todayISO();
    const years = [...new Set(all.flatMap((x) => [x.start.slice(0, 4), x.end.slice(0, 4)]))].sort();
    const st = PS.sessions || (PS.sessions = { n: 12, year: years.includes(q.get('an')) ? q.get('an') : years.includes(today.slice(0, 4)) ? today.slice(0, 4) : years[years.length - 1] });
    const ongoing = first && first.start <= today;
    main.innerHTML = `
      ${crumbs(CR.votes())}
      <h1 class="h1">${archived() ? t('sessionsTitle') : t('hubTitle')}</h1>
      <p class="lede">${archived() ? t('sessionsLede') : t('hubLede')}</p>
      ${archived() ? '' : `
      <section class="section" id="s-prochaine">
        <div class="section-head"><h2 class="h2">${ongoing ? t('hubNow') : t('hubNext')}</h2>${A ? `<span class="small muted">${t('agendaUpdatedOn', dateLong(A.updated))}</span>` : ''}</div>
        ${A && A.sample ? `<p class="callout">${t('agendaSample')}</p>` : ''}
        ${first ? agendaHTML(first, q.get('s') === 'prochaine') + others.map((y) => agendaHTML(y)).join('') : `<p class="callout">${t('agendaNone')}</p>`}
      </section>
      ${years.length ? `<section class="section" id="s-calendrier">
        <div class="section-head"><h2 class="h2">${t('hubCal')}</h2>
          <div class="seg" role="group" aria-label="${t('calYear')}">${years.map((y) => `<button type="button" data-year="${y}" aria-pressed="${y === st.year}">${y}</button>`).join('')}</div></div>
        <ul class="cal-legend">
          <li><i class="k-sxb"></i>${t('calSxb')}</li>
          <li><i class="k-bru"></i>${t('calBru')}</li>
          <li><i class="k-sxb past"></i><i class="k-bru past"></i>${t('calPast')}</li>
          <li><i class="today"></i>${t('calToday')}</li>
        </ul>
        <div id="cal-body"></div>
        <p class="note">${t('calInferred')}</p>
      </section>` : ''}`}
      <section class="section" id="s-passees">
        <div class="section-head"><h2 class="h2">${t('hubPast')}</h2>${archived() ? '' : `<span class="small muted">${t('sessionsLede')}</span>`}</div>
        <div class="sess-grid" id="sess-grid"></div>
        <div class="more-row" id="sess-more"></div>
      </section>
      ${archived() ? '' : `<p class="note">${t('agendaSource')}</p>`}`;
    const drawCal = () => { const box = $('#cal-body'); if (box) box.innerHTML = calendarHTML(all, st.year); };
    const draw = () => {
      $('#sess-grid').innerHTML = past.slice(0, st.n).map((x) => {
        const f = x.votes.filter((v) => v.mn);
        const th = sessionThemesV(f).slice(0, 3);
        return `<a class="theme-card" href="#/${TP()}session/${x.id}"><span class="nm">${esc(sessionRange(x))}</span>
          <span class="mt">${t('sessionsCard', fmt(x.votes.length), f.length)}</span>
          <span class="ds">${th.map(([id]) => esc(thName(id))).join(' · ')}</span></a>`;
      }).join('');
      $('#sess-more').innerHTML = past.length > st.n ? `<button class="btn" data-more>${t('showMore', Math.min(24, past.length - st.n))}</button>` : '';
    };
    on(main, 'click', '[data-more]', () => { st.n += 24; draw(); });
    on(main, 'click', '[data-year]', (e, b) => { st.year = b.dataset.year; $$('[data-year]', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawCal(); });
    drawCal(); draw(); scrollTop();
  }

  /* ================================================================ thèmes */
  const finalsOf = (id) => D.votes.filter((v) => v.mn && themesOf(v).includes(id));
  function groupStance(votes, extra) {
    // position majoritaire de chaque groupe sur une liste de votes finaux : [pour, contre, abst., partagé]
    if (!extra) return [];
    return extra.G.map((g, k) => {
      const n = [0, 0, 0, 0];
      for (const v of votes) { const x = (extra.gm[v.id] || '')[k]; if (x) n['FAX-'.indexOf(x)]++; }
      return { g, n, tot: n[0] + n[1] + n[2] };
    }).filter((x) => x.tot > 0 && D.members.some((m) => m.g === x.g));
  }
  function stanceTable(rows) {
    return `<div class="table-wrap"><table class="t gtable"><thead><tr><th>${t('group')}</th><th></th><th class="num">${posName('F')}</th><th class="num">${posName('A')}</th><th class="num">${t('abstShort')}</th></tr></thead><tbody>
      ${rows.map(({ g, n, tot }) => `<tr><td><span class="gname">${gdot(g)}<a href="#/${TP()}groupe/${g}" style="color:inherit">${esc(gShort(g))}</a></span></td>
        <td class="barcell">${bar([n[0], n[1], n[2]], true)}</td><td class="num">${pct(n[0] / tot)}</td><td class="num">${pct(n[1] / tot)}</td><td class="num">${pct(n[2] / tot)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  async function pageThemes(my) {
    setNav('themes'); setTitle(t('navThemes'));
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    await loadVotes();
    if (my !== token) return;
    const cards = THEMES.map((x) => {
      const list = finalsOf(x.id);
      const ad = list.filter((v) => resultOf(v) === 'ADOPTED').length;
      return { x, n: list.length, ad, last: list[0] };
    }).sort((a, b) => b.n - a.n);
    main.innerHTML = `
      <p class="kicker">${t('ep')}</p>
      <h1 class="h1">${t('navThemes')}</h1>
      <p class="lede">${t('themesLede')}</p>
      <div class="theme-grid">${cards.map(({ x, n, ad, last }) => `<a class="theme-card" href="#/${TP()}theme/${x.id}">
        <span class="nm">${esc(x.name[lang])}</span>
        <span class="ds">${esc(x.intro[lang])}</span>
        <span class="mt">${n ? t('themeCard', n, pct(ad / n)) : t('noThemeVotes')}</span>
        ${last ? `<span class="mt muted">${t('themeLatest', dateShort(last.t))}</span>` : ''}</a>`).join('')}</div>
      <p class="note">${t('themeNote')}</p>`;
    scrollTop();
  }

  async function pageTheme(my, id) {
    setNav('themes');
    const x = themeById.get(id);
    if (!x) return notFound();
    setTitle(x.name[lang]);
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    const [, extra] = await Promise.all([loadVotes(), loadExtra()]);
    if (my !== token) return;
    const list = finalsOf(id);
    const ad = list.filter((v) => resultOf(v) === 'ADOPTED').length;
    const stance = groupStance(list, extra).sort((a, b) => byGroupOrder(a.g, b.g));
    const top = stance.filter((r) => r.tot >= 5).sort((a, b) => b.n[0] / b.tot - a.n[0] / a.tot)[0];
    const close = list.filter((v) => v.c[0] + v.c[1] > 100).sort((a, b) => Math.abs(a.c[0] - a.c[1]) - Math.abs(b.c[0] - b.c[1])).slice(0, 5);
    const st = PS.theme || (PS.theme = { n: 20 });
    main.innerHTML = `
      ${crumbs(CR.themes())}
      <h1 class="h1">${esc(x.name[lang])}</h1>
      <p class="lede">${esc(x.intro[lang])}</p>
      ${archived() ? '' : `<div class="profile-tools" style="margin-top:16px">${followBtn(`t:${x.id}`)}</div>`}
      <div class="kpis">
        <div class="kpi"><div class="lab">${t('themeVotes')}</div><div class="val">${fmt(list.length)}</div><div class="cmp">${list.length ? t('themeLatest', dateShort(list[0].t)) : ''}</div></div>
        <div class="kpi"><div class="lab">${t('themeAdoptedK')}</div><div class="val">${list.length ? pct(ad / list.length) : '–'}</div><div class="cmp">${fmt(ad)} / ${fmt(list.length)}</div></div>
        <div class="kpi"><div class="lab">${t('themeTopGroup')}</div><div class="val sm">${top ? `${gdot(top.g)}${esc(gShort(top.g))}` : '–'}</div><div class="cmp">${top ? t('themeTopGroupCmp', pct(top.n[0] / top.tot)) : ''}</div></div>
        <div class="kpi"><div class="lab">${t('closestOne')}</div><div class="val">${close[0] ? fmt(Math.abs(close[0].c[0] - close[0].c[1])) : '–'}</div><div class="cmp">${close[0] ? `<a href="#/${TP()}vote/${close[0].id}" class="clamp">${esc(topicOf(close[0]) ? cap(topicOf(close[0])) : tiOf(close[0]))}</a>` : ''}</div></div>
      </div>
      ${list.length ? `
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('themeGroups')}</h2></div>
        ${stanceTable(stance)}
        <p class="note">${t('themeGroupsNote')}</p>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('closest')}</h2></div>
        <div class="vote-list compact">${close.map((v) => voteRow(v, `<span class="tag">${t('marginVotes', Math.abs(v.c[0] - v.c[1]))}</span>`)).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('themeAll')}</h2>${D.meta.mainOnly ? '' : `<a class="more" href="#/${TP()}votes?th=${id}&type=tous">${t('themeAmendments')}</a>`}</div>
        <div class="vote-list" id="th-list"></div>
        <div class="more-row" id="th-more"></div>
      </section>` : `<p class="callout">${t('noThemeVotes')}</p>`}
      <p class="note">${t('themeNote')}</p>`;
    const draw = () => {
      $('#th-list').innerHTML = list.slice(0, st.n).map((v) => voteRow(v)).join('');
      $('#th-more').innerHTML = list.length > st.n ? `<button class="btn" data-more>${t('showMoreVotes', 20)}</button>` : '';
    };
    if (list.length) { draw(); on(main, 'click', '[data-more]', () => { st.n += 20; draw(); }); }
    scrollTop();
  }

  /* ================================================================ pays */
  function groupCompo(list, total = list.length) {
    const by = new Map();
    for (const m of list) by.set(m.g, (by.get(m.g) || 0) + 1);
    const rows = [...by].sort((a, b) => byGroupOrder(a[0], b[0]));
    return { rows, bar: `<span class="stack" role="img" aria-label="${esc(rows.map(([g, n]) => `${gShort(g)} ${n}`).join(', '))}">${rows.map(([g, n]) => `<i style="width:${((n / total) * 100).toFixed(2)}%;background:${gColor(g)}" data-tip="${esc(`${gShort(g)} · ${n}`)}"></i>`).join('')}</span>` };
  }





  const fmt2 = (n) => fmt(n);

  /* ================================================================ suivre un eurodéputé, un parti ou un thème */
  // tout reste dans le navigateur : la liste suivie et la date de la dernière visite de chaque élément
  const FW_KEY = 'hemi-follow';
  const fwGet = () => { try { const x = JSON.parse(localStorage.getItem(FW_KEY) || '{}'); return { items: x.items || [], seen: x.seen || {} }; } catch { return { items: [], seen: {} }; } };
  const fwSet = (x) => { try { localStorage.setItem(FW_KEY, JSON.stringify(x)); } catch { /* ignore */ } paintFollowBadge(); };
  const STAR = '<svg class="star" viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z"/></svg>';
  function followBtn(key) {
    const on = fwGet().items.includes(key);
    return `<button type="button" class="btn follow" data-follow="${esc(key)}" aria-pressed="${on}">${STAR}<span>${t(on ? 'fwOn' : 'fwOff')}</span></button>`;
  }
  const latestFinal = () => (D.votes.find((v) => v.mn) || D.votes[0] || {}).t || '';
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-follow]');
    if (!b) return;
    const key = b.dataset.follow, f = fwGet();
    const on = !f.items.includes(key);
    if (on) { f.items.push(key); f.seen[key] = latestFinal(); } else { f.items = f.items.filter((x) => x !== key); delete f.seen[key]; }
    fwSet(f);
    b.setAttribute('aria-pressed', String(on));
    $('span', b).textContent = t(on ? 'fwOn' : 'fwOff');
    b.classList.remove('pop'); void b.offsetWidth; if (on) b.classList.add('pop');
    toast('t-fw', `${esc(t(on ? 'fwAdded' : 'fwRemoved'))} <a href="#/suivi">${esc(t('fwTitle'))} →</a>`, 2600);
  });
  // votes finaux nouveaux pour un élément suivi
  function fwNews(key, since) {
    const [k, id] = [key.slice(0, 1), key.slice(2)];
    return D.votes.filter((v) => v.mn && v.t > (since || '') && (k !== 't' || themesOf(v).includes(id)));
  }
  function paintFollowBadge() {
    const a = $('#fw-link');
    if (!a || !D || !D.votes) return;
    const f = fwGet();
    a.hidden = archived();
    const n = f.items.filter((k) => fwNews(k, f.seen[k]).length).length;
    const b = $('.fw-n', a);
    b.textContent = n || '';
    b.hidden = !n;
    a.setAttribute('aria-label', n ? t('fwBadge', n) : t('fwTitle'));
    a.title = a.getAttribute('aria-label');
  }
  async function pageFollow(my) {
    setNav(''); setTitle(t('fwTitle'));
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    await loadVotes();
    if (my !== token) return;
    const f = fwGet();
    const head = `<h1 class="h1">${t('fwTitle')}</h1><p class="lede">${t('fwLede')}</p>`;
    if (!f.items.length) {
      let c = 'BEL'; try { c = localStorage.getItem('hemi-country') || 'BEL'; } catch { /* ignore */ }
      const sug = D.members.filter((m) => m.a && m.c === c).sort((a, b) => collate(a.ln, b.ln));
      main.innerHTML = `${head}<div class="fw-empty">${STAR}<p>${t('fwEmpty')}</p></div>
        <section class="section"><div class="section-head"><h2 class="h2">${t('fwSuggest', cName(c))}</h2></div>
        <div class="fw-sug">${sug.map((m) => `<div class="fw-s">${photo(m, 'sm')}<a href="#/depute/${m.id}"><b>${esc(fullName(m))}</b><small>${gdot(m.g)}${esc(gShort(m.g))} · ${esc(m.p || '')}</small></a>${followBtn(`m:${m.id}`)}</div>`).join('')}</div></section>
        <section class="section"><div class="section-head"><h2 class="h2">${t('fwSuggestThemes')}</h2></div>
        <div class="chips" style="justify-content:flex-start">${themesSorted().map((x) => `<button type="button" class="chip" data-follow="t:${x.id}" aria-pressed="false">${STAR}${esc(x.name[lang])}</button>`).join('')}</div></section>`;
      scrollTop();
      return;
    }
    const mFiles = await Promise.all(f.items.filter((k) => k.startsWith('m:')).map((k) => memberFile(Number(k.slice(2))).then((x) => [k, x]).catch(() => [k, null])));
    if (my !== token) return;
    const mp = new Map(mFiles);
    const vIdx = new Map(D.votes.map((v, i) => [v.id, i]));
    const block = (key) => {
      const k = key[0], id = key.slice(2), since = f.seen[key] || '';
      let title = '', sub = '', href = '', icon = '', list = [], tag = () => '';
      if (k === 'm') {
        const m = D.mById ? D.mById.get(Number(id)) : D.members.find((x) => x.id === Number(id));
        if (!m) return '';
        title = fullName(m); sub = `${gShort(m.g)} · ${m.p || ''} · ${cName(m.c)}`; href = `#/depute/${m.id}`; icon = photo(m, 'sm');
        const P = mp.get(key) ? mp.get(key).p : '';
        list = D.votes.filter((v) => v.mn).slice(0, 40).filter((v) => { const c = P[vIdx.get(v.id)]; return c && 'FAXfax'.includes(c); }).slice(0, 6);
        tag = (v) => { const c = P[vIdx.get(v.id)]; return c && c !== '.' ? pos(c) : ''; };
      } else if (k === 'p') {
        const [c, p] = id.split('~');
        title = p; sub = cName(c); href = partyHref(c, p); icon = `<span class="fw-ic">${cflag(c)}</span>`;
        list = D.votes.filter((v) => v.mn).slice(0, 6);
      } else {
        const x = themeById.get(id);
        if (!x) return '';
        title = x.name[lang]; sub = t('navThemes'); href = `#/theme/${id}`; icon = `<span class="fw-ic">${STAR}</span>`;
        list = D.votes.filter((v) => v.mn && themesOf(v).includes(id)).slice(0, 6);
      }
      const nNew = fwNews(key, since).length;
      return `<article class="fw-card${nNew ? ' has-new' : ''}">
        <header>${icon}<a href="${href}"><b>${esc(title)}</b><small>${esc(sub)}</small></a>
          ${nNew ? `<span class="fw-new">${t('fwNew', nNew)}</span>` : `<span class="small muted">${t('fwNone')}</span>`}
          <button type="button" class="linkish small" data-follow="${esc(key)}" aria-pressed="true"><span>${t('fwUnfollow')}</span></button></header>
        <div class="vote-list compact">${list.map((v) => voteRow(v, `${v.t > since ? `<span class="tag fw-tag">${t('fwNewTag')}</span>` : ''}${tag(v)}`)).join('') || `<p class="muted">${t('fwNoVotes')}</p>`}</div>
      </article>`;
    };
    main.innerHTML = `${head}<div class="fw-grid">${f.items.map(block).join('')}</div>
      <p class="note">${t('fwNote')}</p>`;
    // la visite marque tout comme vu (les étiquettes « nouveau » restent visibles jusqu'à la prochaine visite)
    const lt = latestFinal();
    for (const k of f.items) f.seen[k] = lt;
    fwSet(f);
    on(main, 'click', '[data-follow]', () => setTimeout(() => { if (location.hash.startsWith('#/suivi')) rerender(); }, 50));
    scrollTop();
  }

  /* ================================================================ Qui me ressemble ? (quiz) */
  // sélection automatique : votes finaux récents, compréhensibles (résumé en langage courant), qui divisent vraiment
  // les groupes, un seul vote par texte, en alternant les thèmes
  function quizPool() {
    const cand = [];
    for (const v of D.votes) {
      if (!v.mn || !v.tp) continue;
      const th = themesOf(v);
      if (!th.length) continue;
      const [f, a] = v.c;
      if (f + a < 300) continue;
      const share = f / (f + a);
      if (share > 0.88 || share < 0.12) continue; // trop consensuel : n'apprend rien
      const kind = EX.kind(v).k;
      if (['agenda', 'urgency', 'referral', 'postpone', 'voteAms', 'amend', 'split', 'part', 'oral', 'budgetLine'].includes(kind)) continue;
      const div = 1 - Math.abs(share - 0.5) * 2;
      const law = v.ty === 'COD' ? 0.25 : 0;
      const age = (Date.now() - new Date(v.t)) / (365 * 864e5);
      cand.push({ v, th, score: div + law - age * 0.12 });
    }
    cand.sort((x, y) => y.score - x.score || y.v.t.localeCompare(x.v.t));
    // un texte (procédure) une seule fois, puis les thèmes à tour de rôle
    const seen = new Set(), byTh = new Map();
    for (const c of cand) {
      const key = c.v.pr || c.v.tp[0];
      if (seen.has(key)) continue;
      seen.add(key);
      const th = c.th[0];
      if (!byTh.has(th)) byTh.set(th, []);
      byTh.get(th).push(c);
    }
    const out = [];
    const lists = [...byTh.values()].sort((a, b) => b[0].score - a[0].score);
    for (let r = 0; out.length < cand.length && r < 40; r++) for (const l of lists) if (l[r]) out.push(l[r]);
    return out;
  }
  const QZ_KEY = 'hemi-quiz';
  const qzLoad = () => { try { return JSON.parse(localStorage.getItem(QZ_KEY) || 'null'); } catch { return null; } };
  const qzSave = (x) => { try { localStorage.setItem(QZ_KEY, JSON.stringify(x)); } catch { /* ignore */ } };
  // couleur d'accord : rouge (0 %) → gris → vert (100 %)
  function agreeColor(x) {
    if (x == null) return 'var(--absent)';
    const stops = [[200, 50, 63], [214, 218, 224], [22, 133, 90]];
    const k = x < 0.5 ? 0 : 1, f = x < 0.5 ? x / 0.5 : (x - 0.5) / 0.5;
    const c = stops[k].map((v, i) => Math.round(v + (stops[k + 1][i] - v) * f));
    return `rgb(${c.join(',')})`;
  }
  async function pageQuiz(my, q) {
    setNav(''); setTitle(t('qzTitle'));
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    await loadVotes();
    if (my !== token) return;
    const pool = quizPool();
    const byId = new Map(pool.map((c) => [c.v.id, c]));
    // résultat partagé : #/quiz?r=ids~réponses~importance
    const shared = q.get('r');
    let st = qzLoad();
    if (shared) {
      const [ids, ans, imp] = shared.split('~');
      const list = (ids || '').split('-').map(Number).filter((id) => D.vById.has(id));
      st = { ids: list, ans: list.map((_, i) => (ans || '')[i] || 'S'), imp: list.map((_, i) => (imp || '')[i] === '1'), i: list.length, done: true, shared: true, country: (st && st.country) || 'BEL', reveal: true };
    }
    const allThemes = [...new Set(pool.flatMap((c) => c.th))].sort((a, b) => collate(thName(a), thName(b)));
    const countries = [...new Set(D.members.filter((m) => m.a).map((m) => m.c))].sort((a, b) => collate(cName(a), cName(b)));
    const myC0 = (() => { try { return localStorage.getItem('hemi-country') || ''; } catch { return ''; } })();

    const start = (len, themes, country, reveal) => {
      const picked = pool.filter((c) => c.th.some((x) => themes.includes(x))).slice(0, len).map((c) => c.v.id);
      st = { ids: picked, ans: picked.map(() => ''), imp: picked.map(() => false), i: 0, done: false, country, reveal, len, themes };
      qzSave(st); draw();
    };
    const prefetch = () => Promise.all(st.ids.map((id) => voteFile(id).catch(() => null)));

    function intro() {
      const saved = qzLoad();
      const can = saved && !saved.done && saved.ans.some(Boolean);
      main.innerHTML = `
        <section class="qz-hero">
          <p class="kicker">${t('qzKicker')}</p>
          <h1 class="h1">${t('qzTitle')}</h1>
          <p class="lede">${t('qzLede')}</p>
          <ol class="qz-how"><li><b>1</b><span>${t('qzHow1')}</span></li><li><b>2</b><span>${t('qzHow2')}</span></li><li><b>3</b><span>${t('qzHow3')}</span></li></ol>
        </section>
        ${can ? `<div class="qz-resume"><span>${t('qzResumeTxt', saved.ans.filter(Boolean).length, saved.ids.length)}</span><button type="button" class="btn primary" data-qz-resume>${t('qzResume')}</button></div>` : ''}
        <form class="qz-setup" id="qz-setup">
          <fieldset><legend>${t('qzLen')}</legend>
            <div class="qz-lens">${[[10, 'qzLenQuick'], [20, 'qzLenStd'], [35, 'qzLenFull']].map(([n, k], i) => `<label class="qz-len"><input type="radio" name="len" value="${n}"${i === 1 ? ' checked' : ''}><span><b>${t(k)}</b><small>${t('qzLenN', n, Math.max(2, Math.round(n / 4)))}</small></span></label>`).join('')}</div>
          </fieldset>
          <fieldset><legend>${t('qzThemes')} <button type="button" class="linkish small" data-qz-all>${t('qzAllThemes')}</button></legend>
            <div class="chips qz-ths">${allThemes.map((id) => `<label class="chip qz-th"><input type="checkbox" name="th" value="${id}" checked><span>${esc(thName(id))}</span></label>`).join('')}</div>
          </fieldset>
          <div class="qz-row">
            <fieldset><legend>${t('qzCountry')}</legend><label class="sr" for="qz-c">${t('qzCountry')}</label>
              <select id="qz-c">${countries.map((c) => `<option value="${c}"${c === (myC0 || 'BEL') ? ' selected' : ''}>${esc(cName(c))}</option>`).join('')}</select></fieldset>
            <fieldset><legend>${t('qzMode')}</legend>
              <label class="swchip"><input type="checkbox" role="switch" id="qz-reveal" checked><span class="sw" aria-hidden="true"></span><span>${t('qzReveal')}</span></label></fieldset>
          </div>
          <button type="submit" class="btn primary qz-go">${t('qzStart')} →</button>
          <p class="note">${t('qzNote')}</p>
        </form>`;
      enhanceSelects(main);
      on(main, 'click', '[data-qz-all]', () => { const bs = $$('input[name=th]', main); const all = bs.every((b) => b.checked); bs.forEach((b) => { b.checked = !all; }); });
      on(main, 'click', '[data-qz-resume]', () => { st = saved; draw(); });
      on(main, 'submit', '#qz-setup', (e) => {
        e.preventDefault();
        const len = Number($('input[name=len]:checked', main).value);
        let themes = $$('input[name=th]:checked', main).map((x) => x.value);
        if (!themes.length) themes = allThemes;
        const country = $('#qz-c').value;
        try { localStorage.setItem('hemi-country', country); } catch { /* ignore */ }
        start(len, themes, country, $('#qz-reveal').checked);
      });
      scrollTop();
    }

    async function question() {
      const i = st.i, id = st.ids[i], c = byId.get(id) || { v: D.vById.get(id), th: themesOf(D.vById.get(id)) };
      const v = c.v;
      const L = EX[lang], K = EX.kind(v);
      const nature = v.ty === 'COD' ? t('qzLaw') : /RSP|INI/.test(v.pr || '') ? t('qzResolution') : K.k === 'objection' ? t('qzObjection') : t('qzText');
      const answered = st.ans[i];
      main.innerHTML = `
        <div class="qz-top">
          <button type="button" class="btn sm" data-qz-quit>← ${t('qzQuit')}</button>
          <div class="qz-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${st.ids.length}" aria-valuenow="${i}"><i style="width:${(i / st.ids.length * 100).toFixed(1)}%"></i></div>
          <span class="qz-count">${t('qzCount', i + 1, st.ids.length)}</span>
        </div>
        <article class="qz-card" id="qz-card">
          <div class="qz-meta">${c.th.map((x) => `<span class="tag">${esc(thName(x))}</span>`).join('')}<span class="small muted">${esc(nature)} · ${esc(dateLong(v.t))}</span></div>
          <p class="qz-q-k">${t('qzAsk')}</p>
          <h1 class="qz-q">${esc(cap(topicOf(v)))}</h1>
          <details class="qz-more"><summary>${t('qzMore')}</summary><p>${esc(tiOf(v))}</p>${explainVote(v, null).replace(/<p class="ex-out[\s\S]*?<\/p>/, '')}</details>
          <div class="qz-answers" role="group" aria-label="${esc(t('qzYour'))}">
            ${[['F', 'qzFor'], ['A', 'qzAgainst'], ['X', 'qzAbst']].map(([k, l]) => `<button type="button" class="qz-a qz-${k}" data-ans="${k}" aria-pressed="${answered === k}"><span class="qz-ic"></span>${t(l)}</button>`).join('')}
          </div>
          <div class="qz-sub">
            <label class="swchip"><input type="checkbox" role="switch" id="qz-imp"${st.imp[i] ? ' checked' : ''}><span class="sw" aria-hidden="true"></span><span>${t('qzImp')}</span></label>
            <button type="button" class="linkish" data-ans="S">${t('qzSkip')}</button>
          </div>
          <div id="qz-reveal-box"></div>
        </article>
        <div class="qz-nav">
          <button type="button" class="btn" data-qz-prev${i ? '' : ' disabled'}>← ${t('qzPrev')}</button>
          ${st.ans.filter((x) => x && x !== 'S').length >= 3 ? `<button type="button" class="linkish" data-qz-finish>${t('qzFinishNow')}</button>` : ''}
        </div>`;
      const next = () => {
        if (st.i < st.ids.length - 1) { st.i++; qzSave(st); question(); window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); }
        else { st.done = true; qzSave(st); results(); }
      };
      on(main, 'change', '#qz-imp', (e) => { st.imp[i] = e.target.checked; qzSave(st); });
      on(main, 'click', '[data-qz-prev]', () => { if (st.i) { st.i--; qzSave(st); question(); } });
      on(main, 'click', '[data-qz-quit]', () => { qzSave(st); intro(); });
      on(main, 'click', '[data-qz-finish]', () => { st.done = true; qzSave(st); results(); });
      on(main, 'click', '[data-ans]', async (e, b) => {
        const a = b.dataset.ans;
        st.ans[i] = a; qzSave(st);
        $$('.qz-a', main).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.ans === a)));
        if (!st.reveal || a === 'S') { $('#qz-card').classList.add('out'); setTimeout(next, reduceMotion() ? 0 : 220); return; }
        // mode découverte : ce que le Parlement et les groupes ont voté
        const file = await voteFile(id).catch(() => null);
        if (my !== token) return;
        const r = resultOf(v);
        const g = file ? Object.entries(file.g).filter(([, n]) => n[0] + n[1] + n[2]).sort((x, y) => byGroupOrder(x[0], y[0])) : [];
        const gm = (n) => { const top = Math.max(n[0], n[1], n[2]); return [n[0], n[1], n[2]].filter((x) => x === top).length > 1 ? null : 'FAX'[[n[0], n[1], n[2]].indexOf(top)]; };
        const same = g.filter(([, n]) => gm(n) === a).map(([k]) => k);
        $('#qz-reveal-box').innerHTML = `<div class="qz-rev">
          <p class="qz-rev-h"><span class="res ${r}">${resName(r)}</span> ${t('qzRevTally', v.c[0], v.c[1], v.c[2])}</p>
          <div class="qz-rev-g">${g.map(([k, n]) => `<span class="qz-g${gm(n) === a ? ' same' : ''}" title="${esc(gLong(k))}">${gdot(k)}${esc(gShort(k))} ${gm(n) ? pos(gm(n)) : `<span class="muted small">${t('split')}</span>`}</span>`).join('')}</div>
          <p class="small muted">${same.length ? t('qzRevSame', same.map(gShort).join(', ')) : t('qzRevNone')}</p>
          <button type="button" class="btn primary" data-qz-next>${st.i < st.ids.length - 1 ? t('qzNext') : t('qzSee')} →</button></div>`;
        $('[data-qz-next]', main).focus({ preventScroll: true });
        $('#qz-reveal-box').scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
      });
      on(main, 'click', '[data-qz-next]', next);
      on(main, 'keydown', 'article', () => {});
      const keyH = (e) => {
        if (e.target.closest('input, select, textarea')) return;
        const k = { 1: 'F', 2: 'A', 3: 'X', p: 'F', c: 'A', a: 'X' }[e.key.toLowerCase()];
        if (k) { const b = $(`[data-ans="${k}"]`, main); if (b) b.click(); }
      };
      document.addEventListener('keydown', keyH);
      handlers.push(() => document.removeEventListener('keydown', keyH));
      prefetch();
    }

    async function results() {
      main.innerHTML = `<p class="loading">${t('qzComputing')}</p>`;
      const files = await Promise.all(st.ids.map((id) => voteFile(id).catch(() => null)));
      if (my !== token) return;
      const Q = st.ids.map((id, k) => ({ v: D.vById.get(id), f: files[k], a: st.ans[k], w: st.imp[k] ? 2 : 1 })).filter((x) => x.v && x.f && x.a && x.a !== 'S');
      const score = (mine, theirs) => (theirs === mine ? 1 : theirs === 'X' || mine === 'X' ? 0.5 : 0);
      // eurodéputés
      const mepScore = D.members.map((m, idx) => {
        let s = 0, w = 0, n = 0;
        for (const x of Q) { const p = (x.f.p[idx] || '.').toUpperCase(); if ('FAX'.includes(p)) { s += score(x.a, p) * x.w; w += x.w; n++; } }
        return { m, s: w ? s / w : null, n };
      }).filter((x) => x.m.a && x.n >= Math.max(2, Q.length * 0.5));
      // groupes : position majoritaire de chaque groupe
      const gm = (n) => { const top = Math.max(n[0], n[1], n[2]); return [n[0], n[1], n[2]].filter((x) => x === top).length > 1 ? null : 'FAX'[[n[0], n[1], n[2]].indexOf(top)]; };
      const gAgg = new Map();
      const thAgg = new Map();
      for (const x of Q) for (const [g, n] of Object.entries(x.f.g)) {
        const p = gm(n); if (!p) continue;
        if (!gAgg.has(g)) gAgg.set(g, [0, 0]);
        const a = gAgg.get(g); a[0] += score(x.a, p) * x.w; a[1] += x.w;
        for (const th of themesOf(x.v)) {
          if (!thAgg.has(th)) thAgg.set(th, new Map());
          const tm = thAgg.get(th); if (!tm.has(g)) tm.set(g, [0, 0]);
          const b = tm.get(g); b[0] += score(x.a, p) * x.w; b[1] += x.w;
        }
      }
      const groups = [...gAgg].filter(([g, a]) => a[1] && D.members.some((m) => m.a && m.g === g)).map(([g, a]) => ({ g, s: a[0] / a[1] })).sort((a, b) => b.s - a.s);
      // partis nationaux : majorité de leurs eurodéputés
      const pIdx = new Map();
      D.members.forEach((m, idx) => { if (m.a && realParty(m.p)) { const k = `${m.c}~${m.p}`; if (!pIdx.has(k)) pIdx.set(k, { c: m.c, p: m.p, g: m.g, idx: [] }); pIdx.get(k).idx.push(idx); } });
      const parties = [...pIdx.values()].map((P) => {
        let s = 0, w = 0;
        for (const x of Q) {
          const n = [0, 0, 0];
          for (const idx of P.idx) { const k = 'FAX'.indexOf((x.f.p[idx] || '.').toUpperCase()); if (k >= 0) n[k]++; }
          const p = n[0] + n[1] + n[2] ? gm(n) : null;
          if (p) { s += score(x.a, p) * x.w; w += x.w; }
        }
        return { ...P, s: w ? s / w : null, w };
      }).filter((x) => x.s != null && x.w >= Q.reduce((a, x2) => a + x2.w, 0) * 0.5);
      parties.sort((a, b) => b.s - a.s);
      const mineC = parties.filter((x) => x.c === st.country);
      const meps = mepScore.slice().sort((a, b) => b.s - a.s);
      const myMeps = meps.filter((x) => x.m.c === st.country);
      const top = groups[0];
      const shareR = `${st.ids.join('-')}~${st.ids.map((_, k) => st.ans[k] || 'S').join('')}~${st.imp.map((x) => (x ? 1 : 0)).join('')}`;
      const bar = (x, color) => `<span class="qz-bar"><i style="width:${(x * 100).toFixed(1)}%;background:${color || agreeColor(x)}"></i></span><b>${pct(x)}</b>`;
      const mepRow = ({ m, s }) => `<li><a href="#/depute/${m.id}">${photo(m, 'xs')}<span><b>${esc(fullName(m))}</b><small>${gdot(m.g)}${esc(gShort(m.g))} · ${esc(m.p || '')} · ${esc(cName(m.c))}</small></span></a>${bar(s)}</li>`;
      const seated = D.members.filter((m) => m.a).sort((a, b) => byGroupOrder(a.g, b.g) || a.ln.localeCompare(b.ln));
      const sOf = new Map(mepScore.map((x) => [x.m.id, x.s]));
      const thRows = [...thAgg].map(([th, tm]) => {
        const best = [...tm].filter(([g, a]) => a[1] && D.members.some((m) => m.a && m.g === g)).map(([g, a]) => [g, a[0] / a[1]]).sort((a, b) => b[1] - a[1])[0];
        return best ? [th, best] : null;
      }).filter(Boolean).sort((a, b) => collate(thName(a[0]), thName(b[0])));
      main.innerHTML = `
        <section class="qz-res-hero">
          <p class="kicker">${t('qzTitle')} · ${t('qzAnswered', Q.length)}</p>
          ${top ? `<h1 class="h1">${t('qzClosest')} <span class="qz-top-g" style="--gc:${gColor(top.g)}">${esc(gLong(top.g))}</span></h1>
          <p class="lede">${t('qzClosestLede', pct(top.s), groups[1] ? gShort(groups[1].g) : '', groups[1] ? pct(groups[1].s) : '')}</p>` : `<h1 class="h1">${t('qzTooFew')}</h1>`}
          <div class="qz-res-actions">
            <button type="button" class="btn primary" data-qz-share>${t('qzShare')}</button>
            <button type="button" class="btn" data-qz-edit>${t('qzEdit')}</button>
            <button type="button" class="btn" data-qz-new>${t('qzNew')}</button>
          </div>
          ${st.shared ? `<p class="callout">${t('qzSharedNote')}</p>` : ''}
        </section>
        <section class="section">
          <div class="section-head"><h2 class="h2">${t('qzHemi')}</h2><span class="small muted">${t('qzHemiNote')}</span></div>
          <div class="qz-hemi">${hemicycle(seated.map((m) => ({ color: agreeColor(sOf.get(m.id)), title: `${fullName(m)} · ${gShort(m.g)} · ${cName(m.c)} — ${sOf.has(m.id) ? pct(sOf.get(m.id)) : '–'}`, m })), `<b>${top ? pct(top.s) : '–'}</b><span>${top ? esc(gShort(top.g)) : ''}</span>`)}
            <div class="qz-scale"><span>0 %</span><i></i><span>100 %</span></div></div>
        </section>
        <div class="split section">
          <section>
            <div class="section-head"><h2 class="h2">${t('qzGroups')}</h2></div>
            <ol class="qz-list">${groups.map(({ g, s }) => `<li><a href="#/groupe/${g}"><span class="gname">${gdot(g)}<b>${esc(gShort(g))}</b></span><small>${esc(gLong(g))}</small></a>${bar(s, gColor(g))}</li>`).join('')}</ol>
          </section>
          <section>
            <div class="section-head"><h2 class="h2">${t('qzParties', cName(st.country))}</h2></div>
            <ol class="qz-list">${mineC.map((x) => `<li><a href="${partyHref(x.c, x.p)}"><span class="gname">${pdot(x.c, x.p, x.g)}<b>${esc(x.p)}</b></span><small>${gdot(x.g)}${esc(gShort(x.g))}</small></a>${bar(x.s)}</li>`).join('') || `<li class="muted">${t('qzNoData')}</li>`}</ol>
          </section>
        </div>
        <div class="split section">
          <section>
            <div class="section-head"><h2 class="h2">${t('qzMyMeps', cName(st.country))}</h2></div>
            <ol class="qz-list meps">${myMeps.map(mepRow).join('') || `<li class="muted">${t('qzNoData')}</li>`}</ol>
          </section>
          <section>
            <div class="section-head"><h2 class="h2">${t('qzTopMeps')}</h2></div>
            <ol class="qz-list meps">${meps.slice(0, 10).map(mepRow).join('')}</ol>
            <div class="section-head" style="margin-top:28px"><h2 class="h2">${t('qzTopParties')}</h2></div>
            <ol class="qz-list">${parties.slice(0, 8).map((x) => `<li><a href="${partyHref(x.c, x.p)}"><span class="gname">${cflag(x.c)}${pdot(x.c, x.p, x.g)}<b>${esc(x.p)}</b></span><small>${esc(cName(x.c))} · ${esc(gShort(x.g))}</small></a>${bar(x.s)}</li>`).join('')}</ol>
          </section>
        </div>
        ${thRows.length ? `<section class="section">
          <div class="section-head"><h2 class="h2">${t('qzByTheme')}</h2><span class="small muted">${t('qzByThemeNote')}</span></div>
          <div class="qz-themes">${thRows.map(([th, [g, s]]) => `<div class="qz-thc" style="--gc:${gColor(g)}"><span class="small muted">${esc(thName(th))}</span><b>${gdot(g)}${esc(gShort(g))}</b><span class="small">${pct(s)}</span></div>`).join('')}</div>
        </section>` : ''}
        <section class="section">
          <div class="section-head"><h2 class="h2">${t('qzRecap')}</h2><span class="small muted">${t('qzRecapNote')}</span></div>
          <ol class="qz-recap">${Q.map((x) => { const r = resultOf(x.v); const tg = top ? gm(x.f.g[top.g] || [0, 0, 0, 0]) : null; return `<li>
            <a href="#/vote/${x.v.id}"><b>${esc(cap(topicOf(x.v)))}</b></a>
            <span class="qz-rc"><span class="small muted">${t('qzYou')}</span>${pos(x.a)}${x.w > 1 ? `<span class="tag">${t('qzImpShort')}</span>` : ''}</span>
            <span class="qz-rc"><span class="small muted">${t('qzParl')}</span><span class="res ${r}">${resName(r)}</span></span>
            ${top ? `<span class="qz-rc"><span class="small muted">${esc(gShort(top.g))}</span>${tg ? pos(tg) : '—'}</span>` : ''}</li>`; }).join('')}</ol>
        </section>
        <p class="note">${t('qzMethod')}</p>`;
      on(main, 'click', '[data-qz-share]', async () => {
        const url = shareUrl(`quiz?r=${shareR}`);
        const text = top ? t('qzShareText', gShort(top.g), pct(top.s)) : t('qzTitle');
        try { if (navigator.share) { await navigator.share({ title: t('qzTitle'), text, url }); return; } } catch { return; }
        try { await navigator.clipboard.writeText(`${text} ${url}`); toast('t-copy', esc(t('linkCopied')), 2500); } catch { prompt(t('qzShare'), url); }
      });
      on(main, 'click', '[data-qz-edit]', () => { st.done = false; st.shared = false; st.i = 0; qzSave(st); question(); });
      on(main, 'click', '[data-qz-new]', () => { try { localStorage.removeItem(QZ_KEY); } catch { /* ignore */ } st = null; if (location.hash.includes('?r=')) location.hash = '#/quiz'; else intro(); });
      on(main, 'click', '[data-open]', (e, el) => openDrawer(Number(el.dataset.open)));
      scrollTop();
    }

    function draw() {
      if (!st || !st.ids || !st.ids.length) return intro();
      if (st.done) return results();
      return question();
    }
    if (shared) results();
    else intro();
  }

  /* ================================================================ la Belgique au Parlement */
  // les 22 sièges belges sont élus dans trois collèges : francophone (8), néerlandophone (13), germanophone (1)
  const BE_COLL = { FR: ['MR', 'PS', 'LesEng', 'ECOLO', 'PVDA-PTB', 'DéFI', 'cdH'], NL: ['Vlaams Belang', 'CD&V', 'N-VA', 'Vooruit', 'GROEN', 'Anders', 'Open Vld', 'sp.a'], DE: ['CSP'] };
  const BE_BY_ID = { 256890: 'NL', 187917: 'FR' }; // Rudi Kennes (liste PVDA, collège néerlandophone) ; Marc Botenga (PTB, collège francophone)
  const beColl = (m) => BE_BY_ID[m.id] || Object.keys(BE_COLL).find((k) => BE_COLL[k].includes(m.p)) || null;
  async function pageBelgium(my) {
    setNav('pays'); setTitle(t('beTitle'));
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    await loadVotes();
    const mem = D.members.filter((m) => m.c === 'BEL' && m.a);
    const files = await Promise.all(mem.map((m) => memberFile(m.id).catch(() => null)));
    if (my !== token) return;
    const P = new Map(mem.map((m, i) => [m.id, files[i] ? files[i].p : '']));
    const coll = { FR: [], NL: [], DE: [] };
    for (const m of mem) { const k = beColl(m); if (k) coll[k].push(m); }
    const finals = [];
    D.votes.forEach((v, i) => { if (v.mn) finals.push([v, i]); });
    // position majoritaire d'un ensemble d'eurodéputés sur un vote
    const tally = (list, i) => {
      const n = [0, 0, 0];
      for (const m of list) { const c = (P.get(m.id)[i] || '.').toUpperCase(); const k = 'FAX'.indexOf(c); if (k >= 0) n[k]++; }
      return n;
    };
    const majOf = (n) => (n[0] > n[1] && n[0] > n[2] ? 'F' : n[1] > n[0] && n[1] > n[2] ? 'A' : null);
    let both = 0, same = 0, uni = 0, present = 0;
    const splits = [], unanimous = [];
    const byTheme = new Map();
    for (const [v, i] of finals) {
      const fr = tally(coll.FR, i), nl = tally(coll.NL, i), all = tally(mem, i);
      const tot = all[0] + all[1] + all[2];
      if (tot >= 12) {
        present++;
        if ((all[0] === tot || all[1] === tot)) { uni++; unanimous.push([v, all]); }
      }
      const a = majOf(fr), b = majOf(nl);
      if (!a || !b) continue;
      both++;
      if (a === b) same++;
      else splits.push([v, fr, nl, Math.min(Math.max(fr[0], fr[1]) / (fr[0] + fr[1] + fr[2]), Math.max(nl[0], nl[1]) / (nl[0] + nl[1] + nl[2]))]);
      for (const th of themesOf(v)) { if (!byTheme.has(th)) byTheme.set(th, [0, 0]); const x = byTheme.get(th); x[1]++; if (a === b) x[0]++; }
    }
    splits.sort((x, y) => y[3] - x[3] || y[0].t.localeCompare(x[0].t));
    const tl = (n) => `<span class="be-t"><b style="color:var(--for)">${n[0]}</b>–<b style="color:var(--against)">${n[1]}</b>${n[2] ? `–<b style="color:var(--abst)">${n[2]}</b>` : ''}</span>`;
    const side = (n) => { const m = majOf(n); return m ? posName(m).toLowerCase() : t('split').toLowerCase(); };
    const collName = { FR: t('beFR'), NL: t('beNL'), DE: t('beDE') };
    const collCard = (k) => {
      const list = coll[k].slice().sort((a, b) => byGroupOrder(a.g, b.g) || collate(a.ln, b.ln));
      const parties = [...new Set(list.map((m) => (realParty(m.p) ? m.p : '')))].map((p) => ({ p, ms: list.filter((m) => (realParty(m.p) ? m.p : '') === p) })).sort((a, b) => b.ms.length - a.ms.length);
      let coh = 0, nv = 0;
      if (list.length > 1) for (const [, i] of finals) { const n = tally(list, i), tt = n[0] + n[1] + n[2]; if (tt >= 2) { coh += Math.max(...n) / tt; nv++; } }
      return `<article class="be-coll be-${k.toLowerCase()}">
        <header><span class="be-k">${esc(collName[k])}</span><b class="be-n">${list.length}</b>${nv ? `<span class="small muted">${t('cohesion')} ${pct(coh / nv)}</span>` : ''}</header>
        <ul class="be-parties">${parties.map(({ p, ms }) => `<li>${pdot('BEL', p, ms[0].g)}${p ? `<a href="${partyHref('BEL', p)}"><b>${esc(p)}</b></a>` : `<b>${esc(t('independent'))}</b>`}<span class="muted small">${esc(gShort(ms[0].g))}</span><span class="be-pn">${ms.length}</span></li>`).join('')}</ul>
        <div class="be-meps">${list.map((m) => `<a href="#/depute/${m.id}" title="${esc(fullName(m))} · ${esc(m.p || '')}">${photo(m, 'xs')}<span>${esc(fullName(m))}</span></a>`).join('')}</div>
      </article>`;
    };
    const thRows = [...byTheme].filter(([, x]) => x[1] >= 5).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]);
    main.innerHTML = `
      ${crumbs(CR.pays(), ['#/pays/BEL', cName('BEL')])}
      <h1 class="h1">${t('beTitle')}</h1>
      <p class="lede">${t('beLede')}</p>
      <div class="kpis">
        <div class="kpi"><div class="lab">${t('beKpiMeps')}</div><div class="val">${mem.length}</div><div class="cmp">${t('beKpiMepsNote', coll.FR.length, coll.NL.length, coll.DE.length)}</div></div>
        <div class="kpi"><div class="lab">${t('beKpiAgree')}</div><div class="val">${both ? pct(same / both) : '–'}</div><div class="cmp">${t('beKpiAgreeNote', both)}</div></div>
        <div class="kpi"><div class="lab">${t('beKpiSplit')}</div><div class="val">${fmt(both - same)}</div><div class="cmp">${t('beKpiSplitNote')}</div></div>
        <div class="kpi"><div class="lab">${t('beKpiUni')}</div><div class="val">${present ? pct(uni / present) : '–'}</div><div class="cmp">${t('beKpiUniNote')}</div></div>
      </div>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('beColleges')}</h2><a class="more" href="#/deputes?pays=BEL">${t('myCountrySeeMeps', mem.length)}</a></div>
        <div class="be-grid">${collCard('FR')}${collCard('NL')}${collCard('DE')}</div>
        <p class="note">${t('beCollNote')}</p>
      </section>
      ${thRows.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${t('beByTheme')}</h2><span class="small muted">${t('beByThemeNote')}</span></div>
        <div class="hbars">${thRows.map(([id, x]) => `<div class="hbar"><span class="gname"><a href="#/theme/${id}" style="color:inherit">${esc(thName(id))}</a></span><span class="hb"><i style="width:${(x[0] / x[1] * 100).toFixed(1)}%;background:var(--accent)"></i></span><b>${pct(x[0] / x[1])}</b></div>`).join('')}</div>
      </section>` : ''}
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('beSplits')}</h2><span class="small muted">${t('beSplitsNote')}</span></div>
        <div class="vote-list compact">${splits.slice(0, 10).map(([v, fr, nl]) => voteRow(v, `<span class="tag be-tag">FR ${esc(side(fr))} ${tl(fr)}</span><span class="tag be-tag">NL ${esc(side(nl))} ${tl(nl)}</span>`)).join('') || `<p class="muted">${t('beNoSplit')}</p>`}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('beUnanimous')}</h2><span class="small muted">${t('beUnanimousNote')}</span></div>
        <div class="vote-list compact">${unanimous.slice(0, 6).map(([v, n]) => voteRow(v, `<span class="tag">${n[0] ? t('beAllFor', n[0]) : t('beAllAgainst', n[1])}</span>`)).join('')}</div>
      </section>`;
    scrollTop();
  }

  async function pageCountries(my) {
    setNav('pays'); setTitle(t('navCountriesParties'));
    const act = D.members.filter((m) => m.a);
    const codes = [...new Set(act.map((m) => m.c))].sort((a, b) => collate(cName(a), cName(b)));
    const nParties = new Set(act.filter((m) => realParty(m.p)).map((m) => `${m.c}~${m.p}`)).size;
    main.innerHTML = `
      <p class="kicker">${t('ep')}</p>
      <h1 class="h1">${t('navCountriesParties')}</h1>
      <p class="lede">${t('countriesLede')}</p>
      <a class="next-session" href="#/${TP()}partis"><span class="ns-k">${t('countryParties')}</span><span class="ns-d">${t('partiesCount', nParties)}</span><span class="ns-s">${esc(t('mn').partiesLede)}</span><span class="more">${t('mn').seeAll}</span></a>
      <h2 class="h2 cg-h">${t('mn').hCountries}</h2>
      <div class="country-grid">${codes.map((c) => {
        const l = act.filter((m) => m.c === c), w = l.filter((m) => m.s.att != null);
        const att = w.reduce((s, m) => s + m.s.att, 0) / (w.length || 1);
        return `<a class="country-card" href="#/${TP()}pays/${c}"><span class="nm">${esc(cName(c))}</span><b>${l.length}</b>
          ${groupCompo(l).bar}<span class="mt">${t('countryCard', l.length, pct(att))}</span></a>`;
      }).join('')}</div>`;
    scrollTop();
  }

  async function pageCountry(my, code) {
    setNav('pays');
    if (!D.countries.has(code) || !D.members.some((m) => m.c === code)) return notFound();
    setTitle(cName(code));
    if (!keepScroll) main.innerHTML = `<p class="loading">${t('loadingVotes')}</p>`;
    const [, CV] = await Promise.all([loadVotes(), loadCountryVotes()]);
    if (my !== token) return;
    const act = D.members.filter((m) => m.a && m.c === code);
    const w = act.filter((m) => m.s.att != null);
    const att = w.reduce((s, m) => s + m.s.att, 0) / (w.length || 1);
    const parties = new Set(act.map((m) => m.p).filter(realParty));
    const compo = groupCompo(act);
    const largest = compo.rows.slice().sort((a, b) => b[1] - a[1])[0];
    const k = CV ? CV.C.indexOf(code) : -1;
    const tally = (v) => (k >= 0 && CV.v[v.id] ? CV.v[v.id][k] : null);
    const finals = D.votes.filter((v) => v.mn && tally(v) && tally(v)[0] + tally(v)[1] + tally(v)[2] > 0);
    const tag = (v) => { const c = tally(v); return c ? `<span class="tag">${t('countryVotesFor', c[0], c[1], c[2])}</span>` : ''; };
    const split = finals.filter((v) => { const c = tally(v); return c[0] + c[1] + c[2] >= Math.min(4, act.length); })
      .map((v) => { const c = tally(v), s = c[0] + c[1] + c[2]; return [v, 1 - Math.max(c[0], c[1], c[2]) / s]; })
      .filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1] || b[0].t.localeCompare(a[0].t)).slice(0, 6).map(([v]) => v);
    const against = finals.map((v) => {
      const c = tally(v), s = c[0] + c[1] + c[2], wl = winLetter(v);
      const maj = c[0] > c[1] && c[0] > c[2] ? 'F' : c[1] > c[0] && c[1] > c[2] ? 'A' : null;
      return [v, maj && wl && maj !== wl ? Math.max(c[0], c[1]) / s : 0];
    }).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1] || b[0].t.localeCompare(a[0].t)).slice(0, 6).map(([v]) => v);
    const byG = compo.rows.map(([g]) => [g, act.filter((m) => m.g === g).sort((a, b) => (a.p || '').localeCompare(b.p || '') || a.ln.localeCompare(b.ln))]);

    main.innerHTML = `
      ${crumbs(CR.pays())}
      <p class="kicker">${t('countryKicker')}</p>
      <h1 class="h1">${esc(cName(code))}</h1>
      ${code === 'BEL' && !archived() ? `<a class="next-session" href="#/belgique" style="margin:22px 0 0"><span class="ns-k">${t('beBanner')}</span><span class="ns-d">${t('beTitle')}</span><span class="ns-s">${t('beBannerNote')}</span><span class="more">→</span></a>` : ''}
      <div class="kpis">
        <div class="kpi"><div class="lab">${t('countrySeats')}</div><div class="val">${act.length}</div><div class="cmp">${t('shareOfEP', pct(act.length / D.members.filter((m) => m.a).length, 1))}</div></div>
        <div class="kpi"><div class="lab">${t('countryAtt')}</div><div class="val">${pct(att)}</div><div class="cmp">${t('parliament')}${col()}${pct(D.avg.att)}</div></div>
        <div class="kpi"><div class="lab">${t('countryParties')}</div><div class="val">${parties.size}</div><div class="cmp">${t('nGroupsShort', compo.rows.length)}</div></div>
        <div class="kpi"><div class="lab">${t('countryLargest')}</div><div class="val sm">${largest ? `${gdot(largest[0])}${esc(gShort(largest[0]))}` : '–'}</div><div class="cmp">${largest ? t('nMeps', largest[1]) : ''}</div></div>
      </div>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('countryCompo')}</h2></div>
        <div class="compo">${compo.bar}<div class="legend">${compo.rows.map(([g, n]) => `<a href="#/${TP()}groupe/${g}"><i style="background:${gColor(g)}"></i>${esc(gShort(g))} <b>${n}</b></a>`).join('')}</div></div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('countryPartiesList')}</h2></div>
        ${partyTable(code, [...new Set(act.map((m) => m.p).filter(realParty))].map((x) => ({ p: x, n: act.filter((m) => m.p === x).length, g: act.find((m) => m.p === x).g })).sort((a, b) => b.n - a.n || collate(a.p, b.p)))}
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('countryMeps')}</h2><a class="more" href="#/${TP()}deputes?pays=${code}">${t('sortFilter')}</a></div>
        <div class="deleg">${byG.map(([g, l]) => `<div class="deleg-row">
          <div class="deleg-c"><span>${gdot(g)}${esc(gShort(g))}</span><b>${l.length}</b></div>
          <ul class="deleg-m">${l.map((m) => `<li><a href="#/${TP()}depute/${m.id}">${esc(fullName(m))}</a>${m.p ? `<small>${realParty(m.p) ? `<a class="plink" href="${partyHref(m.c, m.p)}">${esc(m.p)}</a>` : esc(t('independent'))}</small>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>
      </section>
      ${split.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${t('countrySplit')}</h2></div>
        <p class="note" style="margin-top:0">${t('countrySplitNote')}</p>
        <div class="vote-list compact">${split.map((v) => voteRow(v, tag(v))).join('')}</div>
      </section>` : ''}
      ${against.length ? `<section class="section">
        <div class="section-head"><h2 class="h2">${t('countryAgainst')}</h2></div>
        <p class="note" style="margin-top:0">${t('countryAgainstNote')}</p>
        <div class="vote-list compact">${against.map((v) => voteRow(v, tag(v))).join('')}</div>
      </section>` : ''}
      <section class="section">
        <div class="section-head"><h2 class="h2">${t('countryLatest')}</h2><a class="more" href="#/${TP()}votes">${t('allVotes')}</a></div>
        <div class="vote-list compact">${finals.slice(0, 6).map((v) => voteRow(v, tag(v))).join('')}</div>
      </section>`;
    scrollTop();
  }

  /* ================================================================ comparer */
  async function pageCompare(my, q) {
    setNav('deputes'); setTitle(t('compareTitle'));
    const known = (x) => (D.mById.has(Number(x)) ? Number(x) : null);
    const st = { a: known(q.get('a')), b: known(q.get('b')) };
    main.innerHTML = `
      ${crumbs(CR.deputes())}
      <h1 class="h1">${t('compareTitle')}</h1>
      <p class="lede">${t('compareLede')}</p>
      <div class="cmp-pick">
        ${['a', 'b'].map((k, i) => `${i ? `<span class="vs">${t('and')}</span>` : ''}<div class="picker" data-slot="${k}">
          <label for="pick-${k}">${i ? t('secondMep') : t('firstMep')}</label>
          <input id="pick-${k}" type="search" placeholder="${esc(t('typeName'))}" autocomplete="off">
          <div class="search-results" hidden></div>
          <div class="picked"></div></div>`).join('')}
      </div>
      <div id="cmp-out"></div>`;

    const showPicked = () => {
      for (const k of ['a', 'b']) {
        const m = D.mById.get(st[k]);
        $(`[data-slot="${k}"] .picked`).innerHTML = m ? `${photo(m, 'sm')}<span><a href="#/${TP()}depute/${m.id}" style="color:var(--ink);font-weight:600">${esc(fullName(m))}</a><br><span class="small muted">${gdot(m.g)}${esc(gShort(m.g))} · ${esc(cName(m.c))}</span></span>` : '';
      }
    };
    const compute = async () => {
      setQuery({ a: st.a || '', b: st.b || '' });
      showPicked();
      const out = $('#cmp-out');
      if (!st.a || !st.b) { out.innerHTML = ''; return; }
      if (st.a === st.b) { out.innerHTML = `<p class="callout" style="margin-top:28px">${t('pickTwo')}</p>`; return; }
      out.innerHTML = `<p class="loading" style="margin-top:28px">${t('computing')}</p>`;
      const [fa, fb] = await Promise.all([memberFile(st.a), memberFile(st.b), loadVotes()]);
      if (my !== token) return;
      const A = fa.p.toUpperCase(), B = fb.p.toUpperCase();
      let both = 0, same = 0, bothMain = 0, sameMain = 0;
      const diffs = [];
      for (let i = 0; i < D.votes.length; i++) {
        const x = A[i], y = B[i];
        if (!x || !y || x === '.' || y === '.' || x === 'N' || y === 'N') continue;
        both++; if (x === y) same++;
        if (D.votes[i].mn) { bothMain++; if (x === y) sameMain++; else diffs.push([D.votes[i], x, y]); }
      }
      const ma = D.mById.get(st.a), mb = D.mById.get(st.b);
      out.innerHTML = both ? `
        <div class="agree"><b>${pct(same / both)}</b><span class="muted">${t('sameVotes', fmt(both))}</span></div>
        <p class="note" style="text-align:center;margin:0 auto">${t('onFinalOnly', bothMain ? pct(sameMain / bothMain) : '–', fmt(bothMain))}</p>
        <section class="section">
          <div class="section-head"><h2 class="h2">${t('opposedOn')}</h2><span class="small muted">${t('nVotes', diffs.length)}</span></div>
          <div class="table-wrap"><table class="t"><thead><tr><th>${t('vote')}</th><th>${esc(titleCase(ma.ln))}</th><th>${esc(titleCase(mb.ln))}</th></tr></thead><tbody>
          ${diffs.slice(0, 60).map(([v, x, y]) => `<tr class="click" data-href="#/${TP()}vote/${v.id}"><td><a href="#/${TP()}vote/${v.id}" style="color:var(--ink);font-weight:600">${esc(tiOf(v))}</a><br><span class="small muted">${esc(dateLong(v.t))}</span></td><td>${pos(x)}</td><td>${pos(y)}</td></tr>`).join('')}
          </tbody></table></div>
        </section>` : `<p class="callout" style="margin-top:28px">${t('noCommon')}</p>`;
    };

    for (const k of ['a', 'b']) {
      const box = $(`[data-slot="${k}"]`);
      const input = $('input', box), res = $('.search-results', box);
      input.addEventListener('input', () => {
        const s = norm(input.value);
        if (s.length < 2) { res.hidden = true; return; }
        const hits = D.members.filter((m) => m.key.includes(s)).slice(0, 8);
        res.innerHTML = hits.map((m) => `<a href="#" data-pick="${m.id}">${photo(m, 'xs')}<span class="vt"><span>${esc(fullName(m))}</span><span class="sub">${esc(gShort(m.g))} · ${esc(cName(m.c))}</span></span></a>`).join('') || `<div class="none">${t('noResult')}</div>`;
        res.hidden = false;
      });
      res.addEventListener('click', (e) => {
        const a = e.target.closest('[data-pick]'); if (!a) return;
        e.preventDefault(); st[k] = Number(a.dataset.pick); input.value = ''; res.hidden = true; compute();
      });
    }
    on(main, 'click', 'tr[data-href]', (e, el) => { if (!e.target.closest('a')) location.hash = el.dataset.href; });
    await compute(); scrollTop();
  }


  /* ================================================================ archives */
  const OLD_TERMS = [[8, '2014–2019'], [7, '2009–2014'], [6, '2004–2009'], [5, '1999–2004'], [4, '1994–1999'], [3, '1989–1994'], [2, '1984–1989'], [1, '1979–1984']];
  async function pageArchive(my) {
    setNav('archive'); setTitle(t('archives'));
    const [old] = await Promise.all([loadOld(), loadBase(storeOf(CURRENT)), loadBase(storeOf(9))]);
    if (my !== token) return;
    const list = [CURRENT, 9, ...OLD_TERMS.map(([n]) => n)];
    const years = (n) => (TERMS[n] ? TERMS[n].years : OLD_TERMS.find((x) => x[0] === n)[1]);
    const href = (n) => (n === CURRENT ? '#/' : TERMS[n] ? `#/archive/${n}/` : `#/archive/old/${n}`);
    const fig = (v, l) => `<div class="fig"><b>${v}</b><span>${l}</span></div>`;

    // fiche détaillée d'une législature, construite à la première ouverture
    const cache = new Map();
    function panel(n) {
      if (cache.has(n)) return cache.get(n);
      let hemi, legend, figs, links, note;
      if (TERMS[n]) {
        const S = stores[n], m = S.meta;
        const act = S.members.filter((x) => x.a).sort((a, b) => byGroupOrder(a.g, b.g) || a.ln.localeCompare(b.ln));
        const groups = [...new Set(act.map((x) => x.g))].sort(byGroupOrder);
        hemi = hemicycle(act.map((x) => ({ color: gColor(x.g), title: '', m: x })), `<b>${act.length}</b><span>${t('seats')}</span>`);
        legend = groups.map((g) => `<span><i style="background:${gColor(g)}"></i>${esc(gShort(g))} <b>${act.filter((x) => x.g === g).length}</b></span>`).join('');
        figs = fig(fmt(m.counts.votes), t('figVotesShort')) + fig(fmt(m.counts.main), t('figMain')) + fig(fmt(m.counts.members), t('figMeps')) + fig(groups.length, t('figGroupsN'));
        const pre = n === CURRENT ? '#/' : `#/archive/${n}/`;
        links = `<a class="btn primary" href="${pre}">${t('exploreTerm')}</a><a class="btn" href="${pre}votes">${t('navVotes')}</a><a class="btn" href="${pre}deputes">${t('navMeps')}</a><a class="btn" href="${pre}groupes">${t('navGroups')}</a>`;
        note = n === CURRENT ? '' : t('archiveNote');
      } else {
        const T = old.terms.find((x) => x.n === n), col = oldColors(T);
        const gIdx = new Map(T.groups.map((g, i) => [g.code, i]));
        const seated = T.members.filter((x) => x.i).sort((a, b) => gIdx.get(a.g) - gIdx.get(b.g));
        hemi = hemicycle(seated.map((x) => ({ color: col[x.g], title: '', m: { id: x.id, g: x.g, c: x.c } })), `<b>${T.seats}</b><span>${t('seats')}</span>`);
        legend = T.groups.filter((g) => g.seats).map((g) => `<span><i style="background:${col[g.code]}"></i>${esc(g.code)} <b>${g.seats}</b></span>`).join('');
        figs = fig(fmt(T.seats), t('seatsAtStart')) + fig(fmt(T.members.length), t('figMeps')) + fig(T.groups.filter((g) => g.seats).length, t('figGroupsN')) + fig(new Set(T.members.map((x) => x.c)).size, t('figCountries'));
        links = `<a class="btn primary" href="${href(n)}">${t('exploreTerm')}</a>`;
        note = t('noData');
      }
      const html = `<div class="tp-head"><div><p class="kicker">${t('termName', n)}${n === CURRENT ? ` <span class="tag">${t('ongoing')}</span>` : ''}</p><h2 class="h2">${years(n)}</h2></div><div class="term-links">${links}</div></div>
        <div class="tp-body"><div class="tp-hemi">${hemi}<div class="legend">${legend}</div></div>
        <div class="tp-figs">${figs}${note ? `<p class="note">${note}</p>` : ''}</div></div>`;
      cache.set(n, html);
      return html;
    }

    main.innerHTML = `
      <p class="kicker">${t('ep')}</p>
      <h1 class="h1">${t('archivesTitle')}</h1>
      <p class="lede">${t('archivesLede')}</p>
      <div class="terms" id="terms">
        <ol class="term-list">${list.map((n) => `<li><a class="term-item" href="${href(n)}" data-term="${n}">
          <span class="term-n">${t('termName', n)}</span><span class="term-y">${years(n)}</span>${n === CURRENT ? `<span class="tag">${t('ongoing')}</span>` : ''}<span class="more" aria-hidden="true">→</span></a></li>`).join('')}</ol>
        <div class="term-panel" id="term-panel" aria-live="polite"></div>
      </div>
      <p class="stage-hint">${t('archHint')}</p>
      <p class="note">${t('olderNote')} <a href="https://historicalarchives.europarl.europa.eu/" target="_blank" rel="noopener">${t('epArchives')} ↗</a></p>`;

    const box = $('#terms'), pane = $('#term-panel');
    const narrow = matchMedia('(max-width: 860px)');
    const st = PS.arch || (PS.arch = { n: CURRENT });
    let shown = null, timer = 0;
    function show(n, focus) {
      if (focus) box.classList.add('focus');
      $$('.term-item', box).forEach((a) => a.classList.toggle('on', Number(a.dataset.term) === n));
      if (narrow.matches) $(`.term-item[data-term="${n}"]`, box).parentElement.append(pane); else if (pane.parentElement !== box) box.append(pane);
      if (shown === n) return;
      shown = n; st.n = n;
      pane.innerHTML = `<div class="tp" data-href="${href(n)}">${panel(n)}</div>`;
    }
    show(st.n, false);
    // survol : on attend un court instant pour ne pas changer de fiche en traversant la liste
    on(box, 'pointerover', '.term-item', (e, el) => {
      if (e.pointerType === 'touch') return;
      clearTimeout(timer); timer = setTimeout(() => show(Number(el.dataset.term), true), 90);
    });
    let pressing = false; // un appui donne aussi le focus : seul le clavier passe par focusin
    box.addEventListener('pointerdown', () => { pressing = true; });
    on(box, 'focusin', '.term-item', (e, el) => { if (!pressing) show(Number(el.dataset.term), true); });
    box.addEventListener('pointerleave', () => { clearTimeout(timer); box.classList.remove('focus'); });
    box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) box.classList.remove('focus'); });
    // écran tactile : un premier appui déploie la fiche, le second l'ouvre
    on(box, 'click', '.term-item', (e, el) => {
      const n = Number(el.dataset.term);
      if (narrow.matches && shown !== n) { e.preventDefault(); show(n, true); }
      pressing = false;
    });
    on(box, 'click', '.tp', (e, el) => { if (!e.target.closest('a')) location.hash = el.dataset.href; });
    scrollTop();
  }

  /* ================================================================ législatures 1979–2019 */
  let oldP;
  const loadOld = () => (oldP = oldP || getJSON('data/old.json'));
  const FAM_COLOR = { left: '--g-GUE_NGL', green: '--g-GREEN_EFA', soc: '--g-SD', radical: '--g-RAD', lib: '--g-RENEW', epp: '--g-EPP', cons: '--g-ECR', natcons: '--g-PFE', sov: '--g-ESN', nat: '--g-ID', tech: '--g-TECH', ni: '--g-NI' };
  const c2Name = (a2) => { try { return regionNames ? regionNames.of(a2) : a2; } catch { return a2; } };
  function oldColors(T) {
    const seen = {}; const col = {};
    for (const g of T.groups) {
      const k = seen[g.fam] = (seen[g.fam] ?? -1) + 1;
      col[g.code] = k ? `color-mix(in srgb, var(${FAM_COLOR[g.fam]}) ${100 - k * 35}%, var(--bg))` : `var(${FAM_COLOR[g.fam]})`;
    }
    return col;
  }

  async function pageOldTerm(my, n) {
    setNav('archive');
    const [data] = await Promise.all([loadOld(), loadBase(storeOf(9)).catch(() => {})]);
    if (my !== token) return;
    const T = data.terms.find((x) => x.n === n);
    if (!T) return notFound();
    setTitle(`${t('termName', n)} (${T.years})`);
    const col = oldColors(T);
    const gIdx = new Map(T.groups.map((g, i) => [g.code, i]));
    const gName = new Map(T.groups.map((g) => [g.code, g]));
    const byId = new Map(T.members.map((m) => [m.id, m]));
    oldCtx = { term: T, byId, col };
    const seated = T.members.filter((m) => m.i).sort((a, b) => gIdx.get(a.g) - gIdx.get(b.g) || a.n.localeCompare(b.n));
    const countries = [...new Set(T.members.map((m) => m.c))].sort((a, b) => collate(c2Name(a), c2Name(b)));
    const st = PS.old || (PS.old = { q: '', c: '', g: '', hl: '', n: 60 });

    main.innerHTML = `
      <div class="archive-bar"><span>${t('archiveBar', T.years)}</span><a href="#/archive">${t('allTerms')}</a><a href="#/">${t('backToCurrent')}</a></div>
      <section class="stage">
        <div class="stage-title">
          <p class="kicker">${t('termName', n)}</p>
          <h1 class="h1">${t('archiveTitle', T.years)}</h1>
          <p class="lede" style="margin-inline:auto">${t('oldLede', fmt(T.seats), fmt(T.members.length), dateLong(T.start))}</p>
        </div>
        <div class="chips" role="group" aria-label="${esc(t('hlGroup'))}" style="margin-top:18px">
          ${T.groups.filter((g) => g.seats).map((g) => `<button type="button" class="chip" data-old-hl="${esc(g.code)}" aria-pressed="${st.hl === g.code}"><i style="background:${col[g.code]}"></i>${esc(g.code)} <b>${g.seats}</b></button>`).join('')}
        </div>
        <div class="stage-main${st.hl ? ' side' : ''}" id="stage-main">
        <div class="ginfo-slot" id="old-group-info" aria-live="polite">${st.hl ? oldGroupInfo(T, st.hl, col) : ''}</div>
        <div class="stage-hemi">${hemicycle(seated.map((m) => ({ color: col[m.g], title: `${m.n} · ${m.g} · ${c2Name(m.c)}`, m: { id: m.id, g: m.g, c: m.c } })), `<b id="old-count">${T.seats}</b><span id="old-label">${t('seats')}</span>`, 'big')}</div>
        </div>
        <p class="stage-hint">${t('clickSeat')}</p>
      </section>

      <section class="section" id="s-groupes">
        <div class="section-head"><h2 class="h2">${t('groupsAtStart')}</h2></div>
        <div class="table-wrap"><table class="t">
          <thead><tr><th>${t('group')}</th><th>${t('familyCol')}</th><th class="num">${t('seats')}</th></tr></thead>
          <tbody>${T.groups.map((g) => `<tr><td><span class="gname" style="display:flex;gap:8px;align-items:center;font-weight:600"><i class="gdot" style="background:${col[g.code]}"></i>${esc(g.code)}</span><small class="muted">${esc(g.name)}</small></td><td>${esc(t('fam')[g.fam] || '')}</td><td class="num">${g.seats || '–'}</td></tr>`).join('')}</tbody>
        </table></div>
        <p class="note">${t('oldCompoNote')}</p>
      </section>

      <section class="section" id="s-deputes">
        <div class="section-head"><h2 class="h2">${t('membersOfTerm')}</h2></div>
        <div class="toolbar">
          <label class="sr" for="o-q">${t('name')}</label><input id="o-q" type="search" placeholder="${esc(t('mepName'))}" value="${esc(st.q)}">
          <label class="sr" for="o-c">${t('country')}</label><select id="o-c"><option value="">${t('allCountries')}</option>${countries.map((c) => `<option value="${c}" ${st.c === c ? 'selected' : ''}>${esc(c2Name(c))}</option>`).join('')}</select>
          <label class="sr" for="o-g">${t('group')}</label><select id="o-g"><option value="">${t('allGroups')}</option>${T.groups.map((g) => `<option value="${esc(g.code)}" ${st.g === g.code ? 'selected' : ''}>${esc(g.code)}</option>`).join('')}</select>
        </div>
        <p class="count-line" id="o-count"></p>
        <div class="table-wrap"><table class="t"><thead><tr><th>${t('mep')}</th><th>${t('group')}</th><th>${t('partyCol')}</th><th>${t('mandateCol')}</th></tr></thead><tbody id="o-rows"></tbody></table></div>
        <div class="more-row" id="o-more"></div>
        <p class="note">${t('oldSource')}</p>
      </section>`;

    const svg = $('.hemi', main);
    const applyHL = () => {
      let k = 0;
      for (const c of svg.querySelectorAll('circle')) { const on = !st.hl || c.dataset.g === st.hl; c.classList.toggle('hl', !!st.hl && on); if (on) k++; }
      svg.classList.toggle('dim', !!st.hl);
      $('#old-count').textContent = k;
      $('#old-label').textContent = st.hl || t('seats');
    };
    const draw = () => {
      const k = norm(st.q);
      const list = T.members.filter((m) => (!st.c || m.c === st.c) && (!st.g || m.g === st.g || (m.gh || []).some((h) => h.g === st.g)) && (!k || norm(m.n).includes(k)));
      $('#o-count').textContent = t('nMeps', list.length);
      $('#o-rows').innerHTML = list.slice(0, st.n).map((m) => `<tr class="click" data-old="${m.id}">
        <td><div class="who">${photo({ id: m.id, fn: m.n, ln: m.n.split(' ').slice(-1)[0] }, 'sm')}<span><a href="#" data-old="${m.id}">${esc(m.n)}</a><small>${esc(c2Name(m.c))}</small></span></div></td>
        <td><span class="gpill" style="font-weight:500"><i class="gdot" style="background:${col[m.g]}"></i>${esc(m.g)}</span></td>
        <td class="small">${esc(m.p || '–')}</td>
        <td class="small muted" style="white-space:nowrap">${esc(dateShort(m.s))} – ${esc(dateShort(m.e))}</td></tr>`).join('')
        || `<tr><td colspan="4" class="muted">${t('noMepMatch')}</td></tr>`;
      $('#o-more').innerHTML = list.length > st.n ? `<button class="btn" data-more>${t('showMore', Math.min(60, list.length - st.n))}</button>` : '';
    };
    on(main, 'click', '[data-old-hl]', (e, el) => {
      st.hl = st.hl === el.dataset.oldHl ? '' : el.dataset.oldHl;
      $$('[data-old-hl]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.oldHl === st.hl)));
      sideInfo($('#stage-main'), st.hl ? oldGroupInfo(T, st.hl, col) : '');
      requestAnimationFrame(() => requestAnimationFrame(applyHL));
    });
    on(main, 'input', '#o-q', (e) => { st.q = e.target.value; st.n = 60; draw(); });
    on(main, 'change', '#o-c', (e) => { st.c = e.target.value; st.n = 60; draw(); });
    on(main, 'change', '#o-g', (e) => { st.g = e.target.value; st.n = 60; draw(); });
    on(main, 'click', '[data-more]', () => { st.n += 60; draw(); });
    on(main, 'click', '[data-old]', (e, el) => { e.preventDefault(); openOldDrawer(byId.get(Number(el.dataset.old))); });
    draw(); applyHL(); scrollTop();
  }

  // présentation d'un groupe des législatures 1979–2019 (même format que la législature actuelle)
  function oldGroupInfo(T, code, colors) {
    const g = T.groups.find((x) => x.code === code);
    const G = (window.HEMI_GROUPS_OLD || {})[code];
    if (!g) return '';
    const members = T.members.filter((m) => m.g === code || (m.gh || []).some((h) => h.g === code));
    const count = new Map();
    for (const m of members) { if (!m.p) continue; const k = `${m.p}|${m.c}`; count.set(k, (count.get(k) || 0) + 1); }
    const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, n]) => { const [p, c] = k.split('|'); return `${esc(p)} <span class="muted">(${esc(c2Name(c))}, ${n})</span>`; });
    const period = G && G.p ? (G.p.includes(' · ') ? G.p.split(' · ')[{ fr: 0, en: 1, nl: 2 }[lang]] : G.p) : '';
    const meta = [t('fam')[g.fam], period, g.seats ? t('nSeatsStart', g.seats) : '', t('nMeps', members.length)].filter(Boolean).join(' · ');
    return `<div class="ginfo" style="--gc:${colors[code]}">
      <div class="ginfo-head"><div><h3 class="h3">${esc(g.name)} <span class="muted" style="font-weight:500">(${esc(code)})</span></h3><p class="small muted">${esc(meta)}</p></div></div>
      ${G ? `<p>${esc(G[lang] || G.en)}</p>` : ''}
      ${top.length ? `<p class="small"><b>${t('mainParties')}</b>${col()}${top.join(' · ')}</p>` : ''}
    </div>`;
  }

  function openOldDrawer(m) {
    if (!m || !oldCtx) return;
    const T = oldCtx.term;
    const g = T.groups.find((x) => x.code === m.g);
    const cur = stores[CURRENT] && stores[CURRENT].mById.get(m.id);
    const prev = stores[9] && stores[9].mById && stores[9].mById.get(m.id);
    lastFocus = document.activeElement;
    drawer.dataset.id = String(m.id);
    drawer.setAttribute('aria-label', t('drawerAria'));
    drawer.innerHTML = `
      <button class="drawer-close" type="button" aria-label="${esc(t('close'))}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15"/></svg></button>
      <div class="drawer-head">
        ${photo({ id: m.id, fn: m.n, ln: m.n.split(' ').slice(-1)[0] }, 'lg')}
        <div>
          <p class="kicker">${esc(c2Name(m.c))} · ${t('termName', T.n)}</p>
          <h2 class="h2">${esc(m.n)}</h2>
          <span class="gpill"><i class="gdot" style="background:${oldCtx.col[m.g]}"></i>${esc(g ? g.name : m.g)}</span>
          ${m.p ? `<div class="small muted" style="margin-top:4px">${esc(m.p)}</div>` : ''}
        </div>
      </div>
      <div class="drawer-vote"><span>${t('mandateCol')}</span><b style="color:var(--ink)">${esc(dateLong(m.s))} – ${esc(dateLong(m.e))}</b></div>
      ${m.gh ? `<p class="note">${t('groupHistory')}${col()}${m.gh.map((h) => `${esc(h.g)} (${esc(dateShort(h.s))} – ${esc(dateShort(h.e))})`).join(', ')}.</p>` : ''}
      <div class="drawer-bio" id="drawer-bio"><p class="muted small">${t('bioLoading')}</p></div>
      <div class="drawer-actions">
        <a class="btn primary" href="${epUrl(m.id)}" target="_blank" rel="noopener">${t('officialProfile')} ↗</a>
        ${cur ? `<a class="btn" href="#/depute/${m.id}">${t('currentProfile')}</a>` : prev ? `<a class="btn" href="#/archive/9/depute/${m.id}">${t('termName', 9)}</a>` : ''}
      </div>`;
    showDrawer();
    document.body.classList.add('drawer-open');
    $('.drawer-close', drawer).focus();
    loadBio(m.id).then((b) => { const el = $('#drawer-bio'); if (el && drawer.dataset.id === String(m.id)) el.innerHTML = b ? shortBio(b) : ''; })
      .catch(() => { const el = $('#drawer-bio'); if (el) el.innerHTML = ''; });
  }

  /* ================================================================ recherche globale */
  const sInput = $('#q'), sBox = $('#search-results');
  let sSel = -1;
  function closeSearch() { sBox.hidden = true; sSel = -1; }
  sInput.addEventListener('input', async () => {
    const s = norm(sInput.value.trim());
    if (s.length < 2) return closeSearch();
    await loadBase();
    const mem = D.members.filter((m) => m.key.includes(s)).sort((a, b) => (b.a - a.a)).slice(0, 6);
    const pSeen = new Set(), parties = [];
    for (const m of D.members) {
      if (!realParty(m.p) || parties.length >= 4) continue;
      const k = `${m.c}~${m.p}`;
      if (pSeen.has(k) || !(norm(m.p).includes(s) || norm(m.pl).includes(s))) continue;
      pSeen.add(k); parties.push(m);
    }
    let vts = [];
    if (D.votes) {
      const words = s.split(/\s+/);
      vts = D.votes.filter((v) => v.mn && words.every((w) => v.key.includes(w))).slice(0, 6);
    } else loadVotes().then(() => sInput.dispatchEvent(new Event('input')));
    sBox.innerHTML = (mem.length ? `<h4>${t('meps')}</h4>${mem.map((m) => `<a href="#/${TP()}depute/${m.id}">${photo(m, 'xs')}<span class="vt"><span>${esc(fullName(m))}</span><span class="sub">${esc(gShort(m.g))} · ${esc(cName(m.c))}${m.a ? '' : ` · ${t('formerShort')}`}</span></span></a>`).join('')}` : '')
      + (parties.length ? `<h4>${t('countryPartiesList')}</h4>${parties.map((m) => `<a href="${partyHref(m.c, m.p)}"><span class="vt"><span>${esc(m.pl || m.p)}${m.pl && m.pl !== m.p ? ` (${esc(m.p)})` : ''}</span><span class="sub">${esc(cName(m.c))} · ${esc(gShort(m.g))}</span></span></a>`).join('')}` : '')
      + (vts.length ? `<h4>${t('finalVotes')}</h4>${vts.map((v) => `<a href="#/${TP()}vote/${v.id}"><span class="vt"><span>${esc(tiOf(v))}</span><span class="sub">${esc(dateLong(v.t))} · ${resName(resultOf(v))}</span></span></a>`).join('')}<a href="#/${TP()}votes?q=${encodeURIComponent(sInput.value.trim())}&type=tous" class="sub" style="color:var(--accent)">${t('allVotesFor', esc(sInput.value.trim()))} →</a>` : '')
      || `<div class="none">${t('noResult')}</div>`;
    sBox.hidden = false; sSel = -1;
  });
  sInput.addEventListener('keydown', (e) => {
    const links = $$('a', sBox);
    if (sBox.hidden || !links.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sSel = (sSel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((a, i) => a.classList.toggle('on', i === sSel));
    } else if (e.key === 'Escape') closeSearch();
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const links = $$('a', sBox);
    const a = links[sSel] || links[0];
    if (a) { location.hash = a.getAttribute('href'); sInput.value = ''; closeSearch(); sInput.blur(); }
  });
  sBox.addEventListener('click', (e) => { if (e.target.closest('a')) { sInput.value = ''; closeSearch(); } });
  document.addEventListener('click', (e) => { if (!e.target.closest('#search-form')) closeSearch(); });

  /* ================================================================ application (installation, hors connexion, mode appli) */
  const ROOT = (() => { const sc = $('script[src*="app.js"]'); return sc ? new URL('.', sc.src).href : new URL('.', location.href).href; })();
  const APP_ON = window.HEMI_APP === true;
  const isStandalone = () => APP_ON && matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // petit message en bas de l'écran (hors connexion, nouvelle version…)
  const toastBox = document.createElement('div');
  toastBox.className = 'toasts'; toastBox.setAttribute('aria-live', 'polite');
  document.body.append(toastBox);
  function toast(id, html, ms) {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; el.className = 'toast'; toastBox.append(el); }
    el.innerHTML = html;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    if (ms) el._t = setTimeout(() => dropToast(id), ms);
    return el;
  }
  function dropToast(id) { const el = document.getElementById(id); if (!el) return; el.classList.remove('show'); setTimeout(() => el.remove(), 350); }
  const paintOnline = () => { if (navigator.onLine === false) toast('t-offline', `<span class="t-dot"></span>${esc(t('offline'))}`); else if (document.getElementById('t-offline')) { dropToast('t-offline'); toast('t-online', esc(t('backOnline')), 2500); } };
  window.addEventListener('online', paintOnline);
  window.addEventListener('offline', paintOnline);
  if (navigator.onLine === false) paintOnline();

  // service worker : seulement sur le site publié (fichiers versionnés), jamais en aperçu
  // version application désactivée : on retire un éventuel ancien service worker pour que tout le monde ait la dernière version
  if (!APP_ON && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  }
  if (APP_ON && 'serviceWorker' in navigator && $('script[src*="app.js?v="]') && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('sw.js', ROOT), { scope: ROOT }).then((reg) => {
        const offer = (w) => {
          if (!w || !navigator.serviceWorker.controller) return;
          const el = toast('t-update', `<span>${esc(t('updateReady'))}</span><button type="button" class="t-btn">${esc(t('updateNow'))}</button>`);
          $('button', el).onclick = () => w.postMessage('skipWaiting');
        };
        if (reg.waiting) offer(reg.waiting);
        reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    });
  }

  // installation : bouton du navigateur (Chrome, Edge, Android) ou mode d'emploi (iPhone, iPad)
  let installEvt = null;
  const installLinks = () => $$('[data-install]');
  const paintInstall = () => installLinks().forEach((a) => { a.hidden = !APP_ON || isStandalone() || !(installEvt || isIOS); });
  window.addEventListener('beforeinstallprompt', (e) => { if (!APP_ON) return; e.preventDefault(); installEvt = e; paintInstall(); });
  window.addEventListener('appinstalled', () => { installEvt = null; paintInstall(); toast('t-inst', esc(t('installed')), 3000); });
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-install]');
    if (!a) return;
    e.preventDefault();
    if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch { /* ignore */ } installEvt = null; paintInstall(); return; }
    let dlg = $('#install-help');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'install-help'; dlg.className = 'install-dlg';
      document.body.append(dlg);
      dlg.addEventListener('click', (ev) => { if (ev.target === dlg || ev.target.closest('[data-close]')) dlg.close(); });
    }
    dlg.innerHTML = `<div class="idl-in"><svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">${$('.wordmark .mark').innerHTML}</svg>
      <h2 class="h3">${esc(t('installTitle'))}</h2><ol>${t('installSteps').map((x) => `<li>${x}</li>`).join('')}</ol>
      <button type="button" class="btn primary" data-close>${esc(t('ok'))}</button></div>`;
    dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
  });

  // mode application (site ajouté à l'écran d'accueil) : barre d'onglets en bas et bouton retour
  function paintAppChrome() {
    const app = isStandalone();
    document.documentElement.classList.toggle('app', app);
    paintInstall();
    if (!app) return;
    const { parts } = parseHash();
    const p0 = parts[0] === 'archive' ? '' : parts[0] || '';
    const tabOf = { '': 'home', deputes: 'deputes', depute: 'deputes', comparer: 'deputes', votes: 'votes', vote: 'votes', themes: 'votes', theme: 'votes', sessions: 'sessions', session: 'sessions', pays: 'pays', parti: 'pays', partis: 'pays', groupes: 'pays', groupe: 'pays' };
    const cur = tabOf[p0] ?? '';
    let bar = $('#tabbar');
    if (!bar) {
      bar = document.createElement('nav'); bar.id = 'tabbar'; bar.className = 'tabbar';
      document.body.append(bar);
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'app-back'; back.id = 'app-back';
      back.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6"/></svg>';
      back.addEventListener('click', () => { if (history.length > 1) history.back(); else location.hash = '#/'; });
      $('.masthead-row').prepend(back);
    }
    const I = {
      home: '<path d="M3.5 9.5 10 4l6.5 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1z"/>',
      deputes: '<circle cx="10" cy="7" r="3"/><path d="M4 17c.6-3.2 3-5 6-5s5.4 1.8 6 5"/>',
      votes: '<rect x="4" y="3.5" width="12" height="13" rx="2"/><path d="m7.3 10.2 1.9 1.9 3.6-3.8"/>',
      sessions: '<rect x="3.5" y="4.5" width="13" height="12" rx="2"/><path d="M3.5 8.5h13M7 3v3M13 3v3"/>',
      pays: '<circle cx="10" cy="10" r="6.5"/><path d="M3.5 10h13M10 3.5c2 2 2.8 4.2 2.8 6.5s-.8 4.5-2.8 6.5c-2-2-2.8-4.2-2.8-6.5s.8-4.5 2.8-6.5z"/>',
    };
    const items = [['home', '#/', t('crumbHome')], ['deputes', '#/deputes', t('navMeps')], ['votes', '#/votes', t('navVotes')], ['sessions', '#/sessions', t('tabSessions')], ['pays', '#/pays', t('tabCountries')]];
    bar.setAttribute('aria-label', t('tabsLabel'));
    bar.innerHTML = items.map(([k, h, l]) => `<a href="${h}"${k === cur ? ' aria-current="page" class="on"' : ''}><svg viewBox="0 0 20 20" aria-hidden="true">${I[k]}</svg><span>${esc(l)}</span></a>`).join('');
    const back = $('#app-back');
    back.setAttribute('aria-label', t('back'));
    back.hidden = !parts.length || (parts.length === 1 && !parts[0]);
  }
  window.addEventListener('hashchange', paintAppChrome);
  matchMedia('(display-mode: standalone)').addEventListener?.('change', paintAppChrome);

  // écran de lancement : il reste le temps de l'animation (≈1,7 s) et du premier affichage, puis s'efface vers la page
  const splashT0 = window.__spT || performance.now();
  function endSplash() {
    const el = $('#splash');
    if (!el || !document.documentElement.classList.contains('splash') || el.classList.contains('done')) return;
    const wait = Math.max(0, (reduceMotion() ? 300 : 1900) - (performance.now() - splashT0));
    setTimeout(() => {
      el.classList.add('done');
      document.documentElement.classList.add('splash-leaving');
      setTimeout(() => { el.remove(); document.documentElement.classList.remove('splash', 'splash-leaving'); }, 700);
    }, wait);
  }
  setTimeout(endSplash, 6000);

  // compteur de visites (seulement s'il est configuré dans about.js)
  const STATS = (window.HEMI_STATS || '').trim();
  document.documentElement.classList.toggle('has-stats', !!STATS);
  if (STATS && /^[a-z0-9-]+$/i.test(STATS) && /^https?:$/.test(location.protocol)) {
    const sc = document.createElement('script');
    sc.async = true; sc.src = 'https://gc.zgo.at/count.js';
    sc.dataset.goatcounter = `https://${STATS}.goatcounter.com/count`;
    sc.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
    sc.onload = () => countView();
    document.head.append(sc);
  }
  function countView() {
    if (!STATS || !window.goatcounter || !window.goatcounter.count) return;
    const path = (location.hash || '#/').replace(/^#/, '').split('?')[0] || '/';
    window.goatcounter.count({ path, title: document.title });
  }
  window.addEventListener('hashchange', () => setTimeout(countView, 300));

  paintChrome();
  paintAppChrome();
  window.addEventListener('hashchange', route);
  $('.skip')?.addEventListener('click', (e) => { e.preventDefault(); main.focus(); });
  route();
  loadVotes().then(() => paintFollowBadge()).catch(() => {});
})();
