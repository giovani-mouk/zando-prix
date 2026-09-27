# language: fr
@story-1 @RM01 @RM04
Fonctionnalité: Consulter les prix
  En tant qu'utilisateur
  Je veux consulter les prix des produits
  Afin de comparer les prix selon les marchés

  # Comment lire un fichier .feature (valable pour tous les fichiers de ce dossier)
  # - La 1re ligne « # language: fr » indique que les mots-clés sont en français.
  # - Les @tags relient le fichier au cadrage : @story-1 = user story 1,
  #   @RM04 = règle métier 4. Ils servent aussi à filtrer les tests :
  #   npx cucumber-js --tags "@RM04"
  # - « En tant que… Je veux… Afin de… » reprend la user story : non exécuté.
  # - Contexte : exécuté avant CHAQUE scénario du fichier. La base est vidée
  #   entre deux scénarios, chacun part donc de zéro.
  # - Étant donné = situation de départ, Quand = action de l'utilisateur,
  #   Alors = résultat observable. Et / Et que = même rôle que la ligne d'avant.
  # - Chaque phrase est reliée à du code dans features/step_definitions/api/.
  # - Les lignes commençant par # sont des commentaires, ignorés par Cucumber.

  Contexte:
    Étant donné les marchés suivants :
      | marché           |
      | Marché Total     |
      | Marché Poto-Poto |
    Et les produits suivants :
      | produit      | unité de référence |
      | Riz          | kg                 |
      | Manioc       | kg                 |
      | Poisson salé | kg                 |

  Scénario: Voir les produits, les marchés et les prix disponibles
    Étant donné les prix relevés suivants :
      | produit | marché           | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total     | 800  | kg    | 2                     |
      | Riz     | Marché Poto-Poto | 700  | kg    | 1                     |
      | Manioc  | Marché Total     | 600  | kg    | 1                     |
    Quand je consulte les prix
    Alors je vois les prix suivants :
      | produit | marché           | prix | unité |
      | Riz     | Marché Total     | 800  | kg    |
      | Riz     | Marché Poto-Poto | 700  | kg    |
      | Manioc  | Marché Total     | 600  | kg    |

  Scénario: Seul le relevé le plus récent est affiché
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 650  | kg    | 20                    |
      | Riz     | Marché Total | 800  | kg    | 2                     |
    Quand je consulte les prix
    Alors je vois les prix suivants :
      | produit | marché       | prix | unité |
      | Riz     | Marché Total | 800  | kg    |

  Scénario: Un produit sans aucun prix est signalé comme non disponible
    Étant donné les prix relevés suivants :
      | produit | marché       | prix | unité | relevé il y a (jours) |
      | Riz     | Marché Total | 800  | kg    | 2                     |
    Quand je consulte les prix
    Alors le produit "Poisson salé" est indiqué comme sans prix disponible

  Scénario: Aucun prix n'est encore enregistré
    Étant donné qu'aucun prix n'est enregistré
    Quand je consulte les prix
    Alors on m'indique qu'aucun prix n'est disponible pour le moment
