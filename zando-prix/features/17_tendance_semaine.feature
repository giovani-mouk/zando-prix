# language: fr
@tendance @a-valider
Fonctionnalité: Voir la tendance des prix de la semaine
  En tant qu'utilisateur
  Je veux savoir si les prix montent ou baissent
  Afin de choisir le bon moment pour acheter

  # Bandeau « Tendance globale de la semaine » de la maquette du PM.
  # Hypothèses à valider :
  # - on compare, pour chaque produit et chaque marché, le prix en vigueur
  #   aujourd'hui avec celui en vigueur il y a 7 jours (dernier relevé à cette date) ;
  # - seuls les prix dans l'unité de référence comptent (RM05) ;
  # - la variation d'un produit est la moyenne de ses marchés, celle d'une
  #   catégorie la moyenne de ses produits ;
  # - moins de 2 % de variation générale, dans un sens ou dans l'autre : « stabilité ».
  # Aucune explication n'est inventée : on dit ce qui varie, pas pourquoi.

  Contexte:
    Étant donné les marchés suivants :
      | marché           |
      | Marché Total     |
      | Marché Poto-Poto |
    Et les produits suivants :
      | produit | unité de référence | catégorie |
      | Riz     | kg                 | Céréales  |
      | Tomate  | kg                 | Légumes   |

  Scénario: La catégorie qui varie le plus est mise en avant
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000 | kg    | 10                    |
      | Riz     | Marché Total | 1000 | kg    | 1                     |
      | Tomate  | Marché Total | 500  | kg    | 10                    |
      | Tomate  | Marché Total | 400  | kg    | 2                     |
    Quand je consulte la tendance de la semaine
    Alors la catégorie qui varie le plus est "Légumes" avec une variation de -20 %
    Et la variation générale est de -10 %
    Et la tendance générale est "baisse"

  Scénario: Des prix presque identiques sont présentés comme stables
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000 | kg    | 10                    |
      | Riz     | Marché Total | 1010 | kg    | 1                     |
    Quand je consulte la tendance de la semaine
    Alors la variation générale est de 1 %
    Et la tendance générale est "stabilité"

  Scénario: Un prix dans une autre unité n'est pas pris en compte
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000 | kg    | 10                    |
      | Riz     | Marché Total | 300  | tas   | 1                     |
    Quand je consulte la tendance de la semaine
    Alors la variation générale est de 0 %

  Scénario: La courbe de la semaine a un point par jour
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000 | kg    | 10                    |
      | Riz     | Marché Total | 800  | kg    | 3                     |
    Quand je consulte la tendance de la semaine
    Alors la courbe de la semaine compte 8 points, de 100 à 80

  Scénario: Sans relevé datant d'au moins 7 jours, aucune tendance n'est calculée
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000 | kg    | 2                     |
    Quand je consulte la tendance de la semaine
    Alors aucune tendance n'est disponible
