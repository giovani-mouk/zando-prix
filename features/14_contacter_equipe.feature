# language: fr
@contact @a-valider
Fonctionnalité: Contacter l'équipe Zando Prix
  En tant que visiteur du site
  Je veux envoyer un message à l'équipe
  Afin de poser une question ou de signaler un problème

  # Hors cadrage : demandé pendant le sprint, à valider par le PM.
  # Les messages sont lus dans l'espace administrateur.

  Contexte:
    Étant donné les administrateurs suivants :
      | nom           | e-mail             | mot de passe     | actif |
      | Grâce Mabiala | grace@zandoprix.cg | Manioc-2026-sur! | oui   |

  # ---------------------------------------------------------------
  # Envoyer un message (page Contact, ouverte à tous)
  # ---------------------------------------------------------------

  Scénario: Envoyer un message
    Quand j'envoie le message suivant :
      | nom     | e-mail             | message                                    |
      | Patrick | patrick@exemple.cg | Le prix du riz à Ouenzé a baissé ce matin. |
    Alors mon message est bien reçu
    Et l'équipe a reçu 1 message non lu

  Plan du scénario: Un message incomplet ou incorrect est refusé
    Quand j'envoie le message suivant :
      | nom   | e-mail   | message   |
      | <nom> | <e-mail> | <message> |
    Alors mon message est refusé
    Et on m'indique que le champ "<champ>" est invalide
    Et l'équipe n'a reçu aucun message

    Exemples:
      | nom     | e-mail             | message        | champ   |
      |         | patrick@exemple.cg | Bonjour        | nom     |
      | Patrick |                    | Bonjour        | e-mail  |
      | Patrick | patrick            | Bonjour        | e-mail  |
      | Patrick | patrick@exemple    | Bonjour        | e-mail  |
      | Patrick | patrick@exemple.cg |                | message |

  Scénario: Un robot qui remplit le champ caché n'est pas enregistré
    Quand un robot envoie un message en remplissant le champ caché
    Alors on lui répond comme si le message était reçu
    Et l'équipe n'a reçu aucun message

  Scénario: Trop de messages envoyés depuis la même connexion
    Étant donné que j'ai déjà envoyé 5 messages dans l'heure
    Quand j'envoie le message suivant :
      | nom     | e-mail             | message         |
      | Patrick | patrick@exemple.cg | Encore un autre |
    Alors mon message est refusé avec le message "Vous avez envoyé beaucoup de messages. Réessayez dans une heure."

  # ---------------------------------------------------------------
  # Lire les messages (espace administrateur)
  # ---------------------------------------------------------------

  Scénario: Les messages non lus apparaissent en premier, du plus récent au plus ancien
    Étant donné les messages reçus suivants :
      | nom        | message                       | reçu il y a (minutes) | lu  |
      | Patrick    | Le riz a baissé à Ouenzé.     | 10                    | non |
      | Mama Ngolo | Merci pour le site !          | 60                    | oui |
      | Jean       | Ajoutez le marché de Talangaï | 5                     | non |
    Et je suis connecté en tant que "grace@zandoprix.cg"
    Quand je consulte les messages
    Alors je vois les messages dans cet ordre :
      | nom        | lu  |
      | Jean       | non |
      | Patrick    | non |
      | Mama Ngolo | oui |

  Scénario: Marquer un message comme lu
    Étant donné les messages reçus suivants :
      | nom     | message                   | reçu il y a (minutes) | lu  |
      | Patrick | Le riz a baissé à Ouenzé. | 10                    | non |
    Et je suis connecté en tant que "grace@zandoprix.cg"
    Quand je marque le message de "Patrick" comme lu
    Alors le message de "Patrick" est indiqué comme lu par "Grâce Mabiala"
    Et l'équipe a reçu 0 message non lu

  Scénario: Sans connexion, les messages ne peuvent pas être lus
    Étant donné les messages reçus suivants :
      | nom     | message                   | reçu il y a (minutes) | lu  |
      | Patrick | Le riz a baissé à Ouenzé. | 10                    | non |
    Et que je ne suis pas connecté
    Quand je consulte les messages
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."

  Scénario: Sans connexion, un message ne peut pas être marqué comme lu
    Étant donné les messages reçus suivants :
      | nom     | message                   | reçu il y a (minutes) | lu  |
      | Patrick | Le riz a baissé à Ouenzé. | 10                    | non |
    Et que je ne suis pas connecté
    Quand je marque le message de "Patrick" comme lu
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."
    Et l'équipe a reçu 1 message non lu
