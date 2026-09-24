// =============================================================
// Routes /api/propositions
// Stories 7 et 8 (RM06), espace administrateur (features 12 et 13)
//
// POST /api/propositions reste public : tout le monde peut proposer un prix.
// Tout le reste (lire, publier, supprimer, corriger) exige d'être connecté.
//
// RM06 : une proposition ne devient un prix affiché qu'après publication
// par un administrateur. Tant qu'elle est en attente, elle ne touche pas
// à la table « prix ».
// =============================================================
import { Router } from 'express';
import { existe, pool } from '../db.js';
import { ErreurApi } from '../erreurs.js';
import { exigerAdmin } from '../session.js';
import { STATUTS, UNITES, dateValide, entierPositif } from '../validation.js';

const router = Router();

const DECISIONS = ['validee', 'rejetee'];
const AUTEUR_MAX = 100;

// Requête de lecture commune à toutes les routes : les jointures ajoutent
// les noms du produit, du marché et des administrateurs.
// LEFT JOIN (et non JOIN) pour les administrateurs : une proposition en
// attente n'a été traitée par personne, elle doit quand même apparaître.
const SELECT_PROPOSITION = `
  SELECT p.id, p.produit_id, pr.nom AS produit, p.marche_id, m.nom AS marche,
         p.montant, p.unite, p.date_constat, p.auteur, p.statut,
         p.created_at, p.traitee_le, ta.nom AS traitee_par,
         p.corrigee_le, ca.nom AS corrigee_par
  FROM propositions p
  JOIN produits pr ON pr.id = p.produit_id
  JOIN marches  m  ON m.id  = p.marche_id
  LEFT JOIN administrateurs ta ON ta.id = p.traitee_par
  LEFT JOIN administrateurs ca ON ca.id = p.corrigee_par`;

async function lireProposition(executeur, id) {
  const { rows } = await executeur.query(`${SELECT_PROPOSITION} WHERE p.id = $1`, [id]);
  return rows[0];
}

// Vérifie les champs dans l'ordre du contrat et s'arrête à la première erreur.
// Utilisée à la fois pour une nouvelle proposition et pour une correction.
async function validerChamps(corps) {
  const produitId = entierPositif(corps.produit_id);
  if (produitId === null || !(await existe('produits', produitId))) {
    throw new ErreurApi(400, 'Choisissez un produit de la liste.', 'produit_id');
  }

  const marcheId = entierPositif(corps.marche_id);
  if (marcheId === null || !(await existe('marches', marcheId))) {
    throw new ErreurApi(400, 'Choisissez un marché de la liste.', 'marche_id');
  }

  const montant = entierPositif(corps.montant);
  if (montant === null) {
    throw new ErreurApi(400, 'Le prix doit être un nombre entier de FCFA supérieur à 0.', 'montant');
  }

  if (!UNITES.includes(corps.unite)) {
    throw new ErreurApi(400, `L'unité doit être l'une des suivantes : ${UNITES.join(', ')}.`, 'unite');
  }

  const dateConstat = corps.date_constat;
  let dateAcceptee = dateValide(dateConstat);
  if (dateAcceptee) {
    // Comparaison faite par PostgreSQL, avec la même notion d'aujourd'hui que la base
    const { rows } = await pool.query('SELECT $1::date <= CURRENT_DATE AS ok', [dateConstat]);
    dateAcceptee = rows[0].ok;
  }
  if (!dateAcceptee) {
    throw new ErreurApi(400, "La date doit être aujourd'hui ou dans le passé.", 'date_constat');
  }

  return { produitId, marcheId, montant, unite: corps.unite, dateConstat };
}

async function validerProposition(corps) {
  const champs = await validerChamps(corps);

  let auteur = null;
  if (corps.auteur !== undefined && corps.auteur !== null) {
    if (typeof corps.auteur !== 'string' || corps.auteur.trim().length > AUTEUR_MAX) {
      throw new ErreurApi(400, `Le nom ne doit pas dépasser ${AUTEUR_MAX} caractères.`, 'auteur');
    }
    auteur = corps.auteur.trim() || null;
  }

  return { ...champs, auteur };
}

// ---------------------------------------------------------------
// Story 7 : proposer un prix
// ---------------------------------------------------------------
router.post('/', async (req, res) => {
  // Express 5 : req.body vaut undefined quand la requête n'a pas de corps
  const donnees = await validerProposition(req.body ?? {});

  const { rows } = await pool.query(
    `INSERT INTO propositions (produit_id, marche_id, montant, unite, date_constat, auteur)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [donnees.produitId, donnees.marcheId, donnees.montant,
      donnees.unite, donnees.dateConstat, donnees.auteur],
  );

  res.status(201).json({
    proposition: await lireProposition(pool, rows[0].id),
    message: "Merci ! Votre proposition sera vérifiée avant d'être publiée.",
  });
});

// ---------------------------------------------------------------
// Story 8 : suivre les propositions
// ---------------------------------------------------------------
router.get('/', exigerAdmin, async (req, res) => {
  const { statut } = req.query;
  if (statut !== undefined && !STATUTS.includes(statut)) {
    throw new ErreurApi(400, `Le statut doit être l'un des suivants : ${STATUTS.join(', ')}.`, 'statut');
  }

  const ordre = 'ORDER BY p.created_at DESC, p.id DESC';
  const { rows } = statut === undefined
    ? await pool.query(`${SELECT_PROPOSITION} ${ordre}`)
    : await pool.query(`${SELECT_PROPOSITION} WHERE p.statut = $1 ${ordre}`, [statut]);

  res.json(rows);
});

// Publier (validee) ou supprimer (rejetee) une proposition
router.patch('/:id', exigerAdmin, async (req, res) => {
  const statut = req.body?.statut;
  if (!DECISIONS.includes(statut)) {
    throw new ErreurApi(400, 'Le statut doit être "validee" ou "rejetee".', 'statut');
  }

  const id = entierPositif(req.params.id);
  if (id === null) {
    throw new ErreurApi(404, 'Proposition introuvable.');
  }

  // Publier une proposition, ce sont DEUX écritures : changer son statut
  // ET créer le prix. Elles doivent réussir ou échouer ensemble. On emprunte
  // donc une connexion dédiée (client) pour ouvrir une transaction :
  // BEGIN … COMMIT, ou ROLLBACK en cas d'erreur, qui annule tout.
  // (Avec pool.query, chaque requête pourrait partir sur une connexion
  //  différente, et la transaction n'aurait aucun sens.)
  const client = await pool.connect();
  let proposition;
  let prix;
  try {
    await client.query('BEGIN');

    // FOR UPDATE : deux décisions simultanées sur la même proposition
    // sont traitées l'une après l'autre, la seconde reçoit un 409.
    const { rows } = await client.query(
      'SELECT * FROM propositions WHERE id = $1 FOR UPDATE',
      [id],
    );
    const actuelle = rows[0];
    if (!actuelle) {
      throw new ErreurApi(404, 'Proposition introuvable.');
    }
    if (actuelle.statut !== 'en_attente') {
      throw new ErreurApi(409, 'Cette proposition a déjà été traitée.');
    }

    await client.query(
      'UPDATE propositions SET statut = $2, traitee_le = now(), traitee_par = $3 WHERE id = $1',
      [id, statut, req.administrateur.id],
    );

    // RM06 : seule une proposition validée devient un prix, rattaché à elle
    if (statut === 'validee') {
      const resultat = await client.query(
        `INSERT INTO prix
           (produit_id, marche_id, montant, unite, date_releve, source, proposition_id)
         VALUES ($1, $2, $3, $4, $5, 'proposition', $6)
         RETURNING *`,
        [actuelle.produit_id, actuelle.marche_id, actuelle.montant,
          actuelle.unite, actuelle.date_constat, id],
      );
      prix = resultat.rows[0];
    }

    proposition = await lireProposition(client, id);
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK').catch(() => {});
    throw erreur;
  } finally {
    // Toujours rendre la connexion au pool, même après une erreur :
    // sinon, au bout de quelques erreurs, le pool serait vide et le
    // serveur ne répondrait plus à aucune requête.
    client.release();
  }

  res.json(prix ? { proposition, prix } : { proposition });
});

// ---------------------------------------------------------------
// Corriger une proposition avant publication (feature 13)
// Le corps contient tous les champs modifiables, comme le formulaire
// de correction : produit_id, marche_id, montant, unite, date_constat.
// ---------------------------------------------------------------
router.put('/:id', exigerAdmin, async (req, res) => {
  const corps = req.body ?? {};

  // L'auteur appartient à la personne qui a proposé : on ne le réécrit pas
  if (corps.auteur !== undefined) {
    throw new ErreurApi(400, "L'auteur d'une proposition ne peut pas être modifié.", 'auteur');
  }
  if (corps.statut !== undefined) {
    throw new ErreurApi(400, 'Pour changer le statut, publiez ou supprimez la proposition.', 'statut');
  }

  const id = entierPositif(req.params.id);
  if (id === null) {
    throw new ErreurApi(404, 'Proposition introuvable.');
  }

  const donnees = await validerChamps(corps);

  // Le statut est vérifié dans la même requête que la modification :
  // si quelqu'un publie la proposition au même moment, rien n'est écrit.
  const { rowCount } = await pool.query(
    `UPDATE propositions
     SET produit_id = $2, marche_id = $3, montant = $4, unite = $5, date_constat = $6,
         corrigee_le = now(), corrigee_par = $7
     WHERE id = $1 AND statut = 'en_attente'`,
    [id, donnees.produitId, donnees.marcheId, donnees.montant,
      donnees.unite, donnees.dateConstat, req.administrateur.id],
  );

  if (rowCount === 0) {
    const existante = await lireProposition(pool, id);
    if (!existante) throw new ErreurApi(404, 'Proposition introuvable.');
    throw new ErreurApi(409, 'Cette proposition a déjà été traitée : elle ne peut plus être corrigée.');
  }

  res.json({ proposition: await lireProposition(pool, id) });
});

export default router;
