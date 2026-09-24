-- =============================================================
-- Zando Prix : données de test
-- Exécution : psql -d zando_prix -f db/seed.sql
--
-- Données FICTIVES, à remplacer par la liste officielle du PM (RM07).
-- Les dates sont relatives à CURRENT_DATE : les tests de fraîcheur
-- donnent le même résultat quel que soit le jour d'exécution.
-- Relançable à volonté (utile avant chaque scénario Cucumber).
-- =============================================================

BEGIN;

-- TRUNCATE vide les tables d'un coup ; RESTART IDENTITY remet les
-- identifiants à 1 ; CASCADE vide aussi les tables qui les référencent.
-- La table administrateurs n'est pas touchée : les comptes sont gardés.
TRUNCATE prix, propositions, marches, produits, messages RESTART IDENTITY CASCADE;

-- -------------------------------------------------------------
-- Produits
-- -------------------------------------------------------------
-- Illustrations fournies dans public/images/produits/ (.svg). Pour des photos, voir docs/photos-produits.md.
-- Tant qu'un fichier manque, la page affiche l'initiale du produit à la place.
INSERT INTO produits (nom, categorie, unite_reference, image) VALUES
  ('Riz',            'Céréales',  'kg',    '/images/produits/riz.svg'),
  ('Manioc',         'Féculents', 'kg',    '/images/produits/manioc.svg'),
  ('Tomate',         'Légumes',   'kg',    '/images/produits/tomate.svg'),
  ('Oignon',         'Légumes',   'kg',    '/images/produits/oignon.svg'),
  ('Huile de palme', 'Huiles',    'litre', '/images/produits/huile-de-palme.svg'),
  ('Poisson salé',   'Poissons',  'kg',    '/images/produits/poisson-sale.svg');

-- Autres produits courants des marchés : ils donnent du volume à la démo
-- et ne portent pas de cas de test particulier.
INSERT INTO produits (nom, categorie, unite_reference, image) VALUES
  ('Maïs',               'Céréales',         'kg',    '/images/produits/mais.svg'),
  ('Farine de blé',      'Céréales',         'kg',    '/images/produits/farine-de-ble.svg'),
  ('chikwangue',         'Féculents',        'piece', '/images/produits/chikwangue.svg'),
  ('Banane plantain',    'Féculents',        'tas',   '/images/produits/banane-plantain.svg'),
  ('Igname',             'Féculents',        'kg',    '/images/produits/igname.svg'),
  ('Patate douce',       'Féculents',        'kg',    '/images/produits/patate-douce.svg'),
  ('Saka-saka',          'Légumes',          'botte', '/images/produits/saka-saka.svg'),
  ('Piment',             'Légumes',          'tas',   '/images/produits/piment.svg'),
  ('Gombo',              'Légumes',          'tas',   '/images/produits/gombo.svg'),
  ('Arachide',           'Légumineuses',     'kg',    '/images/produits/arachide.svg'),
  ('Haricots',           'Légumineuses',     'kg',    '/images/produits/haricots.svg'),
  ('Huile végétale',     'Huiles',           'litre', '/images/produits/huile-vegetale.svg'),
  ('Poisson fumé',       'Poissons',         'kg',    '/images/produits/poisson-fume.svg'),
  ('Chinchard (mpiodi)', 'Poissons',         'kg',    '/images/produits/chinchard.svg'),
  ('Poulet',             'Viandes et œufs',  'piece', '/images/produits/poulet.svg'),
  ('Œufs',               'Viandes et œufs',  'piece', '/images/produits/oeufs.svg'),
  ('Sucre',              'Épicerie',         'kg',    '/images/produits/sucre.svg'),
  ('Sel',                'Épicerie',         'kg',    '/images/produits/sel.svg');

-- -------------------------------------------------------------
-- Marchés
-- -------------------------------------------------------------
INSERT INTO marches (nom, ville) VALUES
  ('Marché Total',     'Brazzaville - Bacongo'),
  ('Marché Poto-Poto', 'Brazzaville - Poto-Poto'),
  ('Marché Moungali',  'Brazzaville - Moungali'),
  ('Marché Ouenzé',    'Brazzaville - Ouenzé');

-- -------------------------------------------------------------
-- Propositions (une par statut, plus une en attente sur un
-- produit sans prix officiel)
-- -------------------------------------------------------------
-- Technique utilisée dans tout ce fichier :
--   VALUES (…), (…) AS v(colonnes)  crée une petite table temporaire lisible ;
--   JOIN produits p ON p.nom = v.produit  traduit les noms en identifiants.
-- On écrit ainsi 'Riz' et 'Marché Ouenzé' au lieu de numéros fragiles.
-- CURRENT_DATE - v.age : date relative (age = nombre de jours écoulés).
INSERT INTO propositions (produit_id, marche_id, montant, unite, date_constat, auteur, statut, traitee_le)
SELECT p.id, m.id, v.montant, v.unite, CURRENT_DATE - v.age, v.auteur, v.statut, v.traitee_le
FROM (VALUES
  ('Oignon',       'Marché Moungali',   900, 'kg', 1, 'Mama Ngolo', 'validee',    now()),
  ('Riz',          'Marché Ouenzé',     750, 'kg', 0, 'Patrick',    'en_attente', NULL),
  ('Tomate',       'Marché Total',     5000, 'kg', 1, NULL,         'rejetee',    now()),
  ('Poisson salé', 'Marché Poto-Poto', 3500, 'kg', 2, NULL,         'en_attente', NULL)
) AS v(produit, marche, montant, unite, age, auteur, statut, traitee_le)
JOIN produits p ON p.nom = v.produit
JOIN marches  m ON m.nom = v.marche;

-- -------------------------------------------------------------
-- Prix officiels (age = nombre de jours depuis le relevé)
-- -------------------------------------------------------------
INSERT INTO prix (produit_id, marche_id, montant, unite, date_releve)
SELECT p.id, m.id, v.montant, v.unite, CURRENT_DATE - v.age
FROM (VALUES
  -- RIZ : cas nominal + historique
  ('Riz',            'Marché Total',      650, 'kg',    20),  -- ancien relevé, remplacé par le suivant
  ('Riz',            'Marché Total',      800, 'kg',     2),
  ('Riz',            'Marché Poto-Poto',  700, 'kg',     1),
  ('Riz',            'Marché Moungali',   850, 'kg',     3),
  ('Riz',            'Marché Ouenzé',     780, 'kg',     5),

  -- MANIOC : prix ancien, unité non comparable, prix manquant
  ('Manioc',         'Marché Total',      600, 'kg',     1),
  ('Manioc',         'Marché Moungali',   550, 'kg',    10),
  ('Manioc',         'Marché Ouenzé',     500, 'tas',    3),
  -- (aucun prix à Poto-Poto)

  -- TOMATE : égalité au meilleur prix + cas limite des 7 jours
  ('Tomate',         'Marché Total',     1200, 'kg',     8),
  ('Tomate',         'Marché Poto-Poto', 1000, 'kg',     7),
  ('Tomate',         'Marché Moungali',  1000, 'kg',     1),
  -- (aucun prix à Ouenzé)

  -- OIGNON : le prix de Moungali est ajouté plus bas depuis la proposition validée
  ('Oignon',         'Marché Ouenzé',     950, 'kg',     5),

  -- HUILE DE PALME : un seul marché, unité litre
  ('Huile de palme', 'Marché Total',     1300, 'litre',  4)

  -- POISSON SALÉ : aucun prix officiel
) AS v(produit, marche, montant, unite, age)
JOIN produits p ON p.nom = v.produit
JOIN marches  m ON m.nom = v.marche;

-- -------------------------------------------------------------
-- Prix des autres produits (volume de démo)
-- -------------------------------------------------------------
INSERT INTO prix (produit_id, marche_id, montant, unite, date_releve)
SELECT p.id, m.id, v.montant, v.unite, CURRENT_DATE - v.age
FROM (VALUES
  ('Maïs',               'Marché Total',      400, 'kg',     2),
  ('Maïs',               'Marché Ouenzé',     350, 'kg',     4),

  ('Farine de blé',      'Marché Total',      900, 'kg',     3),
  ('Farine de blé',      'Marché Poto-Poto',  850, 'kg',     1),
  ('Farine de blé',      'Marché Moungali',   950, 'kg',     6),

  ('Chikwangue',         'Marché Total',      250, 'piece',  1),
  ('Chikwangue',         'Marché Poto-Poto',  200, 'piece',  2),
  ('Chikwangue',         'Marché Moungali',   250, 'piece',  3),
  ('Chikwangue',         'Marché Ouenzé',     200, 'piece',  9),

  ('Banane plantain',    'Marché Total',     1000, 'tas',    2),
  ('Banane plantain',    'Marché Ouenzé',     800, 'tas',    1),

  ('Igname',             'Marché Moungali',   700, 'kg',     5),

  ('Patate douce',       'Marché Poto-Poto',  500, 'kg',     2),
  ('Patate douce',       'Marché Total',      600, 'kg',    12),

  ('Saka-saka',          'Marché Total',      200, 'botte',  0),
  ('Saka-saka',          'Marché Poto-Poto',  250, 'botte',  1),
  ('Saka-saka',          'Marché Moungali',   200, 'botte',  2),
  ('Saka-saka',          'Marché Ouenzé',     150, 'botte',  3),

  ('Piment',             'Marché Total',      200, 'tas',    1),
  ('Piment',             'Marché Moungali',   150, 'tas',    8),

  ('Gombo',              'Marché Poto-Poto',  300, 'tas',    2),
  ('Gombo',              'Marché Ouenzé',     250, 'tas',    4),

  ('Arachide',           'Marché Total',     1500, 'kg',     3),
  ('Arachide',           'Marché Poto-Poto', 1400, 'kg',     2),
  ('Arachide',           'Marché Ouenzé',    1300, 'kg',    10),

  ('Haricots',           'Marché Moungali',  1100, 'kg',     1),
  ('Haricots',           'Marché Total',     1200, 'kg',     4),

  ('Huile végétale',     'Marché Total',     1500, 'litre',  2),
  ('Huile végétale',     'Marché Poto-Poto', 1400, 'litre',  3),
  ('Huile végétale',     'Marché Moungali',  1450, 'litre',  1),

  ('Poisson fumé',       'Marché Total',     4000, 'kg',     2),
  ('Poisson fumé',       'Marché Ouenzé',    3500, 'kg',     6),

  ('Chinchard (mpiodi)', 'Marché Total',     1800, 'kg',     1),
  ('Chinchard (mpiodi)', 'Marché Poto-Poto', 1700, 'kg',     2),
  ('Chinchard (mpiodi)', 'Marché Moungali',  1750, 'kg',     3),
  ('Chinchard (mpiodi)', 'Marché Ouenzé',    1600, 'kg',    15),

  ('Poulet',             'Marché Total',     4500, 'piece',  3),
  ('Poulet',             'Marché Moungali',  4000, 'piece',  2),

  ('Œufs',               'Marché Poto-Poto',  100, 'piece',  1),
  ('Œufs',               'Marché Ouenzé',     100, 'piece',  2),

  ('Sucre',              'Marché Total',      800, 'kg',     2),
  ('Sucre',              'Marché Poto-Poto',  750, 'kg',     1),
  ('Sucre',              'Marché Moungali',   800, 'kg',     4),
  ('Sucre',              'Marché Ouenzé',     850, 'kg',     5),

  ('Sel',                'Marché Total',      300, 'kg',     7),
  ('Sel',                'Marché Ouenzé',     250, 'kg',     3)
) AS v(produit, marche, montant, unite, age)
JOIN produits p ON p.nom = v.produit
JOIN marches  m ON m.nom = v.marche;

-- -------------------------------------------------------------
-- Messages de la page Contact (pour la démonstration de l'espace administrateur)
-- -------------------------------------------------------------
INSERT INTO messages (nom, email, contenu, created_at, lu_le) VALUES
  ('Patrick',    'patrick@exemple.cg',
   'Bonjour, le prix du riz au marché Ouenzé a baissé ce matin : 750 FCFA le kilo. Je l''ai proposé sur le site.',
   now() - interval '2 hours', NULL),
  ('Mama Ngolo', 'mama.ngolo@exemple.cg',
   'Pourriez-vous ajouter le marché de Talangaï ? Beaucoup de gens du quartier y font leurs courses.',
   now() - interval '1 day', NULL),
  ('Jean',       'jean@exemple.cg',
   'Merci pour ce site, très utile pour préparer le marché du samedi.',
   now() - interval '3 days', now() - interval '2 days');

-- -------------------------------------------------------------
-- Prix issu de la proposition validée (RM06)
-- -------------------------------------------------------------
INSERT INTO prix (produit_id, marche_id, montant, unite, date_releve, source, proposition_id)
SELECT produit_id, marche_id, montant, unite, date_constat, 'proposition', id
FROM propositions
WHERE statut = 'validee';

COMMIT;

-- =============================================================
-- RÉSULTATS ATTENDUS dans v_prix_actuels / v_grille_prix
-- (servira de base aux scénarios Gherkin)
--
-- Riz
--   Total 800 récent | Poto-Poto 700 récent MEILLEUR | Moungali 850 récent | Ouenzé 780 récent
--   -> l'ancien 650 de Total n'est pas pris en compte (historique)
--   -> la proposition en attente à 750 (Ouenzé) n'est pas prise en compte (RM06)
--
-- Manioc
--   Total 600 récent | Moungali 550 ancien MEILLEUR | Ouenzé 500 tas NON COMPARABLE
--   Poto-Poto : non disponible (RM04)
--   -> le 500 au tas, bien que plus bas, n'est pas "meilleur prix" (RM05)
--
-- Tomate
--   Total 1200 ancien | Poto-Poto 1000 ancien (7 jours) MEILLEUR | Moungali 1000 récent MEILLEUR
--   Ouenzé : non disponible
--
-- Oignon
--   Moungali 900 récent MEILLEUR (source = proposition) | Ouenzé 950 récent
--   Total, Poto-Poto : non disponibles
--
-- Huile de palme
--   Total 1300 litre récent MEILLEUR | autres marchés : non disponibles
--
-- Poisson salé
--   Aucun prix disponible nulle part (la proposition en attente n'apparaît pas)
--
-- Propositions : 1 validée, 2 en attente, 1 rejetée
--
-- Les 18 autres produits (maïs, chikwangue, saka-saka...) servent
-- à donner du volume à la démo : 24 produits dans 8 catégories.
-- =============================================================
