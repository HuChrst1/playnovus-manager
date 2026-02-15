# Cahier des charges fonctionnel - PlayNovus Manager

Version: 1.1
Date: 2026-02-15

## 1. Finalité du produit

PlayNovus Manager est l'outil de pilotage d'une activité d'achat-revente Playmobil d'occasion.

Objectifs business:
- garder un stock exact et traçable en permanence
- calculer automatiquement le coût réel des ventes et la marge
- faciliter les décisions d'achat, de reconstruction de sets et de revente

## 2. Utilisateur cible

- utilisateur principal: activité solo aujourd'hui
- objectif moyen terme: absorber plus de lots, plus de ventes et plus de références sans perte de contrôle

## 3. Règles d'or (non négociables)

1. Stock exact en permanence
- aucune opération ne doit modifier le stock sans trace claire

2. Traçabilité complète des mouvements
- chaque entrée et sortie doit pouvoir être expliquée: quoi, combien, quand, pourquoi

3. Coût réel calculé automatiquement
- les ventes consomment d'abord les pièces des achats les plus anciens (FIFO)
- la marge est calculée automatiquement à partir de ce coût réel

4. Vente de set incomplet autorisée
- l'utilisateur peut ajuster les quantités réellement vendues pièce par pièce
- seules les quantités réellement vendues doivent sortir du stock

5. Annulation sans effet parasite
- une vente annulée doit remettre le stock exactement au niveau précédent
- les ventes annulées ne doivent pas fausser les indicateurs business

## 4. Périmètre produit

Pages obligatoires:
- Catalogue
- Approvisionnement
- Ventes
- Stock
- Dashboard

Hors périmètre actuel:
- connexion marketplace
- gestion multi-utilisateur avancée

## 5. Parcours et fonctionnalités attendues

## 5.1 Catalogue

Objectif:
- visualiser tous les sets et identifier rapidement ceux qui sont réalisables avec le stock actuel

Fonctions attendues:
- liste des sets avec référence, nom, version, période de production, thème, image
- affichage d'un niveau de complétion par set
- affichage du nombre de sets réalisables avec le stock disponible
- recherche et filtres (texte, thème, années, version)
- création, modification et suppression d'un set
- gestion de la liste des pièces nécessaires d'un set (ajout, modification, suppression)

Critères d'acceptation:
- le niveau de complétion affiché en liste est cohérent avec le détail
- les sets presque complets sont facilement repérables

## 5.2 Approvisionnement (Achats / Lots)

Objectif:
- enregistrer les achats de lots et intégrer leur contenu au stock de manière fiable

Fonctions attendues:
- création d'un lot d'achat (date, coût total, libellé, fournisseur, notes)
- saisie du contenu du lot (référence pièce + quantité)
- lot modifiable tant qu'il est en brouillon
- confirmation du lot pour intégration stock
- retour `confirmed -> draft` possible uniquement si le lot n'a jamais été utilisé en ventes
- suppression d'un lot `draft` ou `confirmed` possible uniquement si le lot n'a jamais été utilisé en ventes
- calcul automatique du nombre total de pièces et du coût moyen par pièce

Règles de gestion:
- tant qu'un lot a 0 pièce:
  - son coût moyen par pièce est vide
  - sa confirmation est interdite

Critères d'acceptation:
- un lot confirmé utilisé en ventes ne peut plus revenir en brouillon ni être supprimé
- un lot confirmé non utilisé peut revenir en brouillon et retire ses entrées d'achat du stock/historique
- la confirmation met à jour le stock immédiatement et correctement
- un aller-retour `draft -> confirmed -> draft -> confirmed` ne crée pas de doublons de mouvements d'achat

## 5.3 Stock

Objectif:
- fournir une vision claire du stock réel et de son historique

Fonctions attendues:
- vue globale par référence avec quantité actuelle et indicateurs de valeur/coût moyen
- recherche et tri
- détail d'une référence avec historique complet des entrées/sorties
- historique global filtrable (période, entrée/sortie, type d'opération)

Critère d'acceptation:
- le stock affiché correspond exactement aux achats confirmés moins les ventes confirmées (en tenant compte des ajustements)

## 5.4 Ventes (Commandes)

Objectif:
- enregistrer les ventes, mettre à jour le stock automatiquement et calculer coût/marge réels

Décision produit:
- une seule vue de liste: `Commandes` (1 ligne = 1 vente)
- pas de liste globale dédiée "pièces vendues"
- un détail audit est autorisé depuis le détail d'une commande

### A. Vue Commandes

Fonctions attendues:
- tableau des ventes avec: identifiant, date, canal, type, statut, montant net, coût, marge
- actions: créer, éditer, supprimer, ouvrir le détail

Règle de typage d'une vente:
- une vente est soit "vente de sets", soit "vente de pièces"
- une vente ne mélange jamais les deux types

### B. KPIs Ventes

Indicateurs attendus:
- minimum: nombre de commandes "sets" vs "pièces"
- attendu: montant net, marge totale et taux de marge séparés "sets" vs "pièces"

Règles KPI:
- période par défaut: 30 jours glissants
- filtres rapides: Total, 90 jours, 30 jours, 7 jours
- affichage du delta vs période précédente équivalente
- ventes annulées exclues des KPIs business

### C. Formulaire Nouvelle vente

Champs communs obligatoires:
- date de paiement
- canal
- montant net total

Champ optionnel:
- commentaire

Mode 1 - Vente de set:
- sélection d'un ou plusieurs sets
- quantité par ligne
- détail des pièces pour ajuster les quantités réellement vendues
- en cas de plusieurs lignes: répartition du montant net par ligne avec total strictement égal au montant global

Mode 2 - Vente de pièces:
- recherche de pièces
- quantité vendue par ligne
- en cas de plusieurs lignes: répartition du montant net par ligne avec total strictement égal au montant global

Règles de validation:
- impossible d'enregistrer avec stock insuffisant
- impossible d'enregistrer partiellement: la vente est totalement refusée si une pièce manque

### D. Détail d'une commande

Fonctions attendues:
- résumé de la commande (date, canal, type, statut, montant)
- lignes de vente (quantité, prix imputé, coût, marge)
- totaux commande (montant, coût, marge, taux de marge)

### E. Audit d'un set vendu

Depuis le détail commande:
- afficher le détail réel des pièces sorties pour une ligne de set
- afficher les quantités réellement sorties
- afficher le coût unitaire pris en compte pour le calcul

Critères d'acceptation ventes:
- enregistrer une vente met à jour le stock correctement
- stock insuffisant => vente refusée
- annulation => restitution exacte du stock
- édition => recalcul correct et stock cohérent
- KPIs => jamais de ventes annulées dans les chiffres business

## 5.5 Dashboard

Objectif:
- fournir une vue rapide et exploitable des chiffres clés

Minimum attendu:
- indicateurs cohérents avec les pages Ventes, Stock et Approvisionnement
- accès rapide vers les écrans opérationnels

Indicateurs cibles:
- chiffre d'affaires net
- marge nette
- valeur du stock
- coût des approvisionnements sur période

## 6. État actuel observé (résumé non-technique)

Fonctionnalités déjà en place:
- catalogue opérationnel avec gestion des sets et des pièces
- approvisionnement opérationnel avec brouillon/confirmation
- ventes opérationnelles avec création, édition, annulation et suppression
- stock et historique disponibles

Points à finaliser/prioriser:
- uniformiser les KPIs ventes par type (sets vs pièces) avec périodes standard et delta
- fiabiliser encore les garde-fous sur les flux critiques (vente, annulation, confirmation lot)
- rendre le dashboard pleinement alimenté par les données réelles

## 7. Indicateurs de succès

Le produit est considéré efficace si:
- le stock reste cohérent au quotidien malgré l'augmentation du volume
- chaque écart peut être expliqué rapidement via l'historique
- les marges affichées sont crédibles et exploitables pour décider
- le temps de traitement d'un lot et d'une commande diminue sans perte de fiabilité
