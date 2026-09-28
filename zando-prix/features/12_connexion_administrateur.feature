# language: fr
@admin @securite
Fonctionnalité: Se connecter à l'espace administrateur
  En tant qu'administrateur de Zando Prix
  Je veux accéder à la gestion des propositions avec un compte personnel
  Afin que seules les personnes autorisées puissent publier des prix

  Règles :
  - les comptes sont créés en ligne de commande, jamais par inscription sur le site ;
  - un message d'échec ne dit jamais si c'est l'e-mail ou le mot de passe qui est faux ;
  - proposer un prix reste ouvert à tous, sans compte.

  Contexte:
    Étant donné les marchés suivants :
      | marché        |
      | Marché Ouenzé |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |
    Et les propositions suivantes :
      | produit | marché        | prix | unité | statut     |
      | Riz     | Marché Ouenzé | 750  | kg    | en attente |
    Et les administrateurs suivants :
      | nom           | e-mail             | mot de passe     | actif |
      | Grâce Mabiala | grace@zandoprix.cg | Manioc-2026-sur! | oui   |
      | Jean Okemba   | jean@zandoprix.cg  | Saka-Saka-2026!  | non   |

  # ---------------------------------------------------------------
  # Connexion
  # ---------------------------------------------------------------

  Scénario: Se connecter avec un e-mail et un mot de passe corrects
    Quand je me connecte avec "grace@zandoprix.cg" et "Manioc-2026-sur!"
    Alors je suis connecté sous le nom "Grâce Mabiala"

  Scénario: L'e-mail ne tient pas compte des majuscules
    Quand je me connecte avec "Grace@ZandoPrix.CG" et "Manioc-2026-sur!"
    Alors je suis connecté sous le nom "Grâce Mabiala"

  Plan du scénario: Des identifiants incorrects sont refusés sans dire lequel est faux
    Quand je me connecte avec "<e-mail>" et "<mot de passe>"
    Alors la connexion est refusée avec le message "E-mail ou mot de passe incorrect."
    Et je ne suis pas connecté

    Exemples:
      | e-mail               | mot de passe     | cas                        |
      | grace@zandoprix.cg   | manioc-2026-sur! | mot de passe faux (casse)  |
      | grace@zandoprix.cg   |                  | mot de passe vide          |
      | inconnu@zandoprix.cg | Manioc-2026-sur! | e-mail inconnu             |
      |                      |                  | formulaire vide            |
      | jean@zandoprix.cg    | Saka-Saka-2026!  | compte désactivé           |

  @a-valider
  Scénario: Le compte est bloqué 15 minutes après 5 échecs
    Étant donné que 5 tentatives de connexion ont échoué pour "grace@zandoprix.cg" il y a 2 minutes
    Quand je me connecte avec "grace@zandoprix.cg" et "Manioc-2026-sur!"
    Alors la connexion est refusée avec le message "Trop de tentatives. Réessayez dans 15 minutes."
    Et je ne suis pas connecté

  @a-valider
  Scénario: Le blocage est levé au bout de 15 minutes
    Étant donné que 5 tentatives de connexion ont échoué pour "grace@zandoprix.cg" il y a 16 minutes
    Quand je me connecte avec "grace@zandoprix.cg" et "Manioc-2026-sur!"
    Alors je suis connecté sous le nom "Grâce Mabiala"

  Scénario: Un e-mail inconnu est bloqué de la même façon qu'un e-mail existant
    Étant donné que 5 tentatives de connexion ont échoué pour "inconnu@zandoprix.cg" il y a 2 minutes
    Quand je me connecte avec "inconnu@zandoprix.cg" et "nimporte-quoi"
    Alors la connexion est refusée avec le message "Trop de tentatives. Réessayez dans 15 minutes."

  # ---------------------------------------------------------------
  # Session
  # ---------------------------------------------------------------

  Scénario: Se déconnecter
    Étant donné que je suis connecté en tant que "grace@zandoprix.cg"
    Quand je me déconnecte
    Alors je ne suis pas connecté

  @a-valider
  Scénario: Une session de plus de 8 heures n'est plus acceptée
    Étant donné que je me suis connecté en tant que "grace@zandoprix.cg" il y a 9 heures
    Quand je consulte les propositions
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."

  Scénario: Un compte désactivé perd l'accès immédiatement
    Étant donné que je suis connecté en tant que "grace@zandoprix.cg"
    Et que le compte "grace@zandoprix.cg" est désactivé
    Quand je consulte les propositions
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."

  # ---------------------------------------------------------------
  # Ce qui est protégé, et ce qui ne l'est pas
  # ---------------------------------------------------------------

  Plan du scénario: Sans connexion, la gestion des propositions est fermée
    Étant donné que je ne suis pas connecté
    Quand j'essaie de <action> la proposition de "Riz" au "Marché Ouenzé"
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."
    Et la proposition de "Riz" au "Marché Ouenzé" est toujours "en attente" avec un prix de 750

    Exemples:
      | action    |
      | consulter |
      | publier   |
      | supprimer |
      | corriger  |

  Scénario: Proposer un prix reste ouvert à tous
    Étant donné que je ne suis pas connecté
    Quand je propose le prix suivant :
      | produit | marché        | prix | unité | constaté il y a (jours) | auteur  |
      | Riz     | Marché Ouenzé | 760  | kg    | 0                       | Patrick |
    Alors ma proposition est enregistrée avec le statut "en attente"
