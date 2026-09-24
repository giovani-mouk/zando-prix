# language: fr
@story-2 @RM01 @RM04
Fonctionnalité: Consulter les prix d'un produit
  En tant qu'utilisateur
  Je veux choisir un produit
  Afin de voir les prix proposés dans les différents marchés

  Contexte:
    Étant donné les marchés suivants :
      | marché           |
      | Marché Total     |
      | Marché Poto-Poto |
      | Marché Moungali  |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |
      | Manioc  | kg                 |
    Et les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 800  | kg    | 2                     |
      | Riz     | Marché Poto-Poto | 700  | kg    | 1                     |
      | Manioc  | Marché Total     | 600  | kg    | 1                     |

  Scénario: Voir les prix d'un produit dans tous les marchés
    Quand je choisis le produit "Riz"
    Alors je vois pour chaque marché :
      | marché           | prix           | unité |
      | Marché Total     | 800            | kg    |
      | Marché Poto-Poto | 700            | kg    |
      | Marché Moungali  | non disponible |       |

  Scénario: Les prix des autres produits ne sont pas affichés
    Quand je choisis le produit "Manioc"
    Alors je ne vois aucun prix pour le produit "Riz"

  Scénario: Choisir un produit inconnu
    Quand je choisis le produit "Banane"
    Alors on m'indique que le produit "Banane" n'existe pas
