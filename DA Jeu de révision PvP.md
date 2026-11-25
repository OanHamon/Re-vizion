# DA : Jeu de révision PvP

Nov 19, 2026 · @tidi998

Trois directions artistiques à comparer avant de choisir celle du jeu : FPS arcade, cartoon, low poly web.

## Direction v2 : pastel sur papier

Cette direction remplace la précédente partout où elles se contredisent : le néon et le thème sombre sont abandonnés. Le contenu des maquettes Figma est validé, seule la forme change.

- **Thème** : fond papier blanc beige au lieu du noir.
- **Couleurs** : pastel, avec des effets de couleur doux (dégradés, halos légers), jamais de néon.
- **Formes** : interfaces sobres, fonds à motifs géométriques, boutons ronds.
- **Texte** : le strict minimum, presque pas de titres. Les infos courtes sont séparées par des points (Manche 1 · Question 5).

**Écran de choix de carte**

1. « Choisis ta carte » apparaît seul, puis les 3 cartes surgissent depuis le bas.
2. Les cartes sont beaucoup plus grandes et occupent l'essentiel de l'écran.
3. Pas de nom de joueur, quasiment aucun titre en dehors des cartes.
4. Un petit minuteur en bas.
5. Les bonus déjà acquis forment une colonne verticale à droite, en icônes seulement.

## Direction retenue

Le moodboard fixe la cible : un FPS arcade cartoon, mélange de **Splash jouet** (couleurs saturées, effets exagérés) et d'**arènes low poly** façon Krunker, avec une touche de Roboquest. C'est la cible finale ; le proto web aura des formes plus simples.

&#91;image: Moodboard du jeu de révision PvP\]

**Palette et rôles**

| Couleur | Rôle proposé |
| --- | --- |
| Bleu | Équipe / joueur 1 |
| Rose | Équipe / joueur 2 |
| Cyan | Bouclier, éléments lumineux des armes |
| Jaune | Dégâts, impacts, explosions |
| Orange | Explosions, décor chaud |
| Violet | Rareté légendaire |
| Vert | Soin, bonne réponse |
| Gris anthracite | Fond de l'interface, contraste |

**Principes**

- **Arènes** : formes géométriques, blocs, tours et bannières. Compatible avec un proto Three.js à base de cubes.
- **Personnages** : silhouettes chunky, grosses proportions, lisibles de loin.
- **Armes** : design jouet sci-fi, pièces lumineuses cyan, archétypes reconnaissables (pistolet, fusil d'assaut, sniper, lance-roquettes).
- **Effets** : explosions, impacts et traînées volontairement exagérés, avec une option qui réduit les flashs.
- **HUD** : score et chrono en haut, vie en bas à gauche, munitions en bas à droite.

**Encore à définir**

- L'écran de la phase quiz et le design des 4 familles de cartes (Attaque, Défense, Mobilité, Arme), avec leur niveau de rareté.
- La place de l'univers école, absent du moodboard.
- L'écran de récap des erreurs.

## Palettes

&#91;embedded content: palettes · 3 directions\]

A joue l'ambiance salle d'arcade la nuit, B le jouet coloré en plein jour, C transforme l'univers des révisions en terrain de jeu (arènes faites de règles, crayons et cahiers géants).

## Références

Chaque jeu apporte un élément précis ; glisser des captures sous ce tableau pour construire le moodboard.

| Jeu | Ce qu'on lui prend | Direction |
| --- | --- | --- |
| Splatoon | Couleurs saturées, explosions de peinture, armes « jouet » | B |
| Krunker.io | FPS web low poly ultra rapide, lisibilité, performance navigateur | A, B, C |
| Overwatch / Valorant | Silhouettes et armes reconnaissables au premier coup d'œil | A, B |
| Rocket League | Arènes néon, mouvement et effets partout | A |
| Fortnite (style cartoon) | Explosions cartoon, couleurs franches, ton léger | B |
| Paper Mario / jeux « dessinés » | Univers papier et griffonnages | C |

**Moodboard** : planche d'inspiration de référence (combat, palette, arènes, personnages, armes, effets).

## Style par direction

| Élément | A. Néon arcade | B. Splash jouet | C. Cahier d'écolier |
| --- | --- | --- | --- |
| Rendu 3D | Low poly sombre, contours lumineux (glow) | Low poly lisse, ombrage cartoon (toon shading) | Low poly avec contours noirs façon dessin |
| Arènes | Salles d'arcade, grilles néon, plateformes flottantes | Parcs, toits, aires de jeux géantes | Bureau géant : règles, trousses, cahiers, gommes |
| Armes | Translucides, lumineuses | Plastique coloré, formes rondes | Stylos, compas, taille-crayons détournés |
| Explosions | Éclats de lumière, particules néon | Gerbes de peinture et confettis | Gribouillis, ratures, éclats de mine |
| Interface | Typo pixel ou rétro, effets glitch | Typo ronde et épaisse, boutons bombés | Écriture manuscrite, post-its, surlignage |

## Questions à trancher

- Quelle direction : A, B, C, ou un mélange (par exemple l'univers C avec les couleurs B) ?
- Ombrage cartoon (toon shading) ou couleurs plates sans ombre ?
- Contours noirs autour des objets, oui ou non ?
- Personnages : humanoïdes, robots, créatures, ou objets vivants ?
- Niveau d'intensité des effets, avec l'option de réduction des flashs.
