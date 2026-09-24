# language: fr
@story-4
Fonctionnalité: Rechercher un produit
  En tant qu'utilisateur
  Je veux rechercher un produit
  Afin de le retrouver rapidement

  Contexte:
    Étant donné les produits suivants :
      | produit        | unité de référence |
      | Riz            | kg                 |
      | Huile de palme | litre              |
      | Poisson salé   | kg                 |
      | Tomate         | kg                 |

  Plan du scénario: Trouver un produit à partir de son nom
    Quand je recherche "<recherche>"
    Alors je vois uniquement le produit "<résultat>"

    Exemples: Nom exact
      | recherche      | résultat       |
      | Riz            | Riz            |
      | Huile de palme | Huile de palme |

    Exemples: Majuscules et minuscules
      | recherche | résultat |
      | riz       | Riz      |
      | RIZ       | Riz      |
      | tOmAtE    | Tomate   |

    Exemples: Nom partiel
      | recherche | résultat       |
      | huile     | Huile de palme |
      | palme     | Huile de palme |
      | tom       | Tomate         |

  Scénario: Plusieurs produits correspondent à la recherche
    Quand je recherche "i"
    Alors je vois uniquement les produits suivants :
      | produit        |
      | Riz            |
      | Huile de palme |
      | Poisson salé   |

  Scénario: Les espaces autour de la recherche sont ignorés
    Quand je recherche "   tomate  "
    Alors je vois uniquement le produit "Tomate"

  Scénario: Une recherche vide affiche tous les produits
    Quand je recherche ""
    Alors je vois uniquement les produits suivants :
      | produit        |
      | Riz            |
      | Huile de palme |
      | Poisson salé   |
      | Tomate         |

  Scénario: Aucun produit ne correspond
    Quand je recherche "Banane"
    Alors on m'indique qu'aucun produit ne correspond à "Banane"

  # Hypothèse : beaucoup d'utilisateurs tapent sans accents sur téléphone.
  # Pas demandé dans le cadrage, à confirmer avec le PM.
  @a-valider
  Scénario: La recherche ne tient pas compte des accents
    Quand je recherche "poisson sale"
    Alors je vois uniquement le produit "Poisson salé"
