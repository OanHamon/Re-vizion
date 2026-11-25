// Horloge de l'interface. Le moteur reçoit toujours `now` en paramètre ;
// c'est ici, et seulement ici, qu'on lit l'heure du navigateur.
export class Clock {
  private offset = 0;

  now(): number {
    return performance.now() + this.offset;
  }

  /** Avance l'horloge (outil de développement, pour tester la fin de phase sans attendre). */
  skip(ms: number): void {
    this.offset += ms;
  }
}
