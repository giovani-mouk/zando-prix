// =============================================================
// Feature 19 : historique et stabilité du prix d'un produit
// =============================================================
import assert from 'node:assert/strict';
import { When, Then } from '@cucumber/cucumber';

const NIVEAUX = { 'très stable': 'tres_stable', stable: 'stable', variable: 'variable', instable: 'instable' };

When("je consulte l'historique du produit {string}", async function (produit) {
  this.reponse = await this.api.get(`/api/produits/${this.idProduit(produit)}/historique`);
});

Then("je vois les relevés suivants dans l'historique, dans cet ordre :", async function (table) {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  const attendus = [];
  for (const ligne of table.hashes()) {
    attendus.push({
      'marché': ligne['marché'],
      prix: Number(ligne.prix),
      date: await this.dateIlYA(Number(ligne['relevé il y a (jours)'])),
    });
  }
  const actuels = this.reponse.body.releves.map((r) => ({ 'marché': r.marche, prix: r.montant, date: r.date_releve }));
  assert.deepEqual(actuels, attendus);
});

Then('le prix du produit est {string}, avec une fluctuation de {int} %', function (niveau, fluctuation) {
  assert.ok(niveau in NIVEAUX, `Niveau inconnu : ${niveau}`);
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  const { stabilite } = this.reponse.body;
  assert.equal(stabilite.disponible, true);
  assert.equal(stabilite.niveau, NIVEAUX[niveau]);
  assert.equal(stabilite.fluctuation, fluctuation);
});

Then("la stabilité du prix n'est pas encore connue", function () {
  assert.equal(this.reponse.status, 200);
  assert.equal(this.reponse.body.stabilite.disponible, false);
});
