// =============================================================
// Routes /api/administrateurs : comptes de l'équipe (feature 16)
// Toutes les routes exigent d'être connecté. Tous les administrateurs
// ont les mêmes droits (choix validé : petite équipe).
//
// GET   /api/administrateurs        liste des comptes
// POST  /api/administrateurs        créer un compte
// PATCH /api/administrateurs/:id    désactiver ou réactiver un compte
//
// Aucun compte n'est jamais supprimé : il est désactivé, et tout ce qu'il
// a publié, supprimé ou corrigé reste attribué à son nom.
// =============================================================
import { Router } from 'express';
import { pool } from '../db.js';
import { ErreurApi } from '../erreurs.js';
import { LONGUEUR_MAX, hacher, problemeMotDePasse } from '../motdepasse.js';
import { exigerAdmin, fermerSessionsDe } from '../session.js';
import { entierPositif } from '../validation.js';

const router = Router();
router.use(exigerAdmin);

const NOM_MAX = 100;
const EMAIL_MAX = 254;
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// La dernière connexion est lue dans le journal des tentatives, qui existe
// déjà : pas de colonne à ajouter, donc pas de migration de la base en ligne.
// Limite : ce journal est purgé après 30 jours (voir routes/admin.js).
// « moi » : vrai pour le compte de la personne connectée (pas de bouton
// « Désactiver » sur sa propre ligne).
const SELECT_COMPTES = `
  SELECT a.id, a.nom, a.email, a.actif, a.created_at,
         (SELECT max(t.created_at) FROM tentatives_connexion t
          WHERE lower(t.email) = lower(a.email) AND t.reussie) AS derniere_connexion,
         (a.id = $1) AS moi
  FROM administrateurs a`;

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT_COMPTES} ORDER BY a.actif DESC, a.nom`,
    [req.administrateur.id],
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const corps = req.body ?? {};
  const nom = typeof corps.nom === 'string' ? corps.nom.trim() : '';
  const email = typeof corps.email === 'string' ? corps.email.trim() : '';
  const motDePasse = corps.mot_de_passe;

  if (nom === '' || nom.length > NOM_MAX) {
    throw new ErreurApi(400, `Indiquez un nom (${NOM_MAX} caractères au plus).`, 'nom');
  }
  if (!EMAIL_VALIDE.test(email) || email.length > EMAIL_MAX) {
    throw new ErreurApi(400, 'Indiquez une adresse e-mail valide.', 'email');
  }
  const probleme = problemeMotDePasse(motDePasse);
  if (probleme) throw new ErreurApi(400, probleme, 'mot_de_passe');

  let id;
  try {
    ({ rows: [{ id }] } = await pool.query(
      'INSERT INTO administrateurs (nom, email, mot_de_passe_hash) VALUES ($1, $2, $3) RETURNING id',
      [nom, email, await hacher(motDePasse)],
    ));
  } catch (erreur) {
    // 23505 = violation d'unicité : index sur lower(email), donc sans tenir compte des majuscules
    if (erreur.code === '23505') {
      throw new ErreurApi(409, 'Un compte existe déjà avec cet e-mail.', 'email');
    }
    throw erreur;
  }

  const { rows } = await pool.query(`${SELECT_COMPTES} WHERE a.id = $2`, [req.administrateur.id, id]);
  res.status(201).json({ administrateur: rows[0] });
});

router.patch('/:id', async (req, res) => {
  const id = entierPositif(req.params.id);
  if (id === null) throw new ErreurApi(404, 'Compte introuvable.');

  const actif = req.body?.actif;
  if (typeof actif !== 'boolean') {
    throw new ErreurApi(400, 'Le champ actif doit valoir true ou false.', 'actif');
  }
  // Garde-fou : la personne connectée est forcément active (sinon exigerAdmin
  // l'aurait refusée). En lui interdisant de se désactiver elle-même, il reste
  // toujours au moins un administrateur actif.
  if (!actif && id === req.administrateur.id) {
    throw new ErreurApi(409, 'Vous ne pouvez pas désactiver votre propre compte.');
  }

  const { rowCount } = await pool.query('UPDATE administrateurs SET actif = $2 WHERE id = $1', [id, actif]);
  if (rowCount === 0) throw new ErreurApi(404, 'Compte introuvable.');

  // Un compte désactivé perd l'accès tout de suite, sans attendre la fin de sa session
  if (!actif) await fermerSessionsDe(id);

  const { rows } = await pool.query(`${SELECT_COMPTES} WHERE a.id = $2`, [req.administrateur.id, id]);
  res.json({ administrateur: rows[0] });
});

export default router;
