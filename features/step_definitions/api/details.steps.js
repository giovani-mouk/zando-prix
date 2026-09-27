// =============================================================
// Feature 20 : précisions d'une proposition et page de confirmation
// =============================================================
import assert from 'node:assert/strict';
import { When, Then } from '@cucumber/cucumber';
import { LIBELLES_STATUT } from '../../support/outils.js';

// « 121 caractères » dans la feature -> un texte de cette longueur
const texte = (valeur) => {
  const longueur = /^(\d+) caractères$/.exec(valeur);
  return longueur ? 'x'.repeat(Number(longueur[1])) : valeur || undefined;
};

When('je propose le prix suivant avec des précisions :', async function (table) {
  const [l] = table.hashes();
  this.reponse = await this.api.post('/api/propositions').send({
    produit_id: this.idProduit(l.produit),
    marche_id: this.idMarche(l['marché']),
    montant: Number(l.prix),
    unite: l['unité'],
    date_constat: await this.dateIlYA(0),
    constat: l.constat || undefined,
    repere: texte(l['repère']),
  });
  this.propositionEnvoyee = this.reponse.body.proposition;
});

Then("l'équipe voit que ce prix a été constaté par {string} avec le repère {string}", async function (constat, repere) {
  const reponse = await this.api.get('/api/propositions');
  assert.equal(reponse.status, 200);
  const proposition = reponse.body.find((p) => p.id === this.propositionEnvoyee.id);
  assert.equal(proposition.constat, constat);
  assert.equal(proposition.repere, repere);
});

When('je consulte ma proposition dans le registre public', async function () {
  this.reponse = await this.api.get(`/api/registre/${this.propositionEnvoyee.id}`);
});

When('je consulte la proposition numéro {int} dans le registre public', async function (id) {
  this.reponse = await this.api.get(`/api/registre/${id}`);
});

Then('je la retrouve avec sa référence, son prix de {int} et le statut {string}', function (prix, statut) {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  const ligne = this.reponse.body;
  assert.equal(ligne.reference, `#PROP-${String(this.propositionEnvoyee.id).padStart(4, '0')}`);
  assert.equal(ligne.montant, prix);
  assert.equal(LIBELLES_STATUT[ligne.statut], statut);
});

Then('le registre public ne contient pas {string}', function (mot) {
  assert.ok(!JSON.stringify(this.reponse.body).includes(mot), `« ${mot} » apparaît dans le registre public`);
});

Then('la proposition est introuvable', function () {
  assert.equal(this.reponse.status, 404);
});

// ---------------------------------------------------------------
// Suivi privé par clé
// ---------------------------------------------------------------

When('je suis ma proposition avec la clé reçue', async function () {
  const cle = this.reponseEnvoi?.body.cle_suivi ?? this.reponse.body.cle_suivi;
  assert.ok(cle, 'Aucune clé de suivi reçue');
  this.reponse = await this.api.get(`/api/propositions/${this.propositionEnvoyee.id}/suivi`).query({ cle });
});

When('je suis ma proposition avec la clé {string}', async function (cle) {
  this.reponse = await this.api.get(`/api/propositions/${this.propositionEnvoyee.id}/suivi`).query({ cle });
});
