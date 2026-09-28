// =============================================================
// Feature 17 : tendance des prix de la semaine
// =============================================================
import assert from 'node:assert/strict';
import { When, Then } from '@cucumber/cucumber';

const SENS = { baisse: 'baisse', hausse: 'hausse', 'stabilité': 'stabilite' };

When('je consulte la tendance de la semaine', async function () {
  this.reponse = await this.api.get('/api/tendance');
  assert.equal(this.reponse.status, 200);
  this.tendance = this.reponse.body;
});

Then('la catégorie qui varie le plus est {string} avec une variation de {int} %', function (nom, variation) {
  assert.equal(this.tendance.disponible, true);
  assert.equal(this.tendance.categorie.nom, nom);
  assert.equal(this.tendance.categorie.variation, variation);
});

Then('la variation générale est de {int} %', function (variation) {
  assert.equal(this.tendance.disponible, true);
  assert.equal(this.tendance.variation, variation);
});

Then('la tendance générale est {string}', function (sens) {
  assert.ok(sens in SENS, `Sens inconnu : ${sens}`);
  assert.equal(this.tendance.sens, SENS[sens]);
});

Then('la courbe de la semaine compte {int} points, de {int} à {int}', function (nombre, debut, fin) {
  assert.equal(this.tendance.serie.length, nombre);
  assert.equal(this.tendance.serie[0], debut);
  assert.equal(this.tendance.serie.at(-1), fin);
});

Then("aucune tendance n'est disponible", function () {
  assert.deepEqual(this.tendance, { disponible: false });
});
