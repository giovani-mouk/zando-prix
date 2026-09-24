// =============================================================
// src/erreurs.js : un seul endroit pour transformer les erreurs en réponses
//
// Principe : dans les routes, on ne construit jamais de réponse d'erreur
// à la main. On LÈVE une ErreurApi (throw), et ce middleware, placé en
// dernier dans app.js, la convertit au format du contrat d'API.
// Avantages : le format est toujours identique, et une route peut
// s'arrêter net au milieu d'une fonction, comme avec un « return ».
// =============================================================

// Erreur prévue, renvoyée au client au format du contrat d'API :
// { "erreur": { "champ": "...", "message": "..." } }
// « extends Error » : c'est une vraie erreur JavaScript (avec pile d'appels),
// enrichie du code HTTP à renvoyer et du champ concerné.
export class ErreurApi extends Error {
  constructor(statut, message, champ) {
    super(message);
    this.statut = statut;   // 400, 401, 404, 409…
    this.champ = champ;     // facultatif : "montant", "produit_id"… pour que le front surligne le bon champ
  }
}

// Middleware d'erreurs Express : les 4 paramètres sont obligatoires
// pour qu'Express le reconnaisse comme tel.
// (_next commence par _ : convention pour dire « paramètre volontairement inutilisé ».)
export function gestionErreurs(erreur, req, res, _next) {
  // Cas 1 : erreur prévue par notre code -> message destiné à l'utilisateur
  if (erreur instanceof ErreurApi) {
    const corps = erreur.champ
      ? { champ: erreur.champ, message: erreur.message }
      : { message: erreur.message };
    return res.status(erreur.statut).json({ erreur: corps });
  }

  // Cas 2 : erreurs levées par Express lui-même en lisant le corps
  // (JSON mal formé, corps trop gros)
  if (erreur.type === 'entity.parse.failed') {
    return res.status(400).json({
      erreur: { message: "Le corps de la requête n'est pas un JSON valide." },
    });
  }
  // « expose » signifie que le message de l'erreur peut être montré au client
  // sans risque (exemple : corps de plus de 10 Ko -> 413 Payload Too Large).
  if (erreur.expose && erreur.status >= 400 && erreur.status < 500) {
    return res.status(erreur.status).json({ erreur: { message: erreur.message } });
  }

  // Cas 3 : bug ou panne (base injoignable, faute de frappe dans une requête SQL…).
  // Le détail va dans le journal du serveur, jamais dans la réponse : il
  // pourrait révéler la structure de la base ou des chemins de fichiers.
  console.error(erreur);
  return res.status(500).json({ erreur: { message: 'Erreur interne du serveur.' } });
}
