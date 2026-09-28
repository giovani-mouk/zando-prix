// =============================================================
// Feature 18 : registre public des propositions et confirmations
// (écran « Suivi des propositions » de la maquette du PM)
// =============================================================
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { LIBELLES_STATUT, memesLignes } from '../../support/outils.js';

// Rôles et constats tels qu'écrits dans la feature -> valeurs de l'API
const ROLES = { acheteur: 'acheteur', 'commerçant': 'commercant', visiteur: 'visiteur' };
const CONSTATS = { identique: true, 'différent': false };

// « #PROP-0001 » -> 1
function idDepuisReference(reference) {
  const id = Number(reference.replace(/^#PROP-/, ''));
  assert.ok(Number.isInteger(id) && id > 0, `Référence invalide : ${reference}`);
  return id;
}

async function consulter(world) {
  world.reponse = await world.api.get('/api/registre');
  assert.equal(world.reponse.status, 200, JSON.stringify(world.reponse.body));
  world.registre = world.reponse.body;
}

function ligneDuRegistre(world, reference) {
  const ligne = world.registre.propositions.find((p) => p.reference === reference);
  assert.ok(ligne, `${reference} absente du registre`);
  return ligne;
}

function confirmer(world, reference, corps) {
  return world.api.post(`/api/propositions/${idDepuisReference(reference)}/confirmations`).send(corps);
}

// ---------------------------------------------------------------
// Registre
// ---------------------------------------------------------------

When('je consulte le registre des propositions', function () {
  return consulter(this);
});

Then('je vois les propositions suivantes dans le registre :', function (table) {
  const actuel = this.registre.propositions.map((p) => ({
    'référence': p.reference,
    produit: p.produit.nom,
    'marché': p.marche.nom,
    prix: String(p.montant),
    statut: LIBELLES_STATUT[p.statut],
  }));
  memesLignes(actuel, table.hashes());
});

Then('le registre ne contient ni {string} ni {string}', function (a, b) {
  const texte = JSON.stringify(this.registre);
  assert.ok(!texte.includes(a), `« ${a} » apparaît dans le registre`);
  assert.ok(!texte.includes(b), `« ${b} » apparaît dans le registre`);
});

Then('la proposition {string} a un prix précédent de {int} et un écart de {int}', function (reference, prix, ecart) {
  const ligne = ligneDuRegistre(this, reference);
  assert.equal(ligne.prix_affiche, prix);
  assert.equal(ligne.ecart, ecart);
});

Then('le registre compte {int} propositions ce mois-ci, dont {int} en attente et {int} validée', function (mois, attente, validee) {
  assert.equal(this.registre.statistiques.mois, mois);
  assert.equal(this.registre.compteurs.en_attente, attente);
  assert.equal(this.registre.compteurs.validee, validee);
});

// ---------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------

When('je télécharge le registre au format CSV', async function () {
  this.reponse = await this.api.get('/api/registre.csv').buffer(true).parse((res, fin) => {
    let texte = '';
    res.setEncoding('utf8');
    res.on('data', (morceau) => { texte += morceau; });
    res.on('end', () => fin(null, texte));
  });
  assert.equal(this.reponse.status, 200);
  assert.match(this.reponse.headers['content-type'], /text\/csv/);
  this.csv = this.reponse.body.replace(/^\uFEFF/, '');
});

Then('je reçois un fichier CSV de {int} lignes, en-tête compris', function (nombre) {
  const lignes = this.csv.split(/\r\n/).filter((l) => l !== '');
  assert.equal(lignes.length, nombre);
});

Then('le fichier ne contient ni {string} ni {string}', function (a, b) {
  assert.ok(!this.csv.includes(a), `« ${a} » apparaît dans le fichier`);
  assert.ok(!this.csv.includes(b), `« ${b} » apparaît dans le fichier`);
});

// ---------------------------------------------------------------
// Confirmations (ouvertes à tous)
// ---------------------------------------------------------------

When('je confirme la proposition {string} comme {string} avec le prix {string}', async function (reference, role, constat) {
  assert.ok(role in ROLES && constat in CONSTATS, `Rôle ou constat inconnu : ${role}, ${constat}`);
  this.reponse = await confirmer(this, reference, { role: ROLES[role], conforme: CONSTATS[constat] });
});

When('je confirme la proposition {string} avec :', async function (reference, table) {
  const [ligne] = table.hashes();
  this.reponse = await confirmer(this, reference, {
    role: ROLES[ligne['rôle']] ?? (ligne['rôle'] || undefined),
    conforme: ligne.prix === '' ? undefined : CONSTATS[ligne.prix],
    commentaire: ligne.commentaire || undefined,
  });
});

Given("j'ai déjà confirmé la proposition {string}", async function (reference) {
  const reponse = await confirmer(this, reference, { role: 'acheteur', conforme: true });
  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
});

Then('ma confirmation est enregistrée', function () {
  assert.equal(this.reponse.status, 201, JSON.stringify(this.reponse.body));
});

Then('ma confirmation est refusée', function () {
  assert.equal(this.reponse.status, 400, JSON.stringify(this.reponse.body));
});

Then('la proposition {string} compte {int} confirmation(s) identique(s) et {int} avec un écart', async function (reference, identiques, ecarts) {
  await consulter(this);
  const { confirmations } = ligneDuRegistre(this, reference);
  assert.equal(confirmations.identiques, identiques);
  assert.equal(confirmations.total - confirmations.identiques, ecarts);
});
