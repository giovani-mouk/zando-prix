# language: fr
@proposition @suivi
Fonctionnalité: Préciser comment un prix a été constaté
  En tant qu'utilisateur qui propose un prix
  Je veux indiquer comment je l'ai constaté et où exactement
  Afin d'aider l'équipe à le vérifier

  # Formulaire « Proposer un prix » de la maquette du PM.
  # Règles :
  # - le type de constatation (relevé sur l'étal, ticket, pesée) et le repère
  #   sont facultatifs ;
  # - le repère (« Hangar 3, en face de la pharmacie ») peut désigner une
  #   vendeuse : il est réservé à l'équipe et n'apparaît jamais publiquement ;
  # - l'équipe retrouve une proposition dans son registre par son numéro ;
  #   le repère n'y figure pas (il reste dans la fiche de modération).

  Contexte:
    Étant donné les marchés suivants :
      | marché        |
      | Marché Ouenzé |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |

  Scénario: Proposer un prix avec son type de constatation et un repère
    Quand je propose le prix suivant avec des précisions :
      | produit | marché        | prix | unité | constat | repère                 |
      | Riz     | Marché Ouenzé | 750  | kg    | ticket  | Hangar 3, allée du riz |
    Alors ma proposition est enregistrée avec le statut "en attente"
    Quand je suis connecté en tant qu'administrateur
    Alors l'équipe voit que ce prix a été constaté par "ticket" avec le repère "Hangar 3, allée du riz"

  Scénario: Les précisions sont facultatives
    Quand je propose le prix suivant avec des précisions :
      | produit | marché        | prix | unité | constat | repère |
      | Riz     | Marché Ouenzé | 750  | kg    |         |        |
    Alors ma proposition est enregistrée avec le statut "en attente"

  Plan du scénario: Des précisions incorrectes sont refusées
    Quand je propose le prix suivant avec des précisions :
      | produit | marché        | prix | unité | constat   | repère   |
      | Riz     | Marché Ouenzé | 750  | kg    | <constat> | <repère> |
    Alors ma proposition est refusée
    Et on m'indique que le champ "<champ>" est invalide

    Exemples:
      | constat  | repère                  | champ                  |
      | rumeur   |                         | type de constatation   |
      | direct   | 121 caractères          | repère                 |

  Scénario: L'équipe retrouve la proposition par son numéro, sans le repère
    Quand je propose le prix suivant avec des précisions :
      | produit | marché        | prix | unité | constat | repère                 |
      | Riz     | Marché Ouenzé | 750  | kg    | direct  | Étal de Maman Awa      |
    Et je suis connecté en tant qu'administrateur
    Et je consulte ma proposition dans le registre public
    Alors je la retrouve avec sa référence, son prix de 750 et le statut "en attente"
    Et le registre public ne contient pas "Maman Awa"

  Scénario: Une référence inconnue n'existe pas dans le registre
    Étant donné que je suis connecté en tant qu'administrateur
    Quand je consulte la proposition numéro 999999 dans le registre public
    Alors la proposition est introuvable

  # ---------------------------------------------------------------
  # Suivi privé : le registre est réservé à l'équipe (décision du PM) ;
  # la personne qui propose un prix reçoit une clé pour suivre le sien.
  # ---------------------------------------------------------------

  Scénario: Suivre sa propre proposition grâce à sa clé de suivi
    Quand je propose le prix suivant avec des précisions :
      | produit | marché        | prix | unité | constat | repère            |
      | Riz     | Marché Ouenzé | 750  | kg    | direct  | Étal de Maman Awa |
    Et je suis ma proposition avec la clé reçue
    Alors je la retrouve avec sa référence, son prix de 750 et le statut "en attente"
    Et le registre public ne contient pas "Maman Awa"

  Scénario: Sans la bonne clé, la proposition reste introuvable
    Quand je propose le prix suivant avec des précisions :
      | produit | marché        | prix | unité | constat | repère |
      | Riz     | Marché Ouenzé | 750  | kg    |         |        |
    Et je suis ma proposition avec la clé "une-cle-inventee"
    Alors la proposition est introuvable

