# language: fr
@story-5 @RM02
Fonctionnalité: Identifier le meilleur prix
  En tant qu'utilisateur
  Je veux savoir dans quel marché le produit est proposé au prix le plus bas
  Afin de pouvoir comparer les possibilités

  Contexte:
    Étant donné les marchés suivants :
      | marché           |
      | Marché Total     |
      | Marché Poto-Poto |
      | Marché Moungali  |
      | Marché Ouenzé    |
    Et les produits suivants :
      | produit        | unité de référence |
      | Riz            | kg                 |
      | Manioc         | kg                 |
      | Tomate         | kg                 |
      | Huile de palme | litre              |
      | Poisson salé   | kg                 |

  Scénario: Le prix le plus bas est identifié comme meilleur prix
    Étant donné les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 800  | kg    | 2                     |
      | Riz     | Marché Poto-Poto | 700  | kg    | 1                     |
      | Riz     | Marché Moungali  | 850  | kg    | 3                     |
    Quand je choisis le produit "Riz"
    Alors le meilleur prix pour "Riz" est uniquement au "Marché Poto-Poto"

  Scénario: Un ancien relevé plus bas n'est pas pris en compte
    Étant donné les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 650  | kg    | 20                    |
      | Riz     | Marché Total     | 800  | kg    | 2                     |
      | Riz     | Marché Poto-Poto | 700  | kg    | 1                     |
    Quand je choisis le produit "Riz"
    Alors le meilleur prix pour "Riz" est uniquement au "Marché Poto-Poto"

  Scénario: Un prix unique est le meilleur prix
    Étant donné les prix relevés suivants :
      | produit        | marché       | prix | unité | relevé il y a (jours) |
      | Huile de palme | Marché Total | 1300 | litre | 4                     |
    Quand je choisis le produit "Huile de palme"
    Alors le meilleur prix pour "Huile de palme" est uniquement au "Marché Total"

  Scénario: Pas de meilleur prix quand aucun prix n'est disponible
    Quand je choisis le produit "Poisson salé"
    Alors aucun meilleur prix n'est identifié pour "Poisson salé"

  @RM06
  Scénario: Une proposition en attente n'est pas prise en compte
    Étant donné les prix relevés suivants :
      | produit | marché        | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total  | 800  | kg    | 2                     |
      | Riz     | Marché Ouenzé | 780  | kg    | 5                     |
    Et les propositions suivantes :
      | produit | marché          | prix | unité | statut     |
      | Riz     | Marché Moungali | 500  | kg    | en attente |
    Quand je choisis le produit "Riz"
    Alors le meilleur prix pour "Riz" est uniquement au "Marché Ouenzé"

  # Hypothèse RM05 : un prix dans une autre unité que l'unité de référence
  # est affiché mais exclu de la comparaison. À confirmer avec le PM.
  @RM05 @a-valider
  Scénario: Un prix dans une unité non comparable est exclu
    Étant donné les prix relevés suivants :
      | produit | marché          | prix | unité | relevé il y a (jours) |
      | Manioc  | Marché Total    | 600  | kg    | 1                     |
      | Manioc  | Marché Moungali | 550  | kg    | 10                    |
      | Manioc  | Marché Ouenzé   | 500  | tas   | 3                     |
    Quand je choisis le produit "Manioc"
    Alors le meilleur prix pour "Manioc" est uniquement au "Marché Moungali"
    Et le prix de "Manioc" au "Marché Ouenzé" est indiqué comme non comparable

  # Hypothèse : en cas d'égalité, tous les marchés concernés sont marqués.
  @a-valider
  Scénario: Plusieurs marchés à égalité au prix le plus bas
    Étant donné les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Tomate  | Marché Total     | 1200 | kg    | 2                     |
      | Tomate  | Marché Poto-Poto | 1000 | kg    | 3                     |
      | Tomate  | Marché Moungali  | 1000 | kg    | 1                     |
    Quand je choisis le produit "Tomate"
    Alors le meilleur prix pour "Tomate" est aux marchés suivants :
      | marché           |
      | Marché Poto-Poto |
      | Marché Moungali  |

  # Hypothèse : le meilleur prix se calcule sur tous les marchés,
  # même quand l'utilisateur en a filtré un seul. À confirmer avec le PM.
  @a-valider
  Scénario: Le filtre de marché ne change pas le meilleur prix
    Étant donné les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 800  | kg    | 2                     |
      | Riz     | Marché Poto-Poto | 700  | kg    | 1                     |
    Quand je choisis le produit "Riz"
    Et je choisis le marché "Marché Total"
    Alors le prix de "Riz" au "Marché Total" n'est pas identifié comme meilleur prix
