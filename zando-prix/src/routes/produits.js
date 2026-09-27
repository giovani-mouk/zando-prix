// =============================================================
// GET /api/produits?q=texte : liste des produits, avec recherche
// Stories 1 et 4
// =============================================================
import { Router } from 'express';
import { existe, pool } from '../db.js';
import { ErreurApi } from '../erreurs.js';
import { entierPositif, normaliser } from '../validation.js';

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

// ---------------------------------------------------------------
// GET /api/produits/:id/historique : derniers relevés et stabilité (feature 19)
// ---------------------------------------------------------------

const NOMBRE_RELEVES = 10;
const JOURS_STABILITE = 30;
// Hypothèses à valider par le PM (@a-valider), en % de variation moyenne
const NIVEAUX = [[2.5, 'tres_stable'], [7, 'stable'], [15, 'variable'], [Infinity, 'instable']];

router.get('/:id/historique', async (req, res) => {
  const id = entierPositif(req.params.id);
  if (id === null || !(await existe('produits', id))) {
    throw new ErreurApi(404, "Ce produit n'existe pas.", 'produit_id');
  }

  // Les derniers prix publiés. Jamais de nom : ni la personne qui a proposé
  // le prix, ni l'administrateur qui l'a publié (seulement la source).
  const { rows: releves } = await pool.query(
    `SELECT p.date_releve, p.montant, p.unite, p.source,
            m.id AS marche_id, m.nom AS marche,
            (p.unite = pr.unite_reference) AS comparable
     FROM prix p
     JOIN marches  m  ON m.id  = p.marche_id
     JOIN produits pr ON pr.id = p.produit_id
     WHERE p.produit_id = $1
     ORDER BY p.date_releve DESC, p.id DESC
     LIMIT $2`,
    [id, NOMBRE_RELEVES],
  );

  // Pour chaque marché : prix en vigueur aujourd'hui et il y a 30 jours,
  // dans l'unité de référence (dernier relevé à chacune des deux dates)
  const { rows: marches } = await pool.query(
    `WITH en_vigueur AS (
       SELECT DISTINCT p.marche_id,
         (SELECT x.montant FROM prix x
          WHERE x.produit_id = p.produit_id AND x.marche_id = p.marche_id
            AND x.unite = pr.unite_reference AND x.date_releve <= CURRENT_DATE
          ORDER BY x.date_releve DESC, x.id DESC LIMIT 1) AS aujourd_hui,
         (SELECT x.montant FROM prix x
          WHERE x.produit_id = p.produit_id AND x.marche_id = p.marche_id
            AND x.unite = pr.unite_reference AND x.date_releve <= CURRENT_DATE - $2::int
          ORDER BY x.date_releve DESC, x.id DESC LIMIT 1) AS avant
       FROM prix p
       JOIN produits pr ON pr.id = p.produit_id
       WHERE p.produit_id = $1
     )
     SELECT aujourd_hui, avant FROM en_vigueur
     WHERE aujourd_hui IS NOT NULL AND avant IS NOT NULL`,
    [id, JOURS_STABILITE],
  );

  let stabilite = { disponible: false, jours: JOURS_STABILITE };
  if (marches.length > 0) {
    const ecarts = marches.map((m) => (Math.abs(m.aujourd_hui - m.avant) / m.avant) * 100);
    const fluctuation = Math.round((ecarts.reduce((a, b) => a + b, 0) / ecarts.length) * 10) / 10;
    stabilite = {
      disponible: true,
      jours: JOURS_STABILITE,
      fluctuation,
      niveau: NIVEAUX.find(([seuil]) => fluctuation < seuil)[1],
      marches: marches.length,
    };
  }

  res.json({ releves, stabilite });
});

export default router;
