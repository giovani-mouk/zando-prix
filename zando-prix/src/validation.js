// =============================================================
// src/validation.js : petites fonctions de contrôle des données reçues
//
// Règle d'or : tout ce qui vient du navigateur (URL, corps JSON) est
// suspect. Un utilisateur peut taper n'importe quoi dans l'URL, et un
// script peut appeler l'API sans passer par nos formulaires.
// Ces fonctions sont « pures » (pas de base, pas de réseau) : faciles
// à lire, à réutiliser et à tester.
// =============================================================
import { ErreurApi } from './erreurs.js';

// Même liste que le domaine unite_mesure dans db/schema.sql
// (les deux doivent rester synchronisées : la base refuserait de toute façon
//  une unité inconnue, mais avec un message technique peu lisible)
export const UNITES = ['kg', 'litre', 'tas', 'piece', 'botte', 'sac'];

export const STATUTS = ['en_attente', 'validee', 'rejetee'];

// Plus grand entier accepté par une colonne INTEGER PostgreSQL
// (2^31 - 1). Au-delà, PostgreSQL renverrait une erreur 500.
const ENTIER_MAX = 2147483647;

// Accepte 12 ou "12". Renvoie l'entier, ou null s'il n'est pas valide.
// Les paramètres d'URL arrivent toujours sous forme de texte ("12"),
// les corps JSON peuvent contenir de vrais nombres (12) : on accepte les deux.
// Refusés : "12.5", "-3", "0", "abc", "1e3", 12.5, true…
export function entierPositif(valeur) {
  // Expression régulière : ^ début, \s* espaces éventuels, \d+ un ou plusieurs chiffres, $ fin
  const nombre = typeof valeur === 'string' && /^\s*\d+\s*$/.test(valeur)
    ? Number(valeur)
    : valeur;
  return Number.isInteger(nombre) && nombre > 0 && nombre <= ENTIER_MAX ? nombre : null;
}

// Paramètre d'URL facultatif : absent -> undefined, invalide -> erreur 400
// On distingue bien « absent » (pas de filtre) de « invalide » (erreur).
export function idOptionnel(valeur, champ) {
  if (valeur === undefined || valeur === '') return undefined;
  const id = entierPositif(valeur);
  if (id === null) {
    throw new ErreurApi(400, `Le paramètre ${champ} doit être un entier positif.`, champ);
  }
  return id;
}

// Paramètre texte facultatif : absent ou vide -> undefined, répété -> erreur 400
// (?categorie=a&categorie=b donne un tableau, que l'on refuse)
export function texteOptionnel(valeur, champ) {
  if (valeur === undefined) return undefined;
  if (typeof valeur !== 'string') {
    throw new ErreurApi(400, `Le paramètre ${champ} ne doit apparaître qu'une fois.`, champ);
  }
  return valeur.trim() || undefined;
}

// Vrai si le texte est une date réelle au format AAAA-MM-JJ (refuse 2026-02-30)
// Astuce : JavaScript « corrige » silencieusement le 30 février en 2 mars.
// Si la date relue n'est pas identique au texte d'origine, elle n'existait pas.
export function dateValide(texte) {
  if (typeof texte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  const date = new Date(`${texte}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === texte;
}

// "  Poisson Salé " -> "poisson sale" : pour une recherche sans accents ni casse
// normalize('NFD') décompose « é » en « e » + un accent séparé (caractère
// « combinant », dans la plage Unicode \u0300-\u036f), que l'on supprime ensuite.
export function normaliser(texte) {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
