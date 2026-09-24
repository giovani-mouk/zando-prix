# Photos des produits

> **État actuel :** le projet fournit des **illustrations vectorielles** (`.svg`) pour les 24 produits (`public/images/produits/`) et pour les 4 diapositives du carrousel (`public/images/accueil/`). Les diapositives expliquent le fonctionnement du site. Les illustrations suffisent pour la démonstration ; ce document explique comment les remplacer par de vraies photos.
>
> Pour remplacer l'illustration d'un produit par une photo : déposez `public/images/produits/riz.webp`, puis mettez à jour le chemin en base, par exemple :
>
> ```sql
> UPDATE produits SET image = '/images/produits/riz.webp' WHERE nom = 'Riz';
> ```
>
> et modifiez la même ligne dans `db/seed.sql`, pour que `npm run db:reset` garde la photo. Pour le carrousel, changez l'attribut `data-src` et la légende de la diapositive dans `public/index.html`.

Hors cadrage : fonctionnalité proposée pendant le sprint, à valider par le PM (`features/10_photos_produits.feature`).

## Où déposer les photos

Les photos vont dans `public/images/produits/`. Le nom du fichier doit correspondre au chemin enregistré dans la colonne `image` de la table `produits`. Pour les données de démo (`db/seed.sql`) :

| Produit | Fichier attendu |
|---|---|
| Arachide | `arachide.webp` |
| Banane plantain | `banane-plantain.webp` |
| Chikwangue | `chikwangue.webp` |
| Chinchard (mpiodi) | `chinchard.webp` |
| Farine de blé | `farine-de-ble.webp` |
| Gombo | `gombo.webp` |
| Haricots | `haricots.webp` |
| Huile de palme | `huile-de-palme.webp` |
| Huile végétale | `huile-vegetale.webp` |
| Igname | `igname.webp` |
| Manioc | `manioc.webp` |
| Maïs | `mais.webp` |
| Œufs | `oeufs.webp` |
| Oignon | `oignon.webp` |
| Patate douce | `patate-douce.webp` |
| Piment | `piment.webp` |
| Poisson fumé | `poisson-fume.webp` |
| Poisson salé | `poisson-sale.webp` |
| Poulet | `poulet.webp` |
| Riz | `riz.webp` |
| Saka-saka | `saka-saka.webp` |
| Sel | `sel.webp` |
| Sucre | `sucre.webp` |
| Tomate | `tomate.webp` |

Tant qu'un fichier manque, la page affiche l'initiale du produit à la place. Il n'y a jamais d'image cassée.

## Format

Les photos s'affichent dans un carré de 72 pixels. Pour qu'elles restent nettes sur les écrans de téléphone, qui ont une forte densité de pixels, préparez-les ainsi :

| Réglage | Valeur |
|---|---|
| Format | WebP |
| Dimensions | 240 × 240 pixels, carré |
| Poids visé | moins de 20 Ko par photo |

Beaucoup d'utilisateurs consultent le site avec des données mobiles : le poids compte. Un outil gratuit dans le navigateur comme Squoosh permet de recadrer, redimensionner et convertir en WebP.

## Que photographier

Le produit tel qu'il est vendu au marché : le tas de tomates, le sac de riz, la bouteille d'huile de palme. Un fond simple, une bonne lumière, et le produit bien centré, car la photo sera recadrée en carré.

Évitez les visages (il faudrait l'accord des personnes) et les marques commerciales visibles.

## Droits d'utilisation

La meilleure solution : des photos prises par l'équipe dans les marchés. Elles montrent les produits tels que les utilisateurs les connaissent, et ne posent aucun problème de droits.

N'utilisez pas d'images trouvées au hasard sur Internet. Si vous passez par une banque d'images gratuite, vérifiez la licence de chaque photo et notez-la ici :

| Fichier | Source | Auteur | Licence |
|---|---|---|---|
| | | | |

## Ajouter ou changer une photo

1. Déposez le fichier dans `public/images/produits/`.
2. Enregistrez son chemin dans la base :

```sql
UPDATE produits SET image = '/images/produits/banane-plantain.webp'
WHERE nom = 'Banane plantain';
```

La colonne n'accepte qu'un chemin commençant par `/` ou une adresse `https://`.

# Photos du carrousel d'accueil

Hors cadrage : fonctionnalité proposée pendant le sprint, à valider par le PM (`features/11_carrousel_accueil.feature`).

Le carrousel s'affiche à droite du grand titre, sur les écrans d'au moins 960 pixels de large. Sur mobile, il n'est ni affiché ni téléchargé : les prix passent en premier.

## Où déposer les photos

Dans `public/images/accueil/`, avec ces noms. La légende est écrite dans `public/index.html` : si une photo montre autre chose, modifiez aussi sa légende (`<figcaption>`).

| Fichier | Légende actuelle |
|---|---|
| `marche-total.webp` | Le marché Total, à Bacongo |
| `marche-poto-poto.webp` | Le marché de Poto-Poto |
| `etal-legumes.webp` | Un étal de légumes frais |
| `poissons-fumes.webp` | Poissons fumés au marché |

Tant qu'une photo manque, sa diapositive affiche un fond indigo avec la légende.

## Format

| Réglage | Valeur |
|---|---|
| Format | WebP |
| Dimensions | 1 600 × 1 000 pixels, paysage 16:10 (le carrousel occupe jusqu'à 1 060 pixels de large sur un écran de 1 920) |
| Poids visé | moins de 180 Ko par photo |

Chaque photo n'est téléchargée qu'au moment où elle va s'afficher.

## Que photographier

Des vues des marchés et des étals, prises par l'équipe de préférence. La légende s'affiche sur le bas de l'image : gardez le sujet principal dans les deux tiers supérieurs.

Comme pour les produits, évitez les visages reconnaissables sans l'accord des personnes, et notez la source et la licence de toute photo qui ne vient pas de l'équipe.

## Ajouter ou retirer une photo

Chaque photo correspond à un bloc `<figure class="diapo">` dans `public/index.html`. Copiez ou supprimez un bloc, puis mettez à jour la numérotation de l'attribut `aria-label` (« 1 sur 4 », « 2 sur 4 »...). Les points de navigation se créent automatiquement.
