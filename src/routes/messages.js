// =============================================================
// Routes /api/messages : page Contact (feature 14, hors cadrage)
//
// POST /api/messages          public : un visiteur envoie un message
// GET  /api/messages          : liste pour l'espace administrateur
// PATCH /api/messages/:id     : marquer comme lu ou non lu
//
// Une route publique qui écrit en base attire les robots. Deux protections
// simples, sans service extérieur ni CAPTCHA :
// - un champ piège (« site_web ») caché aux humains : un robot qui remplit
//   tous les champs se trahit ;
// - au plus 5 messages par heure depuis une même connexion (adresse IP).
// =============================================================
import { createHash } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { ErreurApi } from '../erreurs.js';
import { exigerAdmin } from '../session.js';
import { entierPositif } from '../validation.js';

const router = Router();

// Hypothèses à valider par le PM (@a-valider)
const ENVOIS_MAX_PAR_HEURE = 5;

const NOM_MAX = 100;
const EMAIL_MAX = 254;
const MESSAGE_MAX = 2000;
// Volontairement simple : quelque chose, une @, quelque chose, un point, quelque chose.
// La seule vraie vérification d'une adresse e-mail est d'y écrire.
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONFIRMATION = "Merci ! Votre message a bien été envoyé. L'équipe vous répondra par e-mail.";

// Adresse IP du visiteur. Sur Render, la requête traverse un proxy : grâce à
// « trust proxy » (voir app.js), req.ip contient l'adresse réelle du visiteur.
// En local et dans les tests, c'est l'adresse de la connexion directe.
function adresseClient(req) {
  return req.ip ?? 'inconnue';
}

// On ne stocke que l'empreinte de l'adresse, jamais l'adresse elle-même
const empreinteIp = (req) => createHash('sha256').update(adresseClient(req)).digest('hex');

function texte(valeur) {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

// Vérifie les champs dans l'ordre du formulaire et s'arrête à la première erreur
function validerMessage(corps) {
  const nom = texte(corps.nom);
  if (nom === '' || nom.length > NOM_MAX) {
    throw new ErreurApi(400, `Indiquez votre nom (${NOM_MAX} caractères au plus).`, 'nom');
  }

  const email = texte(corps.email);
  if (!EMAIL_VALIDE.test(email) || email.length > EMAIL_MAX) {
    throw new ErreurApi(400, 'Indiquez une adresse e-mail valide, pour que nous puissions vous répondre.', 'email');
  }

  const message = texte(corps.message);
  if (message === '' || message.length > MESSAGE_MAX) {
    throw new ErreurApi(400, `Écrivez votre message (${MESSAGE_MAX} caractères au plus).`, 'message');
  }

  return { nom, email, message };
}

// Colonnes renvoyées à l'espace administrateur
const SELECT_MESSAGE = `
  SELECT m.id, m.nom, m.email, m.contenu AS message, m.created_at,
         (m.lu_le IS NOT NULL) AS lu, m.lu_le, a.nom AS lu_par
  FROM messages m
  LEFT JOIN administrateurs a ON a.id = m.lu_par`;

// ---------------------------------------------------------------
// Envoyer un message (public)
// ---------------------------------------------------------------
router.post('/', async (req, res) => {
  const corps = req.body ?? {};

  // Champ piège rempli : c'est un robot. On lui répond exactement comme à un
  // humain, pour qu'il ne sache pas qu'il a été repéré, mais on n'enregistre rien.
  if (texte(corps.site_web) !== '') {
    return res.status(201).json({ confirmation: CONFIRMATION });
  }

  const { nom, email, message } = validerMessage(corps);
  const ip = empreinteIp(req);

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM messages
     WHERE ip_empreinte = $1 AND created_at > now() - interval '1 hour'`,
    [ip],
  );
  if (rows[0].n >= ENVOIS_MAX_PAR_HEURE) {
    res.set('Retry-After', '3600');
    throw new ErreurApi(429, 'Vous avez envoyé beaucoup de messages. Réessayez dans une heure.');
  }

  await pool.query(
    'INSERT INTO messages (nom, email, contenu, ip_empreinte) VALUES ($1, $2, $3, $4)',
    [nom, email, message, ip],
  );

  // Ménage : les empreintes de plus de 24 heures ne servent plus à rien
  await pool.query(
    "UPDATE messages SET ip_empreinte = NULL WHERE ip_empreinte IS NOT NULL AND created_at < now() - interval '1 day'",
  );

  res.status(201).json({ confirmation: CONFIRMATION });
});

// ---------------------------------------------------------------
// Lire les messages (espace administrateur)
// ---------------------------------------------------------------
router.get('/', exigerAdmin, async (req, res) => {
  // (lu_le IS NOT NULL) vaut false pour un message non lu : false est trié
  // avant true, donc les non lus arrivent en premier.
  const { rows } = await pool.query(
    `${SELECT_MESSAGE}
     ORDER BY (m.lu_le IS NOT NULL), m.created_at DESC, m.id DESC`,
  );
  res.json(rows);
});

router.patch('/:id', exigerAdmin, async (req, res) => {
  const id = entierPositif(req.params.id);
  if (id === null) throw new ErreurApi(404, 'Message introuvable.');

  const lu = req.body?.lu;
  if (typeof lu !== 'boolean') {
    throw new ErreurApi(400, 'Le champ lu doit valoir true ou false.', 'lu');
  }

  // Marquer comme lu enregistre qui l'a lu ; « non lu » efface les deux
  const { rowCount } = await pool.query(
    lu
      ? 'UPDATE messages SET lu_le = COALESCE(lu_le, now()), lu_par = COALESCE(lu_par, $2) WHERE id = $1'
      : 'UPDATE messages SET lu_le = NULL, lu_par = NULL WHERE id = $1',
    lu ? [id, req.administrateur.id] : [id],
  );
  if (rowCount === 0) throw new ErreurApi(404, 'Message introuvable.');

  const { rows } = await pool.query(`${SELECT_MESSAGE} WHERE m.id = $1`, [id]);
  res.json({ message: rows[0] });
});

export default router;
