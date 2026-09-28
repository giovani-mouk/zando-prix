# language: fr
@story-6 @RM03
Fonctionnalité: Vérifier la fraîcheur du prix
  En tant qu'utilisateur
  Je veux connaître la date à laquelle le prix a été relevé
  Afin de savoir si l'information est récente

  Contexte:
    Étant donné les marchés suivants :
      | marché       |
      | Marché Total |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |

  Plan du scénario: La date de relevé est affichée avec un indicateur de fraîcheur
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 800  | kg    | <jours>               |
    Quand je choisis le produit "Riz"
    Alors le prix de "Riz" au "Marché Total" affiche sa date de relevé
    Et l'indicateur de fraîcheur du prix de "Riz" au "Marché Total" est "<couleur>"

    Exemples: Relevé depuis moins de 7 jours
      | jours | couleur |
      | 0     | vert    |
      | 1     | vert    |
      | 6     | vert    |

    Exemples: Relevé au-delà de 7 jours
      | jours | couleur |
      | 8     | orange  |
      | 30    | orange  |

  # Le cadrage ne tranche pas le cas de 7 jours pile.
  # Hypothèse : 7 jours n'est plus "moins de 7 jours", donc orange.
  @a-valider
  Scénario: Prix relevé il y a exactement 7 jours
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 800  | kg    | 7                     |
    Quand je choisis le produit "Riz"
    Alors l'indicateur de fraîcheur du prix de "Riz" au "Marché Total" est "orange"
