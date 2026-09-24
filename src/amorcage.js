// =============================================================
// src/amorcage.js : préparer une base neuve au premier démarrage
//
// Sur l'offre gratuite de Render, il n'y a pas de terminal sur le serveur
// pour lancer « npm run db:reset » ou « npm run admin:creer ». Ce module
// s'exécute au démarrage (voir server.js) et fait le nécessaire, UNE SEULE
// FOIS, sur une base encore vide :
//
// 1. si la table « produits » n'existe pas : crée les tables (schema.sql),
//    puis charge les données de démonstration (seed.sql), sauf si
//    DONNEES_DEMO=non ;
// 2. si aucun compte administrateur n'existe et que les variables
//    ADMIN_NOM, ADMIN_EMAIL et ADMIN_MOT_DE_PASSE sont définies : crée ce compte.
//
// Sur une base déjà prête (votre base locale, ou Render après le premier
// démarrage), il ne fait rien : il ne peut jamais effacer de données.
// =============================================================
import { readFile } from 'node:fs/promises';
import { pool } from './db.js';
import { hacher, problemeMotDePasse } from './motdepasse.js';

const lireSql = (fichier) => readFile(new URL(`../db/${fichier}`, import.meta.url), 'utf8');

async function creerTablesSiBesoin() {
  // to_regclass renvoie NULL si la table n'existe pas (sans lever d'erreur)
  const { rows } = await pool.query("SELECT to_regclass('public.produits') IS NOT NULL AS prete");
  if (rows[0].prete) return;

  console.log('Base vide : création des tables…');
  await pool.query(await lireSql('schema.sql'));
  if (process.env.DONNEES_DEMO !== 'non') {
    console.log('Chargement des données de démonstration…');
    await pool.query(await lireSql('seed.sql'));
  }
}

async function creerAdministrateurSiBesoin() {
  const { ADMIN_NOM, ADMIN_EMAIL, ADMIN_MOT_DE_PASSE } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_MOT_DE_PASSE) return;

  const { rowCount } = await pool.query('SELECT 1 FROM administrateurs LIMIT 1');
  if (rowCount > 0) return; // un compte existe déjà : on ne touche à rien

  const probleme = problemeMotDePasse(ADMIN_MOT_DE_PASSE);
  if (probleme) {
    console.error(`Compte administrateur NON créé : ${probleme}`);
    return;
  }
  await pool.query(
    'INSERT INTO administrateurs (nom, email, mot_de_passe_hash) VALUES ($1, $2, $3)',
    [ADMIN_NOM || 'Administrateur', ADMIN_EMAIL.trim(), await hacher(ADMIN_MOT_DE_PASSE)],
  );
  // Le mot de passe n'est jamais écrit dans le journal
  console.log(`Compte administrateur créé pour ${ADMIN_EMAIL.trim()}.`);
}

export async function amorcer() {
  await creerTablesSiBesoin();
  await creerAdministrateurSiBesoin();
}
