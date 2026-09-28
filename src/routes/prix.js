// =============================================================
// GET /api/prix?produit_id=1&marche_id=2&categorie=Légumes
// Stories 1, 2, 3, 5 et 6 : grille produits × marchés
//
// Tout le calcul métier (dernier relevé, fraîcheur, meilleur prix,
// prix non disponible) est fait par la vue SQL v_grille_prix (schema.sql).
// Cette route ne fait que valider les filtres et interroger la vue.
// =============================================================
import { createHash } from 'node:crypto';
import { Router } from 'express';
import { existe, pool } from '../db.js';
import { ErreurApi } from '../erreurs.js';
import { entierPositif, idOptionnel, texteOptionnel } from '../validation.js';

const router = Router();

router.get('/', async (req, res) => {
  // 1. Lecture et validation des filtres, tous facultatifs.
  //    Un filtre mal formé (?produit_id=abc) donne une erreur 400.
  const produitId = idOptionnel(req.query.produit_id, 'produit_id');
  const marcheId = idOptionnel(req.query.marche_id, 'marche_id');
  const categorie = texteOptionnel(req.query.categorie, 'categorie');

  // 2. Un filtre bien formé mais qui ne correspond à rien donne une erreur 404.
  //    Sans cette vérification, on renverrait une liste vide : le front ne
  //    pourrait pas distinguer « ce produit n'a pas de prix » de « ce produit
  //    n'existe pas » (lien périmé, faute de frappe dans l'URL).
  if (produitId !== undefined && !(await existe('produits', produitId))) {
    throw new ErreurApi(404, "Ce produit n'existe pas.", 'produit_id');
  }
  if (marcheId !== undefined && !(await existe('marches', marcheId))) {
    throw new ErreurApi(404, "Ce marché n'existe pas.", 'marche_id');
  }
  if (categorie !== undefined) {
    const { rowCount } = await pool.query('SELECT 1 FROM produits WHERE categorie = $1 LIMIT 1', [categorie]);
    if (rowCount === 0) throw new ErreurApi(404, "Cette catégorie n'existe pas.", 'categorie');
  }

  // 3. Construction de la clause WHERE selon les filtres présents.
  //    Les VALEURS ne sont jamais collées dans le texte SQL : on écrit $1, $2…
  //    et on les passe à part dans le tableau « valeurs ». C'est PostgreSQL qui
  //    les insère, sans qu'elles puissent être interprétées comme du SQL :
  //    c'est la protection contre l'injection SQL.
  //    Seuls les numéros ($1, $2…) sont calculés, d'après la taille du tableau.
  const conditions = [];
  const valeurs = [];
  if (produitId !== undefined) {
    valeurs.push(produitId);
    conditions.push(`produit_id = $${valeurs.length}`);
  }
  if (marcheId !== undefined) {
    valeurs.push(marcheId);
    conditions.push(`marche_id = $${valeurs.length}`);
  }
  if (categorie !== undefined) {
    valeurs.push(categorie);
    conditions.push(`categorie = $${valeurs.length}`);
  }
  // Exemple avec produit et marché : "WHERE produit_id = $1 AND marche_id = $2"
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Le meilleur prix est calculé dans la vue sur tous les marchés :
  // filtrer sur un marché ne le modifie pas.
  // (Hypothèse @a-valider : « meilleur prix » reste une information globale.)
  const { rows } = await pool.query(
    `SELECT produit_id, produit, categorie, marche_id, marche, disponible,
            prix_id, montant, unite, date_releve, source,
            fraicheur, comparable, est_meilleur_prix,
            -- Réponses des visiteurs au bouton « Confirmer » (feature 22)
            (SELECT COUNT(*)::int FROM confirmations_prix c WHERE c.prix_id = v.prix_id AND c.conforme)     AS confirmations,
            (SELECT COUNT(*)::int FROM confirmations_prix c WHERE c.prix_id = v.prix_id AND NOT c.conforme) AS signalements
     FROM v_grille_prix v
     ${where}
     ORDER BY produit, marche`,
    valeurs,
  );

  res.json(rows);
});

// ---------------------------------------------------------------
// POST /api/prix/:id/confirmations : « ce prix est-il toujours le bon ? »
// (feature 22, public). Un SIGNAL pour l'équipe : rien n'est modifié.
// ---------------------------------------------------------------
router.post('/:id/confirmations', async (req, res) => {
  const id = entierPositif(req.params.id);
  if (id === null) throw new ErreurApi(404, 'Prix introuvable.');
  const conforme = req.body?.conforme;
  if (typeof conforme !== 'boolean') {
    throw new ErreurApi(400, 'Indiquez si le prix est toujours le même.', 'conforme');
  }

  // Seul le prix affiché (le dernier relevé du couple produit/marché) se confirme
  const { rows } = await pool.query(
    `SELECT p.id, (v.prix_id IS NOT NULL) AS actuel
     FROM prix p
     LEFT JOIN v_prix_actuels v ON v.prix_id = p.id
     WHERE p.id = $1`,
    [id],
  );
  if (!rows[0]) throw new ErreurApi(404, 'Prix introuvable.');
  if (!rows[0].actuel) throw new ErreurApi(409, 'Ce prix a déjà été remplacé par un relevé plus récent.');

  // Une réponse par connexion et par prix ; l'adresse n'est pas conservée
  const empreinte = createHash('sha256').update(`prix:${req.ip}:${id}`).digest('hex');
  try {
    await pool.query(
      'INSERT INTO confirmations_prix (prix_id, conforme, empreinte) VALUES ($1, $2, $3)',
      [id, conforme, empreinte],
    );
  } catch (erreur) {
    if (erreur.code === '23505') throw new ErreurApi(409, 'Vous avez déjà répondu pour ce prix.');
    throw erreur;
  }

  const { rows: totaux } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE conforme)::int AS confirmations,
            COUNT(*) FILTER (WHERE NOT conforme)::int AS signalements
     FROM confirmations_prix WHERE prix_id = $1`,
    [id],
  );
  res.status(201).json({
    ...totaux[0],
    message: conforme
      ? 'Merci ! Votre confirmation renforce la fiabilité de ce prix.'
      : "Merci ! L'équipe est prévenue que ce prix a changé. Vous pouvez proposer le nouveau prix.",
  });
});

export default router;
