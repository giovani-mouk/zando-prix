// =============================================================
// Feature 21 : export et impression du registre
// =============================================================
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';

async function exporter(world, params) {
  world.reponse = await world.api.get('/api/registre').query({ tout: '1', ...params });
}

When("j'exporte le registre des prix constatés depuis {int} jours", async function (jours) {
  await exporter(this, { depuis: await this.dateIlYA(jours) });
});

When("j'exporte tout le registre", async function () {
  await exporter(this, {});
});

When("j'exporte le registre depuis la date {string}", async function (date) {
  await exporter(this, { depuis: date });
});

When('je télécharge au format CSV le registre des prix constatés depuis {int} jours', async function (jours) {
  this.reponse = await this.api.get('/api/registre.csv').query({ depuis: await this.dateIlYA(jours) })
    .buffer(true).parse((res, fin) => {
      let texte = '';
      res.setEncoding('utf8');
      res.on('data', (morceau) => { texte += morceau; });
      res.on('end', () => fin(null, texte));
    });
  assert.equal(this.reponse.status, 200);
  this.csv = this.reponse.body.replace(/^\uFEFF/, '');
});

Given('{int} propositions en attente ont été reçues pour le {string} au {string}', async function (nombre, produit, marche) {
  for (let i = 0; i < nombre; i += 1) {
    await this.db.query(
      `INSERT INTO propositions (produit_id, marche_id, montant, unite, date_constat)
       VALUES ($1, $2, $3, 'kg', CURRENT_DATE)`,
      [this.idProduit(produit), this.idMarche(marche), 700 + i],
    );
  }
});

Then('l\'export contient {int} proposition(s)', function (nombre) {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  assert.equal(this.reponse.body.total, nombre);
  assert.equal(this.reponse.body.propositions.length, nombre);
});

Then('la proposition du {string} indique le type de constatation {string}', function (marche, constat) {
  const ligne = this.reponse.body.propositions.find((p) => p.marche.nom === marche);
  assert.ok(ligne, `Aucune proposition pour ${marche}`);
  assert.equal(ligne.constat, constat);
  assert.ok(!('repere' in ligne) && !('auteur' in ligne), 'Le repère ou l\'auteur apparaît dans le registre public');
});

Then("l'export est refusé", function () {
  assert.equal(this.reponse.status, 400);
});
