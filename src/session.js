// =============================================================
// src/session.js : sessions des administrateurs et protections associées
// =============================================================
//
// Sessions des administrateurs
//
// Principe : à la connexion, le serveur tire un jeton au hasard, l'envoie
// dans un cookie et n'en garde que l'empreinte SHA-256 en base.
// À chaque requête protégée, il recalcule l'empreinte du cookie reçu et
// cherche une session valide correspondante.
import { createHash, randomBytes } from 'node:crypto';
import { pool } from './db.js';
import { ErreurApi } from './erreurs.js';

export const NOM_COOKIE = 'zp_session';
export const DUREE_SESSION_HEURES = 8;

const MESSAGE_NON_CONNECTE = 'Connectez-vous pour accéder à cet espace.';

// En production le cookie ne circule qu'en HTTPS. En local (http://localhost),
// un cookie « Secure » ne serait jamais renvoyé par le navigateur.
// NODE_ENV=production est défini dans render.yaml.
const enProduction = () => process.env.NODE_ENV === 'production';

// SHA-256 suffit ici (contrairement aux mots de passe, qui demandent scrypt) :
// le jeton est déjà long et aléatoire (32 octets), impossible à deviner
// par essais successifs. On ne cherche qu'à ne pas le stocker en clair.
const empreinte = (jeton) => createHash('sha256').update(jeton).digest('hex');

// Lecture du cookie sans dépendance supplémentaire
function lireCookie(req, nom) {
  for (const morceau of (req.headers.cookie ?? '').split(';')) {
    const position = morceau.indexOf('=');
    if (position === -1) continue;
    if (morceau.slice(0, position).trim() === nom) {
      return morceau.slice(position + 1).trim();
    }
  }
  return undefined;
}

function optionsCookie() {
  return {
    httpOnly: true,       // inaccessible au JavaScript de la page (protège contre le vol par XSS)
    sameSite: 'strict',   // jamais envoyé depuis un autre site (protège contre le CSRF)
    secure: enProduction(),
    path: '/',
  };
}

// Appelée après une connexion réussie (routes/admin.js)
export async function ouvrirSession(res, administrateurId) {
  // randomBytes utilise le générateur cryptographique du système :
  // contrairement à Math.random(), son résultat est imprévisible.
  const jeton = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO sessions (jeton_hash, administrateur_id, expire_le)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [empreinte(jeton), administrateurId, DUREE_SESSION_HEURES],
  );
  // Le navigateur renverra ce cookie automatiquement à chaque requête vers
  // notre site, pendant 8 heures (maxAge est en millisecondes).
  res.cookie(NOM_COOKIE, jeton, {
    ...optionsCookie(),
    maxAge: DUREE_SESSION_HEURES * 60 * 60 * 1000,
  });
}

export async function fermerSession(req, res) {
  const jeton = lireCookie(req, NOM_COOKIE);
  if (jeton) {
    await pool.query('DELETE FROM sessions WHERE jeton_hash = $1', [empreinte(jeton)]);
  }
  res.clearCookie(NOM_COOKIE, optionsCookie());
}

// Administrateur connecté, ou null. Un compte désactivé perd l'accès
// immédiatement, même si sa session n'a pas encore expiré.
async function administrateurConnecte(req) {
  const jeton = lireCookie(req, NOM_COOKIE);
  if (!jeton || jeton.length > 100) return null;

  const { rows } = await pool.query(
    `SELECT a.id, a.nom, a.email
     FROM sessions s
     JOIN administrateurs a ON a.id = s.administrateur_id
     WHERE s.jeton_hash = $1
       AND s.expire_le > now()
       AND a.actif`,
    [empreinte(jeton)],
  );
  return rows[0] ?? null;
}

// Middleware : à placer devant chaque route réservée aux administrateurs
// Usage : router.get('/', exigerAdmin, async (req, res) => { ... })
// Si la session est valide, il ajoute req.administrateur ({ id, nom, email })
// et passe la main à la route avec next(). Sinon, il lève une erreur 401
// et la route n'est jamais exécutée.
export async function exigerAdmin(req, res, next) {
  // Les réponses contenant des données de gestion ne doivent être
  // gardées par aucun cache (navigateur, proxy, CDN).
  res.set('Cache-Control', 'no-store');

  const administrateur = await administrateurConnecte(req);
  if (!administrateur) {
    throw new ErreurApi(401, MESSAGE_NON_CONNECTE);
  }
  req.administrateur = administrateur;
  next();
}

// Middleware : refuse les requêtes qui modifient des données quand
// elles viennent d'un autre site. Double protection avec SameSite=Strict,
// pour les navigateurs anciens qui ne respectent pas cet attribut.
export function verifierOrigine(req, res, next) {
  const origine = req.get('origin');
  const modification = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (modification && origine) {
    let hote;
    try {
      hote = new URL(origine).host;
    } catch {
      hote = null;
    }
    // Derrière un proxy, le domaine public peut arriver dans X-Forwarded-Host.
    // Un site malveillant ne peut pas fixer cet en-tête depuis le navigateur
    // de sa victime : l'accepter ne rouvre donc pas la faille.
    const hotesServeur = [req.get('host'), req.get('x-forwarded-host')].filter(Boolean);
    if (!hotesServeur.includes(hote)) {
      throw new ErreurApi(403, "Requête refusée : elle ne vient pas de Zando Prix.");
    }
  }
  next();
}
