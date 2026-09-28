// =============================================================
// src/migrations.js : applique les migrations de db/migrations/
//
// schema.sql décrit la base COMPLÈTE, pour une installation neuve.
// Une base déjà en service (Render) ne peut pas être recréée : ses
// données seraient perdues. Les fichiers de db/migrations/ décrivent
// donc chaque évolution, dans l'ordre de leur numéro (001_, 002_…).
//
// Au démarrage, chaque migration absente de la table schema_migrations
// est exécutée dans une transaction, puis notée. Une migration réussie
// n'est jamais rejouée ; une migration qui échoue est annulée en entier
// et empêche le démarrage (mieux vaut un site arrêté qu'une base à moitié modifiée).
// =============================================================
import { readdir, readFile } from 'node:fs/promises';
import { pool } from './db.js';

const DOSSIER = new URL('../db/migrations/', import.meta.url);

export async function appliquerMigrations() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nom          VARCHAR(200) PRIMARY KEY,
    appliquee_le TIMESTAMPTZ  NOT NULL DEFAULT now()
  )`);

  const fichiers = (await readdir(DOSSIER)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const { rows } = await pool.query('SELECT nom FROM schema_migrations');
  const deja = new Set(rows.map((r) => r.nom));

  for (const fichier of fichiers.filter((f) => !deja.has(f))) {
    const sql = await readFile(new URL(fichier, DOSSIER), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [fichier]);
      await client.query('COMMIT');
      console.log(`Migration appliquée : ${fichier}`);
    } catch (erreur) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${fichier} impossible : ${erreur.message}`);
    } finally {
      client.release();
    }
  }
}
