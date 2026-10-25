/*
 * Prépare les données du test « Qui me ressemble ? » (site/data/quiz.json).
 * Pour chaque vote final, le nombre de voix pour / contre / abstention de chaque groupe.
 * Le site s'en sert pour choisir les questions qui distinguent le mieux les groupes,
 * sans devoir télécharger le fichier de chaque vote.
 *   node scripts/build-quiz.js site/data
 */
const fs = require('fs');
const path = require('path');
const dir = process.argv[2] || 'site/data';
const votes = JSON.parse(fs.readFileSync(path.join(dir, 'votes.json'), 'utf8'));
const out = {};
for (const v of votes) {
  if (!v.mn) continue;
  const f = path.join(dir, 'v', `${v.id}.json`);
  if (!fs.existsSync(f)) continue;
  const { g } = JSON.parse(fs.readFileSync(f, 'utf8'));
  out[v.id] = Object.fromEntries(Object.entries(g).map(([k, n]) => [k, n.slice(0, 3)]));
}
fs.writeFileSync(path.join(dir, 'quiz.json'), JSON.stringify(out));
console.log(`quiz.json : ${Object.keys(out).length} votes`);
