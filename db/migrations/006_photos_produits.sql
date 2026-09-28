-- Migration 006 : photos des produits (fichiers .webp)
-- Générée depuis db/seed.sql : met à jour la base déjà en service (Render).
UPDATE produits SET image = '/images/produits/riz.webp' WHERE nom = 'Riz';
UPDATE produits SET image = '/images/produits/manioc.webp' WHERE nom = 'Manioc';
UPDATE produits SET image = '/images/produits/tomate.webp' WHERE nom = 'Tomate';
UPDATE produits SET image = '/images/produits/oignon.webp' WHERE nom = 'Oignon';
UPDATE produits SET image = '/images/produits/huile-de-palme.webp' WHERE nom = 'Huile de palme';
UPDATE produits SET image = '/images/produits/poisson-sale.webp' WHERE nom = 'Poisson salé';
UPDATE produits SET image = '/images/produits/mais.webp' WHERE nom = 'Maïs';
UPDATE produits SET image = '/images/produits/farine-de-ble.webp' WHERE nom = 'Farine de blé';
UPDATE produits SET image = '/images/produits/chikwangue.webp' WHERE nom = 'Chikwangue';
UPDATE produits SET image = '/images/produits/banane-plantain.webp' WHERE nom = 'Banane plantain';
UPDATE produits SET image = '/images/produits/igname.webp' WHERE nom = 'Igname';
UPDATE produits SET image = '/images/produits/patate-douce.webp' WHERE nom = 'Patate douce';
UPDATE produits SET image = '/images/produits/saka-saka.webp' WHERE nom = 'Saka-saka';
UPDATE produits SET image = '/images/produits/piment.webp' WHERE nom = 'Piment';
UPDATE produits SET image = '/images/produits/gombo.webp' WHERE nom = 'Gombo';
UPDATE produits SET image = '/images/produits/arachide.webp' WHERE nom = 'Arachide';
UPDATE produits SET image = '/images/produits/haricot.webp' WHERE nom = 'Haricots';
UPDATE produits SET image = '/images/produits/huile-vegetale.webp' WHERE nom = 'Huile végétale';
UPDATE produits SET image = '/images/produits/poisson-fume.webp' WHERE nom = 'Poisson fumé';
UPDATE produits SET image = '/images/produits/chinchard.webp' WHERE nom = 'Chinchard (mpiodi)';
UPDATE produits SET image = '/images/produits/poulet.webp' WHERE nom = 'Poulet';
UPDATE produits SET image = '/images/produits/oeuf.webp' WHERE nom = 'Œufs';
UPDATE produits SET image = '/images/produits/sucre.webp' WHERE nom = 'Sucre';
UPDATE produits SET image = '/images/produits/sel.webp' WHERE nom = 'Sel';
