// Crée une version « tout-en-un » de l'application (un seul fichier HTML),
// pré-remplie d'acquéreurs fictifs, pour la démonstration en ligne.
// Usage : node outils/construire-demo.mjs chemin/de/sortie.html
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sortie = process.argv[2] || join(racine, 'demo.html');
const html = readFileSync(join(racine, 'index.html'), 'utf8');

const titre = html.match(/<title>[\s\S]*?<\/title>/)[0];
const corps = html.match(/<!-- APP -->([\s\S]*?)<!-- \/APP -->/)[1];
const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
  .map((m) => readFileSync(join(racine, m[1]), 'utf8')).join('\n');
const js = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((m) => readFileSync(join(racine, m[1]), 'utf8')).join('\n;\n');

writeFileSync(sortie, `${titre}
<style>
${css}
</style>
${corps}
<script>window.DEMO_AUTO = true;</script>
<script>
${js}
</script>
`);
console.log('Démo créée :', sortie);
