// =============================================================
// public/js/api.js : le seul fichier du front qui parle au serveur
// Accès à l'API (voir docs/contrat-api.md)
//
// Toutes les pages passent par l'objet « api » ci-dessous. Avantage :
// si une adresse ou un format change, il n'y a qu'un fichier à modifier,
// et toutes les erreurs arrivent sous la même forme (ErreurApi).
// =============================================================

export class ErreurApi extends Error {
  constructor(message, { statut = 0, champ } = {}) {
    super(message);
    this.statut = statut;
    this.champ = champ;
  }
}

// fetch() est la fonction du navigateur pour faire une requête HTTP.
// Elle ne lève PAS d'erreur quand le serveur répond 400 ou 500 : seulement
// quand le réseau est coupé. D'où la vérification de reponse.ok plus bas.
async function requete(chemin, { methode = 'GET', corps, params } = {}) {
  const url = new URL(chemin, window.location.origin);
  for (const [nom, valeur] of Object.entries(params ?? {})) {
    if (valeur !== undefined && valeur !== null && valeur !== '') {
      url.searchParams.set(nom, valeur);
    }
  }

  let reponse;
  try {
    reponse = await fetch(url, {
      method: methode,
      headers: corps ? { 'Content-Type': 'application/json' } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw new ErreurApi('Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.');
  }

  // .catch(() => null) : une réponse vide (204) ou non-JSON ne fait pas planter la page
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    throw new ErreurApi(
      donnees?.erreur?.message ?? `Le serveur a répondu par une erreur ${reponse.status}.`,
      { statut: reponse.status, champ: donnees?.erreur?.champ },
    );
  }
  return donnees;
}

export const api = {
  produits: (recherche) => requete('/api/produits', { params: { q: recherche } }),
  marches: () => requete('/api/marches'),
  prix: ({ produitId, marcheId, categorie } = {}) =>
    requete('/api/prix', { params: { produit_id: produitId, marche_id: marcheId, categorie } }),
  proposer: (proposition) => requete('/api/propositions', { methode: 'POST', corps: proposition }),
  propositions: (statut) => requete('/api/propositions', { params: { statut } }),
  decider: (id, statut) =>
    requete(`/api/propositions/${id}`, { methode: 'PATCH', corps: { statut } }),
  corriger: (id, champs) =>
    requete(`/api/propositions/${id}`, { methode: 'PUT', corps: champs }),

  // Espace administrateur : le cookie de session est envoyé automatiquement
  // par le navigateur (même origine), le JavaScript n'y a pas accès.
  connexion: (email, motDePasse) =>
    requete('/api/admin/connexion', { methode: 'POST', corps: { email, mot_de_passe: motDePasse } }),
  deconnexion: () => requete('/api/admin/deconnexion', { methode: 'POST' }),
  moi: () => requete('/api/admin/moi'),

  // Page Contact (publique) et lecture des messages (administrateur)
  envoyerMessage: (message) => requete('/api/messages', { methode: 'POST', corps: message }),
  messages: () => requete('/api/messages'),
  marquerMessage: (id, lu) => requete(`/api/messages/${id}`, { methode: 'PATCH', corps: { lu } }),
};
