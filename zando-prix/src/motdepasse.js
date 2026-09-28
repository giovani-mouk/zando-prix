// =============================================================
// src/motdepasse.js : hacher et vérifier les mots de passe
//
// On ne stocke JAMAIS un mot de passe, même chiffré. On stocke son
// « empreinte » (hash) : le résultat d'un calcul à sens unique.
// À la connexion, on refait le calcul sur le mot de passe saisi et on
// compare les deux empreintes. Personne, pas même nous, ne peut
// retrouver le mot de passe à partir de l'empreinte.
//
// Le « sel » : 16 octets tirés au hasard pour chaque compte et mélangés
// au mot de passe. Deux comptes avec le même mot de passe ont donc des
// empreintes différentes, et les tables d'empreintes précalculées
// (« rainbow tables ») deviennent inutiles.
// =============================================================

// Hachage des mots de passe avec scrypt, fourni par Node : aucune dépendance.
// scrypt est volontairement lent et gourmand en mémoire, ce qui rend
// très coûteux d'essayer des millions de mots de passe si la base fuit.
//
// Ce module ne dépend pas de la base : les tests peuvent l'importer directement.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// scrypt fonctionne avec une fonction de rappel (callback) ; promisify
// en fait une version qui renvoie une promesse, utilisable avec await.
const scryptAsync = promisify(scrypt);

// Paramètres recommandés par l'OWASP pour scrypt (N = 2^17, r = 8, p = 1).
// Ils sont enregistrés avec chaque empreinte : on pourra les augmenter
// plus tard sans casser les mots de passe existants.
//
// Pendant les tests uniquement (NODE_ENV=test), SCRYPT_COUT_TEST permet un
// coût plus faible : sinon chaque scénario perdrait près d'une seconde.
// Lu à chaque appel, car hooks.js le définit après le chargement de ce module.
function parametres() {
  const coutTest = Number(process.env.SCRYPT_COUT_TEST);
  const N = process.env.NODE_ENV === 'test' && coutTest > 1 ? coutTest : 2 ** 17;
  return { N, r: 8, p: 1 };
}
const LONGUEUR_CLE = 64;
// scrypt a besoin d'environ 128 × N × r octets de mémoire (128 Mo ici).
// La limite par défaut de Node (32 Mo) est trop basse pour ces paramètres.
const MEMOIRE_MAX = 256 * 1024 * 1024;

export const LONGUEUR_MIN = 12;
// Au-delà, on refuse sans calculer : un mot de passe d'un mégaoctet
// ferait travailler le serveur pour rien.
export const LONGUEUR_MAX = 128;

// normalize('NFC') : « é » peut s'écrire avec un seul caractère ou avec
// « e » + accent. Sans normalisation, le même mot de passe tapé sur deux
// claviers différents pourrait donner deux empreintes différentes.
async function deriver(motDePasse, sel, { N, r, p }) {
  return scryptAsync(motDePasse.normalize('NFC'), sel, LONGUEUR_CLE, { N, r, p, maxmem: MEMOIRE_MAX });
}

// Renvoie par exemple "scrypt$131072$8$1$<sel>$<empreinte>" (base64url)
export async function hacher(motDePasse) {
  const sel = randomBytes(16);
  const { N, r, p } = parametres();
  const cle = await deriver(motDePasse, sel, { N, r, p });
  return ['scrypt', N, r, p, sel.toString('base64url'), cle.toString('base64url')].join('$');
}

export async function verifier(motDePasse, empreinte) {
  const morceaux = String(empreinte).split('$');
  if (morceaux.length !== 6 || morceaux[0] !== 'scrypt') return false;

  const [, N, r, p, sel, attendue] = morceaux;
  if (typeof motDePasse !== 'string' || motDePasse.length > LONGUEUR_MAX) return false;
  const cleAttendue = Buffer.from(attendue, 'base64url');
  const cle = await deriver(motDePasse, Buffer.from(sel, 'base64url'), {
    N: Number(N), r: Number(r), p: Number(p),
  });
  // Comparaison en temps constant : le temps de réponse ne révèle
  // pas combien de caractères de l'empreinte correspondent.
  return cle.length === cleAttendue.length && timingSafeEqual(cle, cleAttendue);
}

// Empreinte calculée une seule fois, utilisée quand l'e-mail est inconnu :
// la réponse prend alors le même temps que pour un vrai compte, ce qui
// empêche de deviner quels e-mails existent en mesurant le temps.
let empreinteLeurre;
export async function verifierLeurre(motDePasse) {
  empreinteLeurre ??= hacher(randomBytes(16).toString('hex'));
  await verifier(motDePasse, await empreinteLeurre);
  return false;
}

// Règles appliquées à la création du compte (pas à la connexion)
export function problemeMotDePasse(motDePasse) {
  if (typeof motDePasse !== 'string' || motDePasse.length < LONGUEUR_MIN) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères.`;
  }
  if (motDePasse.length > LONGUEUR_MAX) {
    return `Le mot de passe ne doit pas dépasser ${LONGUEUR_MAX} caractères.`;
  }
  return null;
}
