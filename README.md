# Zando Prix

Comparateur de prix des produits de base entre plusieurs marchés : où acheter moins cher aujourd'hui, avec la date de chaque relevé.

**Stack :** HTML, CSS et JavaScript côté front ; Node.js, Express 5 et PostgreSQL côté back ; spécifications en Gherkin, testées avec Cucumber JS et Supertest ; déploiement sur Render (service web Node.js et base PostgreSQL). Icônes Font Awesome et graphiques Chart.js chargés depuis cdnjs.

## Démarrage rapide

Prérequis : Node.js 20 ou plus, PostgreSQL 14 ou plus, et deux bases en UTF-8, `zando_prix` et `zando_prix_test`. Pour une première installation détaillée, suivez le [guide de mise en place](docs/guide-mise-en-place.md).

```bash
npm install
cp .env.example .env        # puis renseignez votre mot de passe PostgreSQL
npm run db:reset            # crée les tables et charge les données de démo
npm test                    # lance tous les scénarios d'API
npm run admin:creer         # crée votre compte pour l'espace administrateur
npm run dev                 # http://localhost:3000
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement, redémarre à chaque modification |
| `npm start` | Serveur sans redémarrage automatique |
| `npm test` | Tous les scénarios d'API sur la base de test |
| `npm run test:dry` | Contrôle des fichiers `.feature` sans base de données |
| `npm run test:a-valider` | Uniquement les scénarios qui reposent sur une hypothèse |
| `npm run db:reset` | Recrée les tables et recharge les données de démo |
| `npm run db:schema` | Recrée les tables, vides |
| `npm run db:seed` | Recharge les données de démo (garde les comptes administrateurs) |
| `npm run cdn:integrite` | Calcule les empreintes SRI des fichiers chargés depuis cdnjs |
| `npm run admin:creer` | Crée un compte administrateur (questions posées une à une) |
| `npm run admin:lister` | Liste les comptes et leur dernière connexion |
| `npm run admin:mot-de-passe -- <e-mail>` | Change un mot de passe et ferme les sessions du compte |
| `npm run admin:desactiver -- <e-mail>` | Bloque un compte sans effacer son historique |
| `npm run admin:reactiver -- <e-mail>` | Débloque un compte |

Les commandes `db:*` refusent de toucher une base distante sans l'option `-- --confirmer`, car elles effacent les données.

## Organisation

| Dossier | Contenu |
|---|---|
| `db/` | Schéma PostgreSQL et données de démo |
| `src/` | API Express : une route par ressource dans `src/routes/` |
| `public/` | Front-end (pages, styles, scripts, illustrations), servi par Express |
| `features/` | Spécifications Gherkin et step definitions |
| `scripts/` | Scripts de gestion de la base et des comptes administrateurs |
| `docs/` | Contrat d'API, guides et captures |

Le contrat entre le front, l'API et les tests est décrit dans [docs/contrat-api.md](docs/contrat-api.md).

### Lire le code

Chaque fichier commence par un en-tête qui explique son rôle, et les notions importantes sont commentées là où elles servent (transactions SQL, sessions, protection XSS, accessibilité…). Pour une lecture dans l'ordre, suivez les étapes du [guide](docs/guide-mise-en-place.md) : squelette, base de données, spécifications, tests, backend, front-end, déploiement.

Deux fichiers ne peuvent pas contenir de commentaires, car le format JSON ne les autorise pas :

- `package.json` décrit le projet, ses commandes (`scripts`) et ses dépendances. `dependencies` sont nécessaires en production, `devDependencies` seulement pour développer et tester. Le `^` devant une version autorise les mises à jour mineures, jamais une nouvelle version majeure.


## Hypothèses à valider avec le PM

Les scénarios tagués `@a-valider` reposent sur des choix pris pendant le sprint, en l'absence de règle dans le cadrage :

- un prix relevé il y a exactement 7 jours est affiché en orange ;
- en cas d'égalité, tous les marchés au prix le plus bas sont marqués « meilleur prix » ;
- un prix dans une autre unité que l'unité de référence est affiché mais exclu de la comparaison (RM05) ;
- le meilleur prix se calcule sur tous les marchés, même quand un marché est filtré ;
- la recherche ignore les accents ;
- hors cadrage : filtre par catégorie, photos des produits et carrousel de l'accueil ;
- pages À propos et Contact : textes provisoires, formulaire de contact limité à 5 messages par heure et par connexion ;
- espace administrateur : session de 8 heures, blocage de 15 minutes après 5 échecs de connexion, auteur d'une proposition non modifiable, valeur d'origine non conservée après une correction.

## Espace administrateur

`/admin.html` est un tableau de bord réservé aux comptes créés avec `npm run admin:creer` : barre latérale avec l'état de connexion, vue Propositions (corriger, publier, supprimer) et vue Messages (messages de la page Contact).

 La protection est assurée par l'API : sans session valide, les routes de gestion répondent `401` et ne renvoient aucune donnée. Mots de passe hachés avec scrypt, sessions stockées en base (elles survivent aux redémarrages du serveur), cookie `HttpOnly` et `SameSite=Strict`. Détails dans [docs/contrat-api.md](docs/contrat-api.md).

## Déploiement

Sur Render, avec `render.yaml` : voir la partie 4 du [guide de mise en place](docs/guide-mise-en-place.md). Au premier démarrage sur une base vide, le serveur crée les tables, les données de démonstration et le premier compte administrateur (`src/amorcage.js`).

## Bibliothèques chargées depuis cdnjs

- **Font Awesome 6** : icônes, purement décoratives. La feuille est chargée sans bloquer l'affichage ; sans elle, le texte suffit.
- **Chart.js 4** : graphique de comparaison des prix d'un produit. Téléchargé seulement au premier clic sur un bouton « graphique » ; si le CDN ne répond pas, un message l'explique et les prix restent affichés.

`npm run cdn:integrite` calcule l'empreinte SRI de chaque fichier et l'écrit dans les pages : le navigateur refusera un fichier modifié sur le CDN. À lancer une fois (connexion Internet nécessaire), puis après chaque changement de version.

## Auteur
Giovani MOUKOKO Akieniacademy

## Illustrations

Les 24 produits et les 4 diapositives du carrousel ont des illustrations vectorielles (`public/images/**/*.svg`), légères et nettes sur tous les écrans. Pour les remplacer par des photos, voir [docs/photos-produits.md](docs/photos-produits.md).
