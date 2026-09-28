# language: fr
@story-8 @RM06 @admin
Fonctionnalité: Suivre une proposition
  En tant qu'administrateur de Zando Prix
  Je veux pouvoir distinguer les propositions reçues
  Afin de publier ou supprimer chacune d'elles

  Contexte:
    Étant donné les marchés suivants :
      | marché          |
      | Marché Ouenzé   |
      | Marché Moungali |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |
      | Oignon  | kg                 |
    Et les prix relevés suivants :
      | produit | marché        | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Ouenzé | 780  | kg    | 5                     |
    Et les propositions suivantes :
      | produit | marché          | prix | unité | statut     |
      | Riz     | Marché Ouenzé   | 750  | kg    | en attente |
      | Oignon  | Marché Moungali | 900  | kg    | validée    |
      | Riz     | Marché Moungali | 5000 | kg    | rejetée    |
    Et je suis connecté en tant qu'administrateur

  Scénario: Voir toutes les propositions avec leur statut
    Quand je consulte les propositions
    Alors je vois les propositions suivantes :
      | produit | marché          | prix | statut     |
      | Riz     | Marché Ouenzé   | 750  | en attente |
      | Oignon  | Marché Moungali | 900  | validée    |
      | Riz     | Marché Moungali | 5000 | rejetée    |

  Scénario: Voir uniquement les propositions en attente
    Quand je consulte les propositions "en attente"
    Alors je vois les propositions suivantes :
      | produit | marché        | prix | statut     |
      | Riz     | Marché Ouenzé | 750  | en attente |

  Scénario: Valider une proposition la publie comme prix
    Quand je valide la proposition de "Riz" au "Marché Ouenzé"
    Alors le statut de cette proposition devient "validée"
    Et le prix de "Riz" au "Marché Ouenzé" est de 750
    Et le prix de "Riz" au "Marché Ouenzé" est indiqué comme provenant d'une proposition

  Scénario: Rejeter une proposition ne change pas le prix
    Quand je rejette la proposition de "Riz" au "Marché Ouenzé"
    Alors le statut de cette proposition devient "rejetée"
    Et le prix de "Riz" au "Marché Ouenzé" est de 780

  Plan du scénario: Une proposition déjà traitée ne peut plus changer de statut
    Quand je <action> la proposition de "<produit>" au "<marché>"
    Alors l'opération est refusée
    Et le statut de cette proposition reste "<statut>"

    Exemples:
      | action  | produit | marché          | statut  |
      | rejette | Oignon  | Marché Moungali | validée |
      | valide  | Oignon  | Marché Moungali | validée |
      | valide  | Riz     | Marché Moungali | rejetée |
      | rejette | Riz     | Marché Moungali | rejetée |
