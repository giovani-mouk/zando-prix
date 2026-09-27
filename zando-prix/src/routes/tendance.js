// =============================================================
// GET /api/tendance : tendance des prix sur 7 jours (feature 17)
//
// Pour chaque couple produit/marché, on compare le prix EN VIGUEUR
// (dernier relevé à la date donnée) aujourd'hui et il y a N jours,
// dans l'unité de référence seulement (RM05). Aucune donnée n'est
// stockée : tout est recalculé à la demande depuis l'historique des prix.
// =============================================================
import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const JOURS = 7;
// Hypothèse à valider par le PM (@a-valider)
const SEUIL_STABILITE = 2; // en %

const moyenne = (valeurs) => valeurs.reduce((total, v) => total + v, 0) / valeurs.length;
const arrondi = (valeur) => Math.round(valeur * 10) / 10;

router.get('/', async (req, res) => {
  // Une ligne par couple produit/marché et par jour (0 = aujourd'hui, 7 = il y a 7 jours) :
  // le prix en vigueur ce jour-là, ou NULL s'il n'y avait encore aucun relevé.
  // generate_series(0, 7) produit les 8 jours de la courbe.
  const { rows } = await pool.query(
    `WITH couples AS (
       SELECT DISTINCT p.produit_id, p.marche_id, pr.categorie
       FROM prix p
       JOIN produits pr ON pr.id = p.produit_id
       WHERE p.unite = pr.unite_reference
     )
     SELECT c.produit_id, c.marche_id, c.categorie, j.jour,
            (SELECT p.montant
             FROM prix p
             JOIN produits pr ON pr.id = p.produit_id
             WHERE p.produit_id = c.produit_id
               AND p.marche_id = c.marche_id
               AND p.unite = pr.unite_reference
               AND p.date_releve <= CURRENT_DATE - j.jour
             ORDER BY p.date_releve DESC, p.id DESC
             LIMIT 1) AS montant
     FROM couples c
     CROSS JOIN generate_series(0, $1::int) AS j(jour)`,
    [JOURS],
  );

  // Regroupe par couple : { cle: { produit, categorie, montants: [j0, j1, …, j7] } }
  const couples = new Map();
  for (const ligne of rows) {
    const cle = `${ligne.produit_id}-${ligne.marche_id}`;
    if (!couples.has(cle)) {
      couples.set(cle, { produit: ligne.produit_id, categorie: ligne.categorie, montants: [] });
    }
    couples.get(cle).montants[ligne.jour] = ligne.montant;
  }

  // Seuls les couples qui avaient déjà un prix il y a 7 jours sont comparables
  const comparables = [...couples.values()].filter((c) => c.montants[JOURS] !== null && c.montants[0] !== null);
  if (comparables.length === 0) {
    return res.json({ disponible: false });
  }

  // Variation de chaque produit = moyenne de ses marchés
  const parProduit = new Map();
  for (const c of comparables) {
    const variation = ((c.montants[0] - c.montants[JOURS]) / c.montants[JOURS]) * 100;
    if (!parProduit.has(c.produit)) parProduit.set(c.produit, { categorie: c.categorie, variations: [] });
    parProduit.get(c.produit).variations.push(variation);
  }
  const produits = [...parProduit.values()].map((p) => ({ categorie: p.categorie, variation: moyenne(p.variations) }));

  // Variation de chaque catégorie = moyenne de ses produits
  const parCategorie = new Map();
  for (const p of produits) {
    const nom = p.categorie ?? 'Autres';
    if (!parCategorie.has(nom)) parCategorie.set(nom, []);
    parCategorie.get(nom).push(p.variation);
  }
  const categories = [...parCategorie.entries()]
    .map(([nom, variations]) => ({ nom, variation: arrondi(moyenne(variations)) }))
    .sort((a, b) => Math.abs(b.variation) - Math.abs(a.variation));

  const variation = arrondi(moyenne(produits.map((p) => p.variation)));
  const sens = Math.abs(variation) < SEUIL_STABILITE ? 'stabilite' : variation < 0 ? 'baisse' : 'hausse';

  // Courbe : indice base 100 il y a 7 jours, un point par jour jusqu'à aujourd'hui
  const serie = [];
  for (let jour = JOURS; jour >= 0; jour -= 1) {
    serie.push(arrondi(moyenne(comparables.map((c) => (c.montants[jour] / c.montants[JOURS]) * 100))));
  }

  res.json({ disponible: true, jours: JOURS, variation, sens, categorie: categories[0], categories, serie });
});

export default router;
