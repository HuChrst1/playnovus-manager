# F6.1 - Cadrage produit Compte/Parametres

Statut: `VALIDE`
Date: `2026-02-23`
Portee: lot strictement documentaire (sans implementation technique)

## 1) Vision et objectifs

Vision:
- fournir un point d'entree clair `Compte/Parametres` pour les actions personnelles essentielles
- preparer l'arrivee de l'auth/session sans perturber les flux metier existants
- poser un cadre lisible pour la tracabilite utilisateur des tickets report

Objectifs:
- decider le parcours utilisateur desktop/mobile vers `Compte/Parametres`
- verrouiller l'architecture d'information de la future page et sa priorisation
- definir les regles UX attendues (etats succes/erreur/vide/chargement)
- definir la politique produit d'attribution des reports (sans changement schema)
- livrer un handoff actionnable pour `F6.2`, `F6.3`, `F6.4`

Non-objectifs F6.1:
- implementer le login, les sessions ou la protection des routes
- creer une page fonctionnelle `Compte/Parametres`
- modifier l'API, la base, les routes ou les query params
- ajouter des migrations SQL
- ecrire en base distante

## 2) Etat de depart constate (rappel)

- l'entree `Compte` existe deja en topbar via une icone utilisateur
- aucun parcours produit finalise n'est branche derriere cette entree
- aucun flux auth/session applicatif n'est actif dans le code actuel
- le module `Report` existe, mais sans attribution utilisateur explicite (auteur/cloture)

## 3) Parcours utilisateur cibles (F6.1)

### 3.1 Desktop

- point d'entree: icone `Compte` de la topbar
- decision verrouillee: clic direct vers la page `Compte/Parametres`
- aucun menu intermediaire impose en F6.1

Parcours cible:
1. l'utilisateur clique l'icone `Compte`
2. il arrive sur `Compte/Parametres`
3. il consulte/modifie ses reglages essentiels
4. il revient ensuite a son flux metier (Dashboard/Appro/Ventes/Stock/Catalogue)

### 3.2 Mobile

- point d'entree: action `Compte` du shell mobile
- decision verrouillee: meme logique d'acces direct que desktop
- pas de divergence de terminologie entre desktop et mobile

Parcours cible:
1. ouverture de la navigation mobile
2. action `Compte`
3. acces direct a `Compte/Parametres`

## 4) Architecture d'information de la page (MVP vs plus tard)

## 4.1 Bloc `Compte` (MVP)

Contenu:
- `Username` affiche et editable
- `Role` en lecture seule: `Admin` ou `Utilisateur`
- bouton `Se deconnecter`
- bouton contextuel de gestion d'acces:
  - `Changer mot de passe` si auth email/password
  - `Gerer connexion` si auth magic link

Contraintes produit:
- les actions doivent etre explicites et non ambigues
- la deconnexion doit rester une action volontaire, visible, et confirmable si necessaire

## 4.2 Bloc `Securite` (MVP minimal)

Contenu MVP:
- `Derniere connexion` (optionnel)
- etat explicite `non disponible` si la donnee n'existe pas

Hors MVP court terme:
- `Sessions actives` (juge overkill pour demarrage a 2 admins)

Regle ferme:
- aucun affichage de cle/secret en clair

## 4.3 Bloc `Administration (2 admins extensibles)` (MVP minimal)

Contenu:
- liste simple des admins (2 lignes au demarrage)
- modele extensible (ajout futur d'autres admins)

Lien `Voir logs / historique`:
- affiche uniquement si un audit exploitable existe
- sinon, lien non affiche (pas de faux point d'entree)

Hors scope:
- creation/desactivation/reset admin via UI

## 4.4 Bloc `A propos / Diagnostic` (MVP)

Contenu:
- version app (version et/ou commit hash)
- environnement (`local` ou `prod`)
- action `Copier infos de debug`

Objectif:
- faciliter le support et la qualification rapide des incidents

## 5) Regles UX attendues (sans implementation)

Succes:
- message de confirmation explicite apres action validee

Erreur:
- message actionnable, sans details sensibles

Etat vide / donnee absente:
- message informatif (exemple: `Derniere connexion non disponible`)

Chargement et blocage:
- etat de chargement visible lors d'une action
- prevention du double clic sur actions critiques

Coherence:
- libelles, statuts et termes identiques desktop/mobile
- aucune ambiguite entre action de navigation et action destructive

## 6) Cadrage attribution reports (niveau produit)

Objectif:
- rendre lisible qui a cree et qui a cloture/ignore un ticket report

Champs cibles a afficher dans l'onglet `Tickets`:
- `Cree par` (auteur de creation)
- `Cloture/Ignore par` (auteur de cloture/ignorance)

Priorite d'affichage identite:
1. nom visible
2. alias
3. identifiant interne

Rappel de portee:
- F6.1 ne modifie ni schema DB, ni API, ni types
- ce cadrage prepare l'implementation en `F6.4`

## 7) Frontieres explicites F6.1 -> F6.2/F6.3/F6.4

### Ce qui est decide et livre en F6.1

- positionnement navigation `Compte/Parametres` desktop/mobile
- architecture d'information de la page et priorisation MVP
- regles UX attendues
- politique produit d'attribution report
- handoff de perimetre pour les features suivantes

### Ce qui sera implemente ensuite

- `F6.2`:
  - ecran de login
  - erreurs de connexion utilisateur
  - redirection post-login
- `F6.3`:
  - login/logout operationnels
  - persistance session
  - protection des routes metier
  - support multi-session admin
- `F6.4`:
  - page `Compte/Parametres` fonctionnelle
  - operations comptes essentielles
  - attribution report effective (creation + cloture/ignorance)

## 8) Matrice decisionnelle F6.1

| Zone/parcours | Question produit | Decision verrouillee | Livrable doc | Validation |
|---|---|---|---|---|
| Entree Compte | Action de l'icone Compte | Acces direct page `Compte/Parametres` | Section navigation de ce document | Regle identique desktop/mobile |
| Bloc Compte | Quel contenu minimal | Username editable, role RO, logout, action connexion contextuelle | Section IA de ce document | MVP explicite |
| Bloc Securite | Quelle profondeur MVP | Derniere connexion optionnelle, sessions actives hors MVP | Section Securite de ce document | Pas d'ambiguite sur le hors scope |
| Bloc Administration | Faut-il des logs | Lien conditionnel si audit disponible | Section Administration de ce document | Condition d'affichage documentee |
| Bloc Diagnostic | Quel niveau utile | Version, environnement, copie debug | Section Diagnostic de ce document | Utilite support explicitee |
| Reports | Quelle identite afficher | Nom visible puis alias puis identifiant interne | Section attribution reports de ce document | Tracabilite lisible au quotidien |
| Frontieres phase 6 | Que fait chaque feature | F6.1 cadrage, F6.2/F6.3/F6.4 implementation | Ce document + ROADMAP | Decoupage actionnable |

## 9) Criteres d'acceptation du cadrage F6.1

1. le cadrage couvre objectifs, non-objectifs, parcours et sections
2. la navigation `Compte/Parametres` est decidee pour desktop et mobile
3. la tracabilite report (auteur creation + cloture/ignorance) est cadree au niveau produit
4. la frontiere F6.1 vs F6.2/F6.3/F6.4 est explicite et actionnable
5. aucune implementation technique n'est executee en F6.1
6. aucun changement API/DB/routes/query params n'est introduit
7. aucune migration SQL n'est ajoutee
8. aucun secret sensible n'est introduit

## 10) Checklist de validation documentaire (Script A)

Controle 1:
- verifier que ce document couvre navigation, UX, perimetre fonctionnel et attribution reports

Controle 2:
- verifier la separation explicite entre F6.1 et F6.2/F6.3/F6.4

Controle 3:
- verifier la coherence `ROADMAP` + `HISTORIQUE` (+ `DECISIONS` si touche)

Controle 4:
- verifier le respect du scope documentaire strict (pas de code, pas de SQL)

Resultat attendu:
- cadrage F6.1 decision-complete, pret pour implementation ulterieure, sans glissement technique.

## 11) Hypotheses et defaults retenus

1. F6.1 reste un lot documentaire pur.
2. Auth cible: email/password avec compatibilite wording magic link.
3. `Sessions actives` est hors MVP court terme.
4. `Voir logs / historique` est conditionnel a l'existence d'un audit exploitable.
5. Aucun secret ne sera expose en clair dans la future page.
