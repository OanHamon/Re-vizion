# GDD : Jeu de révision PvP

Nov 19, 2026 · @tidi998

## Vision

**Pitch** : un jeu de combat PvP en ligne où chaque bonne réponse à une question de cours te donne une arme, des munitions ou un bonus pour le combat qui suit.

**Piliers**

1. **Réviser doit servir tout de suite** : une bonne réponse a un effet visible et immédiat dans le combat.
2. **Choisir, c'est prendre un risque** : le joueur choisit ce qu'il veut gagner, et la difficulté de la question suit la valeur de la récompense.
3. **Contenu ouvert** : n'importe qui peut ajouter ses cours grâce à un skill IA qui les met au format du jeu.
4. **Apprendre de ses erreurs** : chaque question ratée est corrigée et expliquée après le combat.

**Public cible** : d'abord la promo (étudiants qui révisent entre eux). Le grand public reste une évolution prévue pour plus tard : on garde l'architecture ouverte dans ce sens.

## Boucle de jeu

&#91;embedded content: boucle de jeu · 3 phases\]

Un match enchaîne trois phases : un quiz de X tours qui construit le loadout, un combat court qui l'utilise, puis un récap qui corrige les erreurs. C'est le récap qui fait réellement réviser.

## Phase quiz : les 3 cartes

À chaque tour, trois cartes apparaissent ; le joueur en choisit une, ce qui ouvre une question liée à ce choix. Bonne réponse : il gagne la récompense. Mauvaise réponse : rien (malus à trancher). On répète X tours avant le combat.

L'arme vient du loadout ; les cartes donnent des bonus répartis en quatre familles, et **la rareté du bonus fixe la difficulté**.

| Famille de carte | Exemples de bonus |
| --- | --- |
| Attaque | Plus de dégâts, viseur laser, plus de munitions |
| Défense | Bouclier, casque |
| Mobilité | Vitesse de déplacement, saut amélioré |
| Arme | Amélioration propre à l'arme du loadout : zoom plus fort (sniper), moins de recul (fusil d'assaut), rechargement rapide (pistolet) |

**Difficulté** : elle dépend de la rareté du bonus. Bonus commun = question facile (1-2), rare = moyenne (3), très rare = difficile (4-5). Les armes légendaires viennent uniquement du combo quitte ou double.

**Variantes à tester plus tard**

- Lien par matière (Arme = maths, Munitions = anglais…) pour les sessions multi-matières.
- Carte rare « arme légendaire » avec une question niveau 5.
- Combo « quitte ou double » : après 3 bonnes réponses d'affilée, on propose 3 cartes plus rares (meilleures chances de tomber sur du rare). Mais une erreur sur ces cartes donne un gros malus à la place du bonus, par exemple munitions divisées par deux.
- Temps limité par question (champ `temps_max` du deck), réponse rapide = petit bonus.
- Une question ratée revient plus tard dans la partie ou au match suivant (répétition espacée).

## Phase combat

Le combat est un duel PvP court (cible : 1 à 3 minutes) où le joueur utilise ce qu'il a gagné pendant le quiz. Le genre est choisi : un FPS arcade cartoon.

**Genre retenu** : FPS PvP arcade, rapide et dynamique, style cartoon : tirs nerveux, grosses explosions, couleurs et mouvement partout (références d'ambiance : Splatoon, Unreal Tournament).

**Accessibilité** : prévoir une option qui réduit les flashs et les effets visuels pour les joueurs photosensibles.

**Modes de jeu** (une seule vie par combat par défaut)

| Mode | Déroulement |
| --- | --- |
| Duel | Un quiz, puis un combat en une vie |
| Best of 3 | Trois manches en une vie, un quiz avant chaque manche |
| Chrono | Temps limité avec réapparitions, le plus de kills gagne |
| Personnalisé | L'hôte règle tout : nombre de manches, vies, durée, paramètres du quiz |

**Idées à garder sous le coude**

- Coffres ou zones de capture sur la map : pour les ouvrir, on répond à une question en restant vulnérable.
- Revive : à la mort, une question difficile bien répondue ramène en jeu.
- Bonus offensifs sur l'adversaire : ralentissement, brouillard, vision réduite.

## Armes, loadout et progression

L'arme principale se choisit avant le match dans un loadout ; le quiz ajoute des améliorations, et les armes spéciales sont réservées aux cartes légendaires.

- **Style visuel** : armes sci-fi « jouet », mais archétypes reconnaissables au premier coup d'œil.
- **Loadout** : avant chaque match, le joueur choisit son arme et son équipement.
- **Équilibrage des armes** : sniper, fusil d'assaut, pistolet, etc. ont les mêmes dégâts par seconde sur la durée ; elles changent le style de jeu, pas la puissance.
- **Progression** : gagner une partie rapporte de l'argent pour débloquer des armes, des skins et de nouvelles cartes. Ce qu'on débloque est différent, jamais plus fort.
- **Mode égalitaire** (plus tard) : tout est débloqué pour tout le monde.

**Bonus donnés par les cartes du quiz** : viseur laser, plus de munitions, plus de dégâts, vitesse de déplacement, saut amélioré, bouclier, casque, vision thermique, etc.

**Armes légendaires** (cartes rares du combo quitte ou double) : sniper laser qui traverse les murs, marteau gravité, lance-roquettes à grosse explosion de zone, canon à rebonds, etc.

**Valeurs de départ des armes** (à affiner en playtest) : 100 PV par joueur, environ 80 dégâts par seconde pour toutes les armes, soit un kill en 1,5 s environ si tout touche.

| Arme | Dégâts par tir | Cadence | Chargeur | Particularité |
| --- | --- | --- | --- | --- |
| Pistolet | 20 | 4 tirs/s | 12 | Précis à toute distance |
| Fusil d'assaut | 10 | 8 tirs/s | 30 | Recul croissant en rafale |
| Fusil à pompe | 8 plombs × 10 | 1 tir/s | 6 | Dégâts réduits avec la distance |
| Sniper | 80 (tête × 2) | 1 tir/s | 5 | Un tir à la tête = kill, récompense la précision |

## Paramètres et interface admin

Toutes les valeurs du jeu vivent dans des fichiers JSON, jamais en dur dans le code, et une interface admin permet de les modifier sans coder.

- **Armes** : dégâts, cadence, chargeur, recul, portée.
- **Joueur** : PV, vitesse, saut.
- **Bonus et malus** : effets, durées, rareté.
- **Quiz** : budget de temps, coût de chaque carte, règles des combos.
- **Combat** : durée, nombre de vies ou de manches.
- **Assets** : le catalogue des modèles 3D.

## Système de contenu modulaire

Le jeu est un moteur : il ne connaît pas les matières, il lit des decks au format JSON et pioche les questions selon leur difficulté. N'importe qui peut créer un deck depuis son cours grâce à un skill IA.

**Pipeline**

1. **Entrée** : PDF, notes, slides, photo de tableau, ou un simple sujet.
2. **Skill IA** : extrait les notions, génère les questions, attribue une difficulté, écrit l'explication.
3. **Validation automatique** : un script vérifie le format (champs présents, une seule bonne réponse, difficulté entre 1 et 5).
4. **Relecture humaine** : l'auteur corrige ou supprime avant publication.
5. **Import** : le deck apparaît dans le jeu et devient jouable.

**Format pivot (exemple)**

```json
{
  "deck": {
    "id": "cesi-reseaux-tcp-ip",
    "titre": "Réseaux : modèle TCP/IP",
    "matiere": "Informatique",
    "niveau": "Bac+2",
    "auteur": "tidi998",
    "version": 1,
    "langue": "fr"
  },
  "questions": [
    {
      "id": "q001",
      "type": "qcm",
      "difficulte": 3,
      "enonce": "À quelle couche du modèle TCP/IP appartient le protocole UDP ?",
      "choix": ["Application", "Transport", "Internet", "Accès réseau"],
      "reponse": 1,
      "explication": "UDP, comme TCP, gère le transport de bout en bout entre applications.",
      "tags": ["protocoles", "couches"],
      "temps_max": 15
    }
  ]
}
```

**Types de questions**

| Type | Usage | Version |
| --- | --- | --- |
| `qcm` | Cas général | Proto |
| `vrai_faux` | Questions rapides (munitions) | Proto |
| `reponse_courte` | Un mot ou un nombre, plus dur à deviner | Plus tard |
| `ordre` / `association` | Remettre des étapes dans l'ordre, relier des termes | Plus tard |

**Règles du skill IA**

- Ne poser que des questions trouvables dans le cours fourni (limite les hallucinations).
- Générer des mauvaises réponses crédibles.
- Calibrer la difficulté avec une grille fixe : 1 = définition, 3 = application, 5 = raisonnement ou piège.
- Toujours écrire une explication (sert au récap).
- Équilibrer la répartition des difficultés pour alimenter les trois cartes.

## Communauté et decks

Les decks sont partagés entre joueurs, et ce sont les parties jouées qui affinent leur qualité.

- **Visibilité** : deck public, privé, ou partagé avec une classe via un code d'invitation.
- **Difficulté auto-ajustée** : la difficulté donnée par l'IA est une estimation. Le jeu la recalcule selon le taux de bonnes réponses (une question « niveau 4 » réussie par 90 % des joueurs redescend).
- **Signalement** : bouton « signaler cette question » dans le récap ; une question souvent signalée ou jamais réussie part en relecture.
- **Confiance** : note des decks par les joueurs, badge « vérifié » pour un deck validé par un prof ou un modérateur.
- **Choix du deck en match** : les deux joueurs jouent le même deck, ou un mode mixte qui pioche dans plusieurs decks.

## Équilibrage

Le point de départ visé est un équilibre 50/50 entre connaissance et adresse, à ajuster avec les playtests.

| Risque | Ce qui se passe | Pistes |
| --- | --- | --- |
| Boule de neige | Celui qui connaît le mieux le cours écrase l'autre, qui se décourage | Plafonner les bonus, petit avantage de rattrapage au perdant |
| Connaissance vs adresse | Trop d'adresse : le quiz ne sert à rien. Trop de connaissance : le combat ne sert à rien | Garder les bonus significatifs mais pas décisifs seuls |
| Triche (recherche Google) | Le joueur cherche la réponse pendant le quiz | Timer court, gros pool de questions, réponses mélangées |
| Decks de mauvaise qualité | Questions fausses ou ambiguës, combats injustes | Relecture humaine, signalement, difficulté recalculée |

**Philosophie retenue**

- Connaître le cours doit donner un vrai avantage : un certain déséquilibre en faveur de celui qui sait est voulu, c'est le principe du jeu.
- Ça reste un jeu de skill : entre deux joueurs de même niveau au FPS, celui qui a les bonnes réponses doit gagner.
- Un joueur à 0/20 doit avoir énormément de mal à battre un joueur à 20/20, même s'il vise mieux.

**Combo négatif** : après 3 mauvaises réponses d'affilée, chaque nouvelle erreur donne un malus au lieu de « rien ». Ça pousse à vraiment connaître le cours.

**Onglet Cours** : un menu dédié regroupe tous les cours des decks joués, pour réviser avant un match.

## Multijoueur et matchmaking

Le jeu se joue en 1 contre 1 en ligne, d'abord en salon privé, avec des parties entièrement paramétrables par l'hôte.

- **Priorité : parties privées uniquement.** Le matchmaking public est repoussé à plus tard.
- **L'hôte paramètre la partie** : deck, nombre de questions faciles, moyennes et difficiles (exemple par défaut : 5 / 5 / 5), temps par question (exemple : 30 s ou 1 min).
- **Tirage aléatoire** : les questions sont tirées au hasard dans chaque catégorie de difficulté.
- **Fin synchronisée** : les deux joueurs terminent la phase de préparation en même temps.
- **Budget de temps** : la phase quiz a une durée totale fixe (exemple : 5 min), et chaque carte coûte du temps selon sa difficulté (exemple : facile 30 s, moyenne 45 s, difficile 1 min). Chaque joueur compose son propre parcours. Vers la fin, le jeu ne propose que des cartes qui rentrent dans le temps restant (exemple : à 4 min 30, seulement des faciles), pour que les deux joueurs finissent pile en même temps.
- **À trancher** : choix des cartes en même temps ou en alternance (draft).

## Technique

La première version sera en web.

**Décision V1 : FPS web low poly (Three.js)**, jouable dans le navigateur avec un simple lien, sans installation. Référence : Krunker.io.

- **Pourquoi** : développement beaucoup plus rapide avec Claude Code qu'avec Unreal piloté via MCP.
- **Contrepartie** : réseau et physique à coder soi-même, rendu moins spectaculaire qu'Unreal.
- **Plus tard** : un portage Unreal reste envisageable si le jeu s'ouvre au grand public.

**Briques nécessaires**

- Client de jeu (quiz + combat).
- Serveur de match (synchronisation du combat, tirage des questions côté serveur pour limiter la triche).
- Stockage des decks (JSON) et des stats par question.
- Skill IA de génération, lancé en dehors du jeu pour le proto (pas de coût API côté jeu).

**Gestion des assets**

- **Proto** : tout est fait en code avec les formes de base de Three.js (cubes, cylindres, sphères colorés), plus des particules pour les explosions. On valide le fun avant le visuel.
- **Catalogue d'assets** : un fichier JSON associe chaque objet (ex. « ak ») à son modèle, sa taille, sa rotation et son point de prise en main. Le code ne charge jamais un modèle en dur.
- **Remplacement** : déposer un fichier GLB/glTF dans le dossier assets et changer son chemin dans le catalogue, sans toucher au gameplay.
- **Licences** : vérifier chaque modèle téléchargé (CC0 libre, sinon créditer l'auteur).

## Décisions ouvertes

| Question | Options | Piste pour le proto |
| --- | --- | --- |
| Genre de combat | Tranché : FPS PvP arcade cartoon | Décidé |
| Portée | Tranché : promo d'abord, grand public plus tard | Décidé |
| Choix des cartes | En même temps ou en alternance (draft) | En même temps (plus simple) |
| Questions des deux joueurs | Identiques ou différentes à difficulté égale | Identiques (plus équitable) |
| Mauvaise réponse | Rien, ou un malus | Rien au début, malus seulement sur les cartes rares du combo |
| Nombre de tours de quiz (X) | 3 à 6 | 5, à ajuster en playtest |
| Génération IA | Dans le jeu (API payante) ou en dehors (skill + import JSON) | En dehors |
| Moteur | Tranché : web (Three.js low poly) | Décidé |

## Écrans

Le jeu compte 15 écrans ; 10 sont nécessaires au proto, les autres peuvent attendre. Les maquettes Figma donnent le contenu, mais leur forme est remplacée par la DA v2 (pastel sur papier, sobre, géométrique).

&#91;embedded content: navigation · 15 écrans\]

Le match boucle entre 08 et 09 jusqu'à épuisement du budget, puis enchaîne sur le combat. En Duel, une seule manche : on passe de 11 directement au récap. En entraînement solo, le quiz mène au récap sans combat.

**Hors partie**

| Écran | Fonction | Contenu | Mène à | Proto |
| --- | --- | --- | --- | --- |
| [01 Accueil](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=4-2) | Point d'entrée, lancer une partie | Créer un salon · Rejoindre avec un code · Entraînement solo · accès Loadout, Cours, Decks, Paramètres · pièces et niveau · perso équipé · dernière partie | 02, 03, 04, 05, 06, 07 (code), 08 (solo) | Oui, simplifié |
| [02 Loadout et boutique](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=4-85) | Choisir son arme, dépenser ses pièces | 4 armes avec dégâts, cadence, chargeur · arme équipée · skins avec prix ou verrouillés · solde | 01 | Choix d'arme seulement |
| [03 Cours](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=4-268) | Réviser hors combat | Liste des cours avec % de maîtrise · notions maîtrisées ou à revoir · questions ratées en priorité · bouton entraînement | 01, 08 (entraînement) | Non |
| [04 Decks](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=5-26) | Gérer les decks de questions | Liste des decks (titre, nombre de questions, répartition des difficultés, visibilité, auteur, badge vérifié) · import JSON par glisser-déposer avec erreurs de validation · rejoindre un deck par code | 01 ; le deck choisi sert en 06 | Import JSON et liste |
| [05 Paramètres](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=5-209) | Réglages du joueur | Contrôles (sensibilité, touches) · audio · graphismes · accessibilité (réduire les flashs, mode daltonien, taille du texte, temps de lecture, réticule contrasté) | 01 | Réduire les flashs et sensibilité |

**Avant le match**

| Écran | Fonction | Contenu | Mène à | Proto |
| --- | --- | --- | --- | --- |
| [06 Créer un salon](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=5-334) | L'hôte règle la partie et obtient un code | Deck · mode (Duel, Best of 3, Chrono, Personnalisé) · budget du quiz · nombre de questions faciles, moyennes, difficiles · coût des cartes · durée du combat et vies · règles (quitte ou double, combo négatif, questions identiques) · code et bouton copier · résumé | 07 ; retour 01 | Oui |
| [07 Lobby](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=6-47) | Attendre l'adversaire et se déclarer prêt | Les 2 joueurs (perso, pseudo, niveau, arme, statut prêt) · code · mode et deck · résumé des paramètres · Quitter et Prêt | 08 quand les deux sont prêts ; Quitter vers 01 | Oui |

**Pendant le match**

| Écran | Fonction | Contenu | Mène à | Proto |
| --- | --- | --- | --- | --- |
| [08 Quiz : choix de carte](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=6-120) | Choisir le bonus à tenter | « Choisis ta carte » seul, puis 3 grandes cartes qui montent du bas (famille, rareté, bonus, effet, difficulté, coût en temps) · petit minuteur du budget en bas · colonne d'icônes des bonus acquis à droite · indicateur de combo · pas de nom de joueur | 09 | Oui |
| [09 Quiz : question](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=6-242) | Répondre pour gagner la carte | Carte en jeu · énoncé · 2 à 4 réponses (clic ou touches 1 à 4) · minuteur égal au coût de la carte · retour bonne ou mauvaise réponse avec l'explication · bonus gagné ou malus | 08 (tour suivant) ; 10 quand le budget est épuisé ; 13 en entraînement solo | Oui |
| [10 Transition avant combat](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=7-149) | Montrer les deux équipements | Bonus des 2 joueurs · scores du quiz · compte à rebours 3, 2, 1 · numéro de manche et arène | 11 | Simplifié |
| [11 HUD de combat](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=7-232) | Le duel FPS | Score, chrono, manche · réticule · vie et bouclier · munitions et arme · bonus actifs · capacités (dash, double saut) · fil des éliminations · étiquette de l'ennemi | 12 à la fin de la manche ; 13 à la fin du match | Oui |
| [12 Fin de manche](https://www.figma.com/design/ZArPNRKsbMdLnoM04Sjf5D?node-id=7-338) | Annoncer le résultat de la manche | Vainqueur · score des manches · stats (temps, précision, dégâts, bonus le plus utile) · compte à rebours vers le quiz suivant | 08 (manche suivante) ; 13 si le match est fini | Best of 3 seulement |

**Après le match**

| Écran | Fonction | Contenu | Mène à | Proto |
| --- | --- | --- | --- | --- |
| 13 Récap des erreurs (pas de maquette) | Réviser ses erreurs, c'est le cœur pédagogique | Score du quiz · pour chaque question ratée : énoncé, ta réponse, bonne réponse, explication · bouton signaler la question | 14 | Oui |
| 14 Résultats (pas de maquette) | Conclure le match | Victoire ou défaite · stats (bonnes réponses, kills, précision, combo max) · pièces et XP gagnées | 07 (rejouer dans le même salon), 13 (revoir le récap), 01 | Simplifié |

**À part**

| Écran | Fonction | Contenu | Mène à | Proto |
| --- | --- | --- | --- | --- |
| 15 Admin (pas de maquette) | Régler toutes les valeurs du jeu sans coder | Sections armes, joueur, bonus et malus, quiz, combat, modes, assets · édition des JSON de config · export | Adresse séparée (/admin), pas accessible depuis le jeu | Plus tard |

## Roadmap du prototype

L'objectif du proto est de valider que la boucle quiz puis combat est fun, avec un seul deck écrit à la main.

1. **Trancher les décisions bloquantes** : genre de combat et moteur (fait : FPS cartoon, web Three.js).
2. **Format de deck** : figer le schéma JSON et écrire un deck de test d'environ 30 questions.
3. **Phase quiz en solo** : les 3 cartes, la question, la récompense.
4. **Combat en local** : FPS en réseau local entre deux joueurs, avec les bonus gagnés.
5. **Récap** : questions ratées, bonne réponse et explication.
6. **Réseau** : passage en ligne avec salon privé par code.
7. **Skill IA** : génération d'un deck depuis un cours, validation du JSON, import.
8. **Playtest** avec la promo, puis équilibrage.
