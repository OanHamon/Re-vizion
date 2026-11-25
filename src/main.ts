// Point d'entrée du navigateur.
import './ui/theme.css';
import './ui/styles.css';
import { loadContent } from './loadContent';
import { App } from './ui/app';
import { Clock } from './ui/clock';
import { backdrop } from './ui/components';
import { errorsScreen } from './ui/screens/errors';

const root = document.querySelector<HTMLElement>('#app')!;
const result = loadContent();

if (!result.ok) {
  console.error(result.title, result.errors);
  root.replaceChildren(backdrop(), errorsScreen(result.title, result.errors).el);
} else {
  if (result.content.deckErrors.length) console.warn('Decks refusés :', result.content.deckErrors);
  const clock = new Clock();
  const app = new App(root, result.content, clock);

  // Outils de développement uniquement (absents du build) :
  //   __reviz.skip(60)  avance l'horloge de 60 s (entraînement solo), pour tester la fin sans attendre ;
  //   __reviz.stand()   ouvre le stand de tir sur cibles (pas un écran du jeu).
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __reviz: {
        skip: (seconds: number) => clock.skip(seconds * 1000),
        stand: () => app.openShootingRange(),
      },
    });
  }
}
