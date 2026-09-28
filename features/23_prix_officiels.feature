# language: fr
@officiels @a-valider
Fonctionnalité: Publier les prix officiels du Ministère du Commerce
  En tant qu'administrateur de Zando Prix
  Je veux saisir les prix officiels publiés par le Ministère du Commerce
  Afin que chacun puisse comparer les prix des étals au cadre officiel

  # Décision du PM : la source officielle est le Ministère du Commerce.
  # Règles (hypothèses à valider) :
  # - l'équipe saisit chaque prix à partir d'un texte officiel, dont la
  #   référence est obligatoire (« Arrêté n° … », « Mercuriale du … ») ;
  # - deux types : « plafond » (maximum légal) et « indicatif » ;
  # - le prix en vigueur est celui dont la date d'effet est la plus récente,
  #   parmi ceux déjà entrés en vigueur ; un prix à venir n'est pas affiché ;
  # - un prix officiel n'est jamais effacé : il est retiré, et l'historique reste.

  Contexte:
    Étant donné les produits suivants :
      | produit        | unité de référence |
      | Riz            | kg                 |
      | Huile végétale | litre              |
    Et je suis connecté en tant qu'administrateur

  Scénario: Un prix plafond saisi par l'équipe est visible de tous
    Quand je saisis le prix officiel suivant :
      | produit        | type    | prix | unité | en vigueur depuis (jours) | référence                    |
      | Huile végétale | plafond | 1100 | litre | 3                         | Arrêté n° 2026-114 du Ministère |
    Alors le prix officiel est enregistré
    Et les prix officiels en vigueur sont :
      | produit        | type    | prix | référence                       |
      | Huile végétale | plafond | 1100 | Arrêté n° 2026-114 du Ministère |

  Scénario: Le prix le plus récent remplace le précédent, et un prix à venir attend sa date
    Quand je saisis le prix officiel suivant :
      | produit | type      | prix | unité | en vigueur depuis (jours) | référence          |
      | Riz     | indicatif | 700  | kg    | 30                        | Mercuriale d'août  |
    Et je saisis le prix officiel suivant :
      | produit | type      | prix | unité | en vigueur depuis (jours) | référence          |
      | Riz     | indicatif | 750  | kg    | 2                         | Mercuriale de sept |
    Et je saisis le prix officiel suivant :
      | produit | type      | prix | unité | en vigueur depuis (jours) | référence          |
      | Riz     | indicatif | 800  | kg    | -5                        | Mercuriale d'oct   |
    Alors les prix officiels en vigueur sont :
      | produit | type      | prix | référence          |
      | Riz     | indicatif | 750  | Mercuriale de sept |

  Scénario: Retirer un prix officiel
    Quand je saisis le prix officiel suivant :
      | produit | type    | prix | unité | en vigueur depuis (jours) | référence       |
      | Riz     | plafond | 900  | kg    | 1                         | Arrêté n° 2026-9 |
    Et je retire ce prix officiel
    Alors aucun prix officiel n'est en vigueur
    Et l'historique des prix officiels garde ce prix, marqué comme retiré

  Plan du scénario: Un prix officiel incomplet est refusé
    Quand je saisis le prix officiel suivant :
      | produit | type   | prix   | unité | en vigueur depuis (jours) | référence   |
      | Riz     | <type> | <prix> | kg    | 1                         | <référence> |
    Alors le prix officiel est refusé
    Et on m'indique que le champ "<champ>" est invalide

    Exemples:
      | type     | prix | référence        | champ           |
      | promo    | 900  | Arrêté n° 2026-9 | type officiel   |
      | plafond  | 0    | Arrêté n° 2026-9 | prix            |
      | plafond  | 900  |                  | référence       |

  Scénario: Sans connexion, on ne peut pas saisir de prix officiel
    Étant donné que je me suis déconnecté
    Quand je saisis le prix officiel suivant :
      | produit | type    | prix | unité | en vigueur depuis (jours) | référence        |
      | Riz     | plafond | 900  | kg    | 1                         | Arrêté n° 2026-9 |
    Alors l'accès est refusé avec le message "Connectez-vous pour accéder à cet espace."
