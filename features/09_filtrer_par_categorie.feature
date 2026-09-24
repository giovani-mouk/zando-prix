# language: fr
@categories @a-valider
Fonctionnalité: Filtrer par catégorie
  En tant qu'utilisateur
  Je veux choisir une catégorie de produits
  Afin de voir d'un coup les prix de tous les produits de cette catégorie

  # Hors cadrage : proposé pendant le sprint, à valider par le PM.

  Contexte:
    Étant donné les marchés suivants :
      | marché           |
      | Marché Total     |
      | Marché Poto-Poto |
    Et les produits suivants :
      | produit | unité de référence | catégorie |
      | Riz     | kg                 | Céréales  |
      | Tomate  | kg                 | Légumes   |
      | Oignon  | kg                 | Légumes   |
    Et les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 800  | kg    | 2                     |
      | Tomate  | Marché Total     | 1200 | kg    | 3                     |
      | Tomate  | Marché Poto-Poto | 1000 | kg    | 1                     |
      | Oignon  | Marché Poto-Poto | 950  | kg    | 5                     |

  Scénario: Seuls les produits de la catégorie choisie sont affichés
    Quand je choisis la catégorie "Légumes"
    Alors je vois les prix suivants :
      | produit | marché           | prix | unité |
      | Tomate  | Marché Total     | 1200 | kg    |
      | Tomate  | Marché Poto-Poto | 1000 | kg    |
      | Oignon  | Marché Poto-Poto | 950  | kg    |

  Scénario: Combiner une catégorie et un marché
    Quand je choisis la catégorie "Légumes"
    Et je choisis le marché "Marché Total"
    Alors je vois les prix suivants :
      | produit | marché       | prix | unité |
      | Tomate  | Marché Total | 1200 | kg    |

  Scénario: Retirer le filtre de catégorie affiche de nouveau tous les produits
    Étant donné que j'ai choisi la catégorie "Légumes"
    Quand je retire le filtre de catégorie
    Alors je vois les prix suivants :
      | produit | marché           | prix | unité |
      | Riz     | Marché Total     | 800  | kg    |
      | Tomate  | Marché Total     | 1200 | kg    |
      | Tomate  | Marché Poto-Poto | 1000 | kg    |
      | Oignon  | Marché Poto-Poto | 950  | kg    |

  Scénario: Chaque produit indique sa catégorie
    Quand je consulte les prix
    Alors le produit "Riz" est classé dans la catégorie "Céréales"
    Et le produit "Tomate" est classé dans la catégorie "Légumes"

  Scénario: Choisir une catégorie inconnue
    Quand je choisis la catégorie "Fruits"
    Alors on m'indique que la catégorie "Fruits" n'existe pas
