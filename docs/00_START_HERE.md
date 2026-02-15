# 00_START_HERE

Index unique de documentation pour le produit et pour les agents.

## Resume produit (5 lignes)

- PlayNovus Manager pilote une activite d'achat-revente Playmobil d'occasion.
- Le produit couvre Catalogue, Approvisionnement, Ventes, Stock et Dashboard.
- Le stock doit rester exact et entierement tracable dans le temps.
- Les ventes calculent automatiquement le cout reel et la marge selon FIFO.
- L'objectif est de scaler l'activite sans perdre la fiabilite des donnees.

## Ordre de lecture officiel

1. `docs/CAHIER_DES_CHARGES.md`
2. `docs/AS_IS.md`
3. `docs/ROADMAP.md`
4. `docs/DECISIONS.md`
5. `docs/HISTORIQUE.md`
6. `docs/AGENTS.md`

## Regle anti-incoherence

En cas de contradiction entre documents:
- `docs/CAHIER_DES_CHARGES.md` fait foi pour la cible produit (TO-BE).
- `docs/AS_IS.md` fait foi pour l'existant reel (ce qui est deja implemente).

## Structure actuelle (racine `docs/`)

- `docs/00_START_HERE.md`
- `docs/CAHIER_DES_CHARGES.md`
- `docs/AS_IS.md`
- `docs/ROADMAP.md`
- `docs/AGENTS.md`
- `docs/DECISIONS.md`
- `docs/HISTORIQUE.md`

## Docs secondaires archivees (et quand les consulter)

Important:
- les documents dans `docs/_archive/` sont historiques et peuvent ne pas etre a jour.
- ils ne remplacent pas la regle anti-incoherence ci-dessus.

- `docs/_archive/PRD.md`: si besoin d'un niveau de detail fonctionnel plus fin.
- `docs/_archive/ACCEPTANCE_CRITERIA.md`: pour une checklist de validation rapide par page.
- `docs/_archive/NON_GOALS.md`: pour rappeler les elements explicitement hors perimetre.
- `docs/_archive/GLOSSARY.md`: en cas de doute ponctuel sur un terme metier.
- `docs/_archive/CONVENTIONS.md`: pour les conventions de code/detail d'implementation.
- `docs/_archive/BACKLOG.md`: pour retrouver la granularite ticket historique.
- `docs/_archive/ARCHITECTURE.md`: pour le contexte technique detaille.
