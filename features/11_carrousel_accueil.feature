# language: fr
@e2e @carrousel @a-valider
Fonctionnalité: Carrousel de photos sur l'accueil
  En tant qu'utilisateur
  Je veux voir défiler des photos des marchés à côté du grand titre
  Afin de reconnaître tout de suite l'univers du site

  # Hors cadrage : proposé pendant le sprint, à valider par le PM.
  # Comportement d'interface : ces scénarios seront exécutés par les tests
  # de bout en bout (Playwright). Le profil API les ignore (tag @e2e).

  Scénario: Les photos défilent d'elles-mêmes
    Étant donné que j'ouvre l'accueil sur un grand écran
    Quand j'attends quelques secondes
    Alors une autre photo est affichée

  Scénario: Mettre le défilement en pause
    Étant donné que j'ouvre l'accueil sur un grand écran
    Quand je mets le carrousel en pause
    Et que j'attends quelques secondes
    Alors la même photo est toujours affichée

  Scénario: Choisir une photo
    Étant donné que j'ouvre l'accueil sur un grand écran
    Quand je choisis la photo 3
    Alors la photo 3 est affichée
    Et le défilement est en pause

  Scénario: Pas de défilement automatique quand l'appareil réduit les animations
    Étant donné que mon appareil demande de réduire les animations
    Et que j'ouvre l'accueil sur un grand écran
    Quand j'attends quelques secondes
    Alors la même photo est toujours affichée

  Scénario: Sur mobile, le carrousel laisse la place aux prix
    Étant donné que j'ouvre l'accueil sur un téléphone
    Alors le carrousel n'est pas affiché
    Et aucune photo du carrousel n'est téléchargée
