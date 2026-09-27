// =============================================================
// Features 23 (prix officiels du Ministère) et 24 (photo de l'étal)
// =============================================================
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { After, Given, When, Then } from '@cucumber/cucumber';
import { memesLignes } from '../../support/outils.js';

// ---------------------------------------------------------------
// Prix officiels
// ---------------------------------------------------------------

When('je saisis le prix officiel suivant :', async function (table) {
  const [l] = table.hashes();
  this.reponse = await this.api.post('/api/prix-officiels').send({
    produit_id: this.idProduit(l.produit),
    type: l.type || undefined,
    montant: Number(l.prix),
    unite: l['unité'],
    // Un nombre négatif de jours : une date à venir
    date_effet: await this.dateIlYA(Number(l['en vigueur depuis (jours)'])),
    reference: l['référence'] || undefined,
  });
  if (this.reponse.status === 201) this.prixOfficiel = this.reponse.body.prix_officiel;
});

Then('le prix officiel est enregistré', function () {
  assert.equal(this.reponse.status, 201, JSON.stringify(this.reponse.body));
});

Then('le prix officiel est refusé', function () {
  assert.equal(this.reponse.status, 400, JSON.stringify(this.reponse.body));
});

Then('les prix officiels en vigueur sont :', async function (table) {
  const reponse = await this.api.get('/api/prix-officiels');
  assert.equal(reponse.status, 200);
  memesLignes(reponse.body.map((p) => ({
    produit: p.produit.nom, type: p.type, prix: String(p.montant), 'référence': p.reference,
  })), table.hashes());
});

When('je retire ce prix officiel', async function () {
  const reponse = await this.api.delete(`/api/prix-officiels/${this.prixOfficiel.id}`);
  assert.equal(reponse.status, 204, JSON.stringify(reponse.body));
});

Then("aucun prix officiel n'est en vigueur", async function () {
  const reponse = await this.api.get('/api/prix-officiels');
  assert.deepEqual(reponse.body, []);
});

Then("l'historique des prix officiels garde ce prix, marqué comme retiré", async function () {
  const reponse = await this.api.get('/api/prix-officiels/tous');
  assert.equal(reponse.status, 200);
  const ligne = reponse.body.find((p) => p.id === this.prixOfficiel.id);
  assert.ok(ligne, 'Le prix retiré a disparu de l\'historique');
  assert.ok(ligne.retire_le, 'Le prix n\'est pas marqué comme retiré');
});

// ---------------------------------------------------------------
// Photos (Cloudinary simulé par la variable d'environnement)
// ---------------------------------------------------------------

const SECRET_TEST = 'secret-de-test';

Given('le stockage des photos est configuré pour le compte {string}', function (compte) {
  process.env.CLOUDINARY_URL = `cloudinary://cle-de-test:${SECRET_TEST}@${compte}`;
});

Given("le stockage des photos n'est pas configuré", function () {
  delete process.env.CLOUDINARY_URL;
});

// Chaque scénario repart sans stockage configuré
After({ tags: '@photo' }, function () {
  delete process.env.CLOUDINARY_URL;
});

When("je demande l'autorisation d'envoyer une photo", async function () {
  this.reponse = await this.api.get('/api/photos/signature');
  assert.equal(this.reponse.status, 200);
});

Then('je reçois une autorisation valable pour le compte {string}', function (compte) {
  const { disponible, compte: recu, dossier, timestamp, signature } = this.reponse.body;
  assert.equal(disponible, true);
  assert.equal(recu, compte);
  const attendue = createHash('sha1').update(`folder=${dossier}&timestamp=${timestamp}${SECRET_TEST}`).digest('hex');
  assert.equal(signature, attendue);
});

Then("on m'indique que l'envoi de photos n'est pas disponible", function () {
  assert.deepEqual(this.reponse.body, { disponible: false });
});

When('je propose un prix de {int} FCFA pour le {string} au {string} avec la photo {string}', async function (montant, produit, marche, photo) {
  this.reponse = await this.api.post('/api/propositions').send({
    produit_id: this.idProduit(produit),
    marche_id: this.idMarche(marche),
    montant,
    unite: 'kg',
    date_constat: await this.dateIlYA(0),
    photo_url: photo,
  });
  if (this.reponse.status === 201) this.propositionEnvoyee = this.reponse.body.proposition;
});

Then("l'équipe voit la photo {string}", async function (photo) {
  const reponse = await this.api.get('/api/propositions');
  assert.equal(reponse.status, 200);
  const proposition = reponse.body.find((p) => p.id === this.propositionEnvoyee.id);
  assert.equal(proposition.photo_url, photo);
});
