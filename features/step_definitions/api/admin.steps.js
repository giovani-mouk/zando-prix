// =============================================================
// Connexion à l'espace administrateur (feature 12)
//
// Les mots de passe des comptes de test sont gardés dans le World
// (this.motsDePasse) : la base ne contient que leur empreinte, il faut
// donc se souvenir du mot de passe pour pouvoir se connecter ensuite.
// =============================================================
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Given, When, Then } from '@cucumber/cucumber';
// Import direct sans risque : ce module ne se connecte pas à la base.
// (Ne pas importer src/session.js ici : il charge src/db.js avant que
//  hooks.js n'ait basculé DATABASE_URL sur la base de test.)
import { hacher } from '../../../src/motdepasse.js';

async function creerAdministrateur(world, { nom, email, motDePasse, actif = true }) {
  await world.db.query(
    `INSERT INTO administrateurs (nom, email, mot_de_passe_hash, actif)
     VALUES ($1, $2, $3, $4)`,
    [nom, email, await hacher(motDePasse), actif],
  );
  world.motsDePasse.set(email.toLowerCase(), motDePasse);
}

function seConnecter(world, email, motDePasse) {
  return world.api.post('/api/admin/connexion').send({ email, mot_de_passe: motDePasse });
}

async function connecter(world, email) {
  const motDePasse = world.motsDePasse.get(email.toLowerCase());
  assert.ok(motDePasse, `Aucun administrateur ${email} dans le contexte`);
  const reponse = await seConnecter(world, email, motDePasse);
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
}

// ---------------------------------------------------------------
// Contexte
// ---------------------------------------------------------------

Given('les administrateurs suivants :', async function (table) {
  for (const ligne of table.hashes()) {
    assert.ok(['oui', 'non'].includes(ligne.actif), `actif doit valoir oui ou non : ${ligne.actif}`);
    await creerAdministrateur(this, {
      nom: ligne.nom,
      email: ligne['e-mail'],
      motDePasse: ligne['mot de passe'],
      actif: ligne.actif === 'oui',
    });
  }
});

// Pour les scénarios où l'identité de l'administrateur n'a pas d'importance
Given("je suis connecté en tant qu'administrateur", async function () {
  const email = 'admin.test@zandoprix.cg';
  await creerAdministrateur(this, {
    nom: 'Administrateur de test',
    email,
    motDePasse: randomBytes(12).toString('base64url'),
  });
  await connecter(this, email);
});

Given('je suis connecté en tant que {string}', function (email) {
  return connecter(this, email);
});

Given(
  'je me suis connecté en tant que {string} il y a {int} heures',
  async function (email, heures) {
    await connecter(this, email);
    // On vieillit la session en base. 8 heures = DUREE_SESSION_HEURES (src/session.js).
    await this.db.query(
      `UPDATE sessions
       SET created_at = now() - make_interval(hours => $1),
           expire_le  = now() - make_interval(hours => $1) + interval '8 hours'
       WHERE administrateur_id = (SELECT id FROM administrateurs WHERE lower(email) = lower($2))`,
      [heures, email],
    );
  },
);

Given(
  '{int} tentatives de connexion ont échoué pour {string} il y a {int} minutes',
  async function (nombre, email, minutes) {
    for (let i = 0; i < nombre; i += 1) {
      await this.db.query(
        `INSERT INTO tentatives_connexion (email, reussie, created_at)
         VALUES ($1, false, now() - make_interval(mins => $2))`,
        [email, minutes],
      );
    }
  },
);

Given('le compte {string} est désactivé', async function (email) {
  const { rowCount } = await this.db.query(
    'UPDATE administrateurs SET actif = false WHERE lower(email) = lower($1)',
    [email],
  );
  assert.equal(rowCount, 1);
});

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

When('je me connecte avec {string} et {string}', async function (email, motDePasse) {
  this.reponse = await seConnecter(this, email, motDePasse);
});

When('je me déconnecte', async function () {
  this.reponse = await this.api.post('/api/admin/deconnexion');
  assert.equal(this.reponse.status, 204);
});

// ---------------------------------------------------------------
// Résultats
// ---------------------------------------------------------------

Then('je suis connecté sous le nom {string}', async function (nom) {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  assert.equal(this.reponse.body.administrateur?.nom, nom);

  // La session est réellement ouverte : une requête suivante est reconnue
  const moi = await this.api.get('/api/admin/moi');
  assert.equal(moi.status, 200);
  assert.equal(moi.body.administrateur?.nom, nom);
});

Then('la connexion est refusée avec le message {string}', function (message) {
  assert.ok([401, 429].includes(this.reponse.status), `Statut reçu : ${this.reponse.status}`);
  assert.equal(this.reponse.body.erreur?.message, message);
});

// Sert à la fois de précondition (Étant donné) et de vérification (Alors).
// La réponse est gardée à part pour ne pas écraser this.reponse.
Then('je ne suis pas connecté', async function () {
  const moi = await this.api.get('/api/admin/moi');
  assert.equal(moi.status, 401);
});

Then("l'accès est refusé avec le message {string}", function (message) {
  assert.equal(this.reponse.status, 401);
  assert.equal(this.reponse.body.erreur?.message, message);
});
