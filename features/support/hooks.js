// =============================================================
// features/support/hooks.js : préparation et nettoyage autour des tests
//
// Les « hooks » sont des fonctions que Cucumber appelle automatiquement :
// - BeforeAll : une seule fois, avant le premier scénario ;
// - Before    : avant CHAQUE scénario ;
// - AfterAll  : une seule fois, à la fin.
// =============================================================
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { BeforeAll, Before, AfterAll } from '@cucumber/cucumber';
import { contexte } from './contexte.js';

// Mots de passe hachés avec un coût réduit pendant les tests uniquement
// (voir src/motdepasse.js) : sinon chaque connexion prendrait près d'une seconde.
process.env.NODE_ENV = 'test';
process.env.SCRYPT_COUT_TEST = '1024';

BeforeAll(async function () {
  const urlTest = process.env.TEST_DATABASE_URL;
  if (!urlTest) {
    throw new Error('TEST_DATABASE_URL manquant dans .env');
  }
  if (urlTest === process.env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL doit pointer vers une autre base que DATABASE_URL : '
      + 'les tests vident toutes les tables.',
    );
  }

  // L'application et les tests travaillent sur la base de test
  process.env.DATABASE_URL = urlTest;

  // Imports dynamiques : "npm run test:dry" fonctionne même
  // tant que src/app.js n'existe pas encore.
  const { pool } = await import('../../src/db.js');
  const { default: app } = await import('../../src/app.js');
  contexte.pool = pool;
  contexte.app = app;

  // Schéma recréé à neuf à chaque lancement des tests
  const schema = await readFile(new URL('../../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
});

// Chaque scénario part d'une base vide
// C'est ce qui rend les scénarios indépendants : l'ordre d'exécution n'a
// aucune importance, et un scénario qui échoue ne pollue pas le suivant.
// TRUNCATE est bien plus rapide que DELETE ; RESTART IDENTITY remet les
// compteurs d'identifiants à 1 ; CASCADE vide aussi les tables liées.
Before(async function () {
  await contexte.pool.query(
    `TRUNCATE prix, propositions, marches, produits, messages,
              sessions, tentatives_connexion, administrateurs
     RESTART IDENTITY CASCADE`,
  );
});

// Ferme les connexions : sans cela, Node attendrait indéfiniment
// et « npm test » ne rendrait jamais la main.
AfterAll(async function () {
  await contexte.pool?.end();
});
