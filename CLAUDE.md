# CLAUDE.md · Réviz Arena (nom provisoire)

Jeu web de révision : un quiz de cours construit ton équipement, puis un duel FPS PvP l'utilise, puis un récap corrige tes erreurs.
Public : d'abord une promo d'étudiants (CESI), grand public plus tard. Langue de l'interface : français.

## Boucle d'un match

1. **Phase quiz** : à chaque tour, 3 cartes de bonus apparaissent. Le joueur en choisit une, ce qui ouvre une question. Bonne réponse = il gagne le bonus.
2. **Combat** : FPS PvP de 2 à 5 joueurs, chacun pour soi (Duel : 1 contre 1), court (1 à 5 min), avec l'arme du loadout et les bonus gagnés.
3. **Récap** : chaque question ratée est montrée avec la bonne réponse et l'explication.

## Règles de la phase quiz

- **4 familles de cartes** : Attaque (dégâts, munitions, viseur laser), Défense (bouclier, casque), Mobilité (vitesse, saut), Arme (bonus propre à l'arme équipée : zoom sniper, recul réduit, rechargement rapide).
- **La rareté fixe la difficulté et le coût en temps** :

| Rareté | Difficulté des questions | Coût en temps |
| --- | --- | --- |
| Commune | 1 à 2 | 30 s |
| Rare | 3 | 45 s |
| Épique | 4 | 60 s |
| Légendaire | 5 | 75 s |

- **Budget de temps** : la phase quiz dure un temps total fixe (5:00 par défaut), décompté en temps réel. Le coût d'une carte est aussi le temps max pour répondre. Une carte n'est proposée que si son coût rentre dans le temps restant. Quand il ne reste même plus de quoi jouer une Commune, la phase se termine. Tous les joueurs finissent donc en même temps. L'hôte peut aussi fixer un nombre max de questions : la phase s'arrête alors à la dernière question, même s'il reste du temps.
- **Mauvaise réponse** : rien, sauf cas ci-dessous.
- **Combo quitte ou double** : après 3 bonnes réponses d'affilée, les 3 cartes proposées sont plus rares (les Légendaires, donc les armes spéciales, n'existent que là). Une erreur sur ces cartes donne un gros malus (ex. munitions divisées par 2).
- **Combo négatif** : après 3 erreurs d'affilée, chaque nouvelle erreur donne un malus.
- Questions tirées au hasard dans la bonne tranche de difficulté, sans doublon dans un match.
- **Chacun son cours** : en multijoueur, chaque joueur choisit son propre deck, même sur une matière différente. Les cartes proposées sont communes (même tirage au tour N), les questions viennent du deck de chacun à la difficulté de la carte. Règles d'équilibrage détaillées dans `MVP.md`.

## Combat (pour plus tard, pas dans le premier lot)

- FPS arcade cartoon, rapide. 100 PV, une vie par manche par défaut.
- Modes : Duel (1 contre 1, 1 quiz + 1 combat), Best of 3 (2 à 5 joueurs, quiz avant chaque manche, le dernier en vie gagne la manche), Chrono (2 à 5 joueurs, réapparitions, le plus de kills gagne), Personnalisé (vies, manches et condition de victoire au choix).
- Salon : de 2 à 5 joueurs (réglage de l'hôte, imposé à 2 en Duel). La partie démarre quand tous les joueurs présents sont prêts, à partir de 2. Durées du quiz et du combat de 1:00 à 5:00 par pas de 30 s. Tous les choix proposés viennent de `config/*.json`.
- Armes du loadout, toutes à environ 80 dégâts par seconde (elles changent le style de jeu, pas la puissance) :

| Arme | Dégâts par tir | Cadence | Chargeur | Particularité |
| --- | --- | --- | --- | --- |
| Pistolet | 20 | 4 tirs/s | 12 | Précis à toute distance |
| Fusil d'assaut | 10 | 8 tirs/s | 30 | Recul croissant en rafale |
| Fusil à pompe | 8 plombs × 10 | 1 tir/s | 6 | Dégâts réduits avec la distance |
| Sniper | 80, tête × 2 | 1 tir/s | 5 | Un tir à la tête = kill |

- Option d'accessibilité obligatoire : réduire les flashs et les secousses d'écran.

## Stack technique

- **Front** : Vite + TypeScript + Three.js. Pas de framework UI lourd : DOM + CSS pour les interfaces, Three.js pour la 3D.
- **Serveur (plus tard)** : Node + TypeScript + WebSocket (`ws`), serveur autoritaire : c'est lui qui tire les questions et valide les réponses, pour limiter la triche.
- **Multijoueur** : salons privés par code uniquement, pas de matchmaking public. Pour le MVP, le serveur tourne sur le PC de l'hôte (`npm run host`) et les autres joueurs se connectent sur le même réseau local ; voir `MVP.md`.
- **Tests** : Vitest sur la logique pure (tirage des cartes, budget de temps, combos, validation des decks).

## Règles d'architecture (à respecter partout)

1. **Aucune valeur de gameplay en dur dans le code.** Tout vit dans `config/*.json` : `quiz.json` (budget, coûts, raretés, combos), `bonuses.json` (effets, durées, familles, raretés, malus), `weapons.json`, `player.json`, `modes.json`. Ces fichiers sont validés au chargement (schéma zod). Une interface admin les éditera plus tard.
2. **Le jeu est un moteur, le contenu est interchangeable.** Les questions viennent de decks JSON dans `decks/`. Le code ne connaît aucune matière.
3. **Catalogue d'assets.** Le code ne charge jamais un modèle 3D en dur : il passe par `config/assets.json` (id → chemin GLB, échelle, rotation, point de prise en main). Pour le proto, les entrées pointent vers des formes de base générées en code (cubes, cylindres, sphères).
4. **Logique séparée du rendu.** La logique du quiz et du combat est en TypeScript pur, testable sans navigateur, et réutilisable côté serveur.

## Format d'un deck

```json
{
  "deck": { "id": "cesi-reseaux-tcp-ip", "titre": "Réseaux : modèle TCP/IP", "matiere": "Informatique", "niveau": "Bac+2", "auteur": "tidi998", "version": 1, "langue": "fr" },
  "questions": [
    {
      "id": "q001",
      "type": "qcm",
      "difficulte": 3,
      "enonce": "À quelle couche du modèle TCP/IP appartient le protocole UDP ?",
      "choix": ["Application", "Transport", "Internet", "Accès réseau"],
      "reponse": 1,
      "explication": "UDP, comme TCP, gère le transport de bout en bout entre applications.",
      "tags": ["protocoles", "couches"]
    }
  ]
}
```

- `type` : `qcm` (2 à 4 choix) ou `vrai_faux` (`choix` = ["Vrai", "Faux"]). D'autres types viendront plus tard, le code doit rester extensible.
- `reponse` : index du bon choix (base 0). `difficulte` : entier de 1 à 5.
- Grille de difficulté : 1 = définition, 3 = application, 5 = raisonnement ou piège.
- Un validateur refuse un deck mal formé avec un message clair (champ fautif, numéro de question).

## Direction artistique

- **Pastel sur papier** : fond blanc beige façon papier, couleurs pastel avec des effets doux (dégradés, halos légers). Jamais de néon, jamais de thème sombre.
- **Sobre et géométrique** : fonds à motifs géométriques, boutons ronds, très peu de texte, presque pas de titres. Les infos courtes sont séparées par des points médians (Manche 1 · Question 5).
- Couleurs des familles : Attaque orange, Défense cyan, Mobilité vert, Arme jaune (versions pastel). Raretés par la couleur du contour : Commune gris, Rare bleu, Épique rose, Légendaire violet.
- Toutes les couleurs sont des variables CSS dans un seul fichier de thème. Le thème pastel déjà présent dans le projet est validé : c'est lui qui fait référence.
- **Écran de choix de carte** : « Choisis ta carte » apparaît seul, puis 3 grandes cartes surgissent depuis le bas et occupent l'essentiel de l'écran. Petit minuteur en bas. Les bonus déjà acquis forment une colonne d'icônes à droite. Pas de nom de joueur.
- **Maquettes de référence** : fichier Figma « Réviz Arena · UI (DA pastel) » (https://www.figma.com/design/m6yF34cOU7coSO6Jp5yUaq). Les écrans y portent les numéros de `ECRANS.md`, et les couleurs sont des variables Figma qui reprennent les noms du thème CSS (`paper`, `ink`, `family-*`, `rarity-*`, `good`, `bad`…). En cas d'écart de couleur, c'est `theme.css` qui fait foi. L'ancien fichier Figma « Jeu de révision PvP · UI » (néon, sombre) est obsolète.
- **Captures des maquettes** dans `docs/maquettes/`, nommées par numéro d'écran (ex. `08-choix-carte.png`). Les regarder avant de coder ou de retoucher un écran.
- **Écarts avec le code actuel, à appliquer** :
  - boutons rectangulaires aux coins légèrement arrondis (rayon d'environ 10 px), lisibles, avec icône et libellé, au lieu des gros boutons ronds ; les réponses du quiz ont aussi des coins peu arrondis (environ 14 px) ;
  - Loadout façon Call of Duty : fiche de l'arme à gauche (nom, stats en barres), aperçu au centre, bonus d'arme possibles et bouton Équiper à droite, et en bas un bandeau d'armes qui défile, prévu pour accueillir de nouvelles armes.

## MVP en cours

Le périmètre actuel, les décisions validées, le fonctionnement en réseau local, les règles d'équilibrage entre deux decks, les critères d'acceptation et le découpage en lots sont dans `MVP.md`. Ce qui est marqué « Hors MVP » ne se code pas. Les valeurs déjà présentes dans `config/*.json` sont les valeurs de référence : ne pas les recréer ni les changer sans validation.

## Écrans

La liste complète des écrans, leur fonction, leur contenu et leurs liens est dans `ECRANS.md`. C'est la référence : ne crée aucun écran, menu ou page qui n'y figure pas, et ne code que les écrans marqués pour le proto, sauf demande explicite. Chaque écran est un module séparé dans `src/ui/screens/` (ex. `08-card-choice.ts`), et la navigation passe par un seul routeur qui respecte les liens de `ECRANS.md`.

## Pipeline de travail (obligatoire)

Le travail se fait par **lots**. Un lot = un prompt de l'utilisateur. `VALIDATION.md` est la mémoire partagée entre toi et l'utilisateur : tu y écris ce que tu fais et ce qui attend sa décision.

1. **Lire** : au début de chaque lot, relis ce fichier puis `VALIDATION.md`. Applique les décisions marquées `VALIDÉ` et `REFUSÉ`, et les commentaires de l'utilisateur.
2. **Annoncer** : ajoute en haut du journal une entrée « Lot N » avec ton plan en quelques lignes, avant de toucher au code.
3. **Travailler** : avance par petites étapes jouables, chaque étape doit se lancer avec `npm run dev`. Tests de la logique avant l'écran suivant.
4. **Signaler** : chaque fois que tu dois choisir quelque chose qui n'est pas écrit dans ce brief, ajoute un point dans « À valider ». S'il est bloquant, arrête-toi et pose la question. Sinon, applique le choix le plus simple, marque-le `PROVISOIRE` et continue.
5. **Clôturer** : lance les tests, puis complète l'entrée du lot dans le journal (ce qui est fait, fichiers touchés, comment tester, ce qui reste).
6. **S'arrêter** : ne commence jamais le lot suivant de toi-même. Attends le prochain prompt.

Seul l'utilisateur change le statut d'un point. Tu ne marques jamais un point `VALIDÉ` toi-même.

## Droits

**Tu peux, sans demander :**
- créer, modifier et refactorer du code dans `src/`, `tests/` et les scripts du projet ;
- installer les dépendances listées dans « Stack technique » ;
- lancer `npm`, `npx vite`, `npx vitest`, `npx tsc` ;
- faire des commits git locaux sur la branche de travail, avec un message qui cite le lot (ex. `lot-1: tirage des cartes`) ;
- écrire dans `VALIDATION.md` (journal et nouveaux points à valider).

**Tu dois faire valider avant (point dans « À valider ») :**
- toute dépendance qui n'est pas dans la stack ;
- tout changement d'une règle de jeu, d'une valeur de `config/*.json` par rapport au brief, ou du format des decks ;
- tout écart avec la direction artistique ;
- tout changement de structure des dossiers ;
- toute suppression de fichier que tu n'as pas créé dans le lot en cours ;
- tout écran, menu ou page absent de `ECRANS.md`, ou tout écart avec les liens qui y sont décrits ;
- toute modification de `CLAUDE.md`, `ECRANS.md` ou `MVP.md` ;
- tout travail sur un élément marqué « Hors MVP ».

**Interdit :**
- `git push`, toucher à `main`, réécrire l'historique git ;
- déployer, publier, ou appeler une API ou un service payant ;
- lire ou modifier des fichiers hors du dossier du projet ;
- changer le statut d'un point dans `VALIDATION.md` ;
- passer au lot suivant sans prompt de l'utilisateur.

## Conventions

- Commenter en français, nommer le code en anglais.
- Pas de valeur de gameplay en dur (voir « Règles d'architecture »).
