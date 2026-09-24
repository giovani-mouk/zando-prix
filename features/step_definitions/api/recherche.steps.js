// =============================================================
// Story 4 : rechercher un produit
//
// Motif habituel : l'étape « Quand » appelle l'API et range le résultat
// dans le World (this.reponse, this.produitsTrouves) ; les étapes
// « Alors » vérifient avec assert, qui lève une erreur (donc fait
// échouer le scénario) si la condition n'est pas remplie.
// =============================================================
import assert from 'node:assert/strict';
import { When, Then } from '@cucumber/cucumber';

When('je recherche {string}', async function (texte) {
  this.reponse = await this.api.get('/api/produits').query({ q: texte ?? '' });
  this.produitsTrouves = this.reponse.status === 200
    ? this.reponse.body.map((p) => p.nom)
    : [];
});

Then('je vois uniquement le produit {string}', function (nom) {
  assert.equal(this.reponse.status, 200);
  assert.deepEqual(this.produitsTrouves, [nom]);
});

Then('je vois uniquement les produits suivants :', function (table) {
  assert.equal(this.reponse.status, 200);
  const attendus = table.hashes().map((l) => l.produit).sort();
  assert.deepEqual([...this.produitsTrouves].sort(), attendus);
});

Then("on m'indique qu'aucun produit ne correspond à {string}", function (_texte) {
  assert.equal(this.reponse.status, 200);
  assert.deepEqual(this.produitsTrouves, []);
});
