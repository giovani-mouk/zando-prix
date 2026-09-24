// =============================================================
// src/db.js : la connexion à PostgreSQL, partagée par toute l'application
//
// Tous les fichiers qui parlent à la base importent « pool » d'ici :
// il n'existe qu'un seul pool de connexions pour tout le serveur.
// =============================================================

// Doit rester la première ligne : lit le fichier .env et remplit
// process.env AVANT que l'on n'y cherche DATABASE_URL plus bas.
import 'dotenv/config';
import pg from 'pg';

const { Pool, types } = pg;

// Les colonnes DATE (OID 1082) sont renvoyées telles quelles ("2026-09-23")
// et non en objet Date, pour éviter les décalages de fuseau horaire
// lors de la sérialisation JSON.
types.setTypeParser(1082, (valeur) => valeur);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant : copiez .env.example en .env et complétez-le.');
}

// Un « pool » garde quelques connexions ouvertes et les prête aux requêtes
// à tour de rôle : ouvrir une connexion PostgreSQL coûte cher (réseau,
// authentification), on évite de le refaire à chaque requête HTTP.
// pool.query() emprunte une connexion, exécute la requête et la rend.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Au plus 10 connexions simultanées : la base gratuite de Render en
  // accepte peu, et un petit site n'en a pas besoin de plus.
  max: 10,
  // Une connexion inutilisée depuis 30 s est refermée
  idleTimeoutMillis: 30_000,
});

// Sans ce gestionnaire, une connexion inactive coupée par le serveur
// ferait planter tout le processus Node.
pool.on('error', (erreur) => {
  console.error('Connexion PostgreSQL perdue :', erreur.message);
});

// Tables autorisées dans existe() : le nom n'est jamais fourni par l'utilisateur
// Les paramètres $1 ne protègent que les VALEURS : un nom de table doit être
// écrit dans le texte de la requête. Cette liste blanche garantit que seuls
// ces trois noms peuvent l'être (protection contre l'injection SQL).
const TABLES = new Set(['produits', 'marches', 'propositions']);

// Vrai si la ligne existe. « executeur » permet de passer un client en cours
// de transaction (BEGIN … COMMIT) au lieu du pool, pour lire dans la même transaction.
export async function existe(table, id, executeur = pool) {
  if (!TABLES.has(table)) throw new Error(`Table non autorisée : ${table}`);
  const { rowCount } = await executeur.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}
