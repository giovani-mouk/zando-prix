// =============================================================
// Feature 22 : confirmer un prix affiché
// =============================================================
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';

// Numéro du relevé de ce montant pour ce produit et ce marché
async function idPrix(world, montant, produit, marche) {
  const { rows } = await world.db.query(
    'SELECT id FROM prix WHERE produit_id = $1 AND marche_id = $2 AND montant = $3',
    [world.idProduit(produit), world.idMarche(marche), montant],
  );
  assert.ok(rows[0], `Aucun prix de ${montant} pour ${produit} au ${marche}`);
  return rows[0].id;
}

async function repondre(world, id, corps) {
  world.reponse = await world.api.post(`/api/prix/${id}/confirmations`).send(corps);
}

When('je réponds que le prix de {int} FCFA du {string} au {string} est toujours le même', async function (montant, produit, marche) {
  await repondre(this, await idPrix(this, montant, produit, marche), { conforme: true });
});

When('je réponds que le prix de {int} FCFA du {string} au {string} a changé', async function (montant, produit, marche) {
  await repondre(this, await idPrix(this, montant, produit, marche), { conforme: false });
});

Given("j'ai déjà répondu pour le prix de {int} FCFA du {string} au {string}", async function (montant, produit, marche) {
  await repondre(this, await idPrix(this, montant, produit, marche), { conforme: true });
  assert.equal(this.reponse.status, 201, JSON.stringify(this.reponse.body));
});

When("j'envoie une réponse sans avis pour le prix de {int} FCFA du {string} au {string}", async function (montant, produit, marche) {
  await repondre(this, await idPrix(this, montant, produit, marche), {});
});

When('je réponds pour le prix numéro {int}', async function (id) {
  await repondre(this, id, { conforme: true });
});

Then('ma réponse est enregistrée', function () {
  assert.equal(this.reponse.status, 201, JSON.stringify(this.reponse.body));
});

Then('ma réponse est refusée', function () {
  assert.equal(this.reponse.status, 400, JSON.stringify(this.reponse.body));
});

Then('le prix est introuvable', function () {
  assert.equal(this.reponse.status, 404);
});

async function lignePrix(world, produit, marche) {
  const reponse = await world.api.get('/api/prix').query({ produit_id: world.idProduit(produit) });
  assert.equal(reponse.status, 200);
  const ligne = reponse.body.find((l) => l.marche === marche);
  assert.ok(ligne, `Aucune ligne pour ${marche}`);
  return ligne;
}

Then('le prix du {string} au {string} compte {int} confirmation(s) et {int} signalement(s)', async function (produit, marche, confirmations, signalements) {
  const ligne = await lignePrix(this, produit, marche);
  assert.equal(ligne.confirmations, confirmations);
  assert.equal(ligne.signalements, signalements);
});

Then('le prix affiché du {string} au {string} reste de {int}', async function (produit, marche, montant) {
  const ligne = await lignePrix(this, produit, marche);
  assert.equal(ligne.montant, montant);
});
