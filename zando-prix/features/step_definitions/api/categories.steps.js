// =============================================================
// Hors cadrage (@a-valider) : filtre par catégorie et photos des produits
//
// Même motif que prix.steps.js : l'action met à jour this.filtres puis
// recharge les prix comme le ferait la page (this.chargerPrix, dans world.js).
// =============================================================
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';

// ---------------------------------------------------------------
// Filtre par catégorie
// ---------------------------------------------------------------

async function choisirCategorie(world, categorie) {
  world.filtres.categorie = categorie;
  await world.chargerPrix();
}

When('je choisis la catégorie {string}', function (categorie) {
  return choisirCategorie(this, categorie);
});

Given("j'ai choisi la catégorie {string}", function (categorie) {
  return choisirCategorie(this, categorie);
});

When('je retire le filtre de catégorie', async function () {
  delete this.filtres.categorie;
  await this.chargerPrix();
});

Then('le produit {string} est classé dans la catégorie {string}', function (produit, categorie) {
  const lignes = this.lignes.filter((l) => l.produit === produit);
  assert.ok(lignes.length > 0, `Le produit ${produit} n'est pas affiché`);
  assert.ok(lignes.every((l) => l.categorie === categorie));
});

Then("on m'indique que la catégorie {string} n'existe pas", function (_categorie) {
  assert.equal(this.reponse.status, 404);
  assert.equal(this.reponse.body.erreur?.champ, 'categorie');
});

// ---------------------------------------------------------------
// Photos des produits
// ---------------------------------------------------------------

When('je consulte la liste des produits', async function () {
  this.reponse = await this.api.get('/api/produits');
  assert.equal(this.reponse.status, 200);
});

function produitListe(world, nom) {
  const produit = world.reponse.body.find((p) => p.nom === nom);
  assert.ok(produit, `Le produit ${nom} n'est pas dans la liste`);
  return produit;
}

Then('le produit {string} est présenté avec la photo {string}', function (nom, photo) {
  assert.equal(produitListe(this, nom).image, photo);
});

Then('le produit {string} est présenté sans photo', function (nom) {
  assert.equal(produitListe(this, nom).image, null);
});
