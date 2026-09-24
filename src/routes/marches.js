// =============================================================
// GET /api/marches : liste des marchés (listes déroulantes du front)
//
// Le plus simple des routeurs : il sert de modèle pour lire les autres.
// Un « Router » Express est un mini-application qui regroupe les routes
// d'une même ressource. app.js le monte sous un préfixe :
//   app.use('/api/marches', marches)
// donc router.get('/') ci-dessous répond à GET /api/marches.
// =============================================================
import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// async : la fonction attend la réponse de PostgreSQL (await) sans bloquer
// le serveur, qui continue de traiter les autres requêtes pendant ce temps.
// En cas d'erreur SQL, Express 5 attrape automatiquement l'exception et
// l'envoie au middleware gestionErreurs (voir erreurs.js) : pas besoin de try/catch.
router.get('/', async (req, res) => {
  // On choisit les colonnes explicitement plutôt que SELECT * :
  // une colonne ajoutée plus tard à la table ne sera pas exposée par accident.
  const { rows } = await pool.query('SELECT id, nom, ville FROM marches ORDER BY nom');
  // res.json() convertit le tableau en JSON et ajoute l'en-tête
  // Content-Type: application/json. Statut 200 par défaut.
  res.json(rows);
});

export default router;
