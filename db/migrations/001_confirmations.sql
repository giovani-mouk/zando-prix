-- =============================================================
-- Migration 001 : confirmations citoyennes des propositions
-- (maquette « Suivi des propositions », fenêtre « Confirmer ce prix »)
--
-- Une migration fait évoluer une base EXISTANTE sans l'effacer.
-- Elle est appliquée une seule fois, au démarrage du serveur
-- (voir src/migrations.js), puis notée dans la table schema_migrations.
-- Écrite pour pouvoir être rejouée sans erreur (IF NOT EXISTS).
-- =============================================================

CREATE TABLE IF NOT EXISTS confirmations (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposition_id  INTEGER      NOT NULL REFERENCES propositions(id) ON DELETE CASCADE,
  -- Qui confirme : réponse déclarative, jamais vérifiée
  role            VARCHAR(20)  NOT NULL CHECK (role IN ('acheteur', 'commercant', 'visiteur')),
  -- true : « Oui, prix identique » ; false : « Non, écart constaté »
  conforme        BOOLEAN      NOT NULL,
  commentaire     VARCHAR(300),
  -- Empreinte SHA-256 de « adresse IP : numéro de proposition » : empêche de
  -- confirmer deux fois la même proposition, sans garder l'adresse, et sans
  -- permettre de relier les confirmations d'une même personne entre elles.
  empreinte       CHAR(64)     NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_confirmation_unique UNIQUE (proposition_id, empreinte)
);

CREATE INDEX IF NOT EXISTS idx_confirmations_proposition ON confirmations (proposition_id);
