# language: fr
@photos @a-valider
Fonctionnalité: Voir la photo des produits
  En tant qu'utilisateur
  Je veux voir une photo de chaque produit
  Afin de reconnaître le produit d'un coup d'œil

  # Hors cadrage : proposé pendant le sprint, à valider par le PM.

  Contexte:
    Étant donné les produits suivants :
      | produit | unité de référence | photo                     |
      | Riz     | kg                 | /images/produits/riz.webp |
      | Manioc  | kg                 |                           |

  Scénario: Un produit est présenté avec sa photo
    Quand je consulte la liste des produits
    Alors le produit "Riz" est présenté avec la photo "/images/produits/riz.webp"

  Scénario: Un produit sans photo est présenté sans image
    Quand je consulte la liste des produits
    Alors le produit "Manioc" est présenté sans photo
