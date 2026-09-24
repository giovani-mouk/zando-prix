# Guide de mise en place de Zando Prix

Ce guide va de l'installation des outils jusqu’au déploiement sur Render. Chaque étape se termine par une vérification : ne passez à la suivante que si elle réussit. En cas de blocage, la section « Dépannage » à la fin couvre les erreurs les plus courantes.

---

## Partie 1 : Installer les outils

### 1.1 Node.js

Téléchargez la version **LTS** sur [nodejs.org](https://nodejs.org) et installez-la avec les options par défaut.

Vérification, dans un nouveau terminal :

```bash
node --version    # doit afficher v20 ou plus
npm --version
```

### 1.2 Git

Téléchargez Git sur [git-scm.com](https://git-scm.com) et installez-le avec les options par défaut. Puis donnez-lui votre identité, une seule fois :

```bash
git config --global user.name "Votre Nom"
git config --global user.email "vous@exemple.com"
```

### 1.3 VS Code

Installez [VS Code](https://code.visualstudio.com), puis, dans l'onglet Extensions, l'extension officielle **Cucumber** : elle colore la syntaxe des fichiers `.feature`.

### 1.4 PostgreSQL

La version stable actuelle est PostgreSQL 18. Toute version à partir de la 14 fonctionne avec le projet.

#### Sous Windows

1. Sur [postgresql.org/download/windows](https://www.postgresql.org/download/windows/), cliquez sur « Download the installer ». Vous arrivez chez EDB, qui distribue l'installateur officiel. Choisissez la version 18 pour Windows x86-64.
2. Lancez l'installateur et avancez avec « Next ».
3. **Composants** : gardez *PostgreSQL Server*, *pgAdmin 4* et *Command Line Tools*. Décochez *Stack Builder*, inutile ici.
4. **Dossier des données** : gardez celui proposé.
5. **Mot de passe** : choisissez le mot de passe de l'utilisateur `postgres`. **Notez-le**, il servira dans le fichier `.env`. Pour éviter les soucis, n'utilisez que des lettres et des chiffres (voir le Dépannage sinon).
6. **Port** : gardez `5432`.
7. **Locale** : gardez la valeur par défaut.
8. À la fin, décochez la proposition de lancer Stack Builder et cliquez sur « Finish ».

PostgreSQL tourne désormais en arrière-plan, comme un service Windows qui démarre avec l'ordinateur.

*Facultatif :* pour utiliser `psql` dans n'importe quel terminal, ajoutez `C:\Program Files\PostgreSQL\18\bin` à la variable d'environnement `Path` de Windows. Sinon, utilisez « SQL Shell (psql) » dans le menu Démarrer, ou pgAdmin.

#### Sous macOS

Le plus simple est [Postgres.app](https://postgresapp.com) : téléchargez, glissez dans Applications, lancez, cliquez sur « Initialize ». L'utilisateur est alors votre nom d'utilisateur macOS, sans mot de passe.

Avec Homebrew :

```bash
brew install postgresql@18
brew services start postgresql@18
```

#### Sous Linux (Ubuntu, Debian)

```bash
sudo apt update
sudo apt install postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'votremotdepasse';"
```

### 1.5 Créer les deux bases de données

Le projet utilise deux bases : `zando_prix` pour le développement, et `zando_prix_test` pour les tests, qui est vidée à chaque scénario. Toutes deux doivent être en **UTF-8**, à cause des accents dans les données (« Légumes », « Œufs »).

**Avec pgAdmin (le plus simple sous Windows)**

1. Ouvrez pgAdmin 4 et dépliez *Servers*, puis *PostgreSQL 18*. Saisissez votre mot de passe.
2. Clic droit sur *Databases*, puis *Create*, puis *Database…*
3. Onglet *General* : nom `zando_prix`.
4. Onglet *Definition* : *Encoding* `UTF8`, *Template* `template0`.
5. Cliquez sur *Save*.
6. Recommencez avec le nom `zando_prix_test`.

**Avec psql** (SQL Shell sous Windows, ou `psql -U postgres`)

```sql
CREATE DATABASE zando_prix      WITH ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE zando_prix_test WITH ENCODING 'UTF8' TEMPLATE template0;
```

**Vérification :** les deux bases apparaissent dans pgAdmin sous *Databases*, ou dans la liste affichée par la commande `\l` dans psql.

---

## Partie 2 : Créer le projet

1. Décompressez `zando-prix.zip` dans un dossier de référence, par exemple `Documents/zando-prix-source`. Vous y copierez les fichiers ; ne travaillez pas directement dedans.
2. Créez un dossier vide `zando-prix` pour votre vrai projet.
3. Dans VS Code : *Fichier*, puis *Ouvrir le dossier…*, et choisissez `zando-prix`.
4. Ouvrez le terminal intégré : *Terminal*, puis *Nouveau terminal*.
5. Initialisez Git :

```bash
git init
```

**Astuce :** dans l'explorateur de VS Code, « Nouveau fichier » accepte un chemin complet comme `src/routes/prix.js` et crée les dossiers manquants. Pour les images PNG et les fichiers `.gitkeep`, copiez-les depuis le dossier de référence au lieu de faire un copier-coller de contenu.

---

## Partie 3 : Intégrer les fichiers, étape par étape

Chaque étape se termine par une vérification, puis par un commit. En cas d'erreur, vous saurez exactement à quelle étape revenir.

### Étape 1 : Le squelette (3 fichiers)

| # | Fichier |
|---|---|
| 1 | `.gitignore` (en premier, pour qu'aucun mot de passe ne parte dans Git) |
| 2 | `package.json` |
| 3 | `.env.example` |

Puis :

```bash
npm install
```

Créez votre fichier `.env` à partir du modèle :

```bash
# PowerShell
Copy-Item .env.example .env
# macOS, Linux ou Git Bash
cp .env.example .env
```

Ouvrez `.env` et remplacez `motdepasse` par votre mot de passe PostgreSQL, dans les deux URL. Sous macOS avec Postgres.app, remplacez aussi `postgres:motdepasse` par votre nom d'utilisateur macOS, sans mot de passe.

**Vérification :** `npm install` se termine sans erreur, et un dossier `node_modules` est apparu.

```bash
git add .
git commit -m "chore: initialisation du projet"
```

Vérifiez au passage que `git status` ne mentionne jamais `.env` : c'est le `.gitignore` qui le protège.

### Étape 2 : La base de données (4 fichiers)

| # | Fichier |
|---|---|
| 4 | `db/schema.sql` |
| 5 | `db/seed.sql` |
| 6 | `src/db.js` |
| 7 | `scripts/db.js` |

```bash
npm run db:reset
```

**Vérification :** la commande affiche `✔ db/schema.sql exécuté` puis `✔ db/seed.sql exécuté`. Dans pgAdmin, la table `produits` de la base `zando_prix` contient 24 lignes (clic droit sur la table, *View/Edit Data*, *All Rows*).

```bash
git add .
git commit -m "feat(db): schéma PostgreSQL et données de démo"
```

### Étape 3 : Les spécifications (13 fichiers)

| # | Fichier |
|---|---|
| 8 | `docs/contrat-api.md` |
| 9 | `cucumber.js` |
| 10 à 20 | Les 11 fichiers de `features/`, de `01_consulter_prix.feature` à `11_carrousel_accueil.feature` |

```bash
npm run test:dry
```

**Vérification :** Cucumber lit les fichiers sans erreur de syntaxe et annonce 68 scénarios, dont les étapes sont encore « undefined ». C'est normal : les step definitions arrivent à l'étape suivante. Les 5 scénarios du carrousel (`@e2e`) ne sont pas comptés, ils seront exécutés plus tard par Playwright.

```bash
git add .
git commit -m "test: spécifications Gherkin"
```

### Étape 4 : Les tests automatisés (9 fichiers)

| # | Fichier |
|---|---|
| 21 | `features/support/contexte.js` |
| 22 | `features/support/outils.js` |
| 23 | `features/support/world.js` |
| 24 | `features/support/hooks.js` |
| 25 | `features/step_definitions/api/donnees.steps.js` |
| 26 | `features/step_definitions/api/prix.steps.js` |
| 27 | `features/step_definitions/api/recherche.steps.js` |
| 28 | `features/step_definitions/api/propositions.steps.js` |
| 29 | `features/step_definitions/api/categories.steps.js` |

```bash
npm run test:dry
```

**Vérification :** plus aucune étape « undefined ». Ne lancez pas encore `npm test` : le backend n'existe pas.

```bash
git add .
git commit -m "test: step definitions API avec Supertest"
```

### Étape 5 : Le backend (8 fichiers)

| # | Fichier |
|---|---|
| 30 | `src/erreurs.js` |
| 31 | `src/validation.js` |
| 32 | `src/routes/produits.js` |
| 33 | `src/routes/marches.js` |
| 34 | `src/routes/prix.js` |
| 35 | `src/routes/propositions.js` |
| 36 | `src/app.js` |
| 37 | `src/server.js` |

C'est l'étape décisive :

```bash
npm test
```

**Vérification :** l'objectif est `68 scenarios (68 passed)`. C'est la toute première exécution sur une vraie base : si des scénarios échouent, copiez la sortie du terminal et envoyez-la, on corrigera ensemble.

Puis lancez le serveur :

```bash
npm run dev
```

Ouvrez `http://localhost:3000/api/prix` : vous devez voir du JSON. Arrêtez le serveur avec `Ctrl + C`.

```bash
git add .
git commit -m "feat(api): routes Express conformes au contrat"
```

### Étape 6 : Le front-end (12 fichiers)

| # | Fichier |
|---|---|
| 38 | `public/css/styles.css` |
| 39 | `public/js/dom.js` |
| 40 | `public/js/api.js` |
| 41 | `public/js/format.js` |
| 42 | `public/js/carrousel.js` |
| 43 | `public/js/proposition.js` |
| 44 | `public/js/accueil.js` |
| 45 | `public/index.html` |
| 46 | `public/js/responsable.js` |
| 47 | `public/admin.html` (et `a-propos.html`, `contact.html`) |
| 48 | `public/images/produits/.gitkeep` |
| 49 | `public/images/accueil/.gitkeep` |

```bash
npm run dev
```

**Vérification :** ouvrez `http://localhost:3000` et testez :

- les 24 produits s'affichent, avec leur initiale à la place des photos ;
- une recherche, par exemple « saka » ;
- un filtre de marché, puis une catégorie ;
- sur grand écran, le carrousel défile à droite du titre ;
- « Proposer un prix », avec un prix invalide (`abc`) puis valide ;
- `http://localhost:3000/admin.html` : vous êtes renvoyé vers la page de connexion. Créez d'abord votre compte (voir ci-dessous), connectez-vous, corrigez puis publiez votre proposition, et revenez sur l'accueil pour voir le nouveau prix.

**Créer votre compte administrateur.** Il n'y a pas d'inscription sur le site : les comptes se créent en ligne de commande, et le mot de passe ne s'affiche pas pendant la saisie.

```bash
npm run admin:creer          # nom, e-mail, puis mot de passe (12 caractères minimum)
npm run admin:lister         # voir les comptes et leur dernière connexion
npm run admin:mot-de-passe -- grace@zandoprix.cg   # change le mot de passe, ferme ses sessions
npm run admin:desactiver -- grace@zandoprix.cg     # bloque le compte, garde son historique
```

`npm run db:reset` recrée toutes les tables, **y compris celle des comptes** : il faut recréer son compte après. `npm run db:seed` seul, lui, garde les comptes.

```bash
git add .
git commit -m "feat(front): pages de consultation et espace responsable"
```

### Étape 7 : Déploiement et documentation (7 fichiers)

| # | Fichier |
|---|---|
| 50 | `render.yaml` |
| 51 | `docs/photos-produits.md` |
| 52 à 55 | Les 4 images de `docs/captures/` (à copier comme fichiers) |
| 56 | `docs/guide-mise-en-place.md` (ce guide) |
| 57 | `README.md` |

```bash
git add .
git commit -m "docs: guide, captures et configuration Render"
```

Les 57 fichiers sont en place.

---

## Partie 4 : Mettre en ligne sur Render

Render héberge à la fois le serveur Node.js et la base PostgreSQL. Le fichier `render.yaml` (un « Blueprint ») décrit les deux : Render les crée d'un coup, dans la région de Francfort.

**Avant de commencer : l'offre gratuite a deux limites importantes pour la démo.** Le service s'endort après 15 minutes sans visite, et la première visite suivante attend environ une minute. Ouvrez donc le site deux minutes avant de le présenter. Et la base gratuite expire 30 jours après sa création : au-delà, il faut passer à une offre payante ou recréer la base. Vérifiez les conditions à jour sur [render.com/pricing](https://render.com/pricing).

1. Mettez à jour `package-lock.json`, qui mentionne encore l'ancienne dépendance Vercel, puis enregistrez :

```bash
npm install
npm test
git add .
git commit -m "chore: déploiement sur Render"
```

Sans cette étape, Render refuse d'installer le projet : `npm ci` exige que `package.json` et `package-lock.json` correspondent exactement.

2. Créez un dépôt sur GitHub, puis poussez le projet :

```bash
git remote add origin https://github.com/VOTRE_COMPTE/zando-prix.git
git branch -M main
git push -u origin main
```

3. Sur [dashboard.render.com](https://dashboard.render.com), choisissez **New → Blueprint**, reliez votre compte GitHub et sélectionnez le dépôt `zando-prix`. Render lit `render.yaml` et affiche la base et le service web qu'il va créer.

4. Render demande alors trois valeurs, qui ne sont jamais écrites dans Git :

| Variable | Exemple | Rôle |
|---|---|---|
| `ADMIN_NOM` | Grâce Mabiala | Nom affiché dans l'espace administrateur |
| `ADMIN_EMAIL` | grace@exemple.cg | Identifiant de connexion |
| `ADMIN_MOT_DE_PASSE` | (12 caractères au moins) | Mot de passe du premier compte |

5. Validez avec **Apply**. Au premier démarrage, le serveur trouve une base vide : il crée les tables, charge les données de démonstration et votre compte administrateur (voir `src/amorcage.js`). Le journal du service (onglet *Logs*) affiche :

```
Base vide : création des tables…
Chargement des données de démonstration…
Compte administrateur créé pour grace@exemple.cg.
Zando Prix démarré : …
```

6. Ouvrez l'adresse fournie par Render (`https://zando-prix-xxxx.onrender.com`), puis `/admin.html` pour vous connecter.

Une fois connecté, vous pouvez supprimer la variable `ADMIN_MOT_DE_PASSE` dans *Environment* : le compte existe, elle ne sert plus. Les démarrages suivants ne recréent rien, puisque la base est déjà prête.

**Chaque `git push` sur `main` redéploie automatiquement le site.** Render vérifie `/api/marches` avant de basculer sur la nouvelle version : si elle ne répond pas, l'ancienne reste en ligne.

### Agir sur la base en ligne depuis votre ordinateur (facultatif)

Pour ajouter un deuxième administrateur ou recharger les données, utilisez l'adresse **externe** de la base (page de la base sur Render, *Connections → External Database URL*). Copiez-la dans un fichier `.env.render`, déjà protégé par le `.gitignore`, en ajoutant `?sslmode=no-verify` à la fin :

```
DATABASE_URL=postgres://zando_prix:...@....frankfurt-postgres.render.com/zando_prix?sslmode=no-verify
```

La connexion est chiffrée, mais sans vérification du certificat du serveur. C'est acceptable pour ces commandes ponctuelles ; si Render fournit un jour un certificat reconnu, `?ssl=true` suffira.

```bash
node --env-file=.env.render scripts/admin.js creer          # un compte par personne
node --env-file=.env.render scripts/db.js reset --confirmer  # ATTENTION : efface tout
```

Les deux scripts affichent d'abord la base visée : vérifiez que c'est bien Render et non votre base locale. `reset` efface toutes les données, comptes administrateurs compris ; ne le lancez jamais une fois que la base contient de vrais prix.

---

## Dépannage

**« L'exécution de scripts est désactivée sur ce système » (PowerShell, en lançant `npm`)**
Exécutez une fois, dans PowerShell :
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Ou utilisez le terminal « Command Prompt » ou « Git Bash » dans VS Code.

**`password authentication failed for user "postgres"`**
Le mot de passe du fichier `.env` ne correspond pas. S'il contient des caractères spéciaux, remplacez-les dans l'URL : `@` devient `%40`, `#` devient `%23`, `/` devient `%2F`, `:` devient `%3A`.

**`database "zando_prix" does not exist`**
La base n'a pas été créée : voir la section 1.5.

**`connect ECONNREFUSED 127.0.0.1:5432`**
PostgreSQL ne tourne pas. Sous Windows : menu Démarrer, *Services*, puis démarrez `postgresql-x64-18`. Sous macOS : ouvrez Postgres.app ou lancez `brew services start postgresql@18`.

**`TEST_DATABASE_URL manquant dans .env`**
La ligne `TEST_DATABASE_URL` manque ou est vide dans `.env`.

**`psql` ou `createdb` introuvable**
Le dossier `bin` de PostgreSQL n'est pas dans le `Path` : utilisez pgAdmin ou « SQL Shell (psql) » dans le menu Démarrer.

**Le port 3000 est déjà utilisé**
Changez `PORT=3000` en `PORT=3001` dans `.env`, puis ouvrez `http://localhost:3001`.

**Les accents s'affichent mal (« LÃ©gumes »)**
La base n'est pas en UTF-8. Supprimez-la, recréez-la comme indiqué en 1.5, puis relancez `npm run db:reset`.
