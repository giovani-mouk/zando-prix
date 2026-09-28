# language: fr
@proposition @photo
Fonctionnalité: Joindre une photo de l'étal à une proposition
  En tant qu'habitant qui signale un prix depuis son téléphone
  Je veux joindre une photo de l'étal ou de la balance
  Afin d'aider l'équipe à vérifier mon prix

  # Maquette « Proposer un prix mobile ». Règles :
  # - la photo est facultative ; elle est envoyée chez Cloudinary avec une
  #   autorisation (signature) donnée par notre serveur ;
  # - sans compte Cloudinary configuré, la fonction photo est désactivée ;
  # - seule une photo de NOTRE compte Cloudinary est acceptée ;
  # - la photo n'est visible que par l'équipe de vérification.

  Contexte:
    Étant donné les marchés suivants :
      | marché        |
      | Marché Ouenzé |
    Et les produits suivants :
      | produit | unité de référence |
      | Riz     | kg                 |

  Scénario: Le serveur autorise l'envoi d'une photo quand le stockage est configuré
    Étant donné que le stockage des photos est configuré pour le compte "zando-test"
    Quand je demande l'autorisation d'envoyer une photo
    Alors je reçois une autorisation valable pour le compte "zando-test"

  Scénario: Sans stockage configuré, la photo est désactivée
    Étant donné que le stockage des photos n'est pas configuré
    Quand je demande l'autorisation d'envoyer une photo
    Alors on m'indique que l'envoi de photos n'est pas disponible

  Scénario: L'équipe voit la photo jointe à une proposition
    Étant donné que le stockage des photos est configuré pour le compte "zando-test"
    Quand je propose un prix de 750 FCFA pour le "Riz" au "Marché Ouenzé" avec la photo "https://res.cloudinary.com/zando-test/image/upload/v1/zando-prix/propositions/etal.jpg"
    Alors ma proposition est enregistrée avec le statut "en attente"
    Quand je suis connecté en tant qu'administrateur
    Alors l'équipe voit la photo "https://res.cloudinary.com/zando-test/image/upload/v1/zando-prix/propositions/etal.jpg"

  Plan du scénario: Une photo qui ne vient pas de notre compte est refusée
    Étant donné que le stockage des photos est configuré pour le compte "zando-test"
    Quand je propose un prix de 750 FCFA pour le "Riz" au "Marché Ouenzé" avec la photo "<adresse>"
    Alors ma proposition est refusée
    Et on m'indique que le champ "photo" est invalide

    Exemples:
      | adresse                                                           |
      | https://exemple.com/etal.jpg                                      |
      | https://res.cloudinary.com/autre-compte/image/upload/v1/etal.jpg  |
