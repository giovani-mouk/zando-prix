-- =============================================================
-- Migration 005 : suivi privé d'une proposition et photo de preuve
-- - cle_suivi : empreinte (SHA-256) d'une clé remise à la personne qui
--   propose le prix ; elle seule peut ensuite suivre sa proposition
--   (le registre complet est réservé à l'équipe) ;
-- - photo_url : photo de l'étal envoyée chez Cloudinary (facultative).
-- =============================================================
ALTER TABLE propositions ADD COLUMN IF NOT EXISTS cle_suivi CHAR(64);
ALTER TABLE propositions ADD COLUMN IF NOT EXISTS photo_url VARCHAR(300);
