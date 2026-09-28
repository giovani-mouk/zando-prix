-- =============================================================
-- Migration 004 : prix officiels du Ministère du Commerce
-- Saisis par l'équipe à partir des textes publiés (arrêtés, mercuriales).
-- - type « plafond »   : prix maximum légal ;
-- - type « indicatif » : prix de référence publié, sans valeur de plafond.
-- Un prix officiel n'est jamais effacé : il est « retiré » (retire_le),
-- pour garder la trace de ce qui a été affiché.
-- =============================================================
CREATE TABLE IF NOT EXISTS prix_officiels (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produit_id  INTEGER      NOT NULL REFERENCES produits(id) ON DELETE RESTRICT,
  type        VARCHAR(10)  NOT NULL CHECK (type IN ('plafond', 'indicatif')),
  montant     INTEGER      NOT NULL CHECK (montant > 0),   -- FCFA
  unite       unite_mesure NOT NULL,
  date_effet  DATE         NOT NULL,                        -- date d'entrée en vigueur
  reference   VARCHAR(200) NOT NULL,                        -- texte officiel (« Arrêté n° … »)
  cree_par    INTEGER      REFERENCES administrateurs(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  retire_le   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_prix_officiels_produit ON prix_officiels (produit_id, type, date_effet DESC);
