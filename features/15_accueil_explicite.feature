# language: fr
@e2e @accueil @a-valider
Fonctionnalité: Comprendre le site dès l'accueil
  En tant que visiteur qui découvre Zando Prix
  Je veux comprendre en quelques secondes à quoi sert le site
  Afin de trouver rapidement où acheter moins cher

  # Hors cadrage : demandé pendant le sprint, à valider par le PM.
  # Comportements d'interface : exécutés par les tests de bout en bout
  # (Playwright), comme le carrousel. Le profil API les ignore (tag @e2e).

  Scénario: L'accueil explique le fonctionnement en trois étapes
    Quand j'ouvre l'accueil
    Alors je vois les étapes "Cherchez un produit", "Comparez les marchés" et "Achetez au meilleur prix"
    Et je vois le nombre de produits suivis et le nombre de marchés

  Scénario: Sur téléphone, la navigation est rangée dans un menu
    Étant donné que j'ouvre l'accueil sur un téléphone
    Alors les liens de navigation sont masqués
    Quand j'ouvre le menu
    Alors je vois les liens "Les prix", "À propos" et "Contact"
    Quand j'appuie sur la touche Échap
    Alors les liens de navigation sont masqués
    Et le bouton du menu a le focus

  Scénario: Comparer les prix d'un produit en graphique
    Étant donné que j'ouvre l'accueil sur un grand écran
    Quand j'affiche le graphique du produit "Riz"
    Alors je vois une barre par marché où le riz a un prix comparable
    Et la barre du meilleur prix est verte

  Scénario: Sans accès au service de graphiques, les prix restent lisibles
    Étant donné que le service de graphiques est inaccessible
    Et que j'ouvre l'accueil sur un grand écran
    Quand j'affiche le graphique du produit "Riz"
    Alors un message indique que le graphique n'est pas disponible
    Et les prix de chaque marché sont affichés

  Scénario: Le service de graphiques n'est téléchargé qu'à la demande
    Quand j'ouvre l'accueil
    Alors le fichier de graphiques n'a pas été téléchargé
