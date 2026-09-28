// =============================================================
// scripts/admin.js
// Gestion des comptes administrateurs, en ligne de commande uniquement.
// Pourquoi pas une page web « créer un compte » ? Parce qu'elle devrait
// elle-même être protégée, et qu'une inscription ouverte serait une porte
// d'entrée. Seule une personne ayant accès à la base peut créer un compte.
// =============================================================
//
//   npm run admin:creer                       crée un compte (questions posées une à une)
//   npm run admin:lister                      liste les comptes
//   npm run admin:mot-de-passe -- <e-mail>    change le mot de passe et ferme ses sessions
//   npm run admin:desactiver -- <e-mail>      bloque le compte et ferme ses sessions
//   npm run admin:reactiver -- <e-mail>       débloque le compte
//
// Sur la base Render : node --env-file=.env.render scripts/admin.js creer
// (ou, plus simple, les variables ADMIN_* au premier démarrage : voir src/amorcage.js)
import 'dotenv/config';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hacher, problemeMotDePasse } from '../src/motdepasse.js';

const [action, argument] = process.argv.slice(2);
const ACTIONS = ['creer', 'lister', 'mot-de-passe', 'desactiver', 'reactiver'];

if (!ACTIONS.includes(action)) {
  console.error(`Usage : node scripts/admin.js ${ACTIONS.join(' | ')} [e-mail]`);
  process.exit(1);
}

// Toujours indiquer sur quelle base on travaille : se tromper de base
// (locale ou Render) est l'erreur la plus probable avec ce script.
const url = new URL(process.env.DATABASE_URL ?? 'postgres://absent');
console.log(`Base : ${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}\n`);

const { pool } = await import('../src/db.js');

// Saisie masquée : le mot de passe ne s'affiche pas pendant la frappe
// et ne reste pas dans l'historique du terminal.
let masque = false;
const sortie = new Writable({
  write(morceau, encodage, suite) {
    if (!masque) stdout.write(morceau, encodage);
    suite();
  },
});
// terminal: true seulement dans un vrai terminal ; si les réponses arrivent
// par un tube (echo ... | npm run admin:creer), rien n'est réaffiché.
const terminal = createInterface({ input: stdin, output: sortie, terminal: Boolean(stdin.isTTY) });
// L'itérateur garde en réserve les lignes déjà reçues : aucune n'est perdue,
// même si elles arrivent toutes d'un coup.
const lignes = terminal[Symbol.asyncIterator]();

async function lireLigne(question, { cache = false } = {}) {
  stdout.write(question);
  masque = cache;
  const { value, done } = await lignes.next();
  masque = false;
  if (cache) stdout.write('\n');
  if (done) throw new Error('Saisie interrompue.');
  return value;
}

async function demander(question) {
  return (await lireLigne(question)).trim();
}

async function demanderMotDePasse() {
  for (;;) {
    const premier = await lireLigne('Mot de passe (12 caractères minimum, invisible à la saisie) : ', { cache: true });

    const probleme = problemeMotDePasse(premier);
    if (probleme) {
      console.log(`✘ ${probleme}`);
      continue;
    }

    const second = await lireLigne('Confirmez le mot de passe : ', { cache: true });

    if (premier === second) return premier;
    console.log('✘ Les deux saisies sont différentes. Recommencez.');
  }
}

function exigerEmail() {
  if (!argument) {
    console.error(`Précisez l'e-mail : npm run admin:${action} -- prenom@exemple.cg`);
    process.exit(1);
  }
  return argument;
}

async function compte(email) {
  const { rows } = await pool.query(
    'SELECT id, nom, email, actif FROM administrateurs WHERE lower(email) = lower($1)',
    [email],
  );
  if (!rows[0]) throw new Error(`Aucun compte pour ${email}.`);
  return rows[0];
}

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

try {
  switch (action) {
    case 'creer': {
      const nom = await demander('Nom affiché (ex. Grâce Mabiala) : ');
      if (!nom || nom.length > 100) throw new Error('Le nom doit contenir entre 1 et 100 caractères.');

      const email = await demander('E-mail : ');
      if (!EMAIL_VALIDE.test(email) || email.length > 254) throw new Error('E-mail invalide.');

      const motDePasse = await demanderMotDePasse();
      await pool.query(
        'INSERT INTO administrateurs (nom, email, mot_de_passe_hash) VALUES ($1, $2, $3)',
        [nom, email, await hacher(motDePasse)],
      );
      console.log(`✔ Compte créé pour ${nom} <${email}>`);
      break;
    }

    case 'lister': {
      const { rows } = await pool.query(
        `SELECT a.nom, a.email, a.actif, a.created_at::date AS cree_le,
                (SELECT max(t.created_at) FROM tentatives_connexion t
                 WHERE lower(t.email) = lower(a.email) AND t.reussie) AS derniere_connexion
         FROM administrateurs a ORDER BY a.nom`,
      );
      if (rows.length === 0) console.log('Aucun compte. Créez-en un : npm run admin:creer');
      else console.table(rows);
      break;
    }

    case 'mot-de-passe': {
      const { id, nom } = await compte(exigerEmail());
      const motDePasse = await demanderMotDePasse();
      await pool.query(
        'UPDATE administrateurs SET mot_de_passe_hash = $2 WHERE id = $1',
        [id, await hacher(motDePasse)],
      );
      // Un ancien mot de passe peut avoir fuité : on ferme toutes les sessions ouvertes
      await pool.query('DELETE FROM sessions WHERE administrateur_id = $1', [id]);
      console.log(`✔ Mot de passe changé pour ${nom}. Ses sessions ouvertes sont fermées.`);
      break;
    }

    case 'desactiver': {
      const { id, nom } = await compte(exigerEmail());
      await pool.query('UPDATE administrateurs SET actif = false WHERE id = $1', [id]);
      await pool.query('DELETE FROM sessions WHERE administrateur_id = $1', [id]);
      console.log(`✔ Compte de ${nom} désactivé. Son historique est conservé.`);
      break;
    }

    case 'reactiver': {
      const { id, nom } = await compte(exigerEmail());
      await pool.query('UPDATE administrateurs SET actif = true WHERE id = $1', [id]);
      console.log(`✔ Compte de ${nom} réactivé.`);
      break;
    }
  }
} catch (erreur) {
  // 23505 = violation d'unicité : l'e-mail existe déjà
  console.error(erreur.code === '23505' ? '✘ Un compte existe déjà avec cet e-mail.' : `✘ ${erreur.message}`);
  process.exitCode = 1;
} finally {
  terminal.close();
  await pool.end();
}
