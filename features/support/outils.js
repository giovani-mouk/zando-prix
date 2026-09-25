// =============================================================
// features/support/outils.js : correspondances et fonctions communes
//
// Les features parlent français (« en attente », « vert », « marché »),
// l'API parle en codes (« en_attente », « recent », « marche_id »).
// Ces tables font la traduction, en un seul endroit : si un libellé
// change dans une feature, il n'y a qu'une ligne à modifier ici.
// =============================================================
import assert from 'node:assert/strict';

// Libellés des features -> valeurs de l'API
export const STATUTS = {
  'en attente': 'en_attente',
  'validée': 'validee',
  'rejetée': 'rejetee',
};

export const COULEURS = {
  vert: 'recent',
  orange: 'ancien',
};

export const CHAMPS = {
  produit: 'produit_id',
  'marché': 'marche_id',
  prix: 'montant',
  'unité': 'unite',
  date: 'date_constat',
  auteur: 'auteur',
  // Formulaire de contact (feature 14)
  nom: 'nom',
  'e-mail': 'email',
  message: 'message',
  // Comptes administrateurs (feature 16)
  'mot de passe': 'mot_de_passe',
  'mot de passe actuel': 'actuel',
  'nouveau mot de passe': 'nouveau',
};

export const LIBELLES_STATUT = Object.fromEntries(
  Object.entries(STATUTS).map(([libelle, code]) => [code, libelle]),
);

// Clé d'un couple produit / marché
export const cle = (produit, marche) => `${produit}|${marche}`;

// Compare deux listes de lignes sans tenir compte de l'ordre
// (l'ordre d'affichage n'est pas une règle métier : on ne veut pas qu'un
//  test échoue parce que deux lignes sont arrivées dans un autre ordre)
export function memesLignes(actuel, attendu) {
  const signature = (ligne) =>
    JSON.stringify(Object.keys(ligne).sort().map((k) => [k, ligne[k]]));
  const trier = (lignes) =>
    lignes.map((l) => ({ ...l })).sort((a, b) => signature(a).localeCompare(signature(b)));
  assert.deepEqual(trier(actuel), trier(attendu));
}
