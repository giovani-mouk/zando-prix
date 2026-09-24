// =============================================================
// Stories 7 et 8 : proposer un prix, suivre les propositions (RM06)
// Features 12 et 13 : gestion des propositions par un administrateur
//
// Ces étapes passent par l'API avec this.api (world.js), qui garde le
// cookie de session comme un navigateur : après « je suis connecté… »,
// toutes les requêtes suivantes du scénario sont authentifiées.
// Les vérifications lisent parfois directement la base (this.db) pour
// s'assurer que l'effet est réel, et pas seulement annoncé par l'API.
// =============================================================
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { CHAMPS, LIBELLES_STATUT, STATUTS, cle, memesLignes } from '../../support/outils.js';

// Convertit une cellule comme le ferait un formulaire :
// vide -> champ absent, nombre -> Number, sinon texte brut ("abc")
const valeurSaisie = (cellule) => {
  if (cellule === '') return undefined;
  const nombre = Number(cellule);
  return Number.isNaN(nombre) ? cellule : nombre;
};

// ---------------------------------------------------------------
// Story 7 : proposer un prix
// ---------------------------------------------------------------

When('je propose le prix suivant :', async function (table) {
  const [l] = table.hashes();
  const corps = {
    produit_id: l.produit === '' ? undefined : this.idProduit(l.produit),
    marche_id: l['marché'] === '' ? undefined : this.idMarche(l['marché']),
    montant: valeurSaisie(l.prix),
    unite: l['unité'] || undefined,
    date_constat: await this.dateIlYA(Number(l['constaté il y a (jours)'])),
    auteur: l.auteur || undefined,
  };
  this.reponse = await this.api.post('/api/propositions').send(corps);
});

Then('ma proposition est enregistrée avec le statut {string}', async function (statut) {
  assert.equal(this.reponse.status, 201);
  const { proposition } = this.reponse.body;
  assert.equal(proposition?.statut, STATUTS[statut]);

  const { rows } = await this.db.query(
    'SELECT statut FROM propositions WHERE id = $1',
    [proposition.id],
  );
  assert.equal(rows[0]?.statut, STATUTS[statut]);
});

Then("on me confirme que ma proposition sera vérifiée avant d'être publiée", function () {
  assert.equal(this.reponse.status, 201);
  assert.equal(this.reponse.body.proposition?.statut, 'en_attente');
  assert.equal(typeof this.reponse.body.message, 'string');
  assert.ok(this.reponse.body.message.length > 0);
});

Then('ma proposition est refusée', function () {
  assert.equal(this.reponse.status, 400);
});

Then("on m'indique que le champ {string} est invalide", function (champ) {
  assert.ok(champ in CHAMPS, `Champ inconnu : ${champ}`);
  assert.equal(this.reponse.body.erreur?.champ, CHAMPS[champ]);
});

Then("aucune proposition n'est enregistrée", async function () {
  const { rows } = await this.db.query('SELECT COUNT(*)::int AS n FROM propositions');
  assert.equal(rows[0].n, 0);
});

// ---------------------------------------------------------------
// Story 8 : suivre les propositions
// ---------------------------------------------------------------

When('je consulte les propositions', async function () {
  this.reponse = await this.api.get('/api/propositions');
});

When('je consulte les propositions {string}', async function (statut) {
  assert.ok(statut in STATUTS, `Statut inconnu : ${statut}`);
  this.reponse = await this.api.get('/api/propositions').query({ statut: STATUTS[statut] });
});

Then('je vois les propositions suivantes :', function (table) {
  assert.equal(this.reponse.status, 200);
  const actuel = this.reponse.body.map((p) => ({
    produit: p.produit,
    'marché': p.marche,
    prix: String(p.montant),
    statut: LIBELLES_STATUT[p.statut],
  }));
  memesLignes(actuel, table.hashes());
});

function idProposition(world, produit, marche) {
  const id = world.ids.propositions.get(cle(produit, marche));
  assert.ok(id, `Aucune proposition pour ${produit} au ${marche}`);
  world.propositionCourante = id;
  return id;
}

async function traiter(world, produit, marche, statut) {
  const id = idProposition(world, produit, marche);
  world.reponse = await world.api.patch(`/api/propositions/${id}`).send({ statut });
}

When('je valide la proposition de {string} au {string}', function (produit, marche) {
  return traiter(this, produit, marche, 'validee');
});

When('je rejette la proposition de {string} au {string}', function (produit, marche) {
  return traiter(this, produit, marche, 'rejetee');
});

// Vocabulaire de l'espace administrateur : publier = valider, supprimer = rejeter
When('je publie la proposition de {string} au {string}', function (produit, marche) {
  return traiter(this, produit, marche, 'validee');
});

When('je supprime la proposition de {string} au {string}', function (produit, marche) {
  return traiter(this, produit, marche, 'rejetee');
});

Given("j'ai supprimé la proposition de {string} au {string}", async function (produit, marche) {
  await traiter(this, produit, marche, 'rejetee');
  assert.equal(this.reponse.status, 200);
});

async function statutEnBase(world) {
  const { rows } = await world.db.query(
    'SELECT statut FROM propositions WHERE id = $1',
    [world.propositionCourante],
  );
  return rows[0]?.statut;
}

Then('le statut de cette proposition devient {string}', async function (statut) {
  assert.equal(this.reponse.status, 200);
  assert.equal(await statutEnBase(this), STATUTS[statut]);
});

Then('le statut de cette proposition reste {string}', async function (statut) {
  assert.equal(await statutEnBase(this), STATUTS[statut]);
});

Then("l'opération est refusée", function () {
  assert.equal(this.reponse.status, 409);
});

Then('le prix de {string} au {string} est de {int}', async function (produit, marche, montant) {
  const ligne = await this.prixActuel(produit, marche);
  assert.ok(ligne.disponible, `Aucun prix pour ${produit} au ${marche}`);
  assert.equal(ligne.montant, montant);
});

Then(
  "le prix de {string} au {string} est indiqué comme provenant d'une proposition",
  async function (produit, marche) {
    const ligne = await this.prixActuel(produit, marche);
    assert.equal(ligne.source, 'proposition');
  },
);

// ---------------------------------------------------------------
// Feature 13 : corriger une proposition avant publication
// ---------------------------------------------------------------

// Valeurs actuelles de la proposition, au format attendu par PUT :
// c'est ce que le formulaire de correction affiche au départ.
async function valeursActuelles(world, id) {
  const { rows } = await world.db.query(
    `SELECT produit_id, marche_id, montant, unite, date_constat::text AS date_constat
     FROM propositions WHERE id = $1`,
    [id],
  );
  assert.ok(rows[0], `Proposition ${id} introuvable en base`);
  return { ...rows[0] };
}

When(
  'je corrige la proposition de {string} au {string} avec :',
  async function (produit, marche, table) {
    const id = idProposition(this, produit, marche);
    const corps = await valeursActuelles(this, id);

    const [modifications] = table.hashes();
    for (const [colonne, cellule] of Object.entries(modifications)) {
      switch (colonne) {
        case 'prix': corps.montant = valeurSaisie(cellule); break;
        case 'unité': corps.unite = cellule; break;
        case 'marché': corps.marche_id = this.idMarche(cellule); break;
        case 'produit': corps.produit_id = this.idProduit(cellule); break;
        case 'constaté il y a (jours)': corps.date_constat = await this.dateIlYA(Number(cellule)); break;
        case 'auteur': corps.auteur = cellule; break;
        default: throw new Error(`Colonne inconnue : ${colonne}`);
      }
    }

    this.reponse = await this.api.put(`/api/propositions/${id}`).send(corps);
  },
);

Then('ma correction est refusée', function () {
  assert.equal(this.reponse.status, 400);
});

Then("on m'indique que le champ {string} ne peut pas être modifié", function (champ) {
  assert.ok(champ in CHAMPS, `Champ inconnu : ${champ}`);
  assert.equal(this.reponse.status, 400);
  assert.equal(this.reponse.body.erreur?.champ, CHAMPS[champ]);
});

// Lu directement en base, par nom : le marché a pu être corrigé entre-temps
Then(
  'la proposition de {string} au {string} est toujours {string} avec un prix de {int}',
  async function (produit, marche, statut, montant) {
    assert.ok(statut in STATUTS, `Statut inconnu : ${statut}`);
    const { rows } = await this.db.query(
      `SELECT p.statut, p.montant
       FROM propositions p
       JOIN produits pr ON pr.id = p.produit_id
       JOIN marches  m  ON m.id  = p.marche_id
       WHERE pr.nom = $1 AND m.nom = $2`,
      [produit, marche],
    );
    assert.equal(rows.length, 1, `Propositions trouvées pour ${produit} au ${marche} : ${rows.length}`);
    assert.equal(rows[0].statut, STATUTS[statut]);
    assert.equal(rows[0].montant, montant);
  },
);

Then('je la retrouve parmi les propositions {string}', async function (statut) {
  assert.ok(statut in STATUTS, `Statut inconnu : ${statut}`);
  const reponse = await this.api.get('/api/propositions').query({ statut: STATUTS[statut] });
  assert.equal(reponse.status, 200);
  assert.ok(reponse.body.some((p) => p.id === this.propositionCourante));
});

// Traçabilité : quel champ de l'API porte le nom, et quel statut attendre
const TRACES = {
  'publiée': { champ: 'traitee_par', statut: 'validee' },
  'supprimée': { champ: 'traitee_par', statut: 'rejetee' },
  'corrigée': { champ: 'corrigee_par', statut: 'en_attente' },
};

Then("cette proposition indique qu'elle a été {word} par {string}", async function (action, nom) {
  const trace = TRACES[action];
  assert.ok(trace, `Action inconnue : ${action}`);
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));

  const reponse = await this.api.get('/api/propositions');
  assert.equal(reponse.status, 200);
  const proposition = reponse.body.find((p) => p.id === this.propositionCourante);
  assert.ok(proposition, 'Proposition absente de la liste');
  assert.equal(proposition.statut, trace.statut);
  assert.equal(proposition[trace.champ], nom);
});

// ---------------------------------------------------------------
// Feature 12 : sans connexion, chaque action de gestion est refusée
// ---------------------------------------------------------------

When("j'essaie de {word} la proposition de {string} au {string}", async function (action, produit, marche) {
  const id = idProposition(this, produit, marche);
  switch (action) {
    case 'consulter':
      this.reponse = await this.api.get('/api/propositions');
      break;
    case 'publier':
      this.reponse = await this.api.patch(`/api/propositions/${id}`).send({ statut: 'validee' });
      break;
    case 'supprimer':
      this.reponse = await this.api.patch(`/api/propositions/${id}`).send({ statut: 'rejetee' });
      break;
    case 'corriger':
      this.reponse = await this.api
        .put(`/api/propositions/${id}`)
        .send({ ...(await valeursActuelles(this, id)), montant: 999 });
      break;
    default:
      throw new Error(`Action inconnue : ${action}`);
  }
});
