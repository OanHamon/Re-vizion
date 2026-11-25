# ECRANS · liste de référence

Le jeu compte **15 écrans, pas un de plus** (06b est un panneau de 06, pas un écran à part). Créer, fusionner ou supprimer un écran passe par un point dans `VALIDATION.md`.
La forme suit la DA de `CLAUDE.md` (pastel sur papier, sobre, géométrique, boutons ronds, très peu de texte). Les maquettes Figma « Jeu de révision PvP · UI » donnent le contenu, pas le style.

Colonne **Proto** : `Oui` = à faire pour le prototype · `Simplifié` = version minimale · `Non` / `Plus tard` = ne pas coder pour l'instant. En cas de doute, le périmètre de `MVP.md` prime.

## Navigation

```
01 Accueil ──menu──► 02 Loadout · 03 Cours · 04 Decks · 05 Paramètres ──► retour 01
01 Accueil ──► 06 Créer un salon ──salon créé──► 07 Lobby
06 Créer un salon ──ligne Carte──► 06b Choix de la carte ──choisir ou retour──► 06
01 Accueil ──rejoindre par code──► 07 Lobby
07 Lobby ──tous les joueurs présents prêts (2 au moins)──► 08 Choix de carte

Match :
08 Choix de carte ──► 09 Question ──tour suivant──► 08
09 Question ──budget épuisé──► 10 Transition ──► 11 Combat FPS ──► 12 Fin de manche
12 Fin de manche ──manche suivante──► 08
12 Fin de manche ──match fini──► 13 Récap des erreurs ──► 14 Résultats
(en Duel, une seule manche : 11 ──► 13 directement)

14 Résultats ──rejouer──► 07 Lobby · ──accueil──► 01
01 Accueil ──entraînement solo──► 08 ──► 09 ──budget épuisé──► 13 (sans combat)
15 Admin : adresse séparée /admin, jamais accessible depuis le jeu
```

## Hors partie

### 01 Accueil · Proto : Simplifié
- **Fonction** : point d'entrée, lancer une partie.
- **Contenu** : Créer un salon · Rejoindre avec un code · Entraînement solo · accès Loadout, Cours, Decks, Paramètres · pièces et niveau · perso équipé · dernière partie.
- **Mène à** : 02, 03, 04, 05, 06, 07 (par code), 08 (solo).

### 02 Loadout et boutique · Proto : Simplifié (choix d'arme seulement)
- **Fonction** : choisir son arme, dépenser ses pièces.
- **Contenu** : 4 armes (pistolet, fusil d'assaut, fusil à pompe, sniper) avec dégâts, cadence, chargeur · arme équipée · skins avec prix ou verrouillés · solde de pièces.
- **Mène à** : 01.

### 03 Cours · Proto : Non
- **Fonction** : réviser hors combat.
- **Contenu** : liste des cours avec % de maîtrise · notions maîtrisées ou à revoir · questions ratées en priorité · bouton entraînement.
- **Mène à** : 01, 08 (entraînement).

### 04 Decks · Proto : Simplifié (liste et import JSON)
- **Fonction** : gérer les decks de questions.
- **Contenu** : liste des decks (titre, nombre de questions, répartition des difficultés, visibilité, auteur, badge vérifié) · import JSON par glisser-déposer avec les erreurs de validation · rejoindre un deck par code.
- **Mène à** : 01 ; chaque joueur choisit son deck en 07.

### 05 Paramètres · Proto : Simplifié (réduire les flashs, sensibilité)
- **Fonction** : réglages du joueur.
- **Contenu** : contrôles (sensibilité, touches) · audio · graphismes · accessibilité (réduire les flashs, mode daltonien, taille du texte, temps de lecture, réticule contrasté).
- **Mène à** : 01.

## Avant le match

### 06 Créer un salon · Proto : Oui
- **Fonction** : l'hôte règle la partie et obtient un code.
- **Contenu** : mode (Duel, Best of 3, Chrono, Personnalisé) · carte (ouvre 06b) · nombre de joueurs max (2 à 5, imposé à 2 en Duel) · budget du quiz (1:00 à 5:00 par 30 s) · nombre max de questions · nombre de questions faciles, moyennes, difficiles · coût des cartes · durée du combat (1:00 à 5:00 par 30 s) · en Personnalisé : vies, manches et condition de victoire (dernier en vie ou le plus de kills) · règles (quitte ou double, combo négatif) · code du salon et bouton copier · adresse locale à ouvrir sur l'autre PC (et QR code si possible) · résumé.
- **Pas de choix de deck ici** : chaque joueur choisit le sien dans le lobby.
- **Mène à** : 07 ; 06b (ligne Carte) ; retour 01.

### 06b Choix de la carte · Proto : Oui
- **Fonction** : l'hôte choisit la carte du combat.
- **Forme** : panneau plein écran par-dessus 06, qui garde les réglages en cours.
- **Contenu** : liste des cartes jouables (`selectable` dans `config/arenas.json`), avec étiquette de couleur, nom, type et nombre de joueurs conseillé · aperçu 3D de la carte sélectionnée, qui tourne et qu'on peut faire glisser · type, taille et une ligne de description · bouton Choisir cette carte · retour (Échap) sans rien changer · flèches pour passer d'une carte à l'autre.
- **Mène à** : 06.

### 07 Lobby · Proto : Oui
- **Fonction** : attendre les autres joueurs et se déclarer prêt.
- **Contenu** : une place par joueur possible, 2 à 5 (perso, pseudo, arme, deck choisi, statut prêt ; place libre en attente) · nombre de joueurs présents · choix de son propre deck, avec contrôle du nombre de questions par difficulté (Prêt bloqué et message clair si le deck est trop petit) · code · mode · carte · résumé des paramètres · boutons Quitter et Prêt.
- **Mène à** : 08 quand tous les présents sont prêts (2 au moins) ; Quitter vers 01.

## Pendant le match

### 08 Quiz : choix de carte · Proto : Oui
- **Fonction** : choisir le bonus à tenter.
- **Contenu** : « Choisis ta carte » apparaît seul, puis 3 grandes cartes montent depuis le bas et occupent l'essentiel de l'écran (famille, rareté, bonus, effet, difficulté, coût en temps) · petit minuteur du budget en bas · colonne d'icônes des bonus acquis à droite · indicateur de combo discret.
- **Interdit sur cet écran** : nom du joueur, titres, texte superflu.
- **Mène à** : 09.

### 09 Quiz : question · Proto : Oui
- **Fonction** : répondre pour gagner la carte.
- **Contenu** : carte en jeu · énoncé · 2 à 4 réponses (clic ou touches 1 à 4) · minuteur égal au coût de la carte · retour bonne ou mauvaise réponse avec l'explication · bonus gagné ou malus.
- **Mène à** : 08 (tour suivant) ; 10 quand le budget est épuisé ; 13 en entraînement solo.

### 10 Transition avant combat · Proto : Simplifié
- **Fonction** : montrer les deux équipements.
- **Contenu** : bonus de chaque joueur · scores du quiz · compte à rebours 3, 2, 1 · numéro de manche et arène.
- **Mène à** : 11.

### 11 HUD de combat · Proto : Oui
- **Fonction** : le combat FPS (duel ou mêlée de 2 à 5 joueurs).
- **Contenu** : score, chrono, manche · réticule · vie et bouclier · munitions et arme · bonus actifs · capacités (dash, double saut) · fil des éliminations · étiquette de chaque ennemi.
- **Mène à** : 12 à la fin de la manche ; 13 à la fin du match.

### 12 Fin de manche · Proto : Simplifié (Best of 3 seulement)
- **Fonction** : annoncer le résultat de la manche.
- **Contenu** : vainqueur · score des manches · stats (temps, précision, dégâts, bonus le plus utile) · compte à rebours vers le quiz suivant.
- **Mène à** : 08 (manche suivante) ; 13 si le match est fini.

## Après le match

### 13 Récap des erreurs · Proto : Oui
- **Fonction** : réviser ses erreurs, c'est le cœur pédagogique du jeu.
- **Contenu** : score du quiz · pour chaque question ratée : énoncé, ta réponse, bonne réponse, explication · bouton « signaler la question ».
- **Mène à** : 14.

### 14 Résultats · Proto : Simplifié
- **Fonction** : conclure le match.
- **Contenu** : victoire ou défaite · score · **hexagone de comparaison des joueurs** (une forme par joueur, superposées, aux couleurs des joueurs) · au-delà de 2 joueurs, classement (manches gagnées, puis kills) avec 6 axes notés de 0 à 100, et à côté le tableau des valeurs, la meilleure valeur de chaque axe en gras :
  - Connaissance : % de bonnes réponses, pondéré par la difficulté des questions ;
  - Audace : difficulté moyenne des cartes choisies ;
  - Vitesse de réponse : temps moyen de réponse rapporté au temps permis (plus rapide = plus haut) ;
  - Précision : % de tirs qui touchent ;
  - Agressivité : dégâts infligés rapportés aux PV d'un adversaire (moyenne des adversaires à plusieurs) ;
  - Régularité : plus longue série de bonnes réponses, rapportée au nombre de questions.
  Les formules exactes et leurs bornes vont dans `config/` (ex. `config/stats.json`). Pièces et XP : hors MVP.
- **Mène à** : 07 (rejouer dans le même salon), 13 (revoir le récap), 01.

## À part

### 15 Admin · Proto : Plus tard
- **Fonction** : régler toutes les valeurs du jeu sans coder.
- **Contenu** : sections armes, joueur, bonus et malus, quiz, combat, modes, assets · édition des JSON de `config/` · export.
- **Accès** : adresse séparée `/admin`, jamais depuis le jeu.
