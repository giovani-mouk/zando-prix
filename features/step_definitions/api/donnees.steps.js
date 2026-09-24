// =============================================================
// Étapes "Étant donné" : préparation des données directement en base
//
// Une step definition associe une phrase Gherkin à une fonction :
//   Given('les marchés suivants :', async function (table) { ... })
// Le texte doit correspondre exactement à celui de la feature (le mot-clé
// Étant donné / Quand / Alors, lui, n'est pas pris en compte).
//
// Pourquoi écrire directement en base plutôt que passer par l'API ?
// Parce que l'API n'a pas de route pour créer un marché ou un prix
// officiel, et parce que la préparation doit être rapide et fiable :
// seul le « Quand » doit passer par l'API, c'est lui qu'on teste.
// =============================================================
import assert from 'node:assert/strict';
import { Given } from '@cucumber/cucumber';
import { STATUTS, cle } from '../../support/outils.js';

// « table » est le tableau Gherkin qui suit la phrase. table.hashes()
// le transforme en objets : [{ 'marché': 'Marché Total' }, ...], les
// en-têtes de colonnes devenant les noms des propriétés.
Given('les marchés suivants :', async function (table) {
  for (const { 'marché': nom } of table.hashes()) {
    const { rows } = await this.db.query(
      'INSERT INTO marches (nom, ville) VALUES ($1, $2) RETURNING id',
      [nom, 'Brazzaville'],
    );
    // On retient l'identifiant créé par la base : les étapes suivantes
    // parlent de « Marché Total », l'API attend un numéro.
    this.ids.marches.set(nom, rows[0].id);
  }
});

// Colonnes "catégorie" et "photo" facultatives : absentes ou vides -> NULL
Given('les produits suivants :', async function (table) {
  for (const ligne of table.hashes()) {
    const { rows } = await this.db.query(
      `INSERT INTO produits (nom, unite_reference, categorie, image)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [ligne.produit, ligne['unité de référence'], ligne['catégorie'] || null, ligne.photo || null],
    );
    this.ids.produits.set(ligne.produit, rows[0].id);
  }
});

Given('les prix relevés suivants :', async function (table) {
  for (const ligne of table.hashes()) {
    const { rows } = await this.db.query(
      `INSERT INTO prix (produit_id, marche_id, montant, unite, date_releve)
       VALUES ($1, $2, $3, $4, CURRENT_DATE - $5::int)
       RETURNING date_releve`,
      [
        this.idProduit(ligne.produit),
        this.idMarche(ligne['marché']),
        Number(ligne.prix),
        ligne['unité'],
        Number(ligne['relevé il y a (jours)']),
      ],
    );

    // On retient la date du relevé le plus récent de chaque couple
    const k = cle(ligne.produit, ligne['marché']);
    const date = rows[0].date_releve;
    if (!this.dates.has(k) || date > this.dates.get(k)) {
      this.dates.set(k, date);
    }
  }
});

Given('les propositions suivantes :', async function (table) {
  for (const ligne of table.hashes()) {
    const statut = STATUTS[ligne.statut];
    assert.ok(statut, `Statut inconnu : ${ligne.statut}`);

    const produitId = this.idProduit(ligne.produit);
    const marcheId = this.idMarche(ligne['marché']);

    const { rows } = await this.db.query(
      `INSERT INTO propositions
         (produit_id, marche_id, montant, unite, date_constat, statut, traitee_le)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6)
       RETURNING id`,
      [
        produitId,
        marcheId,
        Number(ligne.prix),
        ligne['unité'],
        statut,
        statut === 'en_attente' ? null : new Date(),
      ],
    );
    const id = rows[0].id;
    this.ids.propositions.set(cle(ligne.produit, ligne['marché']), id);

    // Une proposition validée a déjà donné lieu à un prix (RM06)
    if (statut === 'validee') {
      await this.db.query(
        `INSERT INTO prix
           (produit_id, marche_id, montant, unite, date_releve, source, proposition_id)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, 'proposition', $5)`,
        [produitId, marcheId, Number(ligne.prix), ligne['unité'], id],
      );
    }
  }
});

Given("aucun prix n'est enregistré", async function () {
  // La base est vidée avant chaque scénario : on vérifie simplement.
  const { rows } = await this.db.query('SELECT COUNT(*)::int AS n FROM prix');
  assert.equal(rows[0].n, 0);
});
