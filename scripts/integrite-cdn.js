// =============================================================
// scripts/integrite-cdn.js : empreintes SRI des fichiers chargés depuis cdnjs
//
// Usage : npm run cdn:integrite   (nécessite une connexion Internet)
//
// Le site charge Font Awesome et Chart.js depuis cdnjs. L'attribut
// « integrity » (Subresource Integrity) contient l'empreinte SHA-384 du
// fichier attendu : si le fichier servi par le CDN a été modifié, même d'un
// octet, le navigateur le refuse au lieu de l'exécuter.
//
// Ce script télécharge chaque fichier cdnjs référencé dans public/, calcule
// son empreinte et l'écrit à sa place. À relancer après chaque changement
// de version d'une bibliothèque, puis vérifier le résultat avec git diff.
// =============================================================
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const FICHIERS_HTML = (await readdir('public'))
  .filter((nom) => nom.endsWith('.html'))
  .map((nom) => `public/${nom}`);
const FICHIERS_JS = ['public/js/graphique.js'];

const empreintes = new Map();

async function empreinte(url) {
  if (!empreintes.has(url)) {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`${url} : HTTP ${reponse.status}`);
    const contenu = Buffer.from(await reponse.arrayBuffer());
    empreintes.set(url, `sha384-${createHash('sha384').update(contenu).digest('base64')}`);
    console.log(`✔ ${url}\n  ${empreintes.get(url)}`);
  }
  return empreintes.get(url);
}

// Remplacement asynchrone : String.replace n'accepte pas de fonction async
async function remplacer(texte, motif, fabrique) {
  const morceaux = [];
  let dernier = 0;
  for (const correspondance of texte.matchAll(motif)) {
    morceaux.push(texte.slice(dernier, correspondance.index), await fabrique(correspondance));
    dernier = correspondance.index + correspondance[0].length;
  }
  morceaux.push(texte.slice(dernier));
  return morceaux.join('');
}

try {
  // HTML : <link ... href="https://cdnjs..." ... integrity="...">
  for (const fichier of FICHIERS_HTML) {
    const avant = await readFile(fichier, 'utf8');
    const apres = await remplacer(avant, /<link\b[^>]*>/g, async ([balise]) => {
      const url = balise.match(/href="(https:\/\/cdnjs\.cloudflare\.com\/[^"]+)"/)?.[1];
      if (!url || !balise.includes('integrity=')) return balise;
      return balise.replace(/integrity="[^"]*"/, `integrity="${await empreinte(url)}"`);
    });
    if (apres !== avant) await writeFile(fichier, apres);
  }

  // JavaScript : url: 'https://cdnjs...', puis integrite: '...'
  for (const fichier of FICHIERS_JS) {
    const avant = await readFile(fichier, 'utf8');
    const apres = await remplacer(
      avant,
      /(url: '(https:\/\/cdnjs\.cloudflare\.com\/[^']+)',\s*integrite: ')[^']*(')/g,
      async ([, debut, url, fin]) => `${debut}${await empreinte(url)}${fin}`,
    );
    if (apres !== avant) await writeFile(fichier, apres);
  }

  console.log(`\n${empreintes.size} fichier(s) vérifié(s). Contrôlez avec : git diff public/`);
} catch (erreur) {
  console.error(`✘ ${erreur.message}`);
  process.exitCode = 1;
}
