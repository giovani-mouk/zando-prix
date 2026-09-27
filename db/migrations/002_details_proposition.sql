-- =============================================================
-- Migration 002 : précisions d'une proposition (maquette « Proposer un prix »)
-- - constat : comment le prix a été constaté (relevé sur l'étal, ticket, pesée)
-- - repere  : précision facultative sur l'emplacement (« Hangar 3… »),
--             réservée à l'équipe : jamais affichée publiquement.
-- IF NOT EXISTS : la migration peut être rejouée sans erreur.
-- =============================================================
ALTER TABLE propositions ADD COLUMN IF NOT EXISTS constat VARCHAR(10);
ALTER TABLE propositions ADD COLUMN IF NOT EXISTS repere  VARCHAR(120);

DO $$
BEGIN
  ALTER TABLE propositions
    ADD CONSTRAINT chk_proposition_constat CHECK (constat IN ('direct', 'ticket', 'pesee'));
EXCEPTION WHEN duplicate_object THEN
  NULL; -- contrainte déjà présente
END $$;
