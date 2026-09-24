# language: fr
@story-3
Fonctionnalité: Filtrer par marché
  En tant qu'utilisateur
  Je veux choisir un marché
  Afin de voir uniquement les informations qui le concernent

  Contexte:
    Étant donné les marchés suivants :
      | marché           |
      | Marché Total     |
      | Marché Poto-Poto |
      | Marché Ouenzé    |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |
      | Tomate  | kg                 |
    Et les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 800  | kg    | 2                     |
      | Riz     | Marché Poto-Poto | 700  | kg    | 1                     |
      | Tomate  | Marché Total     | 1200 | kg    | 3                     |
      | Tomate  | Marché Poto-Poto | 1000 | kg    | 1                     |

  Scénario: Seuls les prix du marché choisi sont affichés
    Quand je choisis le marché "Marché Total"
    Alors je vois les prix suivants :
      | produit | marché       | prix | unité |
      | Riz     | Marché Total | 800  | kg    |
      | Tomate  | Marché Total | 1200 | kg    |

  Scénario: Combiner le choix d'un produit et d'un marché
    Quand je choisis le produit "Riz"
    Et je choisis le marché "Marché Poto-Poto"
    Alors je vois les prix suivants :
      | produit | marché           | prix | unité |
      | Riz     | Marché Poto-Poto | 700  | kg    |

  Scénario: Un marché sans aucun prix
    Quand je choisis le marché "Marché Ouenzé"
    Alors on m'indique qu'aucun prix n'est disponible pour le marché "Marché Ouenzé"

  Scénario: Retirer le filtre affiche de nouveau tous les marchés
    Étant donné que j'ai choisi le marché "Marché Total"
    Quand je retire le filtre de marché
    Alors je vois les prix suivants :
      | produit | marché           | prix | unité |
      | Riz     | Marché Total     | 800  | kg    |
      | Riz     | Marché Poto-Poto | 700  | kg    |
      | Tomate  | Marché Total     | 1200 | kg    |
      | Tomate  | Marché Poto-Poto | 1000 | kg    |

  Scénario: Choisir un marché inconnu
    Quand je choisis le marché "Marché Inconnu"
    Alors on m'indique que le marché "Marché Inconnu" n'existe pas
