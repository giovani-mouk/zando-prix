# language: fr
@story-7 @RM06
Fonctionnalité: Proposer un prix
  En tant qu'utilisateur
  Je veux proposer un prix
  Afin de contribuer à l'amélioration des informations disponibles

  Contexte:
    Étant donné les marchés suivants :
      | marché        |
      | Marché Ouenzé |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |
    Et les prix relevés suivants :
      | produit | marché        | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Ouenzé | 780  | kg    | 5                     |

  Scénario: Envoyer une proposition valide
    Quand je propose le prix suivant :
      | produit | marché        | prix | unité | constaté il y a (jours) | auteur  |
      | Riz     | Marché Ouenzé | 750  | kg    | 0                       | Patrick |
    Alors ma proposition est enregistrée avec le statut "en attente"
    Et on me confirme que ma proposition sera vérifiée avant d'être publiée

  Scénario: Une proposition ne remplace pas le prix officiel
    Quand je propose le prix suivant :
      | produit | marché        | prix | unité | constaté il y a (jours) | auteur  |
      | Riz     | Marché Ouenzé | 750  | kg    | 0                       | Patrick |
    Et je choisis le produit "Riz"
    Alors je vois pour chaque marché :
      | marché        | prix | unité |
      | Marché Ouenzé | 780  | kg    |

  Scénario: L'auteur est facultatif
    Quand je propose le prix suivant :
      | produit | marché        | prix | unité | constaté il y a (jours) | auteur |
      | Riz     | Marché Ouenzé | 750  | kg    | 0                       |        |
    Alors ma proposition est enregistrée avec le statut "en attente"

  Plan du scénario: Une proposition incomplète ou incorrecte est refusée
    Quand je propose le prix suivant :
      | produit   | marché   | prix   | unité   | constaté il y a (jours) | auteur  |
      | <produit> | <marché> | <prix> | <unité> | <jours>                 | Patrick |
    Alors ma proposition est refusée
    Et on m'indique que le champ "<champ>" est invalide
    Et aucune proposition n'est enregistrée

    Exemples: Produit manquant ou inconnu
      | produit | marché        | prix | unité | jours | champ   |
      |         | Marché Ouenzé | 750  | kg    | 0     | produit |
      | Banane  | Marché Ouenzé | 750  | kg    | 0     | produit |

    Exemples: Marché manquant ou inconnu
      | produit | marché         | prix | unité | jours | champ  |
      | Riz     |                | 750  | kg    | 0     | marché |
      | Riz     | Marché Inconnu | 750  | kg    | 0     | marché |

    Exemples: Prix manquant, nul, négatif ou non entier (FCFA)
      | produit | marché        | prix  | unité | jours | champ |
      | Riz     | Marché Ouenzé |       | kg    | 0     | prix  |
      | Riz     | Marché Ouenzé | 0     | kg    | 0     | prix  |
      | Riz     | Marché Ouenzé | -100  | kg    | 0     | prix  |
      | Riz     | Marché Ouenzé | 750.5 | kg    | 0     | prix  |
      | Riz     | Marché Ouenzé | abc   | kg    | 0     | prix  |

    Exemples: Unité inconnue
      | produit | marché        | prix | unité | jours | champ |
      | Riz     | Marché Ouenzé | 750  | boîte | 0     | unité |

    # jours = -1 signifie demain : on ne peut pas constater un prix dans le futur
    Exemples: Date dans le futur
      | produit | marché        | prix | unité | jours | champ |
      | Riz     | Marché Ouenzé | 750  | kg    | -1    | date  |
