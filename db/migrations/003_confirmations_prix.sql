-- =============================================================
-- Migration 003 : confirmer un prix déjà publié (bouton « Confirmer »)
-- Un visiteur indique si le prix affiché est toujours le bon (conforme)
-- ou s'il a changé. C'est un signal pour l'équipe : rien n'est modifié
-- automatiquement. Une seule réponse par connexion et par prix :
-- l'empreinte mélange l'adresse et le numéro du prix, l'adresse
-- elle-même n'est pas gardée.
-- =============================================================
CREATE TABLE IF NOT EXISTS confirmations_prix (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prix_id    INTEGER     NOT NULL REFERENCES prix(id) ON DELETE CASCADE,
  conforme   BOOLEAN     NOT NULL,
  empreinte  CHAR(64)    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_confirmation_prix UNIQUE (prix_id, empreinte)
);

CREATE INDEX IF NOT EXISTS idx_confirmations_prix ON confirmations_prix (prix_id);
