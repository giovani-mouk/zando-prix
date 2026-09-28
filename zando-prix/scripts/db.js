// =============================================================
// scripts/db.js : exécuter les fichiers SQL du dossier db/
//
// Usage : node scripts/db.js schema | seed | reset [--confirmer]
// Remplace psql pour que les commandes marchent aussi sous Windows.
// Normalement lancé via npm : npm run db:reset, db:schema, db:seed.
//
// process.argv contient les mots de la ligne de commande :
//   [chemin de node, chemin du script, "reset", "--confirmer"]
// d'où process.argv[2] pour l'action.
// =============================================================
import 'dotenv/config';
import { readFile } from 'node:fs/promises';

const action = process.argv[2];
const confirme = process.argv.includes('--confirmer');

const fichiers = {
  schema: ['schema.sql'],
  seed: ['seed.sql'],
  reset: ['schema.sql', 'seed.sql'],
}[action];

if (!fichiers) {
  console.error('Usage : node scripts/db.js schema | seed | reset [--confirmer]');
  process.exit(1);
}

// schema.sql commence par des DROP TABLE et seed.sql vide les tables :
// sur une base qui n'est pas sur cette machine, on exige une confirmation.
function estLocale(url) {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

if (!estLocale(process.env.DATABASE_URL ?? '') && !confirme) {
  console.error(`✘ Cette base n'est pas locale, et "${action}" efface ses données.`);
  console.error(`  Si c'est bien voulu : npm run db:${action} -- --confirmer`);
  process.exit(1);
}

// Import après le choix de l'URL : src/db.js lit DATABASE_URL au chargement
const { pool } = await import('../src/db.js');

try {
  for (const fichier of fichiers) {
    const sql = await readFile(new URL(`../db/${fichier}`, import.meta.url), 'utf8');
    await pool.query(sql);
    console.log(`✔ db/${fichier} exécuté`);
  }
} catch (erreur) {
  console.error(`✘ ${erreur.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
