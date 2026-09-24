// =============================================================
// src/app.js : construction de l'application Express
//
// Express traite chaque requête en la faisant passer, DANS L'ORDRE où ils
// sont déclarés ici, par une chaîne de « middlewares » : des fonctions
// (req, res, next) qui peuvent lire la requête, répondre, ou passer la main
// à la suivante avec next(). L'ordre des app.use() est donc essentiel.
//
// Ce fichier est importé par :
// - src/server.js en local (qui appelle app.listen) ;
// - les tests (features/support/hooks.js) via Supertest.
// =============================================================
import express from 'express';
import { fileURLToPath } from 'node:url';
import { gestionErreurs } from './erreurs.js';
import admin from './routes/admin.js';
import marches from './routes/marches.js';
import messages from './routes/messages.js';
import prix from './routes/prix.js';
import produits from './routes/produits.js';
import propositions from './routes/propositions.js';
import { verifierOrigine } from './session.js';

const app = express();

// Sur Render, les requêtes passent par un proxy qui ajoute l'en-tête
// X-Forwarded-For avec l'adresse réelle du visiteur. « trust proxy » à 1
// dit à Express de faire confiance à ce seul proxy : req.ip contient alors
// l'adresse du visiteur et non celle du proxy (utile à la limite d'envois
// du formulaire de contact). Render définit toujours la variable RENDER.
if (process.env.RENDER) app.set('trust proxy', 1);

// Par défaut, Express ajoute l'en-tête « X-Powered-By: Express ».
// Inutile pour le navigateur, et utile à un attaquant pour savoir
// quelles failles connues essayer : on le retire.
app.disable('x-powered-by');

// Lit le corps JSON des requêtes (POST, PUT, PATCH) et le place dans req.body.
// La limite de 10 Ko suffit largement pour une proposition de prix et
// empêche d'envoyer un corps énorme pour saturer le serveur.
app.use(express.json({ limit: '10kb' }));

// Front-end : les fichiers de public/ (HTML, CSS, JS, images) sont servis
// par Express, en local comme sur Render.
// import.meta.url est l'adresse de CE fichier (file:///…/src/app.js) :
// on en déduit le chemin absolu de public/, quel que soit le dossier
// depuis lequel on lance « node ».
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));

// API
// 1. Contrôle anti-CSRF sur toutes les routes /api (voir session.js).
app.use('/api', verifierOrigine);
// 2. Une ressource = un routeur, monté sous son préfixe.
app.use('/api/admin', admin);
app.use('/api/produits', produits);
app.use('/api/marches', marches);
app.use('/api/messages', messages);
app.use('/api/prix', prix);
app.use('/api/propositions', propositions);

// 3. Aucune route /api n'a répondu : on renvoie un 404 au format JSON du
//    contrat d'API, plutôt que la page HTML d'erreur par défaut d'Express.
app.use('/api', (req, res) => {
  res.status(404).json({ erreur: { message: 'Route inconnue.' } });
});

// Toujours en dernier : Express reconnaît un middleware d'erreurs à ses
// 4 paramètres (erreur, req, res, next). Toute exception levée plus haut,
// y compris dans une fonction async, arrive ici.
app.use(gestionErreurs);

// Export par défaut : c'est ce que server.js et les tests importent.
export default app;
