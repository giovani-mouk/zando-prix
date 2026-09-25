// =============================================================
// Feature 16 : gérer les comptes administrateurs
//
// Pour vérifier qu'un compte « peut se connecter » sans perturber la
// session du scénario, on utilise un autre navigateur (this.nouvelAppareil),
// qui a ses propres cookies.
// =============================================================
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { memesLignes } from '../../support/outils.js';

async function idCompte(world, email) {
  const { rows } = await world.db.query(
    'SELECT id FROM administrateurs WHERE lower(email) = lower($1)', [email],
  );
  assert.ok(rows[0], `Aucun compte pour ${email}`);
  return rows[0].id;
}

function connexion(appareil, email, motDePasse) {
  return appareil.post('/api/admin/connexion').send({ email, mot_de_passe: motDePasse });
}

async function listeComptes(world) {
  const reponse = await world.api.get('/api/administrateurs');
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  return reponse.body;
}

// ---------------------------------------------------------------
// Contexte
// ---------------------------------------------------------------

Given('{string} est connecté sur un autre appareil', async function (email) {
  const appareil = this.nouvelAppareil();
  const reponse = await connexion(appareil, email, this.motsDePasse.get(email.toLowerCase()));
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  this.autresAppareils.set(email.toLowerCase(), appareil);
});

Given('je me suis déconnecté', async function () {
  const reponse = await this.api.post('/api/admin/deconnexion');
  assert.equal(reponse.status, 204);
});

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

When('je consulte les comptes administrateurs', async function () {
  this.reponse = await this.api.get('/api/administrateurs');
});

// Comme le formulaire : un champ vide n'est pas envoyé
When('je crée le compte suivant :', async function (table) {
  const [ligne] = table.hashes();
  this.reponse = await this.api.post('/api/administrateurs').send({
    nom: ligne.nom || undefined,
    email: ligne['e-mail'] || undefined,
    mot_de_passe: ligne['mot de passe'] || undefined,
  });
});

When('je désactive le compte {string}', async function (email) {
  this.reponse = await this.api
    .patch(`/api/administrateurs/${await idCompte(this, email)}`)
    .send({ actif: false });
});

When('je réactive le compte {string}', async function (email) {
  this.reponse = await this.api
    .patch(`/api/administrateurs/${await idCompte(this, email)}`)
    .send({ actif: true });
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
});

When('je change mon mot de passe {string} en {string}', async function (actuel, nouveau) {
  this.reponse = await this.api.put('/api/admin/mot-de-passe').send({ actuel, nouveau });
});

// ---------------------------------------------------------------
// Résultats
// ---------------------------------------------------------------

Then('je vois les comptes suivants :', function (table) {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  const actuel = this.reponse.body.map((c) => ({
    nom: c.nom, 'e-mail': c.email, actif: c.actif ? 'oui' : 'non',
  }));
  memesLignes(actuel, table.hashes());
});

Then('le compte {string} est indiqué comme le mien', function (email) {
  const compte = this.reponse.body.find((c) => c.email.toLowerCase() === email.toLowerCase());
  assert.ok(compte, `Compte ${email} absent de la liste`);
  assert.equal(compte.moi, true);
  // Et c'est le seul
  assert.equal(this.reponse.body.filter((c) => c.moi).length, 1);
});

Then('le compte est créé', function () {
  assert.equal(this.reponse.status, 201, JSON.stringify(this.reponse.body));
});

Then('la création du compte est refusée', function () {
  assert.ok([400, 409].includes(this.reponse.status), `Statut reçu : ${this.reponse.status}`);
});

Then('le changement de mot de passe est refusé', function () {
  assert.equal(this.reponse.status, 400);
});

Then('mon mot de passe est changé', function () {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
});

Then('le compte {string} est indiqué comme désactivé', async function (email) {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  const compte = (await listeComptes(this)).find((c) => c.email.toLowerCase() === email.toLowerCase());
  assert.equal(compte?.actif, false);
});

Then('la session de {string} sur l\'autre appareil est fermée', async function (email) {
  const appareil = this.autresAppareils.get(email.toLowerCase());
  assert.ok(appareil, `${email} n'est connecté sur aucun autre appareil`);
  const moi = await appareil.get('/api/admin/moi');
  assert.equal(moi.status, 401);
});

Then('je suis toujours connecté', async function () {
  const moi = await this.api.get('/api/admin/moi');
  assert.equal(moi.status, 200);
});

Then('{string} peut se connecter avec {string}', async function (email, motDePasse) {
  const reponse = await connexion(this.nouvelAppareil(), email, motDePasse);
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
});

Then('{string} ne peut plus se connecter avec {string}', async function (email, motDePasse) {
  const reponse = await connexion(this.nouvelAppareil(), email, motDePasse);
  assert.equal(reponse.status, 401);
});

Then('aucun compte n\'existe pour {string}', async function (email) {
  const { rows } = await this.db.query(
    'SELECT 1 FROM administrateurs WHERE lower(email) = lower($1)', [email],
  );
  assert.equal(rows.length, 0);
});
