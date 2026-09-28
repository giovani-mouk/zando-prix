# language: fr
@prix @confirmation
Fonctionnalité: Confirmer un prix affiché
  En tant que visiteur qui revient du marché
  Je veux dire si le prix affiché est toujours le bon
  Afin que les autres sachent à quel point s'y fier

  # Bouton « Confirmer » de la maquette (accueil mobile, fiche produit).
  # Règles :
  # - on ne confirme que le prix affiché, pas un ancien relevé remplacé ;
  # - une seule réponse par connexion et par prix ;
  # - c'est un signal pour l'équipe : le prix n'est jamais modifié automatiquement.

  Contexte:
    Étant donné les marchés suivants :
      | marché       |
      | Marché Total |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |
    Et les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 1000 | kg    | 10                    |
      | Riz     | Marché Total | 1100 | kg    | 1                     |

  Scénario: Confirmer que le prix affiché est toujours le bon
    Quand je réponds que le prix de 1100 FCFA du "Riz" au "Marché Total" est toujours le même
    Alors ma réponse est enregistrée
    Et le prix du "Riz" au "Marché Total" compte 1 confirmation et 0 signalement

  Scénario: Signaler que le prix a changé
    Quand je réponds que le prix de 1100 FCFA du "Riz" au "Marché Total" a changé
    Alors ma réponse est enregistrée
    Et le prix du "Riz" au "Marché Total" compte 0 confirmation et 1 signalement
    Et le prix affiché du "Riz" au "Marché Total" reste de 1100

  Scénario: Une seule réponse par personne et par prix
    Étant donné que j'ai déjà répondu pour le prix de 1100 FCFA du "Riz" au "Marché Total"
    Quand je réponds que le prix de 1100 FCFA du "Riz" au "Marché Total" est toujours le même
    Alors l'opération est refusée

  Scénario: Un ancien relevé, déjà remplacé, ne se confirme plus
    Quand je réponds que le prix de 1000 FCFA du "Riz" au "Marché Total" est toujours le même
    Alors l'opération est refusée

  Scénario: Une réponse sans avis est refusée
    Quand j'envoie une réponse sans avis pour le prix de 1100 FCFA du "Riz" au "Marché Total"
    Alors ma réponse est refusée
    Et on m'indique que le champ "avis" est invalide

  Scénario: Un prix inconnu n'existe pas
    Quand je réponds pour le prix numéro 999999
    Alors le prix est introuvable
