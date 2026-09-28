# language: fr
@historique @a-valider
Fonctionnalité: Consulter l'historique et la stabilité du prix d'un produit
  En tant qu'utilisateur
  Je veux voir les derniers relevés d'un produit et savoir si son prix est stable
  Afin de juger de la fiabilité d'un prix avant d'aller au marché

  # Fiche produit de la maquette du PM. Hypothèses à valider :
  # - l'historique montre les 10 derniers prix publiés, tous marchés confondus,
  #   sans jamais nommer la personne qui les a relevés ou proposés ;
  # - stabilité sur 30 jours : pour chaque marché, l'écart entre le prix en
  #   vigueur aujourd'hui et celui en vigueur il y a 30 jours (unité de
  #   référence seulement), puis la moyenne de ces écarts ;
  # - moins de 2,5 % : « très stable » ; moins de 7 % : « stable » ;
  #   moins de 15 % : « variable » ; au-delà : « instable ».

  Contexte:
    Étant donné les marchés suivants :
      | marché           |
      | Marché Total     |
      | Marché Poto-Poto |
    Et les produits suivants :
      | produit | unité de référence | catégorie |
      | Riz     | kg                 | Céréales  |

  Scénario: Les derniers relevés, du plus récent au plus ancien
    Étant donné les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 1000 | kg    | 40                    |
      | Riz     | Marché Total     | 1020 | kg    | 3                     |
      | Riz     | Marché Poto-Poto | 900  | kg    | 10                    |
    Quand je consulte l'historique du produit "Riz"
    Alors je vois les relevés suivants dans l'historique, dans cet ordre :
      | marché           | prix | relevé il y a (jours) |
      | Marché Total     | 1020 | 3                     |
      | Marché Poto-Poto | 900  | 10                    |
      | Marché Total     | 1000 | 40                    |

  Plan du scénario: La stabilité dépend de l'écart sur 30 jours
    Étant donné les prix relevés suivants :
      | produit | marché       | prix     | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000     | kg    | 40                    |
      | Riz     | Marché Total | <récent> | kg    | 2                     |
    Quand je consulte l'historique du produit "Riz"
    Alors le prix du produit est "<niveau>", avec une fluctuation de <fluctuation> %

    Exemples:
      | récent | niveau      | fluctuation |
      | 1020   | très stable | 2           |
      | 1050   | stable      | 5           |
      | 900    | variable    | 10          |
      | 1200   | instable    | 20          |

  Scénario: La stabilité se calcule marché par marché, puis en moyenne
    Étant donné les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 1000 | kg    | 40                    |
      | Riz     | Marché Total     | 1000 | kg    | 1                     |
      | Riz     | Marché Poto-Poto | 1000 | kg    | 35                    |
      | Riz     | Marché Poto-Poto | 1100 | kg    | 1                     |
    Quand je consulte l'historique du produit "Riz"
    Alors le prix du produit est "stable", avec une fluctuation de 5 %

  Scénario: Un prix dans une autre unité ne compte pas dans la stabilité
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000 | kg    | 40                    |
      | Riz     | Marché Total | 300  | tas   | 1                     |
    Quand je consulte l'historique du produit "Riz"
    Alors le prix du produit est "très stable", avec une fluctuation de 0 %

  Scénario: Sans prix vieux d'au moins 30 jours, la stabilité n'est pas connue
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000 | kg    | 5                     |
    Quand je consulte l'historique du produit "Riz"
    Alors la stabilité du prix n'est pas encore connue

  Scénario: L'historique d'un produit inconnu est refusé
    Quand je consulte l'historique du produit "Banane"
    Alors on m'indique que le produit "Banane" n'existe pas
