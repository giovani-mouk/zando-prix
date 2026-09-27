# language: fr
@e2e @accueil @a-valider
Fonctionnalité: Accueil conforme à la maquette du PM
  En tant que visiteur qui découvre Zando Prix
  Je veux comprendre en quelques secondes à quoi sert le site
  Afin de trouver rapidement où acheter moins cher

  # Hors cadrage : maquette fournie par le PM, adaptée à Brazzaville.
  # Comportements d'interface : exécutés par les tests de bout en bout
  # (Playwright). Le profil API les ignore (tag @e2e).
  # Règle de la maquette respectée partout : aucun chiffre n'est inventé,
  # tout est calculé à partir de l'API.

  Scénario: L'accueil permet de chercher un produit depuis la section héro
    Quand j'ouvre l'accueil
    Et que je cherche "tomate" dans la barre de recherche
    Alors je vois uniquement la carte du produit "Tomate"
    Et la page défile jusqu'aux prix du jour

  Scénario: Les raccourcis « Fréquents » lancent une recherche
    Quand j'ouvre l'accueil
    Et que je clique sur le raccourci "Riz"
    Alors je vois uniquement la carte du produit "Riz"

  Scénario: Chaque carte annonce le prix le plus bas et mène au comparateur
    Quand j'ouvre l'accueil
    Alors la carte du produit "Riz" indique « Dès » suivi de son meilleur prix
    Quand je clique sur « Voir comparatif complet » de la carte "Riz"
    Alors j'arrive sur le comparateur du produit "Riz"

  Scénario: Trier les cartes par fraîcheur
    Quand j'ouvre l'accueil
    Et que je trie par « Fraîcheur récente »
    Alors dans chaque carte, les marchés vont du relevé le plus récent au plus ancien

  Scénario: Sur téléphone, l'accueil suit la maquette mobile
    Étant donné que j'ouvre l'accueil sur un téléphone
    Alors je vois « Votre marché » avec le nombre de relevés de la semaine
    Et je vois le panier type calculé entre deux marchés
    Et je vois « Prix du jour en direct » avec quatre produits
    Quand j'appuie sur « Tout voir »
    Alors la liste complète des produits s'affiche

  Scénario: La fiche produit compare les marchés sans rien inventer
    Quand j'ouvre la fiche du produit "Riz"
    Alors je vois une carte par marché suivi
    Et un marché sans prix affiche « Aucune donnée récente » et un lien pour le renseigner
    Et le prix moyen et l'écart entre marchés sont calculés sur les prix comparables

  Scénario: Comparer plusieurs produits dans le comparateur
    Quand j'ouvre le comparateur pour le produit "Riz"
    Et que j'ajoute le produit "Tomate" dans le champ de recherche
    Alors le tableau montre les marchés du "Riz" puis ceux de la "Tomate"
    Et un graphique des écarts s'affiche pour chacun des deux produits
    Quand je passe à l'affichage « Cartes »
    Alors chaque marché de chaque produit a sa carte

  Scénario: Sur téléphone, le comparateur montre le meilleur tarif et se partage
    Étant donné que j'ouvre le comparateur sur un téléphone pour le produit "Riz"
    Alors je vois le meilleur tarif, l'écart des prix et une carte par marché
    Quand je choisis le marché "Total"
    Alors seule la carte du marché "Total" reste affichée
    Quand j'appuie sur « Partager cette comparaison »
    Alors le menu de partage du téléphone s'ouvre, ou le lien est copié

  Scénario: Le comparateur masque les marchés décochés
    Quand j'ouvre le comparateur pour le produit "Tomate"
    Et que je décoche le marché "Marché Total"
    Alors le tableau ne montre plus le "Marché Total"
    Et l'écart maximum est recalculé sans ce marché

  Scénario: Sur téléphone, la navigation est rangée dans un menu et une barre en bas
    Étant donné que j'ouvre l'accueil sur un téléphone
    Alors les liens de navigation sont masqués
    Et la barre du bas propose « Accueil », « Comparer », « Proposer », « Suivi » et « Fraîcheur »

  Scénario: Sur tablette, la navigation est rangée dans un menu
    Étant donné que j'ouvre l'accueil sur une tablette
    Quand j'ouvre le menu
    Alors je vois les liens "Accueil & Recherche", "Comparateur de prix", "Détail produit", "Suivi des propositions" et "Guide Fraîcheur & États"
    Quand j'appuie sur la touche Échap
    Alors les liens de navigation sont masqués
    Et le bouton du menu a le focus

  Scénario: Le bouton « Proposer » de la barre du bas ouvre le formulaire
    Étant donné que j'ouvre l'accueil sur un téléphone
    Quand j'appuie sur « Proposer » dans la barre du bas
    Alors le formulaire « Proposer un prix » s'ouvre
