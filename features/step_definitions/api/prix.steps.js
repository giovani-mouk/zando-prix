// =============================================================
// Stories 1, 2, 3, 5 et 6 : consultation, filtres, meilleur prix, fraîcheur
//
// {string} et {int} dans les phrases sont des « expressions Cucumber » :
// "Riz" entre guillemets dans la feature devient le paramètre produit,
// un nombre devient un entier JavaScript.
// =============================================================
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { COULEURS, cle, memesLignes } from '../../support/outils.js';

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

When('je consulte les prix', async function () {
  this.filtres = {};
  await this.chargerPrix();
});

When('je choisis le produit {string}', async function (produit) {
  this.filtres.produit_id = this.idProduit(produit);
  await this.chargerPrix();
});

async function choisirMarche(world, marche) {
  world.filtres.marche_id = world.idMarche(marche);
  await world.chargerPrix();
}

When('je choisis le marché {string}', function (marche) {
  return choisirMarche(this, marche);
});

Given("j'ai choisi le marché {string}", function (marche) {
  return choisirMarche(this, marche);
});

When('je retire le filtre de marché', async function () {
  delete this.filtres.marche_id;
  await this.chargerPrix();
});

// ---------------------------------------------------------------
// Affichage des prix
// ---------------------------------------------------------------

Then('je vois les prix suivants :', function (table) {
  assert.equal(this.reponse.status, 200);
  const actuel = this.lignes
    .filter((l) => l.disponible)
    .map((l) => ({
      produit: l.produit,
      'marché': l.marche,
      prix: String(l.montant),
      'unité': l.unite,
    }));
  memesLignes(actuel, table.hashes());
});

Then('je vois pour chaque marché :', function (table) {
  assert.equal(this.reponse.status, 200);
  const actuel = this.lignes.map((l) => ({
    'marché': l.marche,
    prix: l.disponible ? String(l.montant) : 'non disponible',
    'unité': l.disponible ? l.unite : '',
  }));
  memesLignes(actuel, table.hashes());
});

Then('je ne vois aucun prix pour le produit {string}', function (produit) {
  const lignes = this.lignes.filter((l) => l.produit === produit);
  assert.equal(lignes.length, 0);
});

// ---------------------------------------------------------------
// Absence d'information (RM04) et erreurs
// ---------------------------------------------------------------

Then('le produit {string} est indiqué comme sans prix disponible', function (produit) {
  const lignes = this.lignes.filter((l) => l.produit === produit);
  assert.ok(lignes.length > 0, `Le produit ${produit} n'est pas affiché`);
  assert.ok(lignes.every((l) => !l.disponible));
});

Then("on m'indique qu'aucun prix n'est disponible pour le moment", function () {
  assert.equal(this.reponse.status, 200);
  assert.equal(this.lignes.filter((l) => l.disponible).length, 0);
});

Then("on m'indique qu'aucun prix n'est disponible pour le marché {string}", function (marche) {
  assert.equal(this.reponse.status, 200);
  assert.ok(this.lignes.every((l) => l.marche === marche));
  assert.equal(this.lignes.filter((l) => l.disponible).length, 0);
});

Then("on m'indique que le produit {string} n'existe pas", function (_produit) {
  assert.equal(this.reponse.status, 404);
  assert.equal(this.reponse.body.erreur?.champ, 'produit_id');
});

Then("on m'indique que le marché {string} n'existe pas", function (_marche) {
  assert.equal(this.reponse.status, 404);
  assert.equal(this.reponse.body.erreur?.champ, 'marche_id');
});

// ---------------------------------------------------------------
// Meilleur prix (RM02, RM05)
// ---------------------------------------------------------------

const marchesMeilleurPrix = (lignes, produit) =>
  lignes
    .filter((l) => l.produit === produit && l.est_meilleur_prix === true)
    .map((l) => l.marche)
    .sort();

Then('le meilleur prix pour {string} est uniquement au {string}', function (produit, marche) {
  assert.deepEqual(marchesMeilleurPrix(this.lignes, produit), [marche]);
});

Then('le meilleur prix pour {string} est aux marchés suivants :', function (produit, table) {
  const attendus = table.hashes().map((l) => l['marché']).sort();
  assert.deepEqual(marchesMeilleurPrix(this.lignes, produit), attendus);
});

Then("aucun meilleur prix n'est identifié pour {string}", function (produit) {
  assert.deepEqual(marchesMeilleurPrix(this.lignes, produit), []);
});

Then("le prix de {string} au {string} n'est pas identifié comme meilleur prix", function (produit, marche) {
  const ligne = this.ligne(produit, marche);
  assert.ok(ligne.disponible);
  assert.equal(ligne.est_meilleur_prix, false);
});

Then('le prix de {string} au {string} est indiqué comme non comparable', function (produit, marche) {
  assert.equal(this.ligne(produit, marche).comparable, false);
});

// ---------------------------------------------------------------
// Fraîcheur (RM03)
// ---------------------------------------------------------------

Then('le prix de {string} au {string} affiche sa date de relevé', function (produit, marche) {
  const attendue = this.dates.get(cle(produit, marche));
  assert.equal(this.ligne(produit, marche).date_releve, attendue);
});

Then(
  "l'indicateur de fraîcheur du prix de {string} au {string} est {string}",
  function (produit, marche, couleur) {
    assert.ok(couleur in COULEURS, `Couleur inconnue : ${couleur}`);
    assert.equal(this.ligne(produit, marche).fraicheur, COULEURS[couleur]);
  },
);
