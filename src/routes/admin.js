// =============================================================
// Routes /api/admin : connexion, déconnexion, profil
// Connexion à l'espace administrateur (features/12_connexion_administrateur.feature)
//
// Déroulé d'une connexion :
//   1. trop d'échecs récents pour cet e-mail ?        -> 429, on s'arrête
//   2. recherche du compte et vérification du mot de passe (scrypt)
//   3. la tentative est enregistrée, réussie ou non
//   4. échec -> 401 avec un message volontairement vague
//   5. succès -> session créée en base + cookie envoyé au navigateur
// =============================================================
import { Router } from 'express';
import { pool } from '../db.js';
import { ErreurApi } from '../erreurs.js';
import { LONGUEUR_MAX, verifier, verifierLeurre } from '../motdepasse.js';
import { exigerAdmin, fermerSession, ouvrirSession } from '../session.js';

const router = Router();

// Hypothèses à valider par le PM (@a-valider)
const ECHECS_MAX = 5;
const BLOCAGE_MINUTES = 15;

const EMAIL_MAX = 254;

// Même message quel que soit le problème : ne jamais indiquer
// si c'est l'e-mail ou le mot de passe qui est faux.
const MESSAGE_ECHEC = 'E-mail ou mot de passe incorrect.';
const MESSAGE_BLOQUE = `Trop de tentatives. Réessayez dans ${BLOCAGE_MINUTES} minutes.`;

// Échecs récents pour cet e-mail, depuis la dernière connexion réussie
async function echecsRecents(email) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM tentatives_connexion t
     WHERE lower(t.email) = lower($1)
       AND NOT t.reussie
       AND t.created_at > now() - make_interval(mins => $2)
       AND t.created_at > COALESCE(
             (SELECT max(r.created_at) FROM tentatives_connexion r
              WHERE lower(r.email) = lower($1) AND r.reussie),
             '-infinity')`,
    [email, BLOCAGE_MINUTES],
  );
  return rows[0].n;
}

router.post('/connexion', async (req, res) => {
  const corps = req.body ?? {};
  const email = typeof corps.email === 'string' ? corps.email.trim() : '';
  const motDePasse = typeof corps.mot_de_passe === 'string' ? corps.mot_de_passe : '';

  if (email === '' || email.length > EMAIL_MAX) {
    throw new ErreurApi(401, MESSAGE_ECHEC);
  }

  // Le blocage s'applique avant toute vérification, même si le mot de passe
  // est juste : sinon l'attaquant pourrait continuer à essayer.
  if (await echecsRecents(email) >= ECHECS_MAX) {
    res.set('Retry-After', String(BLOCAGE_MINUTES * 60));
    throw new ErreurApi(429, MESSAGE_BLOQUE);
  }

  const { rows } = await pool.query(
    `SELECT id, nom, email, mot_de_passe_hash, actif
     FROM administrateurs WHERE lower(email) = lower($1)`,
    [email],
  );
  const compte = rows[0];

  let reussie = false;
  if (compte && motDePasse !== '' && motDePasse.length <= LONGUEUR_MAX) {
    reussie = (await verifier(motDePasse, compte.mot_de_passe_hash)) && compte.actif;
  } else {
    // Même temps de calcul qu'un vrai compte (voir motdepasse.js)
    await verifierLeurre(motDePasse.slice(0, LONGUEUR_MAX));
  }

  await pool.query(
    'INSERT INTO tentatives_connexion (email, reussie) VALUES ($1, $2)',
    [email, reussie],
  );

  if (!reussie) {
    throw new ErreurApi(401, MESSAGE_ECHEC);
  }

  await ouvrirSession(res, compte.id);

  // Ménage : sessions expirées et vieilles tentatives
  await pool.query('DELETE FROM sessions WHERE expire_le < now()');
  await pool.query("DELETE FROM tentatives_connexion WHERE created_at < now() - interval '30 days'");

  res.set('Cache-Control', 'no-store');
  res.json({ administrateur: { id: compte.id, nom: compte.nom, email: compte.email } });
});

router.post('/deconnexion', async (req, res) => {
  await fermerSession(req, res);
  res.status(204).end();
});

router.get('/moi', exigerAdmin, (req, res) => {
  res.json({ administrateur: req.administrateur });
});

export default router;
