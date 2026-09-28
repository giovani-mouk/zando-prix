// =============================================================
// Routes /api/prix-officiels : prix du Ministère du Commerce (feature 23)
//
// GET  /api/prix-officiels        public : prix officiels EN VIGUEUR
// GET  /api/prix-officiels/tous   équipe : tout l'historique, retirés compris
// POST /api/prix-officiels        équipe : saisir un prix officiel
// DELETE /api/prix-officiels/:id  équipe : retirer un prix (jamais effacé)
//
// Le prix en vigueur d'un produit, pour un type donné, est celui dont la
// date d'effet est la plus récente parmi ceux déjà entrés en vigueur.
// =============================================================
import { Router } from 'express';
import { existe, pool } from '../db.js';
import { ErreurApi } from '../erreurs.js';
import { exigerAdmin } from '../session.js';
import { UNITES, dateValide, entierPositif } from '../validation.js';

const router = Router();

const TYPES = ['plafond', 'indicatif'];
const REFERENCE_MAX = 200;

const COLONNES = `po.id, po.type, po.montant, po.unite, po.date_effet, po.reference, po.created_at, po.retire_le,
  pr.id AS produit_id, pr.nom AS produit, pr.categorie, pr.image, pr.unite_reference`;

const enObjet = (r) => ({
  id: r.id,
  type: r.type,
  montant: r.montant,
  unite: r.unite,
  date_effet: r.date_effet,
  reference: r.reference,
  produit: { id: r.produit_id, nom: r.produit, categorie: r.categorie, image: r.image, unite_reference: r.unite_reference },
  ...(r.saisi_par !== undefined && { saisi_par: r.saisi_par, created_at: r.created_at, retire_le: r.retire_le }),
});

router.get('/', async (req, res) => {
  // DISTINCT ON : une seule ligne par produit et par type, la première
  // dans l'ordre demandé (donc la date d'effet la plus récente)
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (po.produit_id, po.type) ${COLONNES}
     FROM prix_officiels po
     JOIN produits pr ON pr.id = po.produit_id
     WHERE po.retire_le IS NULL AND po.date_effet <= CURRENT_DATE
     ORDER BY po.produit_id, po.type, po.date_effet DESC, po.id DESC`,
  );
  res.json(rows.map(enObjet).sort((a, b) => a.produit.nom.localeCompare(b.produit.nom, 'fr') || a.type.localeCompare(b.type)));
});

router.get('/tous', exigerAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLONNES}, a.nom AS saisi_par
     FROM prix_officiels po
     JOIN produits pr ON pr.id = po.produit_id
     LEFT JOIN administrateurs a ON a.id = po.cree_par
     ORDER BY po.date_effet DESC, po.id DESC`,
  );
  res.json(rows.map(enObjet));
});

router.post('/', exigerAdmin, async (req, res) => {
  const corps = req.body ?? {};

  const produitId = entierPositif(corps.produit_id);
  if (produitId === null || !(await existe('produits', produitId))) {
    throw new ErreurApi(400, 'Choisissez un produit de la liste.', 'produit_id');
  }
  if (!TYPES.includes(corps.type)) {
    throw new ErreurApi(400, 'Le type doit être « plafond » ou « indicatif ».', 'type');
  }
  const montant = entierPositif(corps.montant);
  if (montant === null) {
    throw new ErreurApi(400, 'Le prix doit être un nombre entier de FCFA supérieur à 0.', 'montant');
  }
  if (!UNITES.includes(corps.unite)) {
    throw new ErreurApi(400, `L'unité doit être l'une des suivantes : ${UNITES.join(', ')}.`, 'unite');
  }
  if (!dateValide(corps.date_effet)) {
    throw new ErreurApi(400, "Indiquez la date d'entrée en vigueur (AAAA-MM-JJ).", 'date_effet');
  }
  const reference = typeof corps.reference === 'string' ? corps.reference.trim() : '';
  if (reference.length < 3 || reference.length > REFERENCE_MAX) {
    throw new ErreurApi(400, `Indiquez le texte officiel (arrêté, mercuriale…), ${REFERENCE_MAX} caractères au plus.`, 'reference');
  }

  const { rows } = await pool.query(
    `INSERT INTO prix_officiels (produit_id, type, montant, unite, date_effet, reference, cree_par)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [produitId, corps.type, montant, corps.unite, corps.date_effet, reference, req.administrateur.id],
  );
  const { rows: [ligne] } = await pool.query(
    `SELECT ${COLONNES}, a.nom AS saisi_par FROM prix_officiels po
     JOIN produits pr ON pr.id = po.produit_id LEFT JOIN administrateurs a ON a.id = po.cree_par
     WHERE po.id = $1`,
    [rows[0].id],
  );
  res.status(201).json({ prix_officiel: enObjet(ligne) });
});

router.delete('/:id', exigerAdmin, async (req, res) => {
  const id = entierPositif(req.params.id);
  const { rowCount } = id === null ? { rowCount: 0 } : await pool.query(
    'UPDATE prix_officiels SET retire_le = now() WHERE id = $1 AND retire_le IS NULL',
    [id],
  );
  if (rowCount === 0) throw new ErreurApi(404, 'Prix officiel introuvable ou déjà retiré.');
  res.status(204).end();
});

export default router;
