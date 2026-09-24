// =============================================================
// features/support/world.js : le « World » de Cucumber
//
// Pour chaque scénario, Cucumber crée un objet World tout neuf. Dans les
// step definitions, « this » désigne ce World : c'est la mémoire du
// scénario en cours (identifiants créés, dernière réponse HTTP, filtres…).
// Une étape « Quand » y range la réponse, l'étape « Alors » suivante la lit.
//
// Attention : c'est pour cela que les step definitions utilisent
// « async function () {} » et jamais une fonction fléchée « () => {} »,
// qui n'aurait pas accès à ce « this ».
// =============================================================
import assert from 'node:assert/strict';
import { setWorldConstructor, World } from '@cucumber/cucumber';
import request from 'supertest';
import { contexte } from './contexte.js';

// Identifiant envoyé pour un produit ou un marché qui n'existe pas
// (sert aux scénarios « produit inconnu » : l'API doit répondre par une erreur)
export const ID_INCONNU = 999999;

class ZandoWorld extends World {
  constructor(options) {
    super(options);
    this.ids = {
      produits: new Map(),      // nom -> id
      marches: new Map(),       // nom -> id
      propositions: new Map(),  // "produit|marché" -> id
    };
    this.dates = new Map();     // "produit|marché" -> date du dernier relevé
    this.filtres = {};          // { produit_id, marche_id, categorie }
    this.reponse = null;        // dernière réponse HTTP
    this.lignes = [];           // lignes de prix affichées
    this.produitsTrouves = [];  // noms renvoyés par la recherche
    this.propositionCourante = null;
    this.motsDePasse = new Map(); // e-mail -> mot de passe des administrateurs créés
    this.navigateur = null;
  }

  // Comme un navigateur : garde le cookie de session d'une requête à l'autre,
  // pendant tout le scénario.
  get api() {
    this.navigateur ??= request.agent(contexte.app);
    return this.navigateur;
  }

  // Oublie les cookies : comme un nouveau navigateur, jamais connecté
  oublierCookies() {
    this.navigateur = null;
  }

  get db() {
    return contexte.pool;
  }

  idProduit(nom) {
    return this.ids.produits.get(nom) ?? ID_INCONNU;
  }

  idMarche(nom) {
    return this.ids.marches.get(nom) ?? ID_INCONNU;
  }

  // Date "il y a N jours" calculée par PostgreSQL, pour rester
  // cohérent avec CURRENT_DATE côté base.
  async dateIlYA(jours) {
    const { rows } = await this.db.query(
      'SELECT (CURRENT_DATE - $1::int)::text AS d',
      [jours],
    );
    return rows[0].d;
  }

  // Recharge les prix avec les filtres courants, comme le ferait la page
  async chargerPrix() {
    const query = {};
    if (this.filtres.produit_id !== undefined) query.produit_id = this.filtres.produit_id;
    if (this.filtres.marche_id !== undefined) query.marche_id = this.filtres.marche_id;
    if (this.filtres.categorie !== undefined) query.categorie = this.filtres.categorie;
    this.reponse = await this.api.get('/api/prix').query(query);
    this.lignes = this.reponse.status === 200 ? this.reponse.body : [];
  }

  // Ligne actuellement affichée pour un couple produit / marché
  ligne(produit, marche) {
    const ligne = this.lignes.find((l) => l.produit === produit && l.marche === marche);
    assert.ok(ligne, `Aucune ligne affichée pour ${produit} au ${marche}`);
    return ligne;
  }

  // Interroge l'API directement, sans toucher aux filtres courants
  async prixActuel(produit, marche) {
    const reponse = await this.api
      .get('/api/prix')
      .query({ produit_id: this.idProduit(produit), marche_id: this.idMarche(marche) });
    assert.equal(reponse.status, 200);
    assert.equal(reponse.body.length, 1);
    return reponse.body[0];
  }
}

setWorldConstructor(ZandoWorld);
