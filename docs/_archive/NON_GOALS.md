# NON-GOALS

Ce document liste explicitement ce qui est hors périmètre à ce stade.

## Hors périmètre produit

1. Marketplace connectée
- pas de synchronisation API Vinted/eBay/Leboncoin
- pas d'import automatique des commandes externes

2. Multi-user avancé
- pas de gestion fine des rôles/permissions
- pas de workflow d'approbation multi-acteurs
- pas de journal d'audit utilisateur complet

3. Prévision / BI avancée
- pas de moteur de prédiction de ventes
- pas de planification d'achats automatisée

4. Automatisation comptable étendue
- pas d'export comptable complet multi-format
- pas de rapprochement bancaire automatisé

## Hors périmètre technique immédiat

1. Refonte architecture lourde
- pas de refactor massif tant que la cible fonctionnelle n'est pas figée

2. Changement de logique FIFO
- FIFO reste la règle obligatoire

3. Changement du schéma DB production sans gouvernance migrations
- toute évolution DB devra passer par une stratégie de migration versionnée

## Hors périmètre UX Ventes

1. Pas d'écran "liste des pièces vendues"
- la vue principale reste `Commandes` (1 ligne = 1 vente)
- un détail contextuel de commande peut exister, mais pas une liste indépendante dédiée
