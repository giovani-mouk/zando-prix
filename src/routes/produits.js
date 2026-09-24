// =============================================================
// GET /api/produits?q=texte : liste des produits, avec recherche
// Stories 1 et 4
// =============================================================
import { Router } from 'express';
import { pool } from '../db.js';
import { normaliser } from '../validation.js';

const router = Router();

router.get('/', async (req, res) => {
  // req.query contient les paramètres de l'URL (?q=...). Leur type n'est pas
  // garanti : ?q=a&q=b donne un tableau. On n'accepte qu'un texte, sinon
  // on fait comme s'il n'y avait pas de recherche.
  // normaliser() retire accents, majuscules et espaces : "Poisson Salé " -> "poisson sale".
  const recherche = normaliser(typeof req.query.q === 'string' ? req.query.q : '');

  const { rows } = await pool.query(
    'SELECT id, nom, categorie, unite_reference, image FROM produits ORDER BY nom',
  );

  // Filtrage en JavaScript : le catalogue du sprint est petit, et on obtient
  // une recherche insensible aux accents sans extension PostgreSQL.
  // Si le catalogue grossit : extension "unaccent" et filtre en SQL.
  // (Hypothèse @a-valider : la recherche ignore les accents, « mais » trouve « Maïs ».)
  const resultats = recherche
    ? rows.filter((produit) => normaliser(produit.nom).includes(recherche))
    : rows;

  res.json(resultats);
});

export default router;
