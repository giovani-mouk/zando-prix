-- =============================================================
-- Zando Prix : schéma PostgreSQL
-- Exécution : psql -d zando_prix -f db/schema.sql
-- =============================================================

-- Tout le fichier est une seule transaction : si une instruction échoue,
-- PostgreSQL annule tout (ROLLBACK) et la base reste dans son état d'avant.
BEGIN;

-- Nettoyage (ordre inverse des dépendances)
-- On ne peut pas supprimer une table encore référencée par une autre :
-- on supprime donc d'abord celles qui pointent vers les autres.
-- IF EXISTS : pas d'erreur lors de la toute première exécution.
DROP VIEW   IF EXISTS v_grille_prix;
DROP VIEW   IF EXISTS v_prix_actuels;
DROP TABLE  IF EXISTS sessions;
DROP TABLE  IF EXISTS tentatives_connexion;
DROP TABLE  IF EXISTS prix;
DROP TABLE  IF EXISTS propositions;
DROP TABLE  IF EXISTS messages;
DROP TABLE  IF EXISTS administrateurs;
DROP TABLE  IF EXISTS marches;
DROP TABLE  IF EXISTS produits;
DROP DOMAIN IF EXISTS unite_mesure;

-- -------------------------------------------------------------
-- Unités autorisées (RM05). Liste à confirmer avec le PM.
-- Un DOMAIN est un type réutilisable avec sa règle de validation :
-- la liste n'est écrite qu'ici, et trois tables s'en servent.
-- -------------------------------------------------------------
CREATE DOMAIN unite_mesure AS VARCHAR(20)
  CHECK (VALUE IN ('kg', 'litre', 'tas', 'piece', 'botte', 'sac'));

-- -------------------------------------------------------------
-- Produits
-- -------------------------------------------------------------
-- GENERATED ALWAYS AS IDENTITY : identifiant attribué automatiquement
-- (1, 2, 3…), forme standard SQL qui remplace l'ancien SERIAL.
-- PRIMARY KEY : unique, jamais vide, indexé.
CREATE TABLE produits (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom              VARCHAR(100) NOT NULL UNIQUE,
  categorie        VARCHAR(50),
  unite_reference  unite_mesure NOT NULL,   -- unité servant à la comparaison
  -- Photo du produit : chemin dans public/ ("/images/produits/riz.webp") ou URL https.
  -- Le CHECK refuse tout autre format (ex. "javascript:...").
  image            VARCHAR(255) CHECK (image ~ '^(/|https://)'),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Marchés
-- -------------------------------------------------------------
CREATE TABLE marches (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL UNIQUE,
  ville       VARCHAR(100) NOT NULL,
  latitude    NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
  longitude   NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Administrateurs (espace de gestion des propositions)
-- Comptes nominatifs, créés uniquement par : npm run admin:creer
-- Créée avant "propositions", qui garde qui a traité chaque proposition.
-- -------------------------------------------------------------
CREATE TABLE administrateurs (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom                VARCHAR(100) NOT NULL,
  email              VARCHAR(254) NOT NULL,
  -- Jamais le mot de passe lui-même : "scrypt$N$r$p$sel$empreinte"
  mot_de_passe_hash  TEXT         NOT NULL,
  -- false = compte désactivé : plus de connexion, mais son historique reste
  actif              BOOLEAN      NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Un seul compte par e-mail, sans tenir compte des majuscules
CREATE UNIQUE INDEX ux_administrateurs_email ON administrateurs (lower(email));

-- -------------------------------------------------------------
-- Sessions de connexion
-- Stockées en base et non en mémoire : sur Vercel, deux requêtes
-- successives peuvent être traitées par deux instances différentes.
-- -------------------------------------------------------------
CREATE TABLE sessions (
  -- Empreinte SHA-256 du jeton envoyé dans le cookie. Le jeton lui-même
  -- n'est jamais stocké : une fuite de la base ne donne accès à rien.
  jeton_hash         CHAR(64)     PRIMARY KEY,
  administrateur_id  INTEGER      NOT NULL REFERENCES administrateurs(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expire_le          TIMESTAMPTZ  NOT NULL,
  CONSTRAINT chk_session_duree CHECK (expire_le > created_at)
);

CREATE INDEX idx_sessions_administrateur ON sessions (administrateur_id);

-- -------------------------------------------------------------
-- Tentatives de connexion (blocage après trop d'échecs)
-- L'e-mail est gardé tel que saisi, même s'il ne correspond à aucun
-- compte : un e-mail inconnu est bloqué comme un e-mail existant.
-- -------------------------------------------------------------
CREATE TABLE tentatives_connexion (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       VARCHAR(254) NOT NULL,
  reussie     BOOLEAN      NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_tentatives_email ON tentatives_connexion (lower(email), created_at DESC);

-- -------------------------------------------------------------
-- Messages de la page Contact (hors cadrage, @a-valider)
-- Envoyés par n'importe quel visiteur, lus dans l'espace administrateur.
-- -------------------------------------------------------------
CREATE TABLE messages (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom           VARCHAR(100)  NOT NULL CHECK (length(trim(nom)) > 0),
  email         VARCHAR(254)  NOT NULL,
  -- Nom de colonne « contenu » : « message » désigne déjà la ligne entière
  contenu       VARCHAR(2000) NOT NULL CHECK (length(trim(contenu)) > 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Lu = une date de lecture existe. Qui l'a lu : l'administrateur connecté.
  lu_le         TIMESTAMPTZ,
  lu_par        INTEGER       REFERENCES administrateurs(id) ON DELETE RESTRICT,
  -- Empreinte SHA-256 de l'adresse IP de l'expéditeur, pour limiter les
  -- envois abusifs. Effacée au bout de 24 heures (voir routes/messages.js) :
  -- on ne garde pas durablement une donnée qui permet d'identifier quelqu'un.
  ip_empreinte  CHAR(64)
);

-- Liste de l'espace administrateur : non lus d'abord, puis du plus récent au plus ancien
CREATE INDEX idx_messages_lecture ON messages ((lu_le IS NOT NULL), created_at DESC);
-- Comptage des envois récents depuis une même connexion
CREATE INDEX idx_messages_ip ON messages (ip_empreinte, created_at DESC);

-- -------------------------------------------------------------
-- Propositions des utilisateurs (Stories 7 et 8, RM06)
-- Créée avant "prix", car prix.proposition_id la référence.
-- -------------------------------------------------------------
CREATE TABLE propositions (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produit_id    INTEGER      NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  marche_id     INTEGER      NOT NULL REFERENCES marches(id)  ON DELETE RESTRICT,
  -- INTEGER et non un nombre à virgule : le franc CFA n'a pas de centimes,
  -- et les nombres à virgule flottante arrondissent (0.1 + 0.2 ≠ 0.3).
  montant       INTEGER      NOT NULL CHECK (montant > 0),   -- FCFA
  unite         unite_mesure NOT NULL,
  date_constat  DATE         NOT NULL,                        -- date où l'utilisateur a vu le prix
  auteur        VARCHAR(100),                                 -- pseudo optionnel
  statut        VARCHAR(20)  NOT NULL DEFAULT 'en_attente'
                CHECK (statut IN ('en_attente', 'validee', 'rejetee')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  traitee_le    TIMESTAMPTZ,
  -- Qui a publié ou supprimé la proposition. Toujours rempli par l'API ;
  -- vide seulement pour les données de démonstration (seed.sql).
  traitee_par   INTEGER      REFERENCES administrateurs(id) ON DELETE RESTRICT,
  -- Dernière correction avant publication
  corrigee_le   TIMESTAMPTZ,
  corrigee_par  INTEGER      REFERENCES administrateurs(id) ON DELETE RESTRICT,
  -- En attente <=> pas encore de date de traitement
  CONSTRAINT chk_proposition_traitement
    CHECK ((statut = 'en_attente') = (traitee_le IS NULL)),
  -- Une proposition en attente n'a été traitée par personne
  CONSTRAINT chk_proposition_traitee_par
    CHECK (statut <> 'en_attente' OR traitee_par IS NULL),
  -- Date et auteur de correction vont ensemble
  CONSTRAINT chk_proposition_correction
    CHECK ((corrigee_le IS NULL) = (corrigee_par IS NULL))
);

-- -------------------------------------------------------------
-- Prix relevés (historique conservé)
-- -------------------------------------------------------------
-- REFERENCES … ON DELETE RESTRICT : clé étrangère. PostgreSQL vérifie que
-- le produit et le marché existent, et refuse de supprimer un produit
-- ou un marché qui a encore des prix (pas de prix « orphelins »).
CREATE TABLE prix (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produit_id      INTEGER      NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  marche_id       INTEGER      NOT NULL REFERENCES marches(id)  ON DELETE RESTRICT,
  montant         INTEGER      NOT NULL CHECK (montant > 0),   -- FCFA, jamais inventé (RM04)
  unite           unite_mesure NOT NULL,
  date_releve     DATE         NOT NULL,                        -- base de la fraîcheur (RM03)
  source          VARCHAR(20)  NOT NULL DEFAULT 'officiel'
                  CHECK (source IN ('officiel', 'proposition')),
  proposition_id  INTEGER      UNIQUE REFERENCES propositions(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- RM06 : un prix issu d'une proposition garde le lien vers celle-ci.
  -- (Le fait que la proposition soit bien "validee" est garanti par l'API,
  --  dans la même transaction que le changement de statut.)
  CONSTRAINT chk_prix_source
    CHECK (   (source = 'officiel'    AND proposition_id IS NULL)
           OR (source = 'proposition' AND proposition_id IS NOT NULL))
);

-- Un index est comme l'index d'un livre : PostgreSQL retrouve le dernier
-- relevé d'un couple produit/marché sans parcourir toute la table.
CREATE INDEX idx_prix_dernier         ON prix (produit_id, marche_id, date_releve DESC);
CREATE INDEX idx_propositions_statut  ON propositions (statut);

-- -------------------------------------------------------------
-- Vue : dernier prix de chaque couple produit / marché
-- Calcule la fraîcheur (RM03) et le meilleur prix (RM02, RM05).
--
-- Hypothèses en attente de validation par le PM :
--   * exactement 7 jours  -> 'ancien' (orange)
--   * égalité au plus bas -> tous les marchés concernés sont "meilleur prix"
--   * seuls les prix dans l'unité de référence du produit sont comparés
-- -------------------------------------------------------------
-- WITH … AS (…) : sous-requête nommée (« CTE »), lisible comme une étape.
-- DISTINCT ON (produit_id, marche_id) : propre à PostgreSQL, garde la
-- PREMIÈRE ligne de chaque couple selon le ORDER BY, donc le relevé le
-- plus récent (date décroissante, puis id décroissant pour départager).
CREATE VIEW v_prix_actuels AS
WITH derniers AS (
  SELECT DISTINCT ON (produit_id, marche_id)
         id, produit_id, marche_id, montant, unite, date_releve, source
  FROM prix
  ORDER BY produit_id, marche_id, date_releve DESC, id DESC
)
SELECT
  d.id                               AS prix_id,
  pr.id                              AS produit_id,
  pr.nom                             AS produit,
  pr.categorie,
  pr.unite_reference,
  m.id                               AS marche_id,
  m.nom                              AS marche,
  m.ville,
  d.montant,
  d.unite,
  d.date_releve,
  d.source,
  CURRENT_DATE - d.date_releve       AS age_jours,
  CASE WHEN CURRENT_DATE - d.date_releve < 7
       THEN 'recent' ELSE 'ancien'
  END                                AS fraicheur,
  -- Fonction de fenêtre : MIN(…) OVER (PARTITION BY produit) calcule le
  -- minimum de chaque produit SANS regrouper les lignes (contrairement à
  -- GROUP BY) : chaque ligne garde ses colonnes et « voit » le minimum de
  -- son produit. Le CASE exclut du minimum les unités non comparables (RM05).
  d.unite = pr.unite_reference       AS comparable,
  d.unite = pr.unite_reference
    AND d.montant = MIN(CASE WHEN d.unite = pr.unite_reference THEN d.montant END)
                      OVER (PARTITION BY d.produit_id)
                                     AS est_meilleur_prix
FROM derniers d
JOIN produits pr ON pr.id = d.produit_id
JOIN marches  m  ON m.id  = d.marche_id;

-- -------------------------------------------------------------
-- Vue : grille complète produits x marchés
-- disponible = false => afficher "Prix non disponible" (RM04)
-- -------------------------------------------------------------
CREATE VIEW v_grille_prix AS
SELECT
  pr.id   AS produit_id,
  pr.nom  AS produit,
  pr.categorie,
  m.id    AS marche_id,
  m.nom   AS marche,
  v.prix_id,
  v.montant,
  v.unite,
  v.date_releve,
  v.source,
  v.fraicheur,
  v.comparable,
  v.est_meilleur_prix,
  (v.prix_id IS NOT NULL) AS disponible
-- CROSS JOIN : toutes les combinaisons produit × marché.
-- LEFT JOIN : on y accroche le prix quand il existe ; sinon les colonnes
-- du prix sont NULL, et disponible vaut false.
FROM produits pr
CROSS JOIN marches m
LEFT JOIN v_prix_actuels v
       ON v.produit_id = pr.id
      AND v.marche_id  = m.id;

COMMIT;
