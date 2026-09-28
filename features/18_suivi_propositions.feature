# language: fr
@suivi @a-valider
Fonctionnalité: Suivre les propositions de prix (équipe)
  En tant qu'administrateur de Zando Prix
  Je veux voir le registre de toutes les propositions et les confirmations reçues
  Afin de suivre le travail de vérification

  # Écran « Suivi des propositions » de la maquette du PM.
  # Règles (hypothèses à valider) :
  # - le registre est réservé à l'équipe (décision du PM) : sans connexion,
  #   il est fermé ; même là, le nom ou pseudo de l'auteur n'y figure pas ;
  # - « prix précédent » = dernier prix connu pour ce produit, ce marché et
  #   cette unité à la date où le prix a été vu ;
  # - une connexion ne peut confirmer qu'une fois la même proposition, et
  #   seulement tant qu'elle est en attente ;
  # - les confirmations aident l'équipe : elles ne publient rien seules.

  Contexte:
    Étant donné les marchés suivants :
      | marché        |
      | Marché Ouenzé |
      | Marché Total  |
    Et les produits suivants :
      | produit | unité de référence | catégorie |
      | Riz     | kg                 | Céréales  |
      | Oignon  | kg                 | Légumes   |
    Et les prix relevés suivants :
      | produit | marché        | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Ouenzé | 800  | kg    | 5                     |
    Et les propositions suivantes :
      | produit | marché        | prix | unité | statut     | auteur  |
      | Riz     | Marché Ouenzé | 750  | kg    | en attente | Patrick |
      | Oignon  | Marché Total  | 900  | kg    | validée    | Awa     |
    Et je suis connecté en tant qu'administrateur

  # ---------------------------------------------------------------
  # Registre public
  # ---------------------------------------------------------------

  Scénario: Le registre montre chaque proposition avec son statut
    Quand je consulte le registre des propositions
    Alors je vois les propositions suivantes dans le registre :
      | référence  | produit | marché        | prix | statut     |
      | #PROP-0001 | Riz     | Marché Ouenzé | 750  | en attente |
      | #PROP-0002 | Oignon  | Marché Total  | 900  | validée    |

  Scénario: Le nom de l'auteur n'est jamais publié
    Quand je consulte le registre des propositions
    Alors le registre ne contient ni "Patrick" ni "Awa"

  Scénario: Chaque proposition est comparée au prix précédent
    Quand je consulte le registre des propositions
    Alors la proposition "#PROP-0001" a un prix précédent de 800 et un écart de -50

  Scénario: Les chiffres du registre sont calculés sur les propositions réelles
    Quand je consulte le registre des propositions
    Alors le registre compte 2 propositions ce mois-ci, dont 1 en attente et 1 validée

  Scénario: Le registre se télécharge au format CSV, sans nom d'auteur
    Quand je télécharge le registre au format CSV
    Alors je reçois un fichier CSV de 3 lignes, en-tête compris
    Et le fichier ne contient ni "Patrick" ni "Awa"

  # ---------------------------------------------------------------
  # Confirmer un prix proposé (ouvert à tous)
  # ---------------------------------------------------------------

  Scénario: Confirmer un prix en attente
    Quand je confirme la proposition "#PROP-0001" comme "acheteur" avec le prix "identique"
    Alors ma confirmation est enregistrée
    Et la proposition "#PROP-0001" compte 1 confirmation identique et 0 avec un écart

  Scénario: Signaler un écart sur un prix en attente
    Quand je confirme la proposition "#PROP-0001" comme "commerçant" avec le prix "différent"
    Alors ma confirmation est enregistrée
    Et la proposition "#PROP-0001" compte 0 confirmation identique et 1 avec un écart

  Scénario: On ne confirme qu'une fois la même proposition
    Étant donné que j'ai déjà confirmé la proposition "#PROP-0001"
    Quand je confirme la proposition "#PROP-0001" comme "acheteur" avec le prix "identique"
    Alors l'opération est refusée
    Et la proposition "#PROP-0001" compte 1 confirmation identique et 0 avec un écart

  Scénario: Une proposition déjà traitée ne peut plus être confirmée
    Quand je confirme la proposition "#PROP-0002" comme "acheteur" avec le prix "identique"
    Alors l'opération est refusée

  Plan du scénario: Une confirmation incorrecte est refusée
    Quand je confirme la proposition "#PROP-0001" avec :
      | rôle   | prix   | commentaire   |
      | <rôle> | <prix> | <commentaire> |
    Alors ma confirmation est refusée
    Et on m'indique que le champ "<champ>" est invalide

    Exemples:
      | rôle     | prix      | commentaire | champ   |
      | pirate   | identique |             | rôle    |
      | acheteur |           |             | constat |

  Scénario: Sans connexion, le registre et son export sont fermés
    Étant donné que je me suis déconnecté
    Quand j'essaie de consulter le registre des propositions
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."
    Quand j'essaie de télécharger le registre au format CSV
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."
