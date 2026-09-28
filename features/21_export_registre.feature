# language: fr
@suivi @export
Fonctionnalité: Exporter et imprimer le registre des propositions
  En tant qu'administrateur (le registre est réservé à l'équipe)
  Je veux extraire le registre sur une période et un marché
  Afin de l'imprimer ou de l'analyser

  # Écran « Export & Impression du Registre » de la maquette du PM.
  # Règles :
  # - la période porte sur la date où le prix a été constaté ;
  # - l'export demande toutes les lignes d'un coup (pas de pages de 25) ;
  # - le type de constatation est public ; le repère et l'auteur ne le sont jamais.

  Contexte:
    Étant donné les marchés suivants :
      | marché        |
      | Marché Ouenzé |
      | Marché Total  |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |
    Et les propositions suivantes :
      | produit | marché        | prix | unité | statut     | constatée il y a (jours) | constat | auteur  |
      | Riz     | Marché Ouenzé | 750  | kg    | en attente | 2                        | ticket  | Patrick |
      | Riz     | Marché Total  | 800  | kg    | validée    | 20                       | direct  |         |
    Et je suis connecté en tant qu'administrateur

  Scénario: Limiter l'export aux prix constatés depuis une date
    Quand j'exporte le registre des prix constatés depuis 7 jours
    Alors l'export contient 1 proposition
    Et la proposition du "Marché Ouenzé" indique le type de constatation "ticket"

  Scénario: L'export donne toutes les lignes d'un coup
    Étant donné que 30 propositions en attente ont été reçues pour le "Riz" au "Marché Ouenzé"
    Quand j'exporte tout le registre
    Alors l'export contient 32 propositions

  Scénario: Le fichier CSV suit les mêmes filtres et ne contient aucun nom
    Quand je télécharge au format CSV le registre des prix constatés depuis 7 jours
    Alors je reçois un fichier CSV de 2 lignes, en-tête compris
    Et le fichier ne contient ni "Patrick" ni "auteur"

  Scénario: Une date de début incorrecte est refusée
    Quand j'exporte le registre depuis la date "31/12/2026"
    Alors l'export est refusé
    Et on m'indique que le champ "date de début" est invalide
