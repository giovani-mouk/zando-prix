// =============================================================
// src/server.js : point de départ du serveur (npm run dev / npm start)
//
// Pourquoi deux fichiers, server.js et app.js ?
// - app.js CONSTRUIT l'application (routes, middlewares) sans l'écouter.
// - server.js prépare la base si besoin, puis la MET EN ROUTE sur un port.
// Cette séparation permet aux tests (Supertest) d'importer app.js sans
// ouvrir de port réseau ni toucher à la base de développement.
// =============================================================
import app from './app.js';
import { amorcer } from './amorcage.js';

// process.env.PORT vient du fichier .env en local, et de Render en production
// (Render choisit le port et le transmet). Number() transforme le texte "3000"
// en nombre ; si la variable est absente, Number(undefined) vaut NaN, qui est
// « faux » : l'opérateur || prend alors 3000.
const port = Number(process.env.PORT) || 3000;

// Base neuve (premier déploiement) : tables, données de démo, premier compte.
// Sur une base déjà prête, ne fait rien. Voir src/amorcage.js.
await amorcer();

// Express 5 passe l'éventuelle erreur de démarrage (port déjà utilisé par
// un autre programme, par exemple) à cette fonction : on la relance pour
// arrêter le processus avec un message clair plutôt que de continuer sans serveur.
app.listen(port, (erreur) => {
  if (erreur) throw erreur;
  console.log(`Zando Prix démarré : http://localhost:${port}`);
});
