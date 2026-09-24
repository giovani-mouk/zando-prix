# Zando Prix : contrat d'API

Ce contrat est la référence commune entre le backend, le front et les tests Cucumber.
Toute modification ici doit être répercutée dans `features/step_definitions/api/`.

## Conventions

Toutes les routes sont préfixées par `/api` et échangent du JSON. Les identifiants sont des entiers, les dates sont au format `AAAA-MM-JJ`, et les montants sont des entiers en FCFA.

Les erreurs ont toujours la même forme :

```json
{ "erreur": { "champ": "produit_id", "message": "Ce produit n'existe pas." } }
```

`champ` est présent quand l'erreur concerne un paramètre ou un champ précis. `message` est un texte affichable tel quel par le front.

| Code | Signification |
|---|---|
| 200 | Succès |
| 201 | Création réussie |
| 400 | Donnée invalide ou manquante |
| 401 | Non connecté, session expirée, identifiants incorrects |
| 403 | Requête de modification venant d'un autre site (en-tête `Origin` étranger) |
| 404 | Ressource introuvable (produit, marché ou proposition) |
| 409 | Action impossible dans l'état actuel (proposition déjà traitée) |
| 429 | Trop de tentatives de connexion échouées |

### Routes protégées

Les routes marquées 🔒 exigent d'être connecté à l'espace administrateur. Sans session valide, elles répondent `401` avec le message « Connectez-vous pour accéder à cet espace. » et ne modifient rien. Leurs réponses portent `Cache-Control: no-store`.

La session est un cookie `zp_session` (`HttpOnly`, `SameSite=Strict`, `Secure` en production) posé par `POST /api/admin/connexion`. Le front n'a rien à faire : le navigateur le renvoie tout seul sur les requêtes de même origine.

## Produits

### `GET /api/produits?q=texte`

Stories 1 et 4. Renvoie les produits triés par nom.

La recherche `q` est facultative. Elle ignore les espaces autour du texte, ne tient pas compte des majuscules et accepte un nom partiel. Une recherche vide renvoie tous les produits.

```json
[
  {
    "id": 1, "nom": "Riz", "categorie": "Céréales", "unite_reference": "kg",
    "image": "/images/produits/riz.webp"
  }
]
```

`image` vaut `null` quand le produit n'a pas de photo (hors cadrage, `@a-valider`).

Aucun résultat donne `200` avec un tableau vide.

## Marchés

### `GET /api/marches`

Renvoie les marchés triés par nom.

```json
[
  { "id": 1, "nom": "Marché Total", "ville": "Brazzaville - Bacongo" }
]
```

## Prix

### `GET /api/prix?produit_id=1&marche_id=2&categorie=Légumes`

Stories 1, 2, 3, 5 et 6. Renvoie la grille produits × marchés (vue `v_grille_prix`), avec une ligne par couple, y compris quand aucun prix n'existe (RM04). Les trois filtres sont facultatifs et combinables. Le filtre `categorie` est hors cadrage (`@a-valider`) et attend le nom exact de la catégorie.

```json
[
  {
    "produit_id": 1, "produit": "Riz", "categorie": "Céréales",
    "marche_id": 2, "marche": "Marché Poto-Poto",
    "disponible": true,
    "prix_id": 3, "montant": 700, "unite": "kg",
    "date_releve": "2026-09-22",
    "source": "officiel",
    "fraicheur": "recent",
    "comparable": true,
    "est_meilleur_prix": true
  },
  {
    "produit_id": 1, "produit": "Riz", "categorie": "Céréales",
    "marche_id": 3, "marche": "Marché Moungali",
    "disponible": false,
    "prix_id": null, "montant": null, "unite": null,
    "date_releve": null, "source": null, "fraicheur": null,
    "comparable": null, "est_meilleur_prix": null
  }
]
```

| Champ | Valeurs |
|---|---|
| `fraicheur` | `recent` (moins de 7 jours, vert) ou `ancien` (orange) |
| `source` | `officiel` ou `proposition` |
| `comparable` | `false` si l'unité diffère de l'unité de référence du produit (RM05) |
| `est_meilleur_prix` | calculé sur **tous** les marchés, même si un filtre de marché est appliqué |

Un produit, un marché ou une catégorie inexistants donnent `404` avec `champ` égal à `produit_id`, `marche_id` ou `categorie`.

## Propositions

### `POST /api/propositions`

Story 7. Corps de la requête :

```json
{
  "produit_id": 1,
  "marche_id": 4,
  "montant": 750,
  "unite": "kg",
  "date_constat": "2026-09-23",
  "auteur": "Patrick"
}
```

`auteur` est facultatif, tous les autres champs sont obligatoires. La réponse est `201` :

```json
{
  "proposition": { "id": 7, "statut": "en_attente", "...": "..." },
  "message": "Merci ! Votre proposition sera vérifiée avant d'être publiée."
}
```

En cas de refus, la réponse est `400`, et `champ` indique le premier champ en erreur :

| `champ` | Refusé quand |
|---|---|
| `produit_id` | absent ou produit inexistant |
| `marche_id` | absent ou marché inexistant |
| `montant` | absent, pas un nombre entier, ou inférieur ou égal à 0 |
| `unite` | absente ou hors de la liste autorisée |
| `date_constat` | absente, mal formée ou dans le futur |
| `auteur` | pas un texte, ou plus de 100 caractères |

Seule la création d'une proposition est publique. Toutes les autres routes de cette section sont 🔒.

### 🔒 `GET /api/propositions?statut=en_attente`

Story 8. Le filtre `statut` est facultatif (`en_attente`, `validee` ou `rejetee`) ; toute autre valeur donne `400` avec `champ` égal à `statut`. Les propositions sont triées de la plus récente à la plus ancienne.

```json
[
  {
    "id": 7, "produit_id": 1, "produit": "Riz",
    "marche_id": 4, "marche": "Marché Ouenzé",
    "montant": 750, "unite": "kg", "date_constat": "2026-09-23",
    "auteur": "Patrick", "statut": "en_attente",
    "created_at": "2026-09-23T10:12:00.000Z",
    "traitee_le": null, "traitee_par": null,
    "corrigee_le": "2026-09-24T08:02:00.000Z", "corrigee_par": "Grâce Mabiala"
  }
]
```

`traitee_par` et `corrigee_par` contiennent le **nom** de l'administrateur, jamais son identifiant ni son e-mail. `traitee_par` peut être `null` pour les propositions de démonstration de `seed.sql`.

### 🔒 `PATCH /api/propositions/:id`

Story 8 et feature 13. Corps de la requête : `{ "statut": "validee" }` pour **publier**, ou `{ "statut": "rejetee" }` pour **supprimer**. Une proposition supprimée n'est pas effacée : elle passe au statut `rejetee` et reste dans l'historique. L'administrateur connecté est enregistré dans `traitee_par`.

La validation crée, dans la même transaction, un prix avec `source = 'proposition'` et `date_releve = date_constat` (RM06).

La réponse est `200` avec `{ "proposition": {...}, "prix": {...} }`. Le champ `prix` est présent uniquement en cas de validation.

| Code | Cas |
|---|---|
| 400 | statut demandé invalide |
| 404 | proposition inexistante, ou identifiant non numérique |
| 409 | proposition déjà validée ou rejetée |

### 🔒 `PUT /api/propositions/:id`

Feature 13 : corriger une proposition **avant** publication. Le corps contient tous les champs modifiables, comme le formulaire de correction :

```json
{ "produit_id": 1, "marche_id": 4, "montant": 750, "unite": "kg", "date_constat": "2026-09-23" }
```

Les règles de validation sont celles de `POST /api/propositions`, avec les mêmes messages et les mêmes valeurs de `champ`. La correction ne publie pas : le statut reste `en_attente`. `corrigee_le` et `corrigee_par` sont mis à jour. La valeur d'origine n'est pas conservée (hypothèse `@a-valider`).

La réponse est `200` avec `{ "proposition": {...} }`.

| Code | Cas |
|---|---|
| 400 | champ invalide ; `auteur` ou `statut` présent dans le corps (non modifiables ici) |
| 404 | proposition inexistante |
| 409 | proposition déjà publiée ou supprimée |

## Messages

Feature 14 (hors cadrage, `@a-valider`) : formulaire de la page Contact.

### `POST /api/messages`

Public. Corps : `{ "nom": "Patrick", "email": "patrick@exemple.cg", "message": "Bonjour…" }`.

Réponse `201` : `{ "confirmation": "Merci ! Votre message a bien été envoyé…" }`.

| Code | Cas |
|---|---|
| 400 | `champ` = `nom` (vide ou plus de 100 caractères), `email` (invalide) ou `message` (vide ou plus de 2 000 caractères) |
| 429 | plus de 5 messages en une heure depuis la même connexion. En-tête `Retry-After: 3600`. |

Le champ `site_web` est un piège pour les robots : caché aux humains, il doit rester vide. S'il est rempli, l'API répond `201` comme d'habitude mais n'enregistre rien. L'adresse IP n'est jamais stockée : seule son empreinte SHA-256 l'est, et elle est effacée au bout de 24 heures.

### 🔒 `GET /api/messages`

Les non lus d'abord, puis du plus récent au plus ancien.

```json
[
  {
    "id": 3, "nom": "Patrick", "email": "patrick@exemple.cg",
    "message": "Bonjour…", "created_at": "2026-09-24T08:02:00.000Z",
    "lu": false, "lu_le": null, "lu_par": null
  }
]
```

### 🔒 `PATCH /api/messages/:id`

Corps : `{ "lu": true }` ou `{ "lu": false }`. Marquer comme lu enregistre le nom de l'administrateur dans `lu_par`. Réponse `200` : `{ "message": {...} }`. `400` si `lu` n'est pas un booléen, `404` si le message n'existe pas.

## Administration

Feature 12. Les comptes sont créés en ligne de commande (`npm run admin:creer`), jamais par l'API.

### `POST /api/admin/connexion`

Corps : `{ "email": "grace@zandoprix.cg", "mot_de_passe": "..." }`. L'e-mail ne tient pas compte des majuscules.

En cas de succès : `200` avec `{ "administrateur": { "id": 1, "nom": "Grâce Mabiala", "email": "grace@zandoprix.cg" } }`, et le cookie de session (valable 8 heures, hypothèse `@a-valider`).

| Code | Cas |
|---|---|
| 401 | e-mail inconnu, mot de passe faux, champ vide ou compte désactivé : toujours le message « E-mail ou mot de passe incorrect. » |
| 429 | 5 échecs en 15 minutes pour cet e-mail (hypothèse `@a-valider`), même si le mot de passe est juste. En-tête `Retry-After: 900`. |

Le blocage vaut pour n'importe quel e-mail saisi, qu'il corresponde à un compte ou non : sinon la différence de réponse révélerait quels comptes existent.

### `POST /api/admin/deconnexion`

Ferme la session en base et efface le cookie. Répond `204`, même sans session.

### 🔒 `GET /api/admin/moi`

`200` avec `{ "administrateur": { "id", "nom", "email" } }`. Utilisée par les pages pour savoir si l'on est connecté.
