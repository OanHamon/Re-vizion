# VALIDATION · suivi du projet

Ce fichier est partagé entre l'utilisateur et Claude Code.
- **Claude** écrit le journal des lots et ajoute les points à valider. Il ne change jamais un statut.
- **L'utilisateur** tranche chaque point en changeant son statut, et peut ajouter un commentaire.

Les droits de Claude (libre, à valider, interdit) sont dans `CLAUDE.md`, section « Droits ».

## Statuts

| Statut | Signification | Qui le pose |
| --- | --- | --- |
| `EN ATTENTE` | Claude attend une décision, rien n'est appliqué | Claude |
| `PROVISOIRE` | Claude a appliqué le choix le plus simple pour ne pas bloquer, réversible | Claude |
| `VALIDÉ` | L'utilisateur accepte, Claude peut s'appuyer dessus | Utilisateur |
| `REFUSÉ` | L'utilisateur refuse, Claude annule ou applique le commentaire au lot suivant | Utilisateur |
| `À REVOIR` | L'utilisateur demande une autre proposition | Utilisateur |

---

## À valider

Points ouverts, les plus récents en haut. Une fois tranché, un point descend dans « Points tranchés ».

<!-- Modèle d'un point (à copier par Claude) :

### V-001 · Titre court
- **Lot** : 1
- **Statut** : EN ATTENTE
- **Type** : dépendance | règle de jeu | config | format de deck | DA | structure | suppression | autre
- **Contexte** : pourquoi la question se pose, en 1 ou 2 phrases.
- **Proposition** : ce que Claude propose (et ce qu'il a appliqué si PROVISOIRE).
- **Alternatives** : les autres options, en une ligne chacune.
- **Bloquant** : oui | non
- **Commentaire de l'utilisateur** :

-->

### V-060 · Fichiers ajoutés à la racine pour le serveur en ligne
- **Lot** : 20
- **Statut** : PROVISOIRE
- **Type** : structure
- **Contexte** : le serveur autonome a besoin d'un build et d'une description pour Render.
- **Proposition** (appliqué) : `server/main.ts` (entrée du serveur autonome), `vite.server.config.ts` (build du serveur), `render.yaml` (Blueprint Render), dossier de sortie `dist-server/` (ignoré par git). Port par défaut 8787 hors hébergeur.
- **Alternatives** : `Dockerfile` au lieu de `render.yaml` ; régler Render à la main sans fichier ; config de build dans `server/`.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-059 · Hébergement du serveur en ligne
- **Lot** : 19
- **Statut** : EN ATTENTE
- **Type** : dépendance | autre
- **Contexte** : itch.io n'héberge que des fichiers statiques (HTTPS). Le serveur WebSocket autoritaire doit tourner ailleurs, en `wss://`. Claude n'a pas le droit de déployer ni d'appeler un service payant : le choix et la mise en ligne sont à toi.
- **Proposition** : un petit hébergeur Node avec WebSocket (Fly.io, Render ou Railway ; ou un VPS à quelques euros par mois). Le code reste indépendant de l'hébergeur : adresse du serveur dans la config du client, `Dockerfile` ou script `npm run server` standard.
- **Choix exprimé en chat (lot 20)** : **Render, offre gratuite**, sur le compte Render existant de l'utilisateur. Pas de tunnel sur le PC : les joueurs doivent n'avoir rien de technique à faire (lien itch.io + code). À noter : sur l'offre gratuite, le serveur s'endort après 15 min sans activité (réveil d'environ 1 min), et les heures gratuites (750 h par mois) sont partagées avec les autres services gratuits du compte.
- **Alternatives** : ton PC ouvert via un tunnel (Cloudflare Tunnel, ngrok), gratuit mais PC allumé pendant les parties ; P2P WebRTC (moins bon contre la triche).
- **Bloquant** : oui pour la mise en ligne réelle, non pour coder le serveur autonome (testable en local).
- **Commentaire de l'utilisateur** :

### V-058 · Périmètre de la V2 et découpage en lots
- **Lot** : 19
- **Statut** : EN ATTENTE
- **Type** : structure | règle de jeu | autre
- **Contexte** : MVP déclaré fini en chat. V2 choisie en chat : **jeu en ligne + itch.io**, **progression et boutique**, **admin des réglages**. Les 58 points ouverts restent ouverts (choix en chat : « on avance quand même »). `MVP.md` n'existe pas dans le projet.
- **Proposition** :
  - Écrire le périmètre dans un nouveau `V2.md` (même rôle que `MVP.md`), et mettre à jour `CLAUDE.md` (section « MVP en cours ») et `ECRANS.md` (02 complet, 15 Admin passent au périmètre) : modifications à valider.
  - **Lots proposés**, dans cet ordre :
    1. **Serveur autonome** : sortir le serveur WebSocket de Vite (`server/attach.ts`) en un `npm run server` qui tourne seul ; le LAN (`npm run host`) continue de marcher.
    2. **Client configurable** : adresse du serveur réglable (config de build), `wss://` en ligne, `ws://` en LAN ; reconnexion et messages d'erreur clairs ; build itch.io (chemins relatifs, zip).
    3. **Salons en ligne** : codes uniques côté serveur, expiration des salons vides, limites anti-abus simples (nombre de salons, taille des messages).
    4. **Progression** : pièces (déjà gagnées depuis le lot 13) et XP, formules dans `config/` ; sauvegarde côté client (localStorage) faute de comptes.
    5. **Boutique et déblocages** : écran 02 complet (armes et bonus d'arme à débloquer), prix dans `config/`.
    6. **Admin** : écran 15 sur `/admin`, édition des `config/*.json` avec validation zod, export.
  - Sans comptes joueurs, la progression est locale et donc modifiable par le joueur : acceptable pour une promo, à revoir pour le grand public.
- **Alternatives** : commencer par la progression (pas d'hébergement nécessaire) ; ajouter des comptes joueurs (gros chantier, base de données) ; garder l'admin pour une V3.
- **Bloquant** : oui (ordre des lots et création de `V2.md`)
- **Commentaire de l'utilisateur** :

### V-057 · Explosion spectaculaire : style et accessibilité
- **Lot** : 18
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : demandé (« des effets bien plus dramatiques, de beaux flashs, du shake, plein de particules, une grosse explosion »). La DA interdit le néon et le sombre, et l'option « réduire flashs et secousses » est obligatoire.
- **Proposition** (appliqué) :
  - **Explosion pastel** : cœur crème très lumineux, boule de feu pêche puis orange pastel, champignon de fumée beige clair qui monte et s'étale, onde de choc au sol, étincelles crème, éclats et braises, trace brûlée beige-gris qui s'efface en 10 s. Couleurs dans `theme.css` (`--blast-*`).
  - **Flash** : lumière forte qui éclaire le décor, flash d'écran crème selon la distance.
  - **Secousse** : forte et longue (environ 0,8 s), plus faible avec la distance, avec un petit à-coup du champ de vision.
  - **Son** : plus grave et plus long, avec un écho.
  - **« Réduire flashs et secousses »** : ni flash d'écran, ni secousse, ni à-coup ; lumière et boule de feu adoucies, trois fois moins de particules.
  - Les réglages de l'effet (durées, nombres de particules) sont des constantes du rendu, pas de la config : ils ne changent pas le jeu.
- **Alternatives** : explosion plus sobre ; option à trois niveaux (complet, réduit, aucun) ; couleurs plus vives.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-056 · Écran 06 : panneau réduit au QR code
- **Lot** : 17
- **Statut** : PROVISOIRE
- **Type** : autre
- **Contexte** : demande en chat (« il faut le QR code en grand ici »). `ECRANS.md` liste encore pour 06 « code du salon et bouton copier » et « résumé ».
- **Proposition** (appliqué) : panneau de droite = QR en grand + adresse + « Même wifi requis ». Le code reste affiché dans le lobby (07), et les réglages restent visibles dans le formulaire de gauche.
- **Alternatives** : garder un résumé court sous le QR ; mettre à jour `ECRANS.md` (à valider).
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-055 · QR code aussi dans le lobby (07), lien qui rejoint directement
- **Lot** : 16
- **Statut** : PROVISOIRE
- **Type** : autre
- **Contexte** : `ECRANS.md` prévoit le QR code sur l'écran 06, mais le code du salon n'existe qu'après la création (V-034). Un QR sans code ne fait qu'ouvrir le jeu.
- **Proposition** (appliqué) :
  - 06 : QR de l'adresse du jeu seule, à côté de l'adresse ;
  - 07 : QR de l'adresse + code (`http://IP:port/?code=XXXX`), à côté du code et du bouton Copier ;
  - ouvrir ce lien passe par 01 puis rejoint le salon (lien « 01 → 07 par code » de `ECRANS.md`), et la barre d'adresse est nettoyée ;
  - sans `npm run host`, pas de QR : le panneau dit de lancer le jeu avec `npm run host`.
  - Le jeu reste prévu pour PC : le QR sert surtout à ne pas taper l'IP (appareil photo d'un téléphone, puis lien envoyé au PC, ou scan depuis le PC).
- **Alternatives** : QR seulement en 06 (adresse sans code) ; QR seulement en 07 ; ajouter le QR et le lien direct à `ECRANS.md`.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-054 · Dépendance `qrcode` et adresse réseau local
- **Lot** : 16
- **Statut** : PROVISOIRE
- **Type** : dépendance
- **Contexte** : dépendance hors stack, acceptée en chat (« Avec la lib qrcode ») ; à confirmer ici pour la trace.
- **Proposition** (appliqué) :
  - `qrcode` 1.5.4 (+ `@types/qrcode` en dev), rendu en SVG aux couleurs du thème (`--ink` sur `--paper-light`) ;
  - script `npm run host` (= `vite --host`), déjà cité dans l'écran 06 mais absent de `package.json` ;
  - route `/api/lan` sur le serveur de Vite : elle renvoie l'adresse réseau local. Un PC a souvent des cartes virtuelles (sur ce PC : VirtualBox, deux VMware, puis le wifi) ; on garde la carte de la route par défaut (socket UDP « connectée », aucun paquet envoyé), sinon un classement qui écarte les réseaux virtuels.
- **Alternatives** : encodeur QR maison sans dépendance ; laisser l'hôte choisir l'adresse dans une liste.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-053 · Éléments cassables choisis sur chaque carte
- **Lot** : 15
- **Statut** : PROVISOIRE
- **Type** : règle de jeu | config
- **Contexte** : « destruction limitée » validée en chat. Il fallait choisir quoi casser sur chaque carte.
- **Proposition** (appliqué) :
  - **Cubes** : les 2 murets bas (4 × 1 m) et les 2 longs murets (4 × 1,2 m) deviennent en bois ; les 2 piliers (1 × 1,5 m) en pierre. Mêmes places, mêmes tailles, mêmes couleurs.
  - **Quartier** : caisses (bois), murets de la place (pierre), vitre de l'abri de bus (verre).
  - **Vallon** : troncs couchés (bois), mur à arche et colonnes brisées des ruines (pierre). La tour et l'estrade restent solides.
  - **Mine** : caisses de la galerie (bois).
  - **Jamais cassables** : sol, relief, murs d'enceinte, bâtiments, escaliers, ponts, tours, voitures, wagonnets, rochers.
- **Alternatives** : plus d'éléments (façades, ponts) ; seulement les caisses.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-052 · Fichier `config/materials.json`, champs `breakables` et décor cassable séparé
- **Lot** : 15
- **Statut** : PROVISOIRE
- **Type** : config | structure | DA
- **Contexte** : le brief ne prévoit rien pour les matériaux ni pour les éléments cassables.
- **Proposition** (appliqué) :
  - `config/materials.json` : taille des morceaux et liste des matériaux (validé par zod).
  - `arenas.json` : champ facultatif `breakables` (matériau, position, taille, couleur pour les arènes sans décor) et `breakableDecor` (id d'asset).
  - Cartes voxel : `npm run maps` écrit les voxels cassables à part, dans `assets/models/maps/<id>-breakables.vox` (entrée `map.<id>.breakables` dans `assets.json`). Le décor principal ne les contient plus.
  - `theme.css` : une couleur d'éclats par matériau (`--material-glass`, `--material-wood`, `--material-stone`).
- **Alternatives** : matériaux dans `arenas.json` ; un seul fichier `.vox` par carte qu'on modifie à la volée.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-051 · Destruction limitée : règles et valeurs
- **Lot** : 15
- **Statut** : PROVISOIRE
- **Type** : règle de jeu | config
- **Contexte** : validé en chat (« destruction limitée »). Les règles précises ne sont écrites nulle part.
- **Proposition** (appliqué, valeurs dans `config/materials.json`) :
  - Seuls certains éléments sont cassables (V-053). Chacun est découpé en **morceaux de 50 cm** qui ont leurs propres points de vie : un élément se casse donc plus ou moins, morceau par morceau.
  - **Matériaux** (PV d'un morceau · part des dégâts d'une balle · part des dégâts d'une grenade) :
    - **Verre** : 10 PV · ×1 · ×4. Une balle perce un morceau.
    - **Bois** : 60 PV · ×0,5 · ×3. 6 balles de pistolet par morceau ; une grenade casse tout dans un rayon d'environ 3 m.
    - **Pierre** : 135 PV · ×0,1 · ×2,7. Presque insensible aux balles (68 balles de pistolet par morceau) ; une grenade au pied du mur casse les morceaux à moins de 75 cm (un trou d’environ 1,5 m), il en faut deux pour ouvrir une vraie brèche.
  - **Balles** : dégâts de l'arme (bonus compris) × part du matériau, au morceau touché. **Grenades** : dégâts de l'explosion selon la distance (comme sur les joueurs) × part du matériau, sur tous les morceaux dans le rayon, même derrière un autre morceau.
  - **Pas de physique** : un morceau détruit disparaît avec des éclats ; ce qui est posé dessus ne tombe pas (une caisse empilée peut rester en l'air), mais un joueur debout dessus tombe.
  - **Serveur autoritaire** : il calcule les dégâts à partir des tirs annoncés (point d'impact vérifié près d'un morceau, départ près du tireur) et des explosions, puis envoie la liste des morceaux détruits à tous.
  - **Chaque manche** repart d'une carte intacte.
- **Alternatives** : morceaux de 25 cm (plus fins, plus coûteux) ; balles sans effet sur le décor ; écroulement des parties qui ne tiennent plus.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-050 · HUD du combat (11) : coffre, question et grenades
- **Lot** : 14
- **Statut** : PROVISOIRE
- **Type** : autre | DA
- **Contexte** : les coffres et les grenades ajoutent des éléments au HUD de l'écran 11. `ECRANS.md` ne les liste pas, et je n'ai pas le droit de le modifier sans validation.
- **Proposition** (appliqué) :
  - **Invite** au centre bas quand on est près d'un coffre : « E · Coffre », ou le temps restant avant qu'il se rouvre (cadenas).
  - **Question du coffre** : panneau compact en bas, au-dessus des barres de vie (énoncé, 2 à 4 réponses numérotées, barre des 10 s qui se vide). On répond avec les touches 1 à 4 (la souris reste capturée, les touches 1 et 2 ne changent pas d'arme pendant la question). Après la réponse : bonne réponse en vert et explication en une ligne pendant 2 s.
  - **Grenades** : compteur sous les munitions (icône + nombre, « G »).
  - **Coffres sur la carte** : coffre voxel jaune pastel (couleur de la famille Arme), couvercle fermé et cadenas quand il est bloqué.
  - **À ajouter dans `ECRANS.md` si tu valides** : en 11, « coffres (question en 10 s) · grenades ».
- **Alternatives** : question en plein écran (on ne voit plus le combat) ; réponse à la souris seulement.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-049 · Nouveau fichier `config/pickups.json`, coffres dans `arenas.json`, dossier `assets/models/props/`
- **Lot** : 14
- **Statut** : PROVISOIRE
- **Type** : config | structure
- **Contexte** : le brief ne liste pas de fichier pour les objets ramassés en combat.
- **Proposition** (appliqué) :
  - `config/pickups.json` : règles des coffres (`chests`) et caractéristiques de la grenade (`grenade`). Validé par zod au chargement.
  - `arenas.json` : nouveau champ facultatif `chests` (positions) par carte. Pour les cartes voxel, il est écrit par `npm run maps` (`m.chest(x, z)` dans `scripts/maps/<carte>.ts`) ; pour Cubes, à la main.
  - Modèles voxel du coffre et de la grenade dessinés en code (`scripts/voxels/props.ts`, `npm run voxels`), écrits dans le nouveau dossier `assets/models/props/`, entrées `prop.chest` et `prop.grenade` dans `assets.json`.
- **Alternatives** : grenade dans `weapons.json` ; coffres dans `modes.json`.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-048 · Grenades et coffres : règles et valeurs
- **Lot** : 14
- **Statut** : PROVISOIRE
- **Type** : règle de jeu | config
- **Contexte** : demandé en chat : des grenades qu'on trouve en combat dans des coffres, une question de **difficulté 3 en 10 s**, et un coffre raté **bloqué 30 s pour tout le monde**. Le reste n'est écrit nulle part.
- **Proposition** (appliqué, valeurs dans `config/pickups.json`) :
  - **Coffres** : 4 par carte (Cubes, Quartier, Vallon, Mine), en deux paires symétriques par rotation de 180° comme les apparitions, au sol, à 10 m environ du centre et à plus de 6 m de toute apparition. Tous ouverts au début de chaque manche.
  - **Ouvrir** : à moins de 2 m, touche E. Le serveur tire une question de difficulté 3 dans le deck du salon, jamais déjà posée dans le match (quiz compris). S'il n'en reste plus en difficulté 3, il prend la difficulté restante la plus proche. S'il n'en reste plus du tout, le coffre ne s'ouvre pas.
  - **Pendant la question** (10 s) : on peut tourner la tête mais pas bouger, tirer ni lancer. On reste touchable. Un seul joueur à la fois par coffre.
  - **Bonne réponse** : +1 grenade (2 au plus). Le coffre se referme 30 s pour tout le monde (même durée qu'un échec, pour éviter de le vider en boucle).
  - **Mauvaise réponse, temps écoulé ou mort pendant la question** : rien de gagné, coffre bloqué 30 s pour tout le monde (ta règle).
  - **Récap (13)** : les questions de coffre ratées y apparaissent, avec la bonne réponse et l'explication. Elles comptent dans « bonnes réponses / total » du récap, mais pas dans l'hexagone ni les pièces.
  - **Grenade** : touche G, lancée dans l'axe du regard (12 m/s), rebondit peu sur le décor, explose 2 s après. Portée : environ 2 m en visant ses pieds, 13 m en visant haut. 60 dégâts au centre, puis de moins en moins jusqu'à 4,5 m. Le bouclier absorbe comme pour une balle. Un mur entre l'explosion et le joueur le protège. Le lanceur prend la moitié des dégâts s'il est dans la zone. Pas de mort en un coup à pleine vie. Un kill à la grenade compte comme un kill (pas à la tête).
  - **Serveur autoritaire** : il vérifie qu'on a une grenade, calcule seul la trajectoire et l'explosion, et applique les dégâts. Les clients rejouent la même trajectoire pour l'affichage.
  - **Entre deux manches** : les grenades repartent à 0.
- **Alternatives** : bonne réponse qui laisse le coffre ouvert ; 2 grenades par coffre ; grenade qui tue en un coup ; coffres qui donnent aussi d'autres objets.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-047 · Cartes en voxel générées en code : dossiers, config et style
- **Lot** : 12
- **Statut** : PROVISOIRE
- **Type** : structure | config | DA
- **Contexte** : tu as demandé plusieurs belles cartes en voxel (ville, nature, souterrain). Rien dans le brief ne dit comment les fabriquer ni où les ranger.
- **Proposition** (appliqué) :
  - **Fabrication** : chaque carte est dessinée en code dans `scripts/maps/` (même principe que les armes et les personnages). `npm run maps` écrit le décor `assets/models/maps/<id>.vox` (voxels de 25 cm, ouvrable dans MagicaVoxel) et met à jour les entrées de la carte dans `config/arenas.json` et `config/assets.json`. Les autres entrées de ces fichiers ne sont pas touchées. Collisions et décor viennent du même dessin.
  - **Nouveaux dossiers** : `scripts/maps/` et `assets/models/maps/`.
  - **Nouveaux champs de `arenas.json`** (tous facultatifs) : `selectable` (proposée dans le choix), `kind` (Ville, Nature…), `tagline`, `recommendedPlayers`, `decor` (id du décor dans `assets.json`), `look` (soleil, lumière d'ambiance, ombres, brouillard). Avec un décor, les blocs ne servent plus qu'aux collisions.
  - **Couleurs** : ciel, brouillard et lumière du sol de chaque carte dans `theme.css` (`--map-city-*`, `--map-forest-*`, `--map-mine-*`), plus une couleur d'étiquette par carte. Les couleurs du décor lui-même sont dans les fichiers `.vox`, comme pour les armes.
  - **3 cartes** (en plus de Cubes, toujours jouable) :
    - **Quartier** (Ville, 44 × 44 m) : place à fontaine, deux cafés à toit-terrasse (4,5 m) avec escaliers, passerelle au-dessus de la rue, voitures et caisses, façades pastel tout autour ;
    - **Vallon** (Nature, 44 × 44 m) : rivière où l'on a de l'eau aux chevilles, ponts en dos d'âne, terrasses de 0,5 m, ruines avec une tour de 4 m, arbres (dont cerisiers et sapins), falaises boisées et cascades ;
    - **Mine de cristal** (Souterrain, 40 × 40 m) : caverne sous plafond, galeries à 3 m reliées par une passerelle à un piton central, rails et wagonnets, étais, cristaux et champignons lumineux. Le souterrain reste pastel et clair (jamais sombre), sans ombres portées.
  - **Équité** : chaque carte est symétrique par rotation de 180°. Chacune a 8 apparitions.
  - **Ce qui ne bloque pas** : feuillages, fleurs, lampadaires, bancs, parasols, auvents et stalactites. Les balles les traversent.
  - **Carte par défaut** : celle du mode (Cubes pour Duel, Best of 3, Chrono et Personnalisé, comme avant).
- **Alternatives** : décor en GLB fait à la main ; cartes plus grandes pour 5 joueurs ; carte choisie au hasard ; une 4e carte (toits, plage, métro…).
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-046 · Monter les petites marches sans sauter
- **Lot** : 12
- **Statut** : PROVISOIRE
- **Type** : règle de jeu | config
- **Contexte** : les cartes ont des escaliers et des reliefs. Avant, toute marche, même de 25 cm, demandait un saut.
- **Proposition** (appliqué) : nouvelle valeur `movement.stepHeight` = 0,55 m dans `player.json`. Au sol, on monte d'un coup une marche de 0,55 m au plus, s'il y a la place au-dessus. En l'air, rien ne change. La caméra suit la marche en douceur (rendu seulement). Les escaliers des cartes ont des marches de 0,5 m ; les rebords de toit de 0,5 m se franchissent donc en marchant, les garde-corps de 1 m d'un saut.
- **Alternatives** : 0,3 m avec des marches plus petites ; vraies rampes en pente (collisions plus complexes) ; garder le saut obligatoire.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-045 · Choix de la carte (06b) dans l'écran 06
- **Lot** : 12
- **Statut** : PROVISOIRE
- **Type** : autre
- **Contexte** : demandé (« un écran de choix des maps dans l'écran de préparation du salon »). Cet écran n'est pas dans `ECRANS.md`, et je n'ai pas le droit de modifier ce fichier sans validation.
- **Proposition** (appliqué) :
  - **06 Créer un salon** : nouvelle ligne « Carte » (étiquette de couleur, nom, type, « Changer »).
  - **06b Choix de la carte** : panneau plein écran par-dessus 06, pas une page du routeur. Liste des cartes à gauche, aperçu 3D qui tourne au centre (on peut le faire glisser), type, taille, nombre de joueurs conseillé et une ligne de description, bouton « Choisir cette carte ». Échap ou Retour referme sans rien changer ; flèches pour changer de carte.
  - **Réglage** : `arenaId` dans les réglages du salon, vérifié par le serveur (carte connue, jouable, assez d'apparitions). La carte apparaît dans le résumé de 06 et de 07, et dans la transition (10).
  - **À ajouter dans `ECRANS.md` si tu valides** : en 06, « carte (ouvre 06b) » ; un écran « 06b Choix de la carte · Proto : Oui », qui mène à 06.
- **Alternatives** : choix dans le lobby (07), modifiable jusqu'au départ ; simple liste déroulante sans aperçu ; vote des joueurs.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-044 · Pièces gagnées en fin de match (barème et affichage)
- **Lot** : 13
- **Statut** : PROVISOIRE
- **Type** : règle de jeu | config | autre
- **Contexte** : demandé (« des pièces gagnées à chaque fin de partie selon tes stats en jeu, pas les questions »). Les pièces étaient hors MVP (ECRANS.md, écran 14, et V-027) ; aucun barème n'est écrit nulle part.
- **Proposition** (appliqué) :
  - **Barème** dans le nouveau `config/economy.json` : partie jouée +10 · kill +15 · kill à la tête +5 en plus · +1 par tranche de 10 dégâts · manche gagnée +20 · victoire du match +40 · précision × 25 (à partir de 10 tirs) · plafond 300 par match. Exemple : 3 kills dont 1 à la tête, 340 dégâts, 45 % de précision, victoire 2-0 → 185 pièces.
  - **Ce qui ne compte pas** : rien du quiz (bonnes réponses, séries, difficulté). Les malus et bonus gagnés au quiz jouent seulement indirectement, via le combat.
  - **Serveur autoritaire** : c'est le serveur qui calcule les pièces de chacun à la fin du match (il compte maintenant les kills à la tête). Un joueur parti avant la fin ne gagne rien ; une victoire par abandon donne la victoire.
  - **Entraînement solo** : pas de combat, donc pas de pièces.
  - **Solde** gardé dans ce navigateur (`localStorage`, comme le reste, pas de compte), crédité à la fin du match. Pas encore de quoi les dépenser : les skins restent « plus tard ».
  - **Affichage** : pastille de solde sur 01 (à côté du pseudo et de l'arme) et sur 02 (en haut) ; sur 14, « +N pièces » sous le score avec le détail séparé par des points médians. Couleurs reprises de la famille Arme (jaune pastel), pas de nouvelle couleur.
- **Alternatives** : pièces aussi pour les questions ; barème plus plat (gains fixes victoire/défaite) ; pas de plafond ; solde côté serveur avec comptes.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-043 · Combat sans limite de temps si les vies sont limitées
- **Lot** : 9 (suite)
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : demandé (« le combat peut être infini si le nombre de vies est limité »).
- **Proposition** (appliqué) :
  - **Config** : nouvelle valeur `0` = « Sans limite » à la fin de `combatChoicesSeconds`, dans `modes.json`. Elle s'atteint au « + » après 5:00.
  - **Quand c'est proposé** : seulement si les vies sont limitées, donc en Duel, en Best of 3, et en Personnalisé avec 1 à 5 vies. Pas en Chrono, ni en Personnalisé avec vies ∞, où la manche ne finirait jamais. Le serveur refuse aussi ce cas.
  - **Changement de réglage** : passer les vies à ∞ (ou changer de mode) alors que le combat est sans limite remet la durée du mode.
  - **Fin de la manche** : uniquement quand il ne reste qu'un joueur en lice. Le chrono du HUD affiche « ∞ ».
- **Alternatives** : une limite de sécurité cachée (ex. 15 min) contre les joueurs qui se cachent ; un rétrécissement de l'arène ou un bonus de détection après un temps donné.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-043 · Personnages voxel : style, attribution et config
- **Lot** : 10
- **Statut** : PROVISOIRE
- **Type** : config | DA
- **Contexte** : tu as demandé des personnages voxel « ainsi » (2 images). Comment les attribuer aux joueurs et les ranger dans la config, ce n'est écrit nulle part.
- **Proposition** (appliqué) :
  - **2 personnages** : `student_a` (cheveux longs, short kaki, bottes) et `student_b` (cheveux courts en pics, pantalon bleu, baskets). Tenue sobre (t-shirt) plutôt que le haut court de la 1re image.
  - **Couleur du joueur** : le t-shirt et les manches prennent sa couleur (`--player-N`). Le personnage dépend aussi de la couleur : joueurs 1, 3 et 5 → `student_a`, joueurs 2 et 4 → `student_b`. Pas de choix du personnage par le joueur : aucun écran ne le prévoit dans `ECRANS.md`.
  - **Config** : dans `player.json`, `"asset": "player.body"` devient `"characters": ["character.student_a", "character.student_b"]`. Dans `assets.json`, l'entrée `player.body` (capsule, inutilisée) est remplacée par ces 2 entrées. Format voxel étendu : `tint` (couleurs remplacées) et `parts` (tête, bras, jambes : boîte + pivot).
  - **Taille** : voxels de 2,5 cm, 1,80 m de haut, tête de 0,35 m. La hitbox ne change pas.
- **Alternatives** : un seul personnage ; plus de variantes (coiffures, tenues) ; le personnage choisi par le joueur dans le Loadout (nouvel écran ou nouvelle zone, à valider) ; haut plus proche de la référence.
- **Remarque** : la couleur pêche du joueur 4 est proche de la peau, les bras se distinguent moins. Un ton un peu plus soutenu pour `--player-4` réglerait ça.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-042 · Mettre à jour CLAUDE.md et ECRANS.md pour les salons à plusieurs
- **Lot** : 9
- **Statut** : EN ATTENTE
- **Type** : autre
- **Contexte** : CLAUDE.md parle d'un « duel FPS 1 contre 1 », et ECRANS.md de « les 2 joueurs » (07) et de « deux formes » sur l'hexagone (14). Depuis le lot 9, un salon accepte jusqu'à 5 joueurs. Je n'ai pas le droit de modifier ces fichiers sans validation.
- **Proposition** : remplacer « 1 contre 1 » par « de 2 à 5 joueurs (Duel : 1 contre 1) » dans CLAUDE.md ; dans ECRANS.md, écrire « les joueurs (2 à 5) » en 07, 10 et 12, « une forme par joueur » en 14, et ajouter en 06 : nombre de joueurs, nombre max de questions, condition de victoire.
- **Alternatives** : garder les documents tels quels et considérer le lot 9 comme une extension hors brief.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-041 · Couleurs des joueurs 3 à 5 et mise en page à plusieurs
- **Lot** : 9
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : le thème n'avait que 2 couleurs de joueur (bleu, rose), et les écrans étaient pensés pour 2.
- **Proposition** (appliqué) :
  - **Couleurs** : `--player-3` lavande `#b9a3ec`, `--player-4` pêche `#f3b98c`, `--player-5` menthe `#86d1b6`, dans `theme.css`. Elles servent aussi à teinter les personnages en 3D.
  - **07 Lobby** : une place par joueur possible (pointillés si libre), en grille ; ligne « 3/4 joueurs · départ quand tous sont prêts ».
  - **10 Transition** : à 2, rien ne change ; au-delà, le compte à rebours passe en haut et les fiches en grille.
  - **11 Combat** : une étiquette par ennemi (à sa couleur) ; le score en haut devient « mes kills · kills du meilleur adversaire ».
  - **12 Fin de manche** : à 2, rien ne change ; au-delà, manches gagnées de chacun, du meilleur au moins bon.
  - **14 Résultats** : à 2, rien ne change ; au-delà, un classement numéroté (manches puis kills) ; l'hexagone et le tableau ont une forme et une colonne par joueur.
- **Alternatives** : autres teintes (le lavande est proche du violet Légendaire) ; tableau des scores (Tab) en combat.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-040 · Règles des salons à plusieurs joueurs
- **Lot** : 9
- **Statut** : PROVISOIRE
- **Type** : règle de jeu
- **Contexte** : demandé (« pouvoir être 5 au max »), mais les règles d'une partie à plus de 2 ne sont pas dans le brief.
- **Proposition** (appliqué) :
  - **Départ** : dès que tous les joueurs présents sont prêts, à partir de 2. Le salon n'a pas besoin d'être plein.
  - **Modes** : Duel reste à 2 joueurs (imposé). Best of 3, Chrono et Personnalisé vont de 2 à 5 joueurs.
  - **Réglages libres dans tous les modes** : nombre de joueurs (sauf Duel), durée du quiz, nombre max de questions, durée du combat, quitte ou double, combo négatif. **En Personnalisé seulement** : vies, manches et condition de victoire (« Dernier en vie » ou « Le plus de kills »).
  - **Mêlée « dernier en vie »** : chacun pour soi. La manche se termine quand il ne reste qu'un joueur en lice (vivant ou avec une vie).
  - **Fin du chrono** : « le plus de kills » (à égalité, le moins de morts) ou « dernier en vie » (le plus de vies, puis de PV). Si plusieurs joueurs sont à égalité en tête, la manche est nulle.
  - **Fin du match** : le plus de manches gagnées, puis le plus de kills ; sinon égalité.
  - **Départ d'un joueur en plein match** : s'il reste au moins 2 joueurs, le match continue sans lui. Sinon, le dernier gagne par abandon (comme avant).
  - **Réapparition** : au point le plus loin de l'ennemi le plus proche.
  - **Agressivité (14)** : dégâts ÷ PV max *moyens* des adversaires, pour qu'un joueur en mêlée soit noté comme en duel.
  - **Questions** : tous les joueurs ont les mêmes cartes et questions (même graine), comme à 2.
- **Alternatives** : équipes (2 contre 2) ; départ seulement quand le salon est plein ; une autre arène plus grande pour 5.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-039 · Nouvelles valeurs de config pour personnaliser les salons
- **Lot** : 9
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : demandé : durées de 1 à 5 min par pas de 30 s, jusqu'à 5 joueurs, un nombre max de questions. Les choix du mode Personnalisé étaient écrits dans le code (06), ce que les règles d'architecture interdisent.
- **Proposition** (appliqué) :
  - `quiz.json` : `budgetChoicesSeconds` = 1:00 à 5:00 par 30 s (avant : 1:00, 3:00, 5:00) ; nouveau `maxQuestionsChoices` = ∞, 3, 5, 8, 10, 15, 20 (0 = sans limite). Valeur par défaut : sans limite.
  - `modes.json` : `combatChoicesSeconds` = 1:00 à 5:00 par 30 s (avant : 1:00, 2:00, 3:00) ; nouveau `players` (minimum 2, choix 2 à 5, par défaut 2) ; nouveau `custom` (manches 1, 3, 5 ou 7 ; vies 1, 2, 3, 5 ou ∞) ; `maxPlayers: 2` sur Duel et Entraînement.
  - `arenas.json` : 4 apparitions en plus dans l'arène « Cubes » (côtés et coins), soit 6 au total.
  - Le chargement vérifie : une apparition par joueur possible, défaut des joueurs parmi les choix, durée de combat de chaque mode parmi les choix.
  - Avec un nombre max, le quiz s'arrête à la dernière question même s'il reste du temps (compte à rebours de fin normal). Le numéro devient « Question 3/10 ».
- **Alternatives** : pas de 15 s ; nombre max de questions libre (saisie) ; 7 manches retirées.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-038 · Sons synthétisés et catalogue `config/sounds.json`
- **Lot** : 8
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : le brief ne parle pas des sons, et le projet n'avait aucun fichier audio. Il fallait choisir une méthode, un style et un emplacement pour les réglages.
- **Proposition** (appliqué) :
  - **Méthode** : sons fabriqués en direct par le navigateur (Web Audio API). Pas de dépendance ni de fichier, donc pas de licence à vérifier.
  - **Style** : doux et rond pour coller à la DA pastel (sinus et triangle, petites mélodies de 2 à 4 notes). Les tirs sont un souffle filtré plus un coup sourd, chaque arme a le sien et la hauteur varie légèrement d'un tir à l'autre.
  - **Catalogue** : nouveau fichier `config/sounds.json`, validé par zod. Chaque id a une recette : couches, formes d'onde, fréquences, durées, volumes, filtre. Il faut un son `shot.default` de repli. Le code ne joue que des ids, donc une recette pourra plus tard être remplacée par un vrai fichier.
  - **Volume** : volume général par défaut 70 % dans la config, puis un curseur Volume dans Paramètres (0 % coupe tout), gardé dans le navigateur.
  - **Tirs de l'adversaire** : joués à 50 % du volume.
  - **Pas de son** : pas de musique de fond, pas de bruits de pas, pas de son de saut ni de dash.
- **Alternatives** : banque de sons en fichiers (libres de droits, à choisir) ; ajouter une musique d'ambiance ; volumes séparés effets / musique.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-037 · `MVP.md` absent, maquettes extraites dans `docs/maquettes/`
- **Lot** : 7
- **Statut** : PROVISOIRE
- **Type** : structure
- **Contexte** : le prompt et CLAUDE.md citent `MVP.md` et `docs/maquettes/`, mais aucun des deux n'existait. Les captures étaient dans `maquettes-reviz-arena.zip` à la racine.
- **Proposition** :
  - J'ai extrait le zip dans `docs/maquettes/`, l'emplacement prévu par CLAUDE.md. Le zip est gardé.
  - Sans `MVP.md`, je me suis appuyé sur CLAUDE.md, ECRANS.md et les points tranchés ou provisoires d'ici.
- **Alternatives** : supprimer le zip une fois l'extraction validée ; me fournir `MVP.md`.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-036 · Choix d'interface pris pour suivre les maquettes
- **Lot** : 7
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : les maquettes ne disent pas tout, et certaines contredisent l'ancien code.
- **Proposition** (appliqué) :
  - **Boutons** : un seul composant en trois variantes : principale (encre), secondaire (papier) et discrète (lien). Il remplace tous les boutons ronds.
  - **Champs** : coins arrondis à 10 px.
  - **Fond** : anneau lavande à droite et carré jaune incliné, comme sur les captures. Le jaune reprend `--family-weapon` : aucune couleur ajoutée au thème. La trame de points du papier est gardée, alors que les captures n'en ont pas.
  - **Cartes (08)** :
    - le grand filigrane est le pictogramme du bonus, et non plus le motif de la famille ;
    - les points indiquent le niveau de difficulté sur 5 ;
    - la famille n'est plus écrite, la couleur suffit.
  - **Loadout (02)** :
    - cliquer une arme ne fait que la montrer, c'est le bouton « Équiper » qui l'équipe (avant, le clic équipait directement) ;
    - l'onglet « Skins » est grisé (hors MVP) ;
    - le bandeau finit par 2 emplacements « Bientôt » ;
    - chaque barre de stat est relative à la meilleure arme du loadout ;
    - portée et recul sont donnés en valeurs (m, °) plutôt qu'en mots (« Moyenne »), pour ne pas inventer de seuils ;
    - la vue FPS reste disponible par un petit bouton.
  - **Police** : inchangée. Les captures utilisent une police ronde à télécharger (voir V-013).
  - **Pseudo** : il reste sur l'accueil, il n'est pas dans Paramètres comme sur la capture 05.
- **Alternatives** : garder le motif de famille sur les cartes ; équiper au clic comme avant ; retirer la trame de points.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-035 · `config/stats.json` et formules de l'hexagone (écran 14)
- **Lot** : 7
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : ECRANS.md demande des formules et bornes en config, mais le fichier n'existait pas. Deux formules restaient à préciser.
- **Proposition** (appliqué) :
  - **Fichier** : nouveau `config/stats.json`, validé par zod. Il contient l'échelle (100), les bornes de difficulté (1 à 5) et la valeur d'une question au temps écoulé (0). Il donne aussi les axes dans l'ordre d'affichage, avec libellé et formule écrite.
  - **Formules** :
    - Connaissance : Σ difficulté des bonnes réponses ÷ Σ difficulté des questions répondues ;
    - Audace : difficulté moyenne des questions tentées, ramenée entre 1 et 5 ;
    - Vitesse : moyenne de (1 − temps de réponse ÷ temps permis) ;
    - Précision : touches ÷ tirs ;
    - Agressivité : dégâts infligés ÷ PV max de l'adversaire, cumulés sur les manches jouées, plafonné à 100 ;
    - Régularité : plus longue série ÷ nombre de questions.
  - **Valeur absente** : rien à mesurer donne « — » dans le tableau et 0 sur l'hexagone. C'est le cas de la Précision et de l'Agressivité en solo.
  - **Côté serveur** : il cumule les dégâts et les PV adverses et ajoute `axes` au résultat de fin de match. Ce sont des données en plus, aucune règle n'est changée.
- **Alternatives** : Audace sur la rareté de la carte plutôt que sur la difficulté réelle de la question ; Agressivité sans plafond ; masquer les axes de combat en solo.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-034 · 06 Créer un salon : éléments de la maquette non faisables sans toucher à la logique
- **Lot** : 7
- **Statut** : PROVISOIRE
- **Type** : autre
- **Contexte** : la capture 06 montre des éléments absents de la logique actuelle, ou qui demandent une dépendance.
- **Proposition** (appliqué) :
  - **Code du salon** : il n'existe qu'après la création, car c'est le serveur qui le donne. Le panneau de droite affiche « · · · » et « Le code s'affiche à la création ».
  - **Adresse locale** : elle s'affiche si la page n'est pas ouverte en `localhost`. Sinon, le panneau renvoie à `npm run host`.
  - **Non codé** :
    - nombre de questions faciles, moyennes et difficiles (règle de jeu absente) ;
    - QR code (il faudrait une dépendance) ;
    - libellé « bientôt » sur Best of 3, Chrono et Personnalisé (ces modes marchent déjà).
- **Alternatives** : réserver le code avant la création (changement serveur) ; ajouter une dépendance QR.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-033 · Deck choisi par chaque joueur dans le lobby (07)
- **Lot** : 7
- **Statut** : EN ATTENTE
- **Type** : règle de jeu
- **Contexte** : la capture 07 suit CLAUDE.md (« Chacun son cours ») et ECRANS.md (« Pas de choix de deck ici » sur 06). Chaque joueur y choisit son deck dans le lobby, et une grille vérifie le nombre de questions par niveau (Prêt bloqué si le deck est trop petit). Le code actuel fait autrement : un seul deck par salon, choisi par l'hôte en 06 (« Questions identiques »).
- **Proposition** : le prompt demande de ne pas toucher à la logique, donc rien n'est changé ici. Le lobby montre le deck du salon dans chaque fiche joueur. Le deck par joueur ferait l'objet d'un lot dédié, qui toucherait le serveur, le protocole et l'équilibrage.
- **Alternatives** : faire ce lot maintenant ; garder un deck commun pour le MVP et mettre à jour CLAUDE.md et ECRANS.md.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-032 · Style des nouvelles icônes d'armes et des fondus
- **Lot** : 6
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : la DA ne décrit ni les icônes d'armes ni les transitions entre écrans.
- **Proposition** :
  - Icônes : silhouettes de profil, canon à droite, en deux tons (pièces principales pleines, crosse et poignée en ton clair), angles arrondis. Format large 2:1. Couleur de l'encre, ou couleur du joueur sur l'écran 10. Aussi pour les 3 armes spéciales.
  - Fondus : l'écran entrant apparaît en 0,32 s (opacité seule) ; l'écran sortant s'efface en 0,22 s avec un léger flou. Coupés si le système demande de réduire les animations.
- **Alternatives** : icônes au trait comme les autres icônes ; icônes en voxels comme les modèles 3D ; glissement latéral au lieu du fondu.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-031 · Fin automatique du dernier retour et bandeau d'attente
- **Lot** : 6
- **Statut** : PROVISOIRE
- **Type** : règle de jeu
- **Contexte** : demandé (« compteur de 5 à 0 »). Le détail n'est pas dans le brief.
- **Proposition** :
  - Dès qu'il ne reste plus de quoi jouer une Commune pendant un retour, ce retour devient le dernier : le bouton « continuer » se change en anneau 5 → 0 « Fin du quiz », puis la phase quiz se termine seule. Entrée ou clic passe l'attente.
  - Le serveur ne coupe plus le retour pile à la fin du budget : le dernier retour peut donc déborder de 5 s au plus.
  - En salon, si l'adversaire joue encore, le bandeau « Quiz terminé · En attente de l'adversaire » s'affiche sur l'écran en cours (08 ou 09) jusqu'à la transition. C'est un état de l'écran, pas un nouvel écran.
- **Alternatives** : passer le compte à rebours de l'écran 10 de 3 à 5 s à la place ; couper le dernier retour pile à la fin du budget.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-030 · Nouvelle valeur `endCountdownSeconds` dans `quiz.json`
- **Lot** : 6
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : la durée du compte à rebours de fin de quiz doit vivre dans la config.
- **Proposition** : `"endCountdownSeconds": 5` dans `config/quiz.json`, validé par zod (0 ou plus).
- **Alternatives** : la mettre dans `modes.json` avec les autres comptes à rebours.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-029 · Valeurs ajoutées pour le match
- **Lot** : 5
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : le GDD et ECRANS.md ne donnent pas ces valeurs.
- **Proposition** :
  - Déplacement plus rapide (demandé) : marche 8 m/s, saut 7,5 m/s, dash 18 m/s.
  - Arène de duel « Cubes », symétrique, 2 apparitions face à face.
  - Durées de combat proposées : 1:00 / 2:00 / 3:00.
  - Compte à rebours 3 s (écran 10), fin de manche 5 s (écran 12), réapparition 3 s.
  - Vies : 1 en Duel et Best of 3, illimitées en Chrono. En Personnalisé : 1, 3 ou 5 manches et 1, 2, 3 ou ∞ vies.
  - Fin du chrono : plus de vies restantes puis plus de PV ; en Chrono, plus de kills ; sinon égalité.
- **Alternatives** : à régler dans `config/modes.json`, `config/arenas.json`, `config/player.json`.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-028 · Écrans renommés ou retirés, stand de tir gardé en outil
- **Lot** : 5
- **Statut** : PROVISOIRE
- **Type** : suppression
- **Contexte** : CLAUDE.md demande un module par écran nommé comme ECRANS.md.
- **Proposition** :
  - Les écrans des lots 1 à 4 deviennent des modules numérotés : l'armurerie devient 02, l'écran de combat 11. Les anciens fichiers sont supprimés : `home.ts`, `cardChoice.ts`, `question.ts`, `recap.ts`.
  - L'entraînement solo suit ECRANS.md : quiz puis récap, sans combat.
  - Le stand de tir sur cibles n'est plus dans la navigation. Il reste ouvrable en développement avec `__reviz.stand()` dans la console, pour régler les armes seul.
- **Alternatives** : réintégrer le stand comme écran (à ajouter à ECRANS.md) ou le supprimer.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-027 · Contenus d'écrans simplifiés ou repoussés
- **Lot** : 5
- **Statut** : PROVISOIRE
- **Type** : autre
- **Contexte** : ECRANS.md liste plus de contenu que ce que le MVP peut porter sans comptes ni économie.
- **Proposition** : pas de pièces, de niveau, d'XP, de perso ni de skins pour l'instant. Écart par écran :
  - 01 : pseudo saisi sur l'écran, arme équipée affichée, dernière partie affichée.
  - 06 : pas de nombre de questions par difficulté ni de coût des cartes réglables (ce sont ceux de la config).
  - 07 : pas de perso ni de niveau.
  - 12 : pas de « bonus le plus utile ».
  - 13 : « Signaler la question » enregistré seulement dans ce navigateur (pas encore de serveur de signalements).
  - 14 : pas de pièces ni d'XP.
- **Alternatives** : les ajouter dans un lot dédié à la progression.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-026 · Liens ajoutés au routeur par rapport à ECRANS.md
- **Lot** : 5
- **Statut** : EN ATTENTE
- **Type** : autre
- **Contexte** : ECRANS.md prévoit « 09 → 10 quand le budget est épuisé », mais le budget peut aussi s'épuiser pendant le choix de carte (08). Le routeur refusait alors la suite et la partie restait bloquée (vu en test). Et l'adversaire peut quitter, ou la connexion tomber, à n'importe quel moment.
- **Proposition** (appliquée pour débloquer) : liens 08 → 10 et 08 → 13 (budget épuisé) ; abandon de l'adversaire → 13 depuis n'importe quel écran du match ; connexion perdue → 01. À reporter dans ECRANS.md si tu es d'accord (je ne modifie pas ce fichier sans ton accord).
- **Alternatives** : forcer le passage par 09 (afficher une fausse question) ; finir le quiz seulement depuis 09.
- **Bloquant** : non (appliqué)
- **Commentaire de l'utilisateur** :

### V-025 · Qui calcule quoi pendant le combat en réseau
- **Lot** : 5
- **Statut** : PROVISOIRE
- **Type** : autre
- **Contexte** : un serveur 100 % autoritaire pour un FPS demande de la prédiction et de la réconciliation (gros chantier).
- **Proposition** :
  - Chaque client simule son déplacement et détecte ses touches.
  - Le serveur vérifie chaque touche : cadence de l'arme, portée, distance cohérente avec les positions connues.
  - Le serveur calcule les dégâts avec les bonus des deux joueurs (bouclier, armure, casque, perce-bouclier, vampire) et décide PV, morts, réapparitions et fin de manche.
  - Le quiz est 100 % serveur : questions tirées et réponses validées sur le serveur, bonne réponse envoyée seulement après la réponse.
- **Alternatives** : simulation complète côté serveur (plus sûr contre la triche, plus long à faire).
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-024 · Serveur de match, dossier `server/` et dépendances
- **Lot** : 5
- **Statut** : PROVISOIRE
- **Type** : dépendance
- **Contexte** : le multijoueur a besoin d'un serveur WebSocket.
- **Proposition** :
  - `ws` (prévu dans la stack), plus les types `@types/ws` et `@types/node` (types seulement, rien n'est chargé dans le jeu).
  - Le serveur est branché sur celui de Vite (`server/attach.ts`) : `npm run dev` lance le jeu et le serveur sur le même port, et `npm run dev -- --host` ouvre au réseau local.
  - Toute la logique est dans `src/core/match/` (pure, testée) ; un serveur Node autonome pour la mise en ligne viendra plus tard.
- **Alternatives** : serveur séparé (`npm run server`) sur un autre port.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-023 · Option « réduire flashs et secousses »
- **Lot** : 4
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : option obligatoire selon le brief ; son contenu exact et sa place ne sont pas précisés.
- **Proposition** : l'option coupe le flash du canon et les secousses de caméra, adoucit le surlignage des cibles touchées et réduit les éclats. Elle se règle sur l'écran de départ / pause du combat, est gardée dans le navigateur, et suit par défaut le réglage système « réduire les animations ».
- **Alternatives** : la mettre aussi sur l'accueil ; un curseur d'intensité plutôt qu'un interrupteur.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-022 · Règles de combat non écrites dans le brief
- **Lot** : 4
- **Statut** : PROVISOIRE
- **Type** : règle de jeu
- **Contexte** : il a fallu décider comment les bonus se combinent et quelques détails de tir.
- **Proposition** :
  - Cumul d'un effet : (valeur imposée ou de base + ajouts) × multiplicateurs.
  - Durée d'un bonus comptée depuis le début du combat (ex. Bulle 8 s).
  - « Saut +30 % » = 30 % de hauteur en plus.
  - « Portée +20 % » = la perte de dégâts du fusil à pompe commence et finit 25 % plus loin.
  - Dégâts de zone qui baissent avec la distance.
  - Tête = 60 % de la largeur du corps.
  - Une arme spéciale gagnée va dans un 2e emplacement (touche 2), l'arme du loadout reste en 1.
  - Le recul remonte la visée pendant une rafale et redescend quand on arrête de tirer.
  - En visant : déplacement à 60 % de la vitesse.
- **Alternatives** : l'arme spéciale remplace l'arme du loadout ; un recul qui ne redescend pas tout seul.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-021 · Après le quiz : entraînement sur cibles, en attendant le duel
- **Lot** : 4
- **Statut** : PROVISOIRE
- **Type** : règle de jeu
- **Contexte** : il n'y a pas encore d'adversaire (lot 5).
- **Proposition** : la fin du quiz lance le mode « Entraînement » (60 s, 6 cibles qui réapparaissent après 3 s, dont 2 qui bougent) avec les bonus gagnés, puis le récap (quiz + combat). Bouton « Entraînement » sur l'accueil pour jouer sans quiz. « Terminer le combat » dans la pause.
- **Alternatives** : récap du quiz avant le combat (le brief met le récap à la fin).
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-020 · Arène en config et nouveaux champs
- **Lot** : 4
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : le combat a besoin d'une arène (collisions, cibles) ; le brief ne liste pas de fichier pour ça.
- **Proposition** :
  - Nouveau fichier `config/arenas.json` (taille, murs, apparition, blocs, cibles, PV et réapparition des cibles).
  - Champ `arena` pour chaque mode et nouveau mode `training` dans `modes.json`.
  - Point `muzzle` (bout du canon) dans `assets.json`.
  - Dans `player.json` : `body`, `movement` et `controls.mouseSensitivity`.
  - L'armurerie utilise maintenant cette arène au lieu de blocs écrits dans le code.
- **Alternatives** : arènes dans un dossier `arenas/` à part, comme les decks.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-019 · Valeurs de déplacement et de tir inventées
- **Lot** : 4
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : le brief donne dégâts, cadence et chargeur, pas le reste.
- **Proposition** :
  - Marche 6,5 m/s, saut ≈ 1,1 m, gravité 22, dash 16 m/s pendant 0,18 s (recharge 2,5 s), sensibilité souris 0,0022.
  - Rechargement : pistolet 1,1 s, fusil d'assaut 1,8 s, fusil à pompe 2,2 s, sniper 2,4 s.
  - Dispersion : 0,3° / 1° / 5° / 0,05°.
  - Recul : par tir, montée en rafale (fusil d'assaut seulement), plafond.
  - Fusil à pompe : dégâts pleins jusqu'à 5 m, 20 % à partir de 18 m.
  - Zoom du sniper × 4 ; portées 40 à 200 m.
  - Armes spéciales : Lance-bulles avec zone de 2,5 m, Rayon automatique, Arbalète.
  - Cibles : 100 PV, réapparition en 3 s.
- **Alternatives** : à régler librement dans les JSON après essai en jeu.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-018 · Écran Armurerie et style des armes
- **Lot** : 2
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : il fallait voir les armes en 3D pour juger le détail ; le brief ne prévoit pas cet écran.
- **Proposition** : bouton « Armurerie » sur l'accueil. L'arme tourne au-dessus d'un socle hexagonal (glisser pour tourner), touches 1 à 4 pour changer, V pour la vue à la première personne dans une petite arène en blocs pastel, Échap pour revenir. L'arme choisie devient l'arme équipée. Style des armes : cubes nets comme ta planche de référence, gris en 5 tons, pièces lumineuses cyan (DA), occlusion ambiante aux creux, éclairage doux sans contours noirs.
- **Alternatives** : cubes légèrement arrondis ; contours noirs ; armes colorées façon jouet ; ombrage cartoon (toon) plutôt qu'éclairage doux.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-017 · Nouveaux dossiers pour la 3D
- **Lot** : 2
- **Statut** : PROVISOIRE
- **Type** : structure
- **Contexte** : les modèles voxel ont besoin d'un générateur, de fichiers et de code de rendu.
- **Proposition** : `scripts/voxels/` (générateur, lancé par `npm run voxels`), `assets/models/weapons/*.vox`, `src/core/voxel/` (format .vox et mailleur, sans Three.js), fichiers dans `src/render/` (le `.gitkeep` est retiré). `tsconfig.json` : `scripts/` inclus, imports avec extension `.ts` autorisés (Node lance les scripts sans compilation), `build-weapons.ts` exclu du contrôle de types car il faudrait `@types/node`, dépendance hors stack.
- **Alternatives** : ajouter `@types/node` (à valider) ; modèles écrits en JSON plutôt qu'en `.vox`.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-016 · Type « voxel » dans le catalogue d'assets
- **Lot** : 2
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : le catalogue ne connaissait que `glb` et `primitive`.
- **Proposition** : `"voxel": { "path", "voxelSize", "glow" }` dans `config/assets.json`, une seule source par asset (validé par zod). La prise en main (`grip`) est en voxels pour ces modèles. Les 4 armes du loadout passent en voxel (1 voxel = 1 cm) ; les 3 armes spéciales et le joueur restent en formes de base.
- **Alternatives** : convertir les `.vox` en GLB et n'avoir qu'un seul format.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-015 · Style des modèles 3D : voxel « gros grains »
- **Lot** : 1 (question posée après le lot, à trancher avant le lot 3D)
- **Statut** : EN ATTENTE
- **Type** : DA
- **Contexte** : l'utilisateur penche pour le voxel plutôt que des modèles lisses. La DA vise Krunker (arènes en blocs) + « Splash jouet » (plastique, formes rondes), et reste ouverte sur l'ombrage cartoon et les contours noirs.
- **Proposition** : voxel à gros grains (une arme ≈ 10 à 20 voxels de long, un perso ≈ 24 de haut), fusionné en un seul maillage par modèle, ombrage cartoon, couleurs prises dans la palette de la DA. Modèles décrits en données (grille dans un fichier) ou en `.vox` MagicaVoxel, lus par le `VOXLoader` fourni avec Three.js (pas de nouvelle dépendance). Nouveau type `voxel` dans `config/assets.json` (changement de format, à valider au lot 3D). Premier test : une arme en cubes nets et en cubes légèrement arrondis, côte à côte, pour choisir sur capture.
- **Alternatives** : low poly à facettes (primitives à peu de segments) ; modèles lisses (déconseillé : générés en code, ils font amateur) ; packs CC0 existants pour les persos.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-014 · Bleu et rose : joueurs dans la DA, raretés dans le brief
- **Lot** : 1
- **Statut** : EN ATTENTE
- **Type** : DA
- **Contexte** : la DA réserve le bleu au joueur 1 et le rose au joueur 2 ; le brief utilise ces couleurs pour les contours Rare et Épique.
- **Proposition** : garder les raretés telles quelles sur les cartes (écran sans adversaire) et n'utiliser bleu et rose que pour les joueurs pendant le combat. À revoir si ça prête à confusion au lot combat.
- **Alternatives** : décaler les raretés (ex. Rare cyan clair, Épique corail) ; changer les couleurs des joueurs.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-013 · Typographie ronde et épaisse demandée par la DA
- **Lot** : 1
- **Statut** : EN ATTENTE
- **Type** : DA
- **Contexte** : la DA (direction « Splash jouet ») demande une typo ronde et épaisse ; le lot 1 utilise Century Gothic (géométrique, pas ronde) pour éviter tout téléchargement.
- **Proposition** : embarquer une police libre (licence OFL, ex. Fredoka ou Nunito) en fichier local dans `assets/fonts/`, sans paquet npm ni appel à un service externe.
- **Alternatives** : garder Century Gothic ; Arial Rounded (installée avec Office, absente de certains PC).
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-012 · Arme du loadout : fusil à pompe (brief) ou lance-roquettes (DA)
- **Lot** : 1
- **Statut** : EN ATTENTE
- **Type** : règle de jeu
- **Contexte** : le brief liste Pistolet, Fusil d'assaut, Fusil à pompe, Sniper ; la DA cite Pistolet, Fusil d'assaut, Sniper, Lance-roquettes.
- **Proposition** : garder le brief (fusil à pompe) et renommer l'arme spéciale Légendaire « Lance-bulles » en « Lance-roquettes ».
- **Alternatives** : remplacer le fusil à pompe par le lance-roquettes dans le loadout ; 5 armes au loadout.
- **Bloquant** : non (combat pas encore commencé)
- **Commentaire de l'utilisateur** :

### V-011 · Mettre le cadrage et la DA dans le projet
- **Lot** : 1
- **Statut** : EN ATTENTE
- **Type** : autre
- **Contexte** : l'utilisateur précise : PC uniquement (pas de mobile), un MVP jouable d'abord, les paramètres et options complexes plus tard. Le document de DA est dans ses Téléchargements, or CLAUDE.md m'interdit de lire hors du projet.
- **Proposition** : ajouter ces trois lignes à CLAUDE.md (section « Public » ou « Stack »), y remplacer « 5:00 par défaut » par 1:00 (demandé au lot 3), et copier le document de DA dans le projet (ex. `docs/DA.md`, nouveau dossier), pour que chaque lot puisse le relire. En attendant : je ne fais plus de travail spécifique au mobile ; la petite règle CSS mobile déjà écrite reste, elle ne coûte rien.
- **Alternatives** : laisser CLAUDE.md tel quel et me redonner le document à chaque lot qui touche à la DA.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-010 · Fichiers ajoutés hors de la structure demandée
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : structure
- **Contexte** : il fallait un point d'entrée navigateur et une config pour lancer l'aperçu dans l'app Claude.
- **Proposition** : `src/main.ts` et `src/loadContent.ts` (chargement + validation des JSON) à la racine de `src/` ; `.claude/launch.json` (lance `npm run dev` pour l'aperçu) ; `.gitignore`.
- **Alternatives** : déplacer le chargement dans `src/ui/` ; supprimer `.claude/launch.json` et lancer le serveur à la main.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-009 · Écran d'accueil avec choix de l'arme
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : le brief ne décrit pas d'accueil, mais les bonus de la famille Arme dépendent de l'arme équipée.
- **Proposition** : accueil minimal : titre du deck, « 30 questions · 5:00 », 4 boutons d'arme du loadout (Pistolet par défaut), bouton rond Jouer. Le récap propose Rejouer et « Changer de deck ou d'arme ». S'il y a plusieurs decks, ils apparaissent en boutons.
- **Alternatives** : lancer directement le quiz avec l'arme par défaut ; déplacer le choix d'arme dans un futur écran de loadout.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-008 · Choix de DA non écrits dans le brief
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : DA
- **Contexte** : le brief fixe l'ambiance et les couleurs, pas la typo ni le détail des écrans. Maquettes Figma non consultées dans ce lot.
- **Proposition** : police géométrique déjà installée (Century Gothic / Futura / Avenir), sans police téléchargée ; cartes façon « papier découpé » (ombre nette décalée dans le ton foncé de la famille, pas d'ombre grise floue) ; grand motif géométrique par famille (triangle Attaque, hexagone Défense, chevrons Mobilité, viseur Arme) ; rareté = contour coloré + pastilles 1 à 4 (lisible aussi pour les daltoniens) ; main quitte ou double : titre « Quitte ou double » + « Erreur = gros malus », contour en pointillés ; malus en rose avec contour pointillé dans la colonne de droite ; icônes SVG maison ; `prefers-reduced-motion` respecté.
- **Alternatives** : police web (ex. Nunito, nouvelle dépendance ou appel externe) ; ombres douces classiques ; rareté par la couleur seule.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-007 · Clés et identifiants des fichiers config en anglais
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : le brief ne fixe pas la langue des clés de `config/*.json` (le format des decks, lui, est en français et n'a pas changé).
- **Proposition** : clés et ids en anglais (`costSeconds`, `common`, `attack`, `assault_rifle`), libellés affichés en français dans les champs `label`. Les couleurs suivent les ids : `--family-attack`, `--rarity-common`…
- **Alternatives** : tout en français (`coutSecondes`, `commune`, `attaque`).
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-006 · Valeurs absentes du brief, inventées pour remplir la config
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : le brief ne donne pas les valeurs des bonus, des malus ni de certains champs d'armes et de modes.
- **Proposition** : effets des 57 bonus et 16 malus dans `config/bonuses.json` (ex. Commune Dégâts +10 %, Légendaire +50 %, malus lourd Munitions ÷ 2) ; les Légendaires Arme donnent 3 armes spéciales (Lance-bulles, Rayon, Arbalète, ~80 dégâts/s, dans `weapons.json` avec `special: true`) ; multiplicateur tête = 1 pour Pistolet, Fusil d'assaut et Fusil à pompe (seul le Sniper a × 2 dans le brief) ; durée max de combat 180 s pour chaque mode ; Best of 3 : 2 manches gagnantes.
- **Alternatives** : à ajuster librement dans les JSON (validés au chargement).
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-005 · Règles de tirage des cartes
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : règle de jeu
- **Contexte** : le brief dit « 3 cartes » sans préciser les doublons ni ce qui se passe quand une tranche de questions est vide.
- **Proposition** : les 3 cartes d'une main ont des bonus différents, de familles différentes si possible (`preferDistinctFamilies`) ; un bonus déjà gagné n'est plus proposé (`excludeOwnedBonuses`) ; une rareté n'est proposée que s'il reste une question de sa tranche ; les bonus Arme suivent l'arme équipée (champ `weapons`, vide = toutes). S'il n'y a plus aucune carte possible, la phase se termine.
- **Alternatives** : autoriser le cumul d'un même bonus ; familles tirées au hasard sans préférence.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-004 · Poids des raretés au tirage
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : config
- **Contexte** : le brief dit seulement que les cartes du quitte ou double sont « plus rares » et que les Légendaires n'existent que là.
- **Proposition** : tirage normal Commune 60 / Rare 30 / Épique 10 / Légendaire 0 ; quitte ou double Commune 0 / Rare 30 / Épique 45 / Légendaire 25 (`config/quiz.json`). Une rareté dont le coût ne rentre pas dans le temps restant est retirée du tirage.
- **Alternatives** : autres pondérations ; quitte ou double = au moins une Légendaire garantie.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-003 · Déclenchement du quitte ou double et des malus
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : règle de jeu
- **Contexte** : le brief ne dit pas si le quitte ou double revient tant que la série continue, ni quel malus tombe.
- **Proposition** : main quitte ou double à chaque palier de 3 bonnes réponses d'affilée (après la 3e, la 6e, la 9e…). Si le temps restant ne permet aucune carte Rare ou plus, la main redevient normale. Erreur en quitte ou double = malus lourd (`heavy`) de la même famille que la carte ratée. Combo négatif = malus léger (`light`) de la même famille, à partir de la 4e erreur d'affilée (rien pour les 3 premières), chaque nouvelle erreur en redonne un. Une bonne réponse remet la série d'erreurs à zéro.
- **Alternatives** : quitte ou double à chaque tour tant que la série ≥ 3 ; malus tiré au hasard toutes familles ; malus dès la 3e erreur.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-002 · Écoulement du temps pendant la phase quiz
- **Lot** : 1
- **Statut** : PROVISOIRE
- **Type** : règle de jeu
- **Contexte** : « décompté en temps réel » et « le coût est le temps max pour répondre » laissent ouverts l'hésitation sur le choix et la lecture du retour.
- **Proposition** : l'horloge de 5:00 tourne tout le temps (choix de carte, question, lecture de l'explication) ; répondre vite économise du temps. Temps de réponse écoulé = mauvaise réponse. Le retour reste affiché jusqu'à ce que le joueur appuie sur Continuer (Entrée). Une carte qui ne rentre plus pendant qu'on hésite est grisée ; si aucune ne rentre plus mais qu'une Commune rentrerait, une nouvelle main est tirée.
- **Alternatives** : mettre l'horloge en pause pendant le retour ; passer au tour suivant automatiquement après N secondes ; finir la phase au lieu de retirer une main.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

### V-001 · Le dossier n'est pas un dépôt git
- **Lot** : 1
- **Statut** : EN ATTENTE
- **Type** : autre
- **Contexte** : le brief prévoit des commits locaux « sur la branche de travail », mais aucun dépôt n'existe. `git init` crée une branche par défaut (`main` ou `master`), or toucher à `main` est interdit.
- **Proposition** : tu lances `git init`, fais le premier commit sur `main` toi-même et crées une branche de travail (ex. `dev`) ; je commiterai ensuite sur cette branche à chaque lot. Rien n'est commité pour le lot 1.
- **Alternatives** : je fais `git init -b dev` (pas de `main` du tout) ; pas de git.
- **Bloquant** : non
- **Commentaire de l'utilisateur** :

---

## Points tranchés

_Aucun point pour l'instant._

---

## Journal des lots

Entrées les plus récentes en haut.

<!-- Modèle d'une entrée (à copier par Claude) :

### Lot 1 · Titre du lot · AAAA-MM-JJ
- **Prompt** : résumé de la demande en une ligne.
- **Plan** : les étapes prévues, écrites AVANT de coder.
- **Fait** : ce qui marche réellement à la fin du lot.
- **Fichiers touchés** : liste des fichiers créés ou modifiés.
- **Tests** : commande lancée et résultat (ex. `npx vitest run` : 24 tests, tous verts).
- **Comment tester** : les étapes pour jouer ou vérifier.
- **Points à valider ouverts** : V-00X, V-00Y.
- **Reste à faire** : ce qui n'est pas fini ou a été repoussé.

-->

### Lot 20 · Serveur de match autonome · 2026-11-25
- **Prompt** : « go » pour le premier lot V2 (jouer en ligne entre amis via itch.io, serveur sur Render).
- **Plan** :
  1. `server/main.ts` : serveur HTTP Node seul (port lu dans `PORT`, route `/health`), qui réutilise `attachMatchServer`.
  2. Build du serveur avec Vite (mode SSR, pas de nouvelle dépendance) vers `dist-server/`, scripts `npm run server` et `npm start`.
  3. `attachMatchServer` : ping régulier pour garder les connexions ouvertes derrière un hébergeur et fermer les connexions mortes.
  4. `npm run dev` et `npm run host` (LAN) inchangés.
  5. Test d'une vraie connexion WebSocket au serveur autonome, tests, clôture.
- **Fait** :
  - **Serveur autonome** (`server/main.ts`) : HTTP Node seul, port `PORT` (8787 par défaut), `/health` répond `ok` (avec CORS, pour que le client puisse réveiller le serveur), `/` affiche un texte, le reste en 404. WebSocket du jeu sur `/ws` ; tout autre WebSocket est refusé. Arrêt propre sur SIGTERM (redémarrage de Render).
  - **Build** : `vite.server.config.ts` (mode SSR) produit un seul fichier `dist-server/server.js` avec la config JSON incluse ; `ws` reste une dépendance. Aucune nouvelle dépendance.
  - **Scripts** : `npm run build:server`, `npm run server` (construit puis lance), `npm start` (lance le build, pour Render).
  - **Ping toutes les 25 s** dans `attachMatchServer` : garde la connexion ouverte derrière l'hébergeur et ferme une connexion morte (le joueur est alors libéré comme une déconnexion normale). Actif aussi en LAN.
  - **`render.yaml`** : service web Node gratuit, build `npm ci && npm run build:server`, démarrage `npm start`, contrôle de santé `/health` (V-060).
  - `npm run dev` et `npm run host` inchangés (même `attachMatchServer`, sans le refus des autres WebSocket qui appartiennent à Vite).
- **Fichiers touchés** : `server/main.ts` (nouveau), `server/attach.ts`, `vite.server.config.ts` (nouveau), `render.yaml` (nouveau), `package.json`, `tsconfig.json`, `.gitignore`, `VALIDATION.md`.
- **Tests** : `npx tsc --noEmit` sans erreur ; `npx vitest run` : 280 tests, tous verts ; `npm run build:server` OK (237 ko). Essai réel : serveur autonome lancé, `/health` → `ok`, un client WebSocket envoie `join` avec un faux code et reçoit « Aucun salon avec ce code. », un WebSocket hors `/ws` est refusé. Même essai sur `npm run dev` : OK.
- **Comment tester** : `npm run server`, puis ouvrir `http://localhost:8787/health`. Le jeu ne sait pas encore s'y connecter (lot suivant).
- **Points à valider ouverts** : V-060 ; V-058 et V-059 restent en attente.
- **Reste à faire** :
  - Lot suivant : adresse du serveur réglable dans le client (`wss://…onrender.com`), message « Réveil du serveur… », reconnexion, build pour itch.io.
  - Render déploie depuis un dépôt Git (GitHub ou GitLab) : le projet n'est pas encore un dépôt git. C'est à l'utilisateur de créer le dépôt et de pousser (Claude n'a pas le droit de pousser).
  - Avertissement de Vite déjà présent avant ce lot (`configLoader: 'native'`, imports sans extension dans `vite.config.ts`) : sans effet aujourd'hui.

### Lot 19 · Cadrage de la V2 · 2026-11-25
- **Prompt** : « le MVP est fini, on passe V2 ».
- **Plan** : relire les docs, faire choisir le périmètre, proposer un découpage en lots, sans toucher au code.
- **Fait** : périmètre choisi en chat (jeu en ligne + itch.io, progression et boutique, admin) ; découpage en 6 lots proposé (V-058) ; choix de l'hébergement posé (V-059). Aucun code modifié.
- **Fichiers touchés** : `VALIDATION.md`.
- **Tests** : aucun (pas de code).
- **Comment tester** : rien à tester.
- **Points à valider ouverts** : V-058, V-059 (bloquants) ; les 57 précédents restent ouverts.
- **Reste à faire** : attendre la validation de V-058 avant le premier lot V2.

### Lot 18 · Explosion spectaculaire · 2026-11-24
- **Prompt** : des effets bien plus dramatiques pour l'explosion : beau flash, secousse, plein de particules, une grosse explosion.
- **Plan** :
  1. Rendu de l'explosion (`combatScene`) en couches : flash de lumière, cœur, boule de feu, fumée en champignon, onde de choc au sol, étincelles, éclats et braises, trace brûlée. Couleurs pastel dans le thème.
  2. Caméra : secousse forte selon la distance, à-coup du champ de vision ; flash d'écran sur le HUD.
  3. Son plus grave et plus long.
  4. « Réduire flashs et secousses » : coupe flash d'écran, secousse et à-coup, adoucit le reste.
  5. Vérification dans le navigateur (captures image par image), clôture.
- **Fait** :
  - **Explosion en couches** (`src/render/explosionFx.ts`) : éclair crème (0,2 s), boule de feu pastel qui gonfle, monte et fond (1 s), onde de choc (sphère et anneau au sol), 90 étincelles étirées, 60 braises, 70 éclats qui rebondissent, champignon de fumée cartoon (colonne qui monte et anneau qui roule au sol, né juste après le feu), trace brûlée qui s'efface en 10 s, lumière forte qui éclaire le décor. Couleurs `--blast-*` dans `theme.css`.
  - **Caméra** : secousse forte et souple (ondulations de plusieurs fréquences, position et rotation), qui retombe en 0,8 s et faiblit avec la distance (plus rien à 4 rayons) ; à-coup du champ de vision (+9°).
  - **Flash d'écran** crème, intensité selon la distance.
  - **Son** : claquement, grondement grave et long, écho.
  - **« Réduire flashs et secousses »** : pas de flash d'écran, ni secousse, ni à-coup ; lumière au quart, boule de feu adoucie, trois fois moins de particules.
  - **Vérifié dans le navigateur**, au stand de tir, image par image (0,07 s, 0,23 s, 0,57 s, 1,4 s) : flash, boule de feu et étincelles, puis champignon de fumée et éclats, puis trace au sol. Option d'accessibilité : pas de flash avec, flash à 0,6 sans (explosion à 9 m). Aucune erreur dans la console.
  - **Corrigé pendant les essais** : la fumée cachait la boule de feu et ressemblait à des rochers → fumée retardée, plus petite, boules lisses ; boule de feu plus grosse et plus longue.
  - **Outil de dev** : `__revizCombat.blast(x, y, z)` (absent du build) déclenche une explosion de test, sans dégâts.

  **Pas vérifié** : la secousse et le son ressentis en vrai (captures fixes seulement) ; le coût sur un PC modeste avec plusieurs explosions à la fois.
- **Fichiers touchés** : `src/render/explosionFx.ts` (nouveau), `src/render/combatScene.ts`, `src/render/arena.ts`, `src/ui/screens/11-combat.ts`, `src/ui/theme.css`, `src/ui/styles.css`, `config/sounds.json`, `VALIDATION.md`.
- **Tests** : `npx tsc --noEmit` sans erreur ; `npx vitest run` : 280 tests, tous verts (rendu seulement : pas de nouveau test de logique) ; `npm run build` OK.
- **Comment tester** : `npm run dev`, puis dans la console `__reviz.stand()`, clic sur Jouer, et `__revizCombat.blast(0, 0.12, 8)` pour une explosion à 6 m ; ou en match, gagner une grenade dans un coffre et la lancer (G). Cocher « Réduire flashs et secousses » dans la pause pour la version douce.
- **Points à valider ouverts** : V-057.
- **Reste à faire** : pas de déformation de l'écran (onde de distorsion) ni de ralenti ; les adversaires n'ont pas d'animation de souffle.

### Lot 17 · QR code en grand sur l'écran 06 · 2026-11-24
- **Prompt** : « on s'en fout un peu de toutes les infos, il faut le QR code en grand ici » (panneau de droite de 06).
- **Plan** :
  1. Panneau de 06 : retirer le code « · · · », sa note et le résumé des réglages ; QR en grand, adresse dessous, « Même wifi requis » gardé.
  2. Typecheck, tests, vérification dans le navigateur, clôture.
- **Fait** : le panneau de droite de 06 ne montre plus que le QR code en grand (280 px max), l'adresse dessous et « Même wifi requis ». Code « · · · », sa note et résumé des réglages retirés, ainsi que leurs styles devenus inutiles. Le lobby (07) ne change pas.
- **Fichiers touchés** : `src/ui/screens/06-create-room.ts`, `src/ui/qr.ts` (option `large`), `src/ui/styles.css`.
- **Tests** : `npx tsc --noEmit` sans erreur ; `npx vitest run` : 20 fichiers, 280 tests, tous verts. Vérifié dans le navigateur avec `npm run host`.
- **Comment tester** : `npm run host`, puis Créer un salon.
- **Points à valider ouverts** : V-056.
- **Reste à faire** : rien.

### Lot 16 · QR code pour rejoindre le salon · 2026-11-24
- **Prompt** : un QR code pour rejoindre la partie, avec la bibliothèque `qrcode` (accord donné en chat).
- **Plan** :
  1. Dépendance `qrcode` (+ `@types/qrcode`), point de suivi V-054.
  2. Serveur : petite route `/api/lan` qui renvoie l'adresse réseau local donnée par Vite (`--host`), choix de la meilleure adresse en logique pure testée ; script `npm run host`.
  3. Lien `?code=XXXX` : à l'ouverture, le jeu rejoint directement le salon.
  4. Écran 06 : QR de l'adresse locale ; écran 07 : QR de l'adresse + code (V-055).
  5. Tests, vérification dans le navigateur, clôture.
- **Fait** :
  - **06 Créer un salon** : QR code de l'adresse du jeu à côté de l'adresse réseau local (ex. `10.192.177.0:5199`).
  - **07 Lobby** : QR code qui contient l'adresse + le code du salon, à côté du code et de Copier.
  - **Lien direct** : ouvrir `http://IP:port/?code=XXXX` rejoint le salon tout seul (code invalide ignoré, erreur du serveur affichée sur l'accueil), puis la barre d'adresse est nettoyée.
  - **Adresse réseau local** : route `/api/lan` ; sur ce PC, Vite liste VirtualBox et VMware avant le wifi, d'où le choix par la route par défaut (corrigé pendant le lot après vérification).
  - **Sans `--host`** : pas de QR, le panneau dit de lancer `npm run host`.
- **Fichiers touchés** : `package.json`, `package-lock.json` (qrcode, @types/qrcode, script `host`), `vite.config.ts`, `server/lanUrl.ts` (nouveau), `src/net/joinLink.ts` (nouveau), `src/ui/qr.ts` (nouveau), `src/ui/app.ts`, `src/ui/screens/06-create-room.ts`, `src/ui/screens/07-lobby.ts`, `src/ui/styles.css`, `tests/joinLink.test.ts` (nouveau), `.claude/launch.json` (serveur de test sur le port 5199, retirable).
- **Tests** : `npx vitest run` : 20 fichiers, 280 tests, tous verts ; `npx tsc --noEmit` sans erreur. Vérifié dans le navigateur : QR sur 06 et 07, `/api/lan` renvoie l'adresse wifi, un 2e onglet ouvert sur `?code=…` arrive dans le lobby (2/2 joueurs).
- **Comment tester** : `npm run host`, Créer un salon : le QR et l'adresse apparaissent ; Créer : le QR du lobby contient le code. Sur l'autre PC, ouvrir l'adresse affichée suivie de `/?code=XXXX`, ou scanner le QR.
- **Points à valider ouverts** : V-054, V-055.
- **Reste à faire** : scan réel avec un téléphone non testé ici ; le pare-feu Windows de l'hôte peut bloquer le port à la première ouverture (autoriser Node sur le réseau privé).

### Lot 15 · Destruction limitée de la carte · 2026-11-24
- **Prompt** : « Yes, next lot » : destruction limitée, selon le matériau et les dégâts (validé au lot 14).
- **Plan** :
  1. Config : `config/materials.json` (verre, bois, pierre : PV, part des balles et des grenades), champ `breakables` dans `arenas.json`.
  2. Logique pure et testée (`src/core/combat/destruction.ts`) : éléments découpés en morceaux de 50 cm ajoutés aux collisions, dégâts d'une balle sur le morceau touché, d'une explosion sur les morceaux proches, retrait des morceaux détruits (le joueur et les grenades passent à travers).
  3. Serveur : dégâts au décor depuis les tirs et les explosions, diffusion des morceaux détruits, carte intacte à chaque manche.
  4. Cartes : `m.breakable(matériau, …)` dans le générateur ; voxels cassables dans un `.vox` à part ; éléments choisis sur les 4 cartes.
  5. Rendu : éléments cassables maillés à part et remaillés quand un morceau tombe, éclats de la couleur du matériau.
  6. Tests, vérification dans le navigateur, clôture.
- **Fait** :
  - **Config** : `config/materials.json` validé au chargement (matériau inconnu ou en double refusé, décor cassable connu du catalogue).
  - **Logique pure** (`src/core/combat/destruction.ts`) : éléments découpés en morceaux d'environ 50 cm, ajoutés aux collisions ; balle sur le morceau touché, explosion sur les morceaux du rayon ; un morceau détruit quitte le monde (balles, grenades et joueurs passent, un joueur posé dessus tombe). Mêmes ids partout.
  - **Serveur** : dégâts au décor depuis chaque tir annoncé (départ près du tireur, portée, cadence) et chaque explosion ; diffusion `breaks` ; carte neuve à chaque combat.
  - **Cartes** : `m.breakable(matériau, …)` dans le générateur ; voxels cassables dans `<id>-breakables.vox` (décors principaux régénérés sans eux). Quartier 22 éléments (248 morceaux), Vallon 14, Mine 8 ; Cubes : 6 blocs convertis (V-053).
  - **Rendu** : chaque élément est maillé à part et remaillé quand un morceau tombe ; les voxels posés dessus (fleurs d'un muret) tombent avec le morceau le plus proche ; éclats de la couleur du matériau, impacts aussi. Cubes : un pavé par morceau. Les éléments cassables apparaissent aussi dans l'aperçu de 06b.
  - **Vérifié dans le navigateur** (2 onglets, Quartier) : aperçu 06b avec caisses, murets et vitre ; 12 balles de pistolet sur une pile de caisses → un morceau cassé, vu par les deux joueurs ; grenade au pied d'un muret de pierre → 7 morceaux sur 10, brèche visible, mêmes morceaux chez l'autre joueur. Aucune erreur dans la console ni sur le serveur.
  - **Réglé pendant les essais** : pierre d'abord trop dure (150 PV : une grenade à 36 cm ne faisait rien), puis trop fragile (120 PV : un muret entier rasé) → 135 PV.
  - **Corrigé (bug du lot 14)** : l'invite « E · Coffre » pouvait rester affichée en s'éloignant après un changement d'état d'un coffre.

  **Pas vérifié à la main** : tirer et lancer à la souris en vrai (piloté par les outils de développement) ; Vallon, Mine et Cubes en match (couverts par les tests et l'aperçu seulement).
- **Fichiers touchés** :
  - créés : `config/materials.json`, `src/core/combat/destruction.ts`, `src/render/breakables.ts`, `tests/destruction.test.ts`, `assets/models/maps/city-breakables.vox`, `forest-breakables.vox`, `mine-breakables.vox` ;
  - config : `config/arenas.json` (éléments cassables, Cubes), `config/assets.json` (décors cassables) ; décors `assets/models/maps/*.vox` régénérés ;
  - logique : `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/core/combat/combatSession.ts`, `src/core/match/protocol.ts`, `src/core/match/room.ts` ;
  - cartes : `scripts/maps/mapDsl.ts`, `build-maps.ts`, `city.ts`, `forest.ts`, `mine.ts` ;
  - rendu et interface : `src/render/assets.ts`, `src/render/combatScene.ts`, `src/render/mapPreview.ts`, `src/ui/screens/11-combat.ts`, `src/ui/app.ts`, `src/ui/theme.css` ;
  - chargement : `src/loadContent.ts`, `server/attach.ts`, `tests/helpers.ts`, `tests/destruction.test.ts` ; `VALIDATION.md`.
- **Tests** : `npx tsc --noEmit` sans erreur ; `npx vitest run` : 271 tests, tous verts (15 nouveaux : config, découpe, balles, explosions, trous traversés par une grenade, joueur qui tombe, cartes, serveur).
- **Comment tester** :
  1. `npm run dev`, Créer un salon, « Changer » la carte : caisses, murets et vitre visibles dans l'aperçu.
  2. Match à 2 onglets sur Quartier. Tirer sur une caisse (6 balles de pistolet par morceau) ou sur la vitre de l'abri de bus (une balle par morceau).
  3. Gagner une grenade dans un coffre et la lancer au pied d'un muret de pierre : il s'ouvre ; dans l'autre onglet, le même trou.
  4. Au combat suivant (Best of 3), tout est réparé.
- **Points à valider ouverts** : V-051, V-052, V-053 (provisoires) ; V-048 à V-050 et les précédents.
- **Reste à faire** :
  - pas d'écroulement : une caisse posée sur une caisse détruite reste en l'air ;
  - pas de fissures avant la casse (un morceau abîmé a l'air intact) ;
  - le serveur ne vérifie pas qu'aucun mur ne se trouve entre le tireur et le morceau touché (même limite que pour les touches sur les joueurs, V-025).

### Lot 14 · Grenades dans des coffres · 2026-11-24
- **Prompt** : des grenades qu'on trouve en combat dans des coffres, en répondant à une question de difficulté 3 en 10 s ; un coffre raté est bloqué 30 s pour tout le monde. Destruction limitée de la carte validée en principe, pour un lot suivant.
- **Plan** :
  1. Config : `config/pickups.json` (coffres, grenade) validé par zod ; positions des coffres dans `arenas.json` (Cubes à la main, cartes voxel via `npm run maps`).
  2. Logique pure et testée : trajectoire de la grenade (rebonds sur le décor), dégâts de l'explosion (distance, murs, bouclier) ; état des coffres (libre, occupé, bloqué), tirage de la question.
  3. Serveur : ouvrir un coffre, envoyer la question sans la réponse, valider, bloquer 30 s ; lancer une grenade (vérifiée), explosion et dégâts côté serveur ; questions ratées dans le récap.
  4. Client : modèles voxel coffre et grenade, coffres sur la carte, invite « E », question en 10 s sur le HUD (touches 1 à 4), compteur et lancer (G), trajectoire et explosion (respecte « réduire flashs et secousses »), sons.
  5. Tests, vérification dans le navigateur, clôture.
- **Fait** :
  - **Config** : `config/pickups.json` validé au chargement (contrôles croisés : modèles connus, départ ≤ maximum, coffres dans l'arène). 4 coffres par carte (Cubes à la main, cartes voxel par `npm run maps`, décors `.vox` inchangés).
  - **Modèles voxel** : coffre jaune pastel à cerclages et serrure lumineuse, grenade orange pastel (`npm run voxels`).
  - **Logique pure** : `src/core/combat/grenade.ts` (trajectoire avec rebonds, explosion, murs qui protègent), `src/core/match/chests.ts` (libre, occupé, bloqué ; tirage sans doublon avec le quiz) ; `resolveDamage` commun aux balles et aux explosions.
  - **Serveur** : ouvre le coffre si le joueur est à portée, envoie la question sans la réponse, valide, bloque 30 s ; ignore les tirs d'un joueur qui répond ; mort pendant la question = échec ; vérifie et simule seul les lancers, applique l'explosion (moitié des dégâts pour le lanceur, sa propre grenade ne compte pas comme un kill) ; questions des coffres dans le récap.
  - **Client** : coffres sur la carte (halo qui tourne quand libre, grisés quand bloqués), invite « E · Coffre » ou temps de blocage, question en bas de l'écran avec barre des 10 s, correction 2 s, compteur de grenades sous les munitions, trajectoire rejouée, explosion (boule, éclats, lumière, secousse ; adoucie avec « réduire flashs et secousses »), 2 nouveaux sons.
  - **Vérifié dans le navigateur**, 2 vrais matchs à 2 onglets (Quartier, Mine) : invite, question de difficulté 3, bonne réponse → 1 grenade, la touche 2 répond sans changer d'arme, coffre bloqué vu par l'autre joueur avec son décompte, grenade lancée aux pieds de l'adversaire → environ 47 dégâts chez lui et 14 chez le lanceur à 2,8 m. Aucune erreur serveur.
  - **Corrigé pendant le lot** : la grenade roulait trop (8 m en visant ses pieds) → lancer 12 m/s, rebond 0,2, frottement 0,35 ; le coffre central du Quartier tombait dans la fontaine → deux paires de coffres au lieu d'un coffre central.

  **Pas vérifié à la main** : viser et lancer à la souris (le navigateur intégré ne capture pas la souris, j'ai piloté le jeu par les outils de développement) ; l'aspect de l'explosion en plein mouvement.
- **Fichiers touchés** :
  - créés : `config/pickups.json`, `src/core/combat/grenade.ts`, `src/core/match/chests.ts`, `scripts/voxels/props.ts`, `assets/models/props/chest.vox`, `assets/models/props/grenade.vox`, `tests/pickups.test.ts` ;
  - config : `config/arenas.json` (coffres), `config/assets.json` (`prop.chest`, `prop.grenade`), `config/sounds.json` (`combat.grenadeThrow`, `combat.explosion`) ;
  - logique : `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/core/combat/damage.ts`, `src/core/match/protocol.ts`, `src/core/match/matchServer.ts`, `src/core/match/room.ts` ;
  - cartes : `scripts/maps/mapDsl.ts`, `build-maps.ts`, `city.ts`, `forest.ts`, `mine.ts`, `scripts/voxels/build-weapons.ts` ;
  - rendu et interface : `src/render/arena.ts`, `src/render/combatScene.ts`, `src/ui/screens/11-combat.ts`, `src/ui/app.ts`, `src/ui/icons.ts`, `src/ui/styles.css` ;
  - chargement : `src/loadContent.ts`, `server/attach.ts`, `tests/helpers.ts`, `tests/maps.test.ts` ; `VALIDATION.md`.
- **Tests** : `npx tsc --noEmit` sans erreur ; `npx vitest run` : 256 tests, tous verts (29 nouveaux : config, trajectoire, explosion, tirage de la question, états du coffre, serveur en match, récap, coffres de chaque carte libres, posés, symétriques et atteignables).
- **Comment tester** :
  1. `npm run dev`, deux onglets, créer un salon (Quiz 1:00 et 3 questions pour aller vite) et le rejoindre.
  2. En combat, marcher jusqu'à un coffre (halo jaune au sol) : « E · Coffre » apparaît. E, puis répondre avec 1 à 4 en moins de 10 s.
  3. Bonne réponse : le compteur de grenades passe à 1. G pour lancer (viser ses pieds = court, viser haut = loin).
  4. Erreur ou temps écoulé : dans l'autre onglet, le coffre est grisé et l'invite affiche le temps avant réouverture (30 s).
  5. Finir le match : les questions de coffre ratées sont dans le récap (13).
- **Points à valider ouverts** : V-048, V-049, V-050 (provisoires) ; les précédents.
- **Reste à faire** :
  - **destruction limitée de la carte** : prochain lot (matériaux et points de vie dans la config, éléments cassables seulement, grenades qui cassent vraiment) ;
  - remarque hors lot : la fontaine du Quartier n'a pas de collision (on la traverse, les balles et les grenades aussi) ; à corriger dans `scripts/maps/city.ts` si tu veux ;
  - pas de grenade dans le stand de tir (pas de coffres dans l'arène d'entraînement) ;
  - pas d'indication de l'endroit où la grenade va tomber.

### Lot 13 · Pièces gagnées en fin de partie · 2026-11-23
- **Prompt** : un système de pièces gagnées à chaque fin de partie selon les stats en jeu (pas les questions).
- **Plan** :
  1. Config : nouveau `config/economy.json` (gains par kill, kill à la tête, dégâts, manche gagnée, victoire, précision, participation, plafond), validé par zod.
  2. Logique pure `src/core/match/coins.ts` : stats de combat → détail des gains et total plafonné. Le serveur compte en plus les kills à la tête et calcule les pièces de chacun à la fin du match (serveur autoritaire).
  3. Client : solde gardé dans ce navigateur, crédité à la réception de la fin de match ; « +N pièces » et le détail sur 14, solde sur 01 et 02.
  4. Tests, clôture.
- **Fait** :
  - `config/economy.json` validé au chargement (message clair si un gain est négatif, etc.).
  - `matchCoins()` : détail ligne par ligne (seulement les lignes non nulles) et total plafonné.
  - Serveur : compte les kills à la tête, joint `coins` à chaque résultat de `matchEnd`.
  - Client : solde crédité à la fin du match ; pastille de solde sur 01 et 02 ; « +N pièces » et détail sur 14. Vérifié dans le navigateur (accueil, et écran 14 rendu avec des données de test).
- **Fichiers touchés** : `config/economy.json` (nouveau), `src/core/match/coins.ts` (nouveau), `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/core/match/room.ts`, `src/core/match/protocol.ts`, `src/loadContent.ts`, `server/attach.ts`, `src/ui/app.ts`, `src/ui/store.ts`, `src/ui/components.ts`, `src/ui/icons.ts`, `src/ui/styles.css`, `src/ui/screens/01-home.ts`, `02-loadout.ts`, `14-results.ts`, `tests/helpers.ts`, `tests/coins.test.ts` (nouveau), `tests/rooms.test.ts`.
- **Tests** : `npx tsc --noEmit` sans erreur ; `npx vitest run` : 227 tests, tous verts (dont 7 nouveaux sur les pièces).
- **Comment tester** : `npm run dev`, ouvrir deux onglets, créer un salon dans l’un et le rejoindre dans l’autre, jouer le match jusqu’au bout ; l'écran 14 affiche « +N pièces » et le détail ; de retour à l'accueil, la pastille de solde a augmenté.
- **Points à valider ouverts** : V-044.
- **Reste à faire** : dépenser les pièces (skins de l'écran 02, hors MVP) ; niveau et XP non faits.

### Lot 12 · Choix de la carte et cartes en voxel · 2026-11-23
- **Prompt** : choisir la map dans la préparation du salon ; plusieurs belles maps en voxel détaillé, avec des hauteurs, entre ville, nature et souterrain.
- **Plan** :
  1. Logique : réglage `arenaId` dans les réglages du salon (vérifié par le serveur, parmi les cartes jouables de `arenas.json`) ; le combat utilise la carte choisie au lieu de celle du mode ; montée automatique des petites marches (`stepHeight`) pour que les escaliers et les reliefs se parcourent sans sauter.
  2. Générateur `scripts/maps/` (`npm run maps`) : chaque carte est dessinée en code ; il écrit le décor voxel (`assets/models/maps/<id>.vox`, voxels de 25 cm) et les blocs de collision, apparitions et réglages dans `config/arenas.json`. Collision et décor viennent du même dessin, donc ils collent.
  3. Cartes : une ville (place, immeubles, toits accessibles, passerelles), une nature (collines, rivière, pont, ruines, arbres), un souterrain (mine et cristaux, galeries sur plusieurs niveaux). « Cubes » reste jouable.
  4. Rendu : décor voxel maillé par morceaux (occlusion ambiante, cristaux et lanternes lumineux), ciel, brouillard et lumière propres à chaque carte (couleurs dans `theme.css`).
  5. Écran : ligne « Carte » dans 06, qui ouvre le choix de la carte (liste à gauche, aperçu 3D qui tourne, type et taille conseillée) ; la carte apparaît dans le résumé de 06 et de 07 et dans la transition (10).
  6. Tests, vérification dans le navigateur, clôture.
- **Fait** :
  - **Choix de la carte** : ligne « Carte » dans 06, qui ouvre le panneau 06b. Il contient la liste des cartes et un aperçu 3D qui tourne. La carte choisie part au serveur avec les réglages, qui la vérifie. Elle sert au combat et aux réapparitions, et s'affiche dans les résumés de 06 et 07 et dans la transition (« Manche 1 · Quartier »).
  - **3 nouvelles cartes en voxel** (en plus de Cubes) : **Quartier** (Ville), **Vallon** (Nature), **Mine de cristal** (Souterrain). Détail dans V-047.
  - **Hauteurs** : toits-terrasses, passerelles, tour en ruine, galeries à 3 m, terrasses de terrain. Les marches de 0,5 m se montent en marchant (V-046).
  - **Rendu** : décor découpé en morceaux de 8 m (ceux hors champ ne sont pas dessinés), occlusion ambiante, cristaux, lanternes et lampadaires lumineux. Chaque carte a son ciel, son brouillard et sa lumière. Le décor est mis en cache : l'aperçu de 06b et le combat partagent le même.
  - **Générateur** : `npm run maps` (ou `npm run maps -- city`). L'intérieur invisible des volumes pleins est vidé avant l'écriture (Vallon : 1,47 M → 350 000 voxels, 1,4 Mo).
  - **Vérifié dans le navigateur** : aperçu des 4 cartes dans 06b, puis 3 vrais matchs à 2 onglets (Mine, Quartier, Vallon) jusqu'au combat. Le décor est chargé et l'apparition est au bon endroit. Aucune erreur dans la console.

  **Pas vérifié à la main** : se déplacer et tirer dans les cartes (le navigateur intégré ne me laisse pas prendre la souris). Les tests couvrent les déplacements à la place : apparitions libres et posées, toutes atteignables à pied, montée des marches.
- **Fichiers touchés** :
  - créés : `scripts/maps/mapDsl.ts`, `props.ts`, `city.ts`, `forest.ts`, `mine.ts`, `build-maps.ts` ; `assets/models/maps/city.vox`, `forest.vox`, `mine.vox` ; `src/render/mapPreview.ts` ; `src/ui/screens/06b-map-choice.ts` ; `tests/maps.test.ts` ;
  - config : `config/arenas.json` (Cubes jouable, 3 cartes), `config/assets.json` (3 décors), `config/player.json` (`stepHeight`) ;
  - logique : `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/core/match/settings.ts`, `src/core/match/room.ts`, `src/core/combat/combatSession.ts`, `src/core/combat/movement.ts`, `src/core/voxel/mesher.ts` ;
  - rendu et interface : `src/render/arena.ts`, `src/render/assets.ts`, `src/render/combatScene.ts`, `src/ui/app.ts`, `src/ui/screens/06-create-room.ts`, `src/ui/screens/11-combat.ts`, `src/ui/icons.ts`, `src/ui/theme.css`, `src/ui/styles.css` ;
  - `package.json` (script `maps`), `tests/combat.test.ts`, `VALIDATION.md`.
- **Tests** : `npx vitest run` : 227 tests, tous verts (29 nouveaux). Ils couvrent :
  - la montée des marches ;
  - pour chaque carte : apparitions libres, posées et atteignables à pied depuis la première, combat qui démarre à chaque apparition, décor présent ;
  - le serveur, qui refuse une carte inconnue ou le stand de tir, et la config, qui refuse une carte sans assez d'apparitions.

  `npx tsc --noEmit` et `npm run build` : OK.
- **Comment tester** :
  1. `npm run dev`, Créer un salon, cliquer sur la ligne « Carte », parcourir les cartes (flèches ou clic), faire tourner l'aperçu à la souris, « Choisir cette carte ».
  2. Créer le salon, rejoindre depuis un 2e onglet, jouer le quiz : la transition affiche la carte, le combat s'y déroule.
  3. Monter sur les toits du Quartier (escaliers à côté des cafés, passerelle), sur la tour du Vallon, sur les galeries et le piton de la Mine.
  4. Retoucher une carte : éditer `scripts/maps/<carte>.ts`, puis `npm run maps -- <id>`.
- **Points à valider ouverts** : V-045, V-046, V-047 (provisoires) ; V-039 à V-044 et les précédents.
- **Reste à faire** :
  - le stand de tir (Loadout, vue à la première personne) reste dans l'arène d'entraînement ;
  - pas d'aperçu de la carte dans le lobby (07) : seul son nom apparaît ;
  - les balles traversent feuillages et petits décors (choix fait pour garder peu de collisions) ;
  - à 5 joueurs, 40 à 44 m reste serré : à jouer pour juger.
- **Après le lot (accord donné en chat : « Oui, ajoute 06b »)** : `ECRANS.md` mis à jour pour V-045. Le statut reste à poser par l'utilisateur.
  - Navigation : 06 ──ligne Carte──► 06b ──choisir ou retour──► 06.
  - 06 : « carte (ouvre 06b) » dans le contenu, 06b dans « Mène à ».
  - Nouvelle fiche « 06b Choix de la carte · Proto : Oui ». C'est un panneau de 06, donc le compte reste à 15 écrans.
  - 07 : « carte » ajoutée au contenu, à côté du mode.

### Lot 11 · Animations des personnages · 2026-11-23
- **Prompt** : « Tu peux les animer ? » (les personnages voxel du lot 10).
- **Plan** (rendu seulement, aucune règle ne change) :
  1. Visée : bras, arme et tête suivent la visée haut/bas de l'adversaire (déjà envoyée par le serveur), position un peu plus serrée quand il vise.
  2. Tir : recul des bras à chaque tir adverse.
  3. Déplacement : marche en avant, en arrière et en pas chassés, buste penché dans le sens de la course ; saut (jambes repliées) et réception (petit tassement).
  4. Touché : sursaut quand l'adversaire prend des dégâts. Mort : il bascule en arrière puis disparaît, au lieu de disparaître d'un coup.
  5. Aperçu dans le navigateur, tests, clôture.
- **Fait** :
  - **Visée** : les bras, l'arme et la tête suivent la visée haut/bas de l'adversaire. Quand il vise, ses bras remontent un peu et sa tête se penche vers l'arme.
  - **Tir** : à chaque tir adverse, ses bras reculent puis reviennent en place en un quart de seconde.
  - **Déplacement** :
    - en marche avant ou arrière, les jambes alternent et le buste penche dans le sens de la marche ;
    - en pas chassés, les jambes s'écartent sur le côté et le buste penche aussi ;
    - en l'air, une jambe passe devant et l'autre derrière ; à la réception d'un saut, le corps se tasse ;
    - une réapparition ne déclenche pas de pas.
  - **Touché** : le corps et la tête partent en arrière, que les dégâts viennent de moi ou d'un autre joueur.
  - **Mort** : l'adversaire bascule en arrière (0,55 s), reste au sol, s'enfonce, puis disparaît au bout de 1,6 s. Il repart d'aplomb à la réapparition. Avant, il disparaissait d'un coup.
  - Les calculs de pose sont dans un module pur (`characterPose.ts`), testé sans navigateur. Rien ne change dans les règles, ni dans ce que le serveur envoie : la visée et l'état « vise » étaient déjà transmis.
  - Vérifié dans le navigateur, sur une page d'aperçu temporaire (supprimée ensuite) : visée haute et basse, saut, marche, pas chassés, sursaut, chute, réapparition.

  **Pas vu en vrai match** : je n'ai pas lancé de partie à 2 onglets.
- **Fichiers touchés** :
  - créés : `src/render/characterPose.ts`, `tests/characterPose.test.ts` ;
  - modifiés : `src/render/character.ts`, `src/render/combatScene.ts`, `src/ui/screens/11-combat.ts`, `VALIDATION.md`.
- **Tests** : `npx vitest run` : 197 tests, tous verts (9 nouveaux). `npx tsc --noEmit` et `npm run build` : OK.
- **Comment tester** : `npm run dev`, partie à 2 onglets ; dans un onglet, bouger, sauter, viser en haut et en bas, tirer ; regarder le personnage dans l'autre onglet, puis l'éliminer.
- **Points à valider ouverts** : aucun nouveau (V-043 et les précédents restent ouverts).
- **Reste à faire** :
  - l'arme tenue ne change pas quand l'adversaire change d'arme : le serveur envoie l'emplacement, mais seule l'arme du loadout est chargée ;
  - pas d'animation de rechargement : l'information n'est pas envoyée ;
  - le sprint (dash) n'a pas de pose à lui.

### Lot 10 · Personnages en voxel · 2026-11-23
- **Prompt** : « Tu peux faire les personnes en voxel ainsi », avec deux images de référence (personnages voxel aux proportions un peu chibi : grosse tête, visage à gros yeux, cheveux en mèches, vêtements simples, bottes).
- **Plan** :
  1. Générateur `scripts/voxels/characters.ts` (même langage que les armes) : 2 personnages (cheveux longs / cheveux courts en pics), 1,80 m, voxels de 2,5 cm. Le haut prend la couleur du joueur (couleurs « marqueurs » remplacées au chargement).
  2. Catalogue : entrées `character.*` dans `config/assets.json`, avec les parties animables (tête, bras, jambes) décrites par des boîtes et des pivots, validées par zod.
  3. Rendu : les adversaires en combat utilisent ces modèles (bras tendus qui tiennent l'arme, marche animée selon la vitesse), à la place de la capsule.
  4. Tests (modèles d'un seul tenant, taille cohérente avec la hitbox, catalogue), vérification dans le navigateur, clôture.
- **Fait** :
  - **Générateur** : `npm run voxels` écrit aussi `assets/models/characters/student_a.vox` et `student_b.vox` (28 × 75 × 17, environ 9 000 voxels chacun). Visage à gros yeux avec reflets, sourcils, nez, joues roses, oreilles ; cheveux longs en mèches ou courts en pics ; t-shirt à col rond, écusson, plis ; ceinture à boucle ; bracelets ; bottes à revers ou baskets à lacets. Les `.vox` s'ouvrent dans MagicaVoxel.
  - **Chargement** : la couleur du joueur remplace les couleurs marqueurs (avec un ton plus foncé pour les ourlets) ; le modèle est découpé en tête, bras et jambes qui pivotent chacun à l'épaule, à la hanche ou au cou.
  - **Combat** : les adversaires sont ces personnages à la place de la capsule. Ils tiennent l'arme à deux mains, canon vers l'avant. Les jambes marchent au rythme du déplacement réel, sans pas lors d'une réapparition, et le personnage respire à l'arrêt. L'éclair de touche marche toujours.
  - Vérifié dans le navigateur, sur une page d'aperçu temporaire (supprimée ensuite) : les 5 couleurs, de face, de profil, de dos, en marche, avec les 4 armes. Aucune erreur dans la console.

  **Pas vu en vrai match** : l'aperçu utilise la même fonction que le combat (`createCharacter`), mais je n'ai pas lancé de partie à 2 onglets pour voir un adversaire dans l'arène.
- **Fichiers touchés** :
  - créés : `scripts/voxels/characters.ts`, `src/core/voxel/parts.ts`, `src/render/character.ts`, `assets/models/characters/student_a.vox` et `student_b.vox`, `tests/characters.test.ts` ;
  - modifiés : `scripts/voxels/build-weapons.ts`, `config/assets.json`, `config/player.json`, `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/render/assets.ts`, `src/render/combatScene.ts`, `tests/helpers.ts` (fonction `connectedCount` partagée), `tests/weapons.test.ts`, `VALIDATION.md`.
- **Tests** : `npx vitest run` : 188 tests, tous verts (20 nouveaux : modèles d'un seul tenant, partie par partie ; hauteur 1,80 m, largeur dans la hitbox, cou au niveau de la zone tête ; couleurs du joueur présentes ; catalogue ; découpage et recoloration). `npx tsc --noEmit` et `npm run build` : OK.
- **Comment tester** :
  1. `npm run dev`, créer un salon, ouvrir un 2e onglet et rejoindre avec le code, jouer le quiz.
  2. En combat, l'adversaire est un personnage voxel à sa couleur, l'arme en main. Il marche quand il bouge.
  3. Retoucher un personnage : éditer `scripts/voxels/characters.ts`, puis `npm run voxels -- student_a student_b`.
- **Points à valider ouverts** : V-043 (provisoire) ; V-039 à V-042 et les précédents.
- **Reste à faire** : bras et tête ne suivent pas la visée verticale (le serveur n'envoie que l'orientation horizontale) ; pas d'animation de tir, de saut ni de chute ; le joueur ne se voit pas lui-même (vue à la première personne).

### Lot 9 · Salons personnalisables, jusqu'à 5 joueurs · 2026-11-23
- **Prompt** : plus de personnalisation des salons : jusqu'à 5 joueurs, durée du quiz et du combat de 1 à 5 min par pas de 30 s, nombre max de questions, 2 ou 3 modes par défaut et un maximum d'options.
- **Plan** :
  1. Config : durées 1:00 à 5:00 par 30 s (`quiz.json`, `modes.json`), choix du nombre de joueurs (2 à 5) et du nombre max de questions, apparitions en plus dans l'arène de duel, 3 couleurs de joueur en plus dans le thème.
  2. Logique : réglages `maxPlayers`, `maxQuestions`, `winCondition` ; le quiz s'arrête au nombre max de questions ; le salon accepte jusqu'à 5 joueurs et démarre dès que 2 joueurs ou plus sont tous prêts ; combat en mêlée (dernier en vie ou le plus de kills), abandon d'un joueur sans arrêter le match s'il en reste 2.
  3. Écrans : 06 (nouveaux réglages), 07 (N places), 10, 11 (plusieurs adversaires), 12, 14 (hexagone et classement à N).
  4. Tests Vitest de la logique, vérification dans le navigateur, clôture.
- **Fait** :
  - **06 Créer un salon** : nouvelles lignes Joueurs (2 à 5, imposé à 2 en Duel) et Questions max (∞, 3 à 20) ; durées du quiz et du combat de 1:00 à 5:00 par 30 s ; en Personnalisé, nouvelle ligne Victoire (Dernier en vie / Le plus de kills) et choix des vies et manches lus dans la config. Changer de mode garde les réglages déjà faits. Le résumé de droite reprend tout.
  - **Modes par défaut** : Duel (1 contre 1), Best of 3 (2 à 5, dernier en vie), Chrono (2 à 5, le plus de kills), plus Personnalisé.
  - **Serveur** : salon de 2 à 5 joueurs, départ quand tous les présents sont prêts, mêlée chacun pour soi, fin de manche au dernier en lice, égalités, départ d'un joueur sans arrêter le match (nouveau message `peerLeft`), réapparition loin des ennemis.
  - **Quiz** : arrêt au nombre max de questions, « Question 3/10 » sur 08 et 09.
  - **Écrans 07, 10, 11, 12, 14** : à N joueurs (voir V-041). À 2 joueurs, l'affichage ne change pas.
- **Fichiers touchés** :
  - créé : `tests/rooms.test.ts` ;
  - config : `config/quiz.json`, `config/modes.json`, `config/arenas.json` ;
  - logique : `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/core/match/settings.ts`, `src/core/match/room.ts`, `src/core/match/protocol.ts`, `src/core/match/quizView.ts`, `src/core/quiz/quizSession.ts` ;
  - rendu et interface : `src/render/arena.ts`, `src/render/combatScene.ts`, `src/ui/app.ts`, `src/ui/theme.css`, `src/ui/styles.css` ;
  - écrans : `src/ui/screens/` 06, 07, 08, 09, 10, 11, 12, 14.
- **Tests** : `npx vitest run` : 168 tests, tous verts (12 nouveaux). `npx tsc --noEmit` et `npm run build` : OK.
- **Vérifié dans le navigateur** :
  - 06 en Chrono puis en Personnalisé, 4 joueurs max ;
  - 07 avec 4 places de couleurs différentes, puis 3 joueurs dans 3 onglets ;
  - départ à 3 prêts, quiz, puis combat. Le 3e joueur apparaît sur une nouvelle apparition, les positions des 2 adversaires arrivent, et chaque étiquette a sa couleur. Aucune erreur dans la console.

  **Pas vu à l'écran** : la transition (10) et le classement (14) à 3 joueurs. Les éliminations et la fin de manche à 3 sont couvertes par les tests, pas jouées à la main.
- **Comment tester** :
  1. `npm run dev`, Créer un salon, choisir Chrono ou Personnalisé, régler Joueurs sur 3, 4 ou 5, et essayer les durées et le nombre de questions.
  2. Ouvrir l'adresse dans 2 à 4 autres onglets ou PC, rejoindre avec le code, tout le monde prêt.
  3. Avec « Questions max » réglé, le quiz s'arrête à la dernière question.
  4. En combat, éliminer les autres : la manche continue tant qu'il reste 2 joueurs en lice.
- **Points à valider ouverts** : V-039, V-040, V-041 (provisoires), V-042 (en attente) ; V-033 à V-038 et les précédents.
- **Après le lot (accord donné en chat : « Oui, mets-les à jour »)** : V-042 appliqué. Le statut reste à poser par l'utilisateur.
  - CLAUDE.md : boucle d'un match (combat de 2 à 5 joueurs, de 1 à 5 min), budget de temps (nombre max de questions), modes, nouvelle ligne « Salon », réseau local (« les autres joueurs »).
  - ECRANS.md : 06 (joueurs, durées par 30 s, questions max, réglages du Personnalisé), 07 (une place par joueur, départ dès 2 prêts), 10, 11, 14 (une forme par joueur, classement, Agressivité moyenne).
- **Suite (demande en chat : combat infini si les vies sont limitées)** : V-043. Durée « Sans limite » proposée seulement avec des vies limitées, refusée par le serveur sinon, « ∞ » sur le chrono du HUD. Fichiers : `config/modes.json`, `src/core/config/schemas.ts`, `src/core/match/settings.ts`, `src/core/match/room.ts`, `src/core/match/protocol.ts`, `src/ui/screens/06-create-room.ts`, `src/ui/screens/11-combat.ts`, `tests/rooms.test.ts`. `npx vitest run` : 170 tests, tous verts. Vérifié dans 06 : « Sans limite » en Duel et en Personnalisé avec 1 vie, absent en Chrono, et la durée revient à 3:00 quand on passe les vies à ∞.
- **Reste à faire** : arène plus grande pour 5 si « Cubes » est trop serrée ; le deck par joueur (V-033) reste à faire.

### Lot 8 · Sons · 2026-11-22
- **Prompt** : « Tu peux faire les sons ? »
- **Plan** :
  1. Sons synthétisés en direct avec la Web Audio API du navigateur : aucune dépendance, aucun fichier audio à télécharger ou à licencier. Style doux et rond, accordé à la DA pastel (sinus et triangle, attaques courtes, pas de son agressif).
  2. Un catalogue `config/sounds.json` (id → recette : couches, forme d'onde, fréquences, durée, volume), validé par zod. Le code ne joue que des ids, comme pour les modèles 3D : une recette pourra plus tard être remplacée par un fichier.
  3. Branchements :
     - interface : clic, retour ;
     - quiz : cartes qui arrivent, quitte ou double, choix d'une carte, bonne ou mauvaise réponse, temps écoulé, malus, tic des 5 dernières secondes, anneau de fin ;
     - transition : 3, 2, 1, partez ;
     - combat : un tir par arme, chargeur vide, rechargement, changement d'arme, touche, tête, élimination, dégâts reçus, mort, tirs de l'adversaire ;
     - résultats : victoire ou défaite.
  4. Paramètres (05) : un volume général, gardé dans le navigateur.
  5. Tests Vitest du catalogue et du calcul des volumes, vérification, clôture.
- **Fait** :
  - **Moteur** : `src/ui/sound.ts` (Web Audio). Le calcul pur des volumes, décalages et hauteurs est dans `src/ui/soundPlan.ts`, testé sans navigateur. Le moteur s'active au premier clic ou à la première touche (règle des navigateurs). Un compresseur en sortie évite la saturation quand plusieurs sons se superposent, et un écart minimal évite le crépitement des touches en rafale.
  - **Catalogue** : 35 sons dans `config/sounds.json`, validés au chargement (onde sans fréquence refusée, repli `shot.default` obligatoire).
  - **Branchés** :
    - interface : clic sur tout bouton, son « retour » pour le bouton retour (un seul écouteur pour tous les écrans) ;
    - 08 : cartes qui arrivent, scintillement du quitte ou double, choix d'une carte ;
    - 09 : bonne réponse, mauvaise, temps écoulé, malus, tic sur les 5 dernières secondes, tic de l'anneau de fin ;
    - 10 : 3, 2, 1, puis partez ;
    - 11 : tir propre à chaque arme (7 armes), chargeur vide, rechargement et fin de rechargement, changement d'arme, touche, tête, élimination, dégâts reçus, mort, tirs de l'adversaire ;
    - 14 : victoire ou défaite.
  - **Paramètres (05)** : nouvelle carte « Audio » avec un curseur Volume, qui joue un petit son témoin quand on le bouge.
- **Fichiers touchés** :
  - créés : `config/sounds.json`, `src/ui/sound.ts`, `src/ui/soundPlan.ts`, `tests/sounds.test.ts` ;
  - modifiés : `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/loadContent.ts`, `server/attach.ts`, `tests/helpers.ts`, `src/ui/app.ts`, `src/ui/store.ts` ;
  - écrans : `src/ui/screens/` 05, 08, 09, 10, 11, 14.
- **Tests** : `npx vitest run` : 156 tests, tous verts (8 nouveaux). `npx tsc --noEmit` et `npm run build` : OK.
- **Vérifié dans le navigateur** : le moteur démarre (état « running ») et les bons sons partent aux bons moments :
  - clic et retour ;
  - cartes, choix et réponse en solo ;
  - tir, tête, rechargement et fin de rechargement au stand de tir.
  
  **Pas écouté** : le panneau automatisé n'a pas de sortie son. Le rendu réel (timbre, volume, équilibre entre les sons) est à juger à l'oreille.
- **Comment tester** :
  1. `npm run dev`, cliquer dans l'accueil, puis jouer un entraînement solo : cartes, choix, réponses, tic des 5 dernières secondes, anneau de fin.
  2. Console : `__reviz.stand()` pour le stand de tir, puis tirer, recharger (R) et viser une cible.
  3. Paramètres : bouger le curseur Volume (0 % coupe tout).
  4. À deux onglets : tirs de l'adversaire, dégâts reçus, élimination, compte à rebours 3-2-1 et victoire ou défaite.
- **Points à valider ouverts** : V-038 (nouveau) ; V-033 à V-037 et les précédents.
- **Reste à faire** : régler les recettes à l'oreille selon tes retours (il suffit de modifier `config/sounds.json`, sans toucher au code) ; musique éventuelle (V-038).

### Lot 7 · Refonte des interfaces selon les maquettes · 2026-11-22
- **Prompt** : refaire les écrans du MVP pour qu'ils correspondent aux maquettes de `docs/maquettes/`, sans toucher à la logique du jeu, en gardant `theme.css`. Priorités : boutons rectangulaires, 08 et 09, 02 façon CoD, 06 et 07, 14 avec l'hexagone (formules dans `config/stats.json`), puis le reste.
- **Constats au départ** :
  - `MVP.md` est absent du projet : je m'appuie sur CLAUDE.md, ECRANS.md et VALIDATION.md.
  - Les maquettes étaient dans `maquettes-reviz-arena.zip` : extraites dans `docs/maquettes/` (emplacement prévu par CLAUDE.md). Le zip est gardé.
  - `config/stats.json` n'existe pas encore : à créer pour l'écran 14.
- **Plan** :
  1. Un composant bouton unique (rectangle, rayon ≈ 10 px, icône + libellé ; variantes principale, secondaire, discrète) qui remplace les boutons ronds sur tous les écrans. Décor de fond aligné sur les maquettes (anneau, carré).
  2. 08 Choix de carte et 09 Question : cartes à motif, pastille et points de rareté ; réponses en grille 2 × 2 à coins de 14 px ; retour en encadré ; bouton « Continuer · ou Entrée ».
  3. 02 Loadout : fiche de l'arme à gauche (stats en barres), aperçu 3D au centre, bonus d'arme possibles et bouton Équiper à droite, bandeau d'armes défilant en bas avec emplacements « Bientôt ».
  4. 06 Créer un salon (formulaire en lignes à gauche, panneau de création à droite) et 07 Lobby (code en grand, deux fiches joueurs, Quitter / Je suis prêt).
  5. 14 Résultats : hexagone SVG des deux joueurs et tableau des valeurs. Calcul en TypeScript pur dans `src/core/`, formules et bornes dans `config/stats.json`, tests Vitest. Le serveur ajoute ces valeurs au résultat de fin de match (donnée en plus, aucune règle changée).
  6. Les autres écrans (01, 04, 05, 10, 13, HUD 11), puis tests, build, comparaison aux captures et clôture.
  Ce que les maquettes demandent et que la logique actuelle ne fait pas (deck par joueur dans le lobby, nombre de questions par difficulté…) : point à valider, pas codé.
- **Fait** :
  - **Boutons** : un composant unique (`button()` dans `components.ts`) : rectangle à coins de 10 px, icône et libellé, en variantes principale, secondaire et discrète. Il n'y a plus aucun bouton rond. S'y ajoutent :
    - un bouton retour ;
    - un interrupteur on/off ;
    - des boutons groupés (segments) ;
    - un sélecteur « − valeur + ».
  - **Fond** : anneau et carré incliné comme sur les captures.
  - **08 Choix de carte** :
    - cartes plus compactes, pictogramme du bonus en filigrane, rareté en haut à droite ;
    - « Niv. 3 · 45 s » et 5 points de niveau ;
    - infos de partie en haut à gauche, colonne de bonus plus fine ;
    - sous-titre du quitte ou double reformulé.
  - **09 Question** :
    - pastille de la carte (bonus · niveau · rareté) et anneau de temps ;
    - réponses en grille 2 × 2 à coins de 14 px, coche sur la bonne ;
    - retour en encadré, puis bouton « Continuer · ou Entrée » (l'anneau 5 → 0 du lot 6 le remplace sur le dernier retour).
  - **02 Loadout façon CoD** :
    - à gauche, la fiche de l'arme : type, nom, description, 5 stats en barres, ≈ dégâts par seconde ;
    - au centre, l'aperçu 3D sur un disque pastel ;
    - à droite, les bonus d'arme possibles (lus dans `bonuses.json`) et le bouton Équiper ;
    - en bas, un bandeau défilant avec flèches, badge « Équipée » et emplacements « Bientôt ».
  - **06 Créer un salon** :
    - formulaire en lignes : deck, mode, quiz, cartes, combat, règles avec interrupteurs ;
    - à droite, panneau « Code du salon » avec le résumé, puis « Créer le salon ».
  - **07 Lobby** :
    - « Salon privé · Duel », code en grand avec Copier, résumé des réglages ;
    - deux fiches joueurs : nom, Prêt / Pas prêt, silhouette d'arme, deck ;
    - boutons Quitter et Je suis prêt.
  - **14 Résultats** :
    - titre et score des manches, puis l'hexagone SVG des deux joueurs (formes superposées aux couleurs des joueurs) et le tableau des valeurs, la meilleure en gras ;
    - en solo, un seul joueur et « — » pour les axes de combat ;
    - boutons Rejouer, Revoir le récap, Accueil.
  - **Calcul des axes** : en TypeScript pur (`src/core/match/matchStats.ts`), avec formules et bornes dans `config/stats.json`. Le serveur ajoute ces valeurs au résultat de fin de match.
  - **Autres écrans** :
    - 01 : titre et accroche ; pseudo et arme ; trois cartes d'action (Créer, Rejoindre avec le code, Entraînement solo) ; menu discret Loadout · Decks · Paramètres ;
    - 04 : en-tête « Mes decks », lignes cliquables (répartition des difficultés, badge Valide ou Choisi), zone d'import en pointillés, erreurs dans un encadré rouge avec le nom du fichier ;
    - 05 : cartes « Contrôles » (curseur) et « Accessibilité » (interrupteur) ;
    - 10 : fiches à la couleur des joueurs (nom, score du quiz, arme, bonus), compte à rebours et « Le combat commence » ;
    - 13 : anneau de score plus petit, deck et série, section « Bonus gagnés », « Questions ratées », bouton « Voir les résultats · ou Entrée » ;
    - 11 : bouton Jouer rectangulaire ; le reste du HUD était déjà conforme.
  - **Vérifié dans le navigateur**, en 1280 × 720 :
    - 01, 02, 04, 05, 06, 07, 08, 09 et 13 en jeu réel ;
    - 10 et 14 avec des données d'exemple (14 aussi en vrai, en solo) ;
    - 11 par le stand de tir.
- **Fichiers touchés** :
  - créés : `config/stats.json`, `src/core/match/matchStats.ts`, `tests/matchStats.test.ts`, `docs/maquettes/` (extrait du zip) ;
  - logique et config : `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/core/match/protocol.ts`, `src/core/match/room.ts` (cumul des dégâts et des PV adverses, axes en fin de match), `src/loadContent.ts`, `server/attach.ts`, `tests/helpers.ts` ;
  - interface : `src/ui/components.ts`, `icons.ts`, `format.ts`, `styles.css`, `app.ts` ;
  - écrans : `src/ui/screens/` 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, 13, 14 ;
  - `VALIDATION.md`.
- **Tests** : `npx vitest run` : 148 tests, tous verts (8 nouveaux sur l'hexagone et `stats.json`). `npx tsc --noEmit` et `npm run build` : OK.
- **Comment tester** :
  1. `npm run dev`, puis regarder chaque écran à côté de sa capture dans `docs/maquettes/`.
  2. Entraînement solo jusqu'au bout pour voir 08, 09, 13 puis 14 et son hexagone à un joueur. Pour aller plus vite : `__reviz.skip(400)` dans la console avant de répondre.
  3. Loadout : cliquer une arme du bandeau la montre, « Équiper » l'équipe, et le badge « Équipée » se déplace.
  4. Deux onglets : Créer un salon (06), rejoindre avec le code (07), jouer un match jusqu'à 14 pour voir les deux formes superposées.
- **Écarts restants avec les maquettes** :
  - 07 : pas de choix de deck par joueur ni de grille des niveaux (V-033).
  - 06 : pas de nombre de questions par difficulté, pas de QR code ; le code n'apparaît qu'après la création (V-034).
  - 05 : le pseudo n'est pas dans Paramètres.
  - 13 : pas de ligne Éliminations / Précision / Dégâts (ces stats sont sur 14).
  - Police différente des captures (V-013) et trame de points gardée sur le fond (V-036).
  - Les codes de salon font 4 lettres, contre 6 caractères sur les captures.
  - Pas vérifié à l'œil : les animations (entrée des cartes, fondus), car le panneau navigateur était masqué, donc animations en pause. Pas de vrai match à deux joueurs jusqu'à 14 non plus : vérifié avec des données d'exemple.
- **Points à valider ouverts** : V-033 (en attente), V-034 à V-037 (provisoires) ; toujours V-030 à V-032, V-026 et ceux des lots précédents.
- **Reste à faire** : le deck par joueur (V-033) si tu le valides, et un passage sur petits écrans (moins de 1100 px de large : loadout et création de salon sont pensés pour un PC).

### Lot 6 · Interfaces plus pro · 2026-11-22
- **Prompt** : refaire les icônes d'armes de l'UI, transitions douces entre les écrans, et après la dernière carte un compte à rebours de 5 à 0 au lieu de « attente puis bouton ».
- **Plan** :
  1. Icônes d'armes : 4 silhouettes de profil, détaillées, en deux tons (format large), utilisées partout où une arme apparaît (01, 02, 07, 10, HUD 11, 14).
  2. Transitions : le routeur fait un fondu enchaîné court entre l'ancien et le nouvel écran (coupé par « réduire les animations » et par l'option d'accessibilité).
  3. Fin du quiz : quand il ne reste plus de quoi jouer une carte, le retour de la dernière question affiche un anneau 5 → 0 qui enchaîne seul (Entrée ou clic pour passer). La règle vit dans la logique pure du quiz (solo et serveur), la durée dans `config/quiz.json`. En salon, si l'adversaire joue encore, un bandeau « En attente de l'adversaire » remplace l'écran figé.
  4. Tests Vitest de la nouvelle règle, vérification dans le navigateur, clôture.
- **Fait** :
  - **Icônes d'armes** : 7 silhouettes en deux tons (pistolet, fusil d'assaut, fusil à pompe, sniper, lance-bulles, rayon, arbalète), plus une silhouette par défaut pour une arme inconnue. Elles sont utilisées sur :
    - 01 : bouton de l'arme équipée ;
    - 02 : boutons de choix ;
    - 07 : cartes des joueurs ;
    - 10 : grande icône à la couleur du joueur ;
    - 11 : HUD des munitions, qui suit l'arme active.
  - **Transitions** : le routeur fait un fondu enchaîné entre deux écrans. L'écran sortant est libéré tout de suite (3D, souris, écouteurs), il ne fait plus que s'effacer.
  - **Fin du quiz** : sur le dernier retour, anneau 5 → 0 « Fin du quiz » qui enchaîne seul. Règle dans `QuizSession`, donc la même en solo et sur le serveur. En salon, bandeau « En attente de l'adversaire » au lieu d'un écran figé.
  - **Vérifié dans le navigateur** :
    - solo : l'anneau décompte puis le récap s'ouvre seul ;
    - deux onglets : bandeau d'attente chez le joueur qui a fini, anneau 5 → 0 chez l'autre, puis transition 10 avec les silhouettes, puis combat avec l'icône au HUD ;
    - fondus : l'ancien et le nouvel écran se superposent, puis l'ancien disparaît.
- **Fichiers touchés** :
  - `config/quiz.json`, `src/core/config/schemas.ts`, `src/core/quiz/quizSession.ts`, `src/core/match/quizView.ts`, `src/core/match/room.ts` ;
  - `src/ui/` : `icons.ts`, `router.ts`, `components.ts`, `app.ts`, `styles.css` ;
  - `src/ui/screens/` : `01-home.ts`, `02-loadout.ts`, `07-lobby.ts`, `08-card-choice.ts`, `09-question.ts`, `10-transition.ts`, `11-combat.ts` ;
  - `tests/quizSession.test.ts`, `VALIDATION.md`.
- **Tests** : `npx vitest run` : 140 tests, tous verts (5 nouveaux sur la fin du quiz). `npx tsc --noEmit` et `npm run build` : OK.
- **Comment tester** :
  1. `npm run dev`, puis Entraînement solo. Pour ne pas attendre : dans la console, `__reviz.skip(31)` avant de répondre. L'anneau 5 → 0 apparaît, puis le récap s'ouvre seul.
  2. En salon : un joueur laisse filer le temps sur 08, l'autre prend une carte vers 0:40. Le premier voit le bandeau d'attente, le second l'anneau, puis les deux passent en transition.
  3. Naviguer entre l'accueil, le loadout et les decks pour voir les fondus.
- **Points à valider ouverts** : V-030, V-031, V-032 (nouveaux) ; V-026 toujours en attente ; les points provisoires des lots précédents.
- **Reste à faire** :
  - Le panneau navigateur automatisé était masqué (animations en pause) : le rendu des fondus en vrai est à juger à l'œil.
  - Les autres icônes (bonus, menus) gardent leur style au trait. À harmoniser si tu veux aller plus loin.

### Lot 5 · MVP complet selon ECRANS.md · 2026-11-21
- **Prompt** : 4 retours sur le combat :
  - arme pas centrée en visant ;
  - mouvements plus dynamiques, plus rapides de base, mouvements de tête ;
  - chiffres de dégâts ;
  - éclairage au flash du canon.

  Puis « on commence à suivre le GDD et ECRANS.md, construction totale du MVP ».
- **Plan** :
  1. Retours combat :
     - visée alignée sur le guidon (point de visée par arme dans `assets.json`) ;
     - vitesse de base plus haute ;
     - balancement de tête, inclinaison en pas latéral, à-coup à l'atterrissage (coupés par l'option d'accessibilité) ;
     - chiffres de dégâts au point d'impact ;
     - lumière au flash du canon.
  2. Écrans de ECRANS.md marqués pour le proto : 01, 02, 04, 05, 06, 07, 08 à 14. Un module par écran (`src/ui/screens/NN-nom.ts`), un seul routeur qui n'autorise que les liens de ECRANS.md. L'armurerie devient 02 Loadout, l'entraînement solo devient quiz → 13 → 14 sans combat.
  3. Logique pure du match dans `src/core/match/` :
     - réglages du salon ;
     - salon et code ;
     - quiz par joueur avec mêmes questions ;
     - transition ;
     - combat en duel avec PV, bouclier et vies ;
     - manches (Duel, Best of 3, Chrono, Personnalisé) ;
     - récap et résultats.

     Tests Vitest.
  4. Serveur autoritaire Node + `ws`, branché sur le serveur de Vite : `npm run dev` lance tout, et `--host` ouvre le jeu au réseau local. Le serveur tire les questions, valide les réponses, calcule les dégâts et les PV. Chaque client simule son propre déplacement.
  5. Arène de duel symétrique avec 2 points d'apparition, adversaire visible (corps + arme), interpolation.
  6. Vérification avec deux onglets, clôture.
- **Fait** :
  - **Retours combat** :
    - en visant, le guidon se place pile sous le réticule (point `sight` par arme dans `assets.json`) ;
    - vitesse 8 m/s ;
    - mouvements de tête : balancement, inclinaison en pas latéral, à-coup à l'atterrissage, champ de vision élargi pendant le dash ;
    - chiffres de dégâts qui sautent au point d'impact (violets à la tête) ;
    - lumière ponctuelle au flash du canon, aussi pour les tirs adverses.

    Les effets de mouvement et de lumière sont coupés par l'option d'accessibilité.
  - **Écrans de ECRANS.md marqués pour le proto**, un module chacun, un seul routeur limité aux liens du document :
    - 01 Accueil, 02 Loadout, 04 Decks (liste + import JSON avec erreurs), 05 Paramètres, 06 Créer un salon, 07 Lobby ;
    - 08 et 09 Quiz, 10 Transition, 11 Combat, 12 Fin de manche, 13 Récap (avec « Signaler »), 14 Résultats.
  - **Multijoueur** :
    - salon privé par code (4 lettres) ;
    - quiz tiré et validé par le serveur, mêmes questions pour les deux, sans doublon d'une manche à l'autre ;
    - duel en réseau : adversaire visible avec son arme et une étiquette (seulement s'il est en vue), PV, bouclier, morts, réapparitions, fil des éliminations ;
    - modes Duel, Best of 3, Chrono, Personnalisé ;
    - abandon ;
    - rejouer dans le même salon.
  - **Vérifié avec deux onglets** :
    - création, puis entrée par code, puis Prêt / Prêt ;
    - mêmes cartes et même question des deux côtés ;
    - transition 3-2-1 ;
    - duel : 5 tirs de pistolet tuent ;
    - récap, résultats « Victoire » et « Défaite » ;
    - Rejouer ;
    - fermeture d'un onglet en plein combat : « Victoire par abandon ».
  - **Bugs trouvés et corrigés** :
    - relais de position qui gardait le mauvais type de message ;
    - partie bloquée sur 08 quand le budget s'épuise (→ V-026) ;
    - étiquette de l'ennemi visible à travers les murs ;
    - entraînement solo redessiné seulement à l'image suivante.
- **Fichiers touchés** :
  - Créés :
    - `server/attach.ts` ;
    - `src/core/match/` : `settings.ts`, `protocol.ts`, `quizView.ts`, `room.ts`, `matchServer.ts` ;
    - `src/core/combat/damage.ts`, `src/net/connection.ts` ;
    - `src/ui/` : `router.ts`, `store.ts`, `quizPort.ts` ;
    - `src/ui/screens/` : `01-home.ts`, `04-decks.ts`, `05-settings.ts`, `06-create-room.ts`, `07-lobby.ts`, `08-card-choice.ts`, `09-question.ts`, `10-transition.ts`, `12-round-end.ts`, `13-recap.ts`, `14-results.ts` ;
    - `tests/match.test.ts`, `tests/router.test.ts`.
  - Renommés : `armory.ts` → `02-loadout.ts`, `combat.ts` → `11-combat.ts`.
  - Supprimés : `home.ts`, `cardChoice.ts`, `question.ts`, `recap.ts` (V-028).
  - Modifiés :
    - `config/` : `arenas.json`, `modes.json`, `player.json`, `assets.json` ;
    - `src/core/` : `config/schemas.ts`, `config/gameConfig.ts`, `combat/combatSession.ts`, `quiz/quizSession.ts`, `quiz/questionPool.ts` ;
    - `src/render/` : `combatScene.ts`, `viewmodel.ts`, `assets.ts`, `arena.ts`, `armoryScene.ts` ;
    - `src/ui/` : `app.ts`, `screen.ts`, `theme.css`, `styles.css`, et `src/main.ts` ;
    - `vite.config.ts`, `tsconfig.json`, `package.json`, `VALIDATION.md`.
- **Tests** : `npx vitest run` : 135 tests, tous verts (10 fichiers, dont 14 pour le match et 4 pour le routeur). `npx tsc --noEmit` et `npm run build` : OK.
- **Comment tester** :
  1. `npm run dev`. Pour jouer à deux sur le même réseau : `npm run dev -- --host`, puis l'autre PC ouvre l'adresse « Network » affichée.
  2. Joueur 1 : Accueil → bouton rond « Créer un salon » → réglages → Créer. Le code s'affiche dans le lobby.
  3. Joueur 2 : tape le code sur l'accueil → flèche. Les deux cliquent Prêt.
  4. Quiz (08/09) → transition (10) → combat (11) : clic pour capturer la souris → fin → récap (13) → résultats (14) → Rejouer.
  5. Seul : deux fenêtres de navigateur côte à côte. Deux onglets partagent le même pseudo ; change-le dans l'une des fenêtres.
  6. Stand de tir (outil de dev) : console du navigateur → `__reviz.stand()`.
- **Points à valider ouverts** : V-024 à V-029 (nouveaux), V-026 en attente ; plus ceux des lots précédents, et toujours V-001 (git).
- **Reste à faire** :
  - Test à la vraie souris et en réseau local entre deux PC (pas faisable dans le navigateur automatisé).
  - Lissage du mouvement de l'adversaire plus fin si la latence se voit.
  - Serveur Node autonome pour la mise en ligne.
  - Pièces, niveau, XP, perso, skins (V-027) ; écran Cours (03) et Admin (15), marqués « plus tard ».
  - Sons ; modèles voxel des armes spéciales et des personnages.
  - Vite signale des imports sans extension dans la config (avertissement sans effet aujourd'hui).

### Lot 4 · Se déplacer et tirer · 2026-11-21
- **Prompt** : « Go lot 4 » (proposé au lot 3 : déplacement, tir, cibles, HUD, bonus appliqués, option réduire flashs et secousses).
- **Plan** :
  1. Config : corps et déplacement du joueur (`player.json`), rechargement, recul, dispersion, portée, perte de dégâts, zoom par arme (`weapons.json`), arène d'entraînement en blocs et cibles (nouveau `config/arenas.json`), mode « Entraînement » (`modes.json`), point de bouche du canon (`assets.json`). Tout validé par zod.
  2. Logique pure dans `src/core/combat/` : cumul des effets des bonus/malus (avec durées), déplacement avec collisions (sol, blocs, murs, saut, sauts en plus, dash), état de l'arme (cadence, chargeur, rechargement, recul croissant), lancer de rayon et dégâts (tête, distance, zone), session de combat (cibles qui meurent et réapparaissent, chrono, score). Tests Vitest.
  3. Rendu Three.js : arène depuis la config (partagée avec l'armurerie), cibles, arme en main animée (recul, rechargement), flash, traçantes, éclats de voxels, laser si bonus, secousses (coupées par l'option).
  4. Écran de combat : souris capturée, ZQSD (touches physiques, marche aussi en QWERTY), Espace, clic, clic droit (viser), R, Maj (dash si bonus), 1/2 (arme spéciale si gagnée). HUD de la DA : chrono et score en haut, PV en bas à gauche, munitions en bas à droite. Pause avec Échap, option « Réduire flashs et secousses ».
  5. Enchaînement quiz → combat (bonus gagnés appliqués) → récap (questions ratées + résultats du combat). Bouton « Entraînement » sur l'accueil pour tester le combat sans quiz.
  6. Vérification navigateur, clôture.
- **Fait** :
  - Logique de combat pure dans `src/core/combat/` :
    - déplacement avec collisions (sol, blocs, murs), saut, sauts en plus, dash ;
    - cadence, chargeur, rechargement, recul croissant, dispersion, plombs ;
    - perte de dégâts avec la distance, tir à la tête, dégâts de zone ;
    - cibles qui meurent et réapparaissent, chrono, score, précision.
  - Bonus et malus du quiz appliqués en combat : dégâts, chargeur, bouclier, PV, vitesse, saut, dash, recul, zoom, laser, arme spéciale en 2e emplacement, effets à durée limitée.
  - Rendu : arène depuis la config, cibles avec un cercle sur le torse, arme voxel en main (recul, rechargement, balancement, visée recentrée), flash, traçantes, éclats de voxels, laser, lunette du sniper.
  - HUD de la DA : chrono et cibles abattues en haut, PV et bouclier en bas à gauche, munitions en bas à droite, viseur qui s'écarte, marque de touche (tête / kill en couleur).
  - Écran de départ / pause : bonus gagnés, commandes, option d'accessibilité, « Terminer le combat ».
  - Partie complète : quiz → combat avec les bonus → récap (score du quiz, résultats du combat, questions ratées). Bouton « Entraînement » sur l'accueil.
  - Corrigé en route : un saut à la toute première image était ignoré ; Three.js ne connaît plus `PCFSoftShadowMap`.
- **Fichiers touchés** :
  - Créés :
    - `config/arenas.json` ;
    - `src/core/combat/` : `geometry.ts`, `stats.ts`, `movement.ts`, `weaponState.ts`, `combatSession.ts` ;
    - `src/render/` : `arena.ts`, `combatScene.ts`, `viewmodel.ts` ;
    - `src/ui/screens/combat.ts`, `src/ui/settings.ts`, `tests/combat.test.ts`.
  - Modifiés :
    - `config/` : `player.json`, `weapons.json`, `modes.json`, `assets.json` ;
    - `src/core/config/` : `schemas.ts`, `gameConfig.ts`, et `src/loadContent.ts` ;
    - `src/render/` : `assets.ts`, `armoryScene.ts` ;
    - `src/ui/` : `app.ts`, `screen.ts`, `screens/home.ts`, `screens/recap.ts`, `screens/armory.ts`, `theme.css`, `styles.css` ;
    - `tests/helpers.ts`, `VALIDATION.md`.
- **Tests** : `npx vitest run` : 117 tests, tous verts (8 fichiers, dont 26 pour le combat). `npx tsc --noEmit` et `npm run build` : OK.
- **Vérifié dans le navigateur** :
  - pistolet : 5 tirs au corps pour abattre une cible, réapparition, HUD à jour ;
  - déplacement, saut, visée ;
  - fin du chrono et récap ;
  - enchaînement quiz → combat avec un bonus appliqué → récap.
  - La capture de la souris est refusée dans le navigateur automatisé, donc ces essais sont passés par l'outil de développement `__revizCombat`. **À tester à la vraie souris de ton côté.**
- **Comment tester** :
  1. `npm run dev` puis, sur l'accueil, « Entraînement » (ou une partie complète avec le bouton Jouer).
  2. Clic sur le bouton rond pour capturer la souris.
  3. Commandes : ZQSD, Espace, clic gauche, clic droit (viser, lunette au sniper), R, Maj (dash, seulement avec le bonus), 1/2 (arme spéciale, si gagnée).
  4. Échap met en pause.
- **Points à valider ouverts** : V-019 à V-023 (nouveaux), plus ceux des lots précédents.
- **Reste à faire** :
  - Lot 5 : bot adversaire qui se déplace et tire, PV du joueur qui baissent (bouclier, casque, armure et régénération déjà calculés), duel de 1 à 3 min, fin de partie.
  - Modèles voxel des armes spéciales (encore des formes de base).
  - Sons.
  - Le JavaScript fait 753 kB : charger la 3D à la demande.

### Lot 3 · Durée du quiz réglable · 2026-11-21
- **Prompt** : « descendre le timer à 1 minute ou commencer les settings pour pouvoir modifier ça » + quelle est la prochaine étape.
- **Plan** :
  1. `config/quiz.json` : durée par défaut 1:00 (demandé en chat) et liste des durées proposées (1:00, 3:00, 5:00), validées au chargement (chaque durée doit laisser jouer au moins une Commune).
  2. La session de quiz accepte une durée choisie (sinon celle de la config).
  3. Accueil : trois boutons de durée, à côté du choix d'arme. Pas d'écran de réglages complet (options complexes = plus tard).
  4. Tests, vérification navigateur, clôture.
- **Fait** :
  - Durée par défaut 1:00, comme demandé en chat (le brief disait 5:00). L'accueil propose 1:00 · 3:00 · 5:00 et le choix est gardé jusqu'au rechargement de la page.
  - La config refuse une durée par défaut absente de la liste, ou une durée trop courte pour une Commune.
  - À savoir en 1:00 : la phase s'arrête dès qu'il reste moins de 30 s (plus de place pour une Commune), soit 3 à 6 questions si on répond vite. Aucune Légendaire ne sort (75 s > 1:00), le quitte ou double ne propose donc que des Rares et des Épiques.
- **Fichiers touchés** :
  - `config/quiz.json` ;
  - `src/core/config/schemas.ts`, `src/core/config/gameConfig.ts`, `src/core/quiz/quizSession.ts` ;
  - `src/ui/app.ts`, `src/ui/screens/home.ts`, `src/ui/icons.ts` ;
  - `tests/config.test.ts`, `tests/quizSession.test.ts`, `VALIDATION.md`.
- **Tests** : `npx vitest run` : 91 tests, tous verts. `npx tsc --noEmit` et `npm run build` : OK. Partie en 1:00 jouée dans le navigateur jusqu'au récap.
- **Comment tester** : `npm run dev`, choisir la durée sur l'accueil, jouer.
- **Points à valider ouverts** : inchangés. La ligne « 5:00 par défaut » de CLAUDE.md est à mettre à jour avec V-011.
- **Reste à faire** : un vrai écran de réglages plus tard, et le combat (prochain lot proposé).

### Lot 2 · Armes en voxel détaillées · 2026-11-21
- **Prompt** : après la discussion sur la 3D (V-015), l'utilisateur montre une planche de 15 armes voxel grises et détaillées : « il faut que ce soit assez détaillé comme ça. Et sinon go ! ». Je lis « go » comme le feu vert pour commencer la 3D par les armes, comme proposé.
- **Plan** :
  1. Lecture et écriture du format `.vox` (MagicaVoxel) en TypeScript pur + mailleur voxel (faces cachées retirées, occlusion ambiante par sommet). Tests Vitest.
  2. Script de génération `scripts/voxels/` : petit langage (profils de côté extrudés, cylindres, perçages) qui écrit les 4 armes du loadout dans `assets/models/weapons/*.vox`, avec un niveau de détail proche de la référence (30 à 80 voxels de long). Les `.vox` restent modifiables dans MagicaVoxel.
  3. Type `voxel` dans `config/assets.json` (chemin, échelle, rotation, prise en main, couleurs lumineuses), validé par zod.
  4. Écran « Armurerie » en Three.js, ouvert depuis l'accueil : l'arme tourne sur un socle, changement d'arme au clavier, bascule en vue à la première personne dans une petite arène en blocs. Pas encore de déplacement ni de tir.
  5. Itérer le détail des armes sur captures, puis tests, vérification navigateur, clôture.
- **Fait** :
  - Retour appliqué : niveau de détail proche de ta planche (voxels fins, pas « gros grains » comme proposé en V-015, qui reste à trancher).
  - Format `.vox` MagicaVoxel lu et écrit en TypeScript pur, mailleur avec occlusion ambiante et pièces lumineuses à part.
  - Générateur `npm run voxels` : profils de côté extrudés, cylindres, gravures, peinture de surface. 4 armes de 35 à 90 voxels de long et 2 100 à 4 200 voxels chacune :
    - Pistolet : poignée quadrillée, culasse striée, fenêtre d'éjection, guidon lumineux ;
    - Fusil d'assaut : crosse ajourée, rails, garde-main ventilé, poignée avant, chargeur courbe à fenêtre lumineuse, frein de bouche ;
    - Fusil à pompe : crosse à panneau creusé, cartouches lumineuses sur le flanc, pompe striée, bande ventilée, guidon lumineux ;
    - Sniper : crosse à trou de pouce, lunette à objectif lumineux, canon cannelé avec bague lumineuse, bipied replié.
  - Écran Armurerie (rotation + vue à la première personne), vérifié dans le navigateur, sans erreur console. Après une itération sur capture : cadrage automatique, gris éclaircis, crosse du fusil à pompe refaite, oculaire du sniper en verre.
- **Fichiers touchés** :
  - Créés :
    - `src/core/voxel/` : `voxelModel.ts`, `mesher.ts` ;
    - `src/render/` : `assets.ts`, `armoryScene.ts` ;
    - `src/ui/screens/armory.ts` ;
    - `scripts/voxels/` : `dsl.ts`, `weapons.ts`, `build-weapons.ts` ;
    - `assets/models/weapons/` : `pistol.vox`, `assault_rifle.vox`, `shotgun.vox`, `sniper.vox` ;
    - `tests/` : `voxel.test.ts`, `weapons.test.ts`.
  - Modifiés :
    - `config/assets.json`, `src/core/config/schemas.ts` ;
    - `src/ui/` : `app.ts`, `screen.ts`, `screens/home.ts`, `icons.ts`, `theme.css`, `styles.css` ;
    - `package.json` (script `voxels`), `tsconfig.json`, `VALIDATION.md`.
  - Supprimé : `src/render/.gitkeep` (créé au lot 1).
- **Tests** : `npx vitest run` : 88 tests, tous verts (7 fichiers). Ils vérifient notamment qu'aucune arme n'a de voxel flottant et que chaque `.vox` du catalogue existe. `npx tsc --noEmit` : OK. `npm run build` : OK (les `.vox` sont copiés dans `dist/`).
- **Comment tester** :
  1. `npm run dev`, sur l'accueil cliquer « Armurerie ».
  2. Touches 1 à 4 pour changer d'arme, glisser à la souris pour tourner, V pour la vue à la première personne (la souris oriente le regard), Échap pour revenir.
  3. Modifier une arme : éditer `scripts/voxels/weapons.ts` puis `npm run voxels`, ou ouvrir le `.vox` dans MagicaVoxel (relancer le script écrase ensuite les retouches faites à la main).
- **Points à valider ouverts** : V-001, V-011 à V-015 (en attente) ; V-016 à V-018 et ceux du lot 1 (provisoires).
- **Reste à faire** :
  - Le combat lui-même : déplacement (ZQSD, saut), tir, munitions, rechargement, cibles ou adversaire, HUD.
  - Modèles voxel des 3 armes spéciales et du personnage (encore en formes de base).
  - Le bundle JS fait 708 kB à cause de Three.js : charger la 3D à la demande quand le combat arrivera.
  - Git : toujours rien de commité (V-001).

### Lot 1 · Phase quiz jouable en solo · 2026-11-19
- **Prompt** : initialiser le projet, créer les configs validées par zod, le validateur de decks et un deck TCP/IP de 30 questions, coder la logique du quiz avec tests, puis les écrans choix de carte, question et récap.
- **Plan** :
  1. Projet Vite + TypeScript + Three.js + Vitest + zod, dossiers `src/core`, `src/ui`, `src/render` (vide), `config/`, `decks/`, `assets/`, `tests/`.
  2. `config/*.json` (quiz, bonuses, weapons, player, modes, assets) + schémas zod + contrôles croisés (rareté, famille, arme, asset référencés existent).
  3. Validateur de decks extensible par type de question, messages en français (champ fautif, numéro de question) + deck `cesi-reseaux-tcp-ip` (30 questions).
  4. Logique pure dans `src/core` avec horloge injectée (pas de `Date.now()`) : RNG à graine, budget de temps, pioche de questions sans doublon, tirage des 3 cartes, combos, inventaire, session de quiz (machine à états). Tests Vitest pour chaque module.
  5. Écrans DOM + CSS (thème unique en variables CSS) : accueil minimal, choix de carte, question + retour, récap.
  6. Tests, vérification dans le navigateur, puis clôture de cette entrée.
- **Fait** :
  - Projet Vite 8 + TypeScript 7 + Three.js 0.187 (installé, pas encore utilisé) + Vitest 5 + zod 4. `npm run dev`, `npm test`, `npm run build` marchent.
  - 6 fichiers `config/*.json` validés au chargement (schémas zod stricts, messages en français) + contrôles croisés. Une config invalide affiche un écran listant les erreurs (fichier · chemin : message).
  - Validateur de decks extensible (registre des types de questions dans `src/core/deck/questionTypes.ts`), messages du type `question n°3 (id « q003 »), champ « reponse » : …`. Tout fichier de `decks/` est chargé ; un deck refusé n'empêche pas de jouer les autres.
  - Deck `cesi-reseaux-tcp-ip` : 30 questions (20 QCM, 10 vrai/faux), difficultés 1 à 5 réparties 9 / 8 / 6 / 4 / 3, une explication pour chacune.
  - Logique pure dans `src/core/quiz` (aucun accès au DOM ni à l'heure système, graine de match pour le futur serveur) : budget de temps, pioche sans doublon (mêmes questions pour la même graine), tirage des cartes, quitte ou double, combo négatif, inventaire, session (machine à états).
  - Écrans : accueil, choix de carte (titre seul puis 3 cartes qui montent, minuteur en bas, bonus à droite, touches 1-3), question (clic ou touches 1-4, minuteur de la question, retour avec explication, Entrée pour continuer), récap (score, bonus et malus, questions ratées avec ta réponse, la bonne et l'explication). Vérifiés dans le navigateur, y compris quitte ou double, malus, temps écoulé, combo négatif et largeur mobile.
- **Fichiers touchés** :
  - Créés : `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.claude/launch.json` ;
  - `config/` : `quiz.json`, `bonuses.json`, `weapons.json`, `player.json`, `modes.json`, `assets.json` ;
  - `decks/cesi-reseaux-tcp-ip.json` ; `assets/.gitkeep` ; `src/render/.gitkeep` ;
  - `src/core/` : `zod.ts`, `random.ts`, `config/schemas.ts`, `config/gameConfig.ts`, `deck/deckSchema.ts`, `deck/questionTypes.ts`, `deck/validateDeck.ts`, `quiz/timeBudget.ts`, `quiz/questionPool.ts`, `quiz/cardDraw.ts`, `quiz/combo.ts`, `quiz/inventory.ts`, `quiz/quizSession.ts` ;
  - `src/ui/` : `theme.css`, `styles.css`, `app.ts`, `clock.ts`, `components.ts`, `dom.ts`, `format.ts`, `icons.ts`, `screen.ts`, `screens/home.ts`, `screens/cardChoice.ts`, `screens/question.ts`, `screens/recap.ts`, `screens/errors.ts` ;
  - `src/main.ts`, `src/loadContent.ts` ;
  - `tests/` : `helpers.ts`, `config.test.ts`, `deck.test.ts`, `basics.test.ts`, `cardDraw.test.ts`, `quizSession.test.ts` ;
  - Modifié : `VALIDATION.md`.
- **Tests** : `npx vitest run` : 65 tests, tous verts (5 fichiers). `npx tsc --noEmit` : aucune erreur. `npm run build` : OK.
- **Comment tester** :
  1. `npm install` puis `npm run dev`, ouvrir http://localhost:5173.
  2. Choisir une arme, cliquer le bouton rond (ou Entrée).
  3. Choisir une carte (clic ou 1-3), répondre (clic ou 1-4), Entrée pour continuer.
  4. 3 bonnes réponses d'affilée : la main suivante est « Quitte ou double ».
  5. Pour voir la fin sans attendre 5 min, dans la console du navigateur : `__reviz.skip(300)` (outil de dev, absent du build).
- **Points à valider ouverts** : V-001 (en attente), V-002 à V-010 (provisoires).
- **Reste à faire** :
  - Git : rien n'est commité tant que V-001 n'est pas tranché.
  - Combat (FPS Three.js), application des effets des bonus et malus, armes spéciales en jeu.
  - Option d'accessibilité « réduire flashs et secousses » (à faire avec le combat ; l'interface respecte déjà `prefers-reduced-motion`).
  - Serveur autoritaire et salons privés (la session est déjà pure et à graine, réutilisable côté serveur).
  - Comparer les écrans avec les maquettes Figma (non consultées dans ce lot).
  - Pas de tests automatisés des écrans DOM (vérifiés à la main dans le navigateur).
