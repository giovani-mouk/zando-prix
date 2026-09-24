# language: fr
@admin @RM06
Fonctionnalité: Gérer les propositions depuis l'espace administrateur
  En tant qu'administrateur de Zando Prix
  Je veux corriger, publier ou supprimer les propositions reçues
  Afin que seuls des prix vérifiés soient affichés

  Règles convenues avec le PM :
  - publier une proposition la transforme en prix affiché (story 8) ;
  - supprimer une proposition la marque « rejetée » : elle reste dans l'historique ;
  - une proposition ne peut être corrigée que tant qu'elle est en attente
    (« l'opération est refusée » : conflit avec son statut ;
     « ma correction est refusée » : valeur saisie incorrecte) ;
  - chaque publication, suppression ou correction garde le nom de l'administrateur.

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
    # 7500 au lieu de 750 : une faute de frappe typique de l'utilisateur
    Et les propositions suivantes :
      | produit | marché          | prix | unité | statut     |
      | Riz     | Marché Ouenzé   | 7500 | kg    | en attente |
      | Oignon  | Marché Moungali | 900  | kg    | validée    |
    Et les administrateurs suivants :
      | nom           | e-mail             | mot de passe     | actif |
      | Grâce Mabiala | grace@zandoprix.cg | Manioc-2026-sur! | oui   |
    Et je suis connecté en tant que "grace@zandoprix.cg"

  # ---------------------------------------------------------------
  # Corriger avant de publier
  # ---------------------------------------------------------------

  Scénario: Corriger une proposition ne la publie pas
    Quand je corrige la proposition de "Riz" au "Marché Ouenzé" avec :
      | prix | unité | constaté il y a (jours) |
      | 750  | kg    | 1                       |
    Alors la proposition de "Riz" au "Marché Ouenzé" est toujours "en attente" avec un prix de 750
    Et le prix de "Riz" au "Marché Ouenzé" est de 780

  Scénario: Publier une proposition corrigée affiche le prix corrigé
    Quand je corrige la proposition de "Riz" au "Marché Ouenzé" avec :
      | prix | unité | constaté il y a (jours) |
      | 750  | kg    | 1                       |
    Et je publie la proposition de "Riz" au "Marché Ouenzé"
    Alors le prix de "Riz" au "Marché Ouenzé" est de 750
    Et le prix de "Riz" au "Marché Ouenzé" est indiqué comme provenant d'une proposition

  Scénario: On peut corriger le marché d'une proposition
    Quand je corrige la proposition de "Riz" au "Marché Ouenzé" avec :
      | marché          |
      | Marché Moungali |
    Alors la proposition de "Riz" au "Marché Moungali" est toujours "en attente" avec un prix de 7500

  Scénario: Une proposition déjà publiée ne peut plus être corrigée
    Quand je corrige la proposition de "Oignon" au "Marché Moungali" avec :
      | prix |
      | 950  |
    Alors l'opération est refusée
    Et la proposition de "Oignon" au "Marché Moungali" est toujours "validée" avec un prix de 900

  Scénario: Une proposition supprimée ne peut plus être corrigée
    Étant donné que j'ai supprimé la proposition de "Riz" au "Marché Ouenzé"
    Quand je corrige la proposition de "Riz" au "Marché Ouenzé" avec :
      | prix |
      | 750  |
    Alors l'opération est refusée
    Et la proposition de "Riz" au "Marché Ouenzé" est toujours "rejetée" avec un prix de 7500

  Plan du scénario: Une correction incorrecte est refusée avec les mêmes règles qu'une proposition
    Quand je corrige la proposition de "Riz" au "Marché Ouenzé" avec :
      | <champ modifié> |
      | <valeur>        |
    Alors ma correction est refusée
    Et on m'indique que le champ "<champ>" est invalide
    Et la proposition de "Riz" au "Marché Ouenzé" est toujours "en attente" avec un prix de 7500

    Exemples:
      | champ modifié           | valeur         | champ  |
      | prix                    | 0              | prix   |
      | prix                    | 750.5          | prix   |
      | unité                   | boîte          | unité  |
      | marché                  | Marché Inconnu | marché |
      | produit                 | Banane         | produit |
      | constaté il y a (jours) | -1             | date   |

  @a-valider
  Scénario: L'auteur d'une proposition ne peut pas être modifié
    Quand je corrige la proposition de "Riz" au "Marché Ouenzé" avec :
      | prix | auteur  |
      | 750  | Inconnu |
    Alors ma correction est refusée
    Et on m'indique que le champ "auteur" ne peut pas être modifié

  # ---------------------------------------------------------------
  # Supprimer
  # ---------------------------------------------------------------

  Scénario: Supprimer une proposition la garde dans l'historique
    Quand je supprime la proposition de "Riz" au "Marché Ouenzé"
    Alors le statut de cette proposition devient "rejetée"
    Et le prix de "Riz" au "Marché Ouenzé" est de 780
    Et je la retrouve parmi les propositions "rejetée"

  # ---------------------------------------------------------------
  # Traçabilité
  # ---------------------------------------------------------------

  Plan du scénario: On sait quel administrateur a traité une proposition
    Quand je <action> la proposition de "Riz" au "Marché Ouenzé"
    Alors cette proposition indique qu'elle a été <résultat> par "Grâce Mabiala"

    Exemples:
      | action    | résultat  |
      | publie    | publiée   |
      | supprime  | supprimée |

  @a-valider
  Scénario: On sait quel administrateur a corrigé une proposition
    Quand je corrige la proposition de "Riz" au "Marché Ouenzé" avec :
      | prix |
      | 750  |
    Alors cette proposition indique qu'elle a été corrigée par "Grâce Mabiala"
