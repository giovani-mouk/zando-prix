# language: fr
@admin @administrateurs
Fonctionnalité: Gérer les comptes administrateurs
  En tant qu'administrateur de Zando Prix
  Je veux créer, désactiver et réactiver les comptes de l'équipe depuis le tableau de bord
  Afin de donner ou retirer un accès sans passer par la ligne de commande

  Règles convenues :
  - tous les administrateurs ont les mêmes droits, y compris sur les comptes ;
  - un compte n'est jamais supprimé, seulement désactivé : son historique reste ;
  - désactiver un compte ferme immédiatement ses sessions ouvertes ;
  - on ne peut pas désactiver son propre compte (on ne peut donc jamais
    se retrouver sans aucun administrateur actif).

  Contexte:
    Étant donné les administrateurs suivants :
      | nom           | e-mail             | mot de passe     | actif |
      | Grâce Mabiala | grace@zandoprix.cg | Manioc-2026-sur! | oui   |
      | Jean Okemba   | jean@zandoprix.cg  | Saka-Saka-2026!  | oui   |
    Et je suis connecté en tant que "grace@zandoprix.cg"

  # ---------------------------------------------------------------
  # Consulter et créer
  # ---------------------------------------------------------------

  Scénario: Voir la liste des comptes
    Quand je consulte les comptes administrateurs
    Alors je vois les comptes suivants :
      | nom           | e-mail             | actif |
      | Grâce Mabiala | grace@zandoprix.cg | oui   |
      | Jean Okemba   | jean@zandoprix.cg  | oui   |
    Et le compte "grace@zandoprix.cg" est indiqué comme le mien

  Scénario: Un compte créé peut aussitôt se connecter
    Quand je crée le compte suivant :
      | nom       | e-mail           | mot de passe      |
      | Awa Ngoma | awa@zandoprix.cg | Poisson-fume-2026 |
    Alors le compte est créé
    Et "awa@zandoprix.cg" peut se connecter avec "Poisson-fume-2026"

  Plan du scénario: Un compte incorrect n'est pas créé
    Quand je crée le compte suivant :
      | nom   | e-mail   | mot de passe   |
      | <nom> | <e-mail> | <mot de passe> |
    Alors la création du compte est refusée
    Et on m'indique que le champ "<champ>" est invalide

    Exemples:
      | nom  | e-mail            | mot de passe      | champ        | cas                        |
      |      | awa@zandoprix.cg  | Poisson-fume-2026 | nom          | nom vide                   |
      | Awa  | awa               | Poisson-fume-2026 | e-mail       | e-mail invalide            |
      | Awa  | awa@zandoprix.cg  | court             | mot de passe | moins de 12 caractères     |
      | Awa  | JEAN@zandoprix.cg | Poisson-fume-2026 | e-mail       | e-mail déjà utilisé        |

  # ---------------------------------------------------------------
  # Désactiver et réactiver
  # ---------------------------------------------------------------

  Scénario: Désactiver un compte ferme ses sessions et bloque la connexion
    Étant donné que "jean@zandoprix.cg" est connecté sur un autre appareil
    Quand je désactive le compte "jean@zandoprix.cg"
    Alors le compte "jean@zandoprix.cg" est indiqué comme désactivé
    Et la session de "jean@zandoprix.cg" sur l'autre appareil est fermée
    Et "jean@zandoprix.cg" ne peut plus se connecter avec "Saka-Saka-2026!"

  Scénario: Réactiver un compte
    Étant donné que le compte "jean@zandoprix.cg" est désactivé
    Quand je réactive le compte "jean@zandoprix.cg"
    Alors "jean@zandoprix.cg" peut se connecter avec "Saka-Saka-2026!"

  Scénario: On ne peut pas désactiver son propre compte
    Quand je désactive le compte "grace@zandoprix.cg"
    Alors l'opération est refusée
    Et je suis toujours connecté

  # ---------------------------------------------------------------
  # Changer son propre mot de passe
  # ---------------------------------------------------------------

  Scénario: Changer son mot de passe
    Quand je change mon mot de passe "Manioc-2026-sur!" en "Nouveau-mot-2026"
    Alors mon mot de passe est changé
    Et "grace@zandoprix.cg" peut se connecter avec "Nouveau-mot-2026"
    Et "grace@zandoprix.cg" ne peut plus se connecter avec "Manioc-2026-sur!"

  Scénario: Changer son mot de passe ferme ses autres sessions, pas celle en cours
    Étant donné que "grace@zandoprix.cg" est connecté sur un autre appareil
    Quand je change mon mot de passe "Manioc-2026-sur!" en "Nouveau-mot-2026"
    Alors la session de "grace@zandoprix.cg" sur l'autre appareil est fermée
    Et je suis toujours connecté

  Plan du scénario: Un changement de mot de passe incorrect est refusé
    Quand je change mon mot de passe "<actuel>" en "<nouveau>"
    Alors le changement de mot de passe est refusé
    Et on m'indique que le champ "<champ>" est invalide

    Exemples:
      | actuel            | nouveau          | champ                | cas                         |
      | Faux-mot-de-passe | Nouveau-mot-2026 | mot de passe actuel  | mot de passe actuel faux    |
      | Manioc-2026-sur!  | court            | nouveau mot de passe | moins de 12 caractères      |

  # ---------------------------------------------------------------
  # Protection
  # ---------------------------------------------------------------

  Scénario: Sans connexion, la liste des comptes est fermée
    Étant donné que je me suis déconnecté
    Quand je consulte les comptes administrateurs
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."

  Scénario: Sans connexion, aucun compte ne peut être créé
    Étant donné que je me suis déconnecté
    Quand je crée le compte suivant :
      | nom       | e-mail           | mot de passe      |
      | Awa Ngoma | awa@zandoprix.cg | Poisson-fume-2026 |
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."
    Et aucun compte n'existe pour "awa@zandoprix.cg"
