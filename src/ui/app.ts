// Contrôleur de l'interface : enchaîne les écrans de ECRANS.md via le routeur,
// fait tourner l'entraînement solo, et relaie les messages du serveur de match.
import type { GameConfig } from '../core/config/gameConfig';
import { validateDeck, type Deck } from '../core/deck/validateDeck';
import type { RoomInfo, ServerMessage } from '../core/match/protocol';
import { computeAxes, quizSamples } from '../core/match/matchStats';
import { recapView, type RecapView } from '../core/match/quizView';
import { effectiveConfig } from '../core/match/settings';
import { QuizSession } from '../core/quiz/quizSession';
import type { Content } from '../loadContent';
import { Connection } from '../net/connection';
import { readJoinCode } from '../net/joinLink';
import type { Clock } from './clock';
import { backdrop } from './components';
import { LocalQuizPort, RemoteQuizPort, type QuizPort } from './quizPort';
import { Router, type ScreenId } from './router';
import { TRAINING_MODE_ID } from './screen';
import { homeScreen } from './screens/01-home';
import { loadoutScreen } from './screens/02-loadout';
import { decksScreen, type DeckEntry } from './screens/04-decks';
import { settingsScreen } from './screens/05-settings';
import { createRoomScreen } from './screens/06-create-room';
import { lobbyScreen } from './screens/07-lobby';
import { cardChoiceScreen } from './screens/08-card-choice';
import { questionScreen, type QuestionScreen } from './screens/09-question';
import { transitionScreen } from './screens/10-transition';
import { combatScreen, type CombatScreen } from './screens/11-combat';
import { roundEndScreen } from './screens/12-round-end';
import { recapScreen } from './screens/13-recap';
import { resultsScreen, type ResultsData } from './screens/14-results';
import { getReduceEffects, setReduceEffects } from './settings';
import { installUiSounds, sound } from './sound';
import { playerName, store } from './store';

export class App {
  private readonly router: Router;
  private readonly config: GameConfig;
  private decks: DeckEntry[] = [];
  private weaponId: string;
  private deckId: string;
  private message = '';

  // match en cours
  private conn: Connection | null = null;
  private room: RoomInfo | null = null;
  private localPort: LocalQuizPort | null = null;
  private remotePort: RemoteQuizPort | null = null;
  private shownVersion = -1;
  private combat: CombatScreen | null = null;
  private fighters: { id: string; name: string; color: number }[] = [];
  private recap: RecapView | null = null;
  private results: ResultsData | null = null;
  private recapKey = '';
  private wantLobby = false;

  constructor(
    root: HTMLElement,
    private readonly content: Content,
    private readonly clock: Clock,
  ) {
    this.config = content.config;
    root.replaceChildren(backdrop());
    this.router = new Router(root);
    sound.init(this.config.sounds, store.volume());
    installUiSounds(root);
    this.weaponId = store.weaponId(this.config.player.defaultWeapon);
    if (!this.config.player.loadout.includes(this.weaponId)) this.weaponId = this.config.player.defaultWeapon;
    this.loadDecks();
    this.deckId = this.decks.some((d) => d.deck.deck.id === store.deckId()) ? store.deckId()! : this.decks[0]!.deck.deck.id;
    window.addEventListener('keydown', (e) => {
      if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) this.router.active?.onKey?.(e);
    });
    this.showHome();
    // lien du QR code (?code=XXXX) : on rejoint directement le salon, puis on nettoie la barre d'adresse
    const code = readJoinCode(location.search);
    if (code) {
      history.replaceState(null, '', location.pathname);
      this.join(code);
    }
    requestAnimationFrame(this.frame);
  }

  private get deck(): Deck {
    return (this.decks.find((d) => d.deck.deck.id === this.deckId) ?? this.decks[0]!).deck;
  }

  private loadDecks(): void {
    const imported: DeckEntry[] = [];
    for (const raw of store.importedDecks()) {
      const r = validateDeck(raw, 'deck importé');
      if (r.ok) imported.push({ deck: r.deck, imported: true });
    }
    this.decks = [...this.content.decks.map((deck) => ({ deck, imported: false })), ...imported];
  }

  private frame = (): void => {
    if (this.localPort) {
      this.localPort.tick();
      this.syncQuiz(this.localPort);
    }
    this.router.active?.update?.(this.clock.now());
    requestAnimationFrame(this.frame);
  };

  private go(to: ScreenId, screen: Parameters<Router['go']>[1]): void {
    // un lien absent de ECRANS.md est refusé par le routeur ; en dernier recours on revient à l'accueil
    if (!this.router.go(to, screen)) console.warn(`[app] écran ${to} non affiché`);
  }

  // ---------- 01 et menus ----------

  showHome(): void {
    this.localPort = null;
    const message = this.message;
    this.message = '';
    this.go(
      '01',
      homeScreen(
        { config: this.config, name: playerName(), weaponId: this.weaponId, deckTitle: this.deck.deck.titre, lastGame: store.lastGame(), coins: store.coins(), message },
        {
          rename: (name) => store.setName(name || playerName()),
          create: () => this.showCreate(''),
          join: (code) => this.join(code),
          solo: () => this.startSolo(),
          loadout: () => this.showLoadout(),
          decks: () => this.showDecks(),
          settings: () => this.showSettings(),
        },
      ),
    );
  }

  private showLoadout(): void {
    this.go(
      '02',
      loadoutScreen({
        config: this.config,
        weaponId: this.weaponId,
        coins: store.coins(),
        onSelect: (id) => {
          this.weaponId = id;
          store.setWeaponId(id);
        },
        onBack: () => this.showHome(),
      }),
    );
  }

  private showDecks(): void {
    this.go(
      '04',
      decksScreen(this.decks, this.deckId, {
        select: (id) => {
          this.deckId = id;
          store.setDeckId(id);
          this.showDecks();
        },
        import: (raw, deck) => {
          const others = store.importedDecks().filter((d) => validateDeck(d).ok && (validateDeck(d) as { deck: Deck }).deck.deck.id !== deck.deck.id);
          store.setImportedDecks([...others, raw]);
          this.loadDecks();
          this.deckId = deck.deck.id;
          store.setDeckId(deck.deck.id);
          this.showDecks();
        },
        remove: (id) => {
          store.setImportedDecks(store.importedDecks().filter((d) => {
            const r = validateDeck(d);
            return r.ok && r.deck.deck.id !== id;
          }));
          this.loadDecks();
          if (this.deckId === id) this.deckId = this.decks[0]!.deck.deck.id;
          this.showDecks();
        },
        back: () => this.showHome(),
      }),
    );
  }

  private showSettings(): void {
    this.go(
      '05',
      settingsScreen(
        { reduceEffects: getReduceEffects(), sensitivity: store.sensitivity(), volume: store.volume() },
        {
          setReduceEffects,
          setSensitivity: (v) => store.setSensitivity(v),
          setVolume: (v) => {
            store.setVolume(v);
            sound.setVolume(v);
          },
          back: () => this.showHome(),
        },
      ),
    );
  }

  // ---------- entraînement solo : 01 → 08 → 09 → 13 → 14 ----------

  private startSolo(): void {
    const session = new QuizSession({
      config: this.config,
      questions: this.deck.questions,
      seed: Math.floor(Math.random() * 2 ** 32),
      now: this.clock.now(),
      weaponId: this.weaponId,
    });
    const port = new LocalQuizPort(this.config, session, this.clock, () => this.syncQuiz(port));
    this.localPort = port;
    this.shownVersion = -1;
    this.recapKey = this.deck.deck.id;
    this.syncQuiz(this.localPort);
  }

  private endSolo(session: QuizSession): void {
    this.localPort = null;
    const recap = recapView([{ results: session.results, bestStreak: session.combo.bestStreak, inventory: session.inventory.all() }]);
    store.setLastGame({ outcome: 'solo', correct: recap.correct, total: recap.total, at: Date.now() });
    this.recap = recap;
    const axes = computeAxes({ quiz: quizSamples(session.results), bestStreak: session.combo.bestStreak, combat: null }, this.config.stats);
    this.results = { match: null, recap, solo: { name: playerName(), axes } };
    this.showRecap();
  }

  /** Affiche 08 ou 09 selon l'état du quiz (solo ou salon). */
  private syncQuiz(port: QuizPort): void {
    const view = port.view();
    if (view.version === this.shownVersion) return;
    this.shownVersion = view.version;
    switch (view.phase) {
      case 'choosing':
        this.go('08', cardChoiceScreen(port));
        break;
      case 'answering':
        this.go('09', questionScreen(port));
        break;
      case 'feedback': {
        const screen = this.router.active as QuestionScreen | null;
        if (this.router.current === '09' && view.lastResult && screen?.turn === view.lastResult.turn) screen.showFeedback(view.lastResult);
        break;
      }
      case 'finished':
        if (port instanceof LocalQuizPort) this.endSolo(port.session);
        // salon : on reste sur l'écran, avec un bandeau d'attente jusqu'à la transition (10)
        else (this.router.active as Partial<QuestionScreen> | null)?.showWaiting?.();
        break;
    }
  }

  // ---------- salon : 06 → 07 → 08 … ----------

  private connect(): Connection {
    if (this.conn) return this.conn;
    this.conn = new Connection(
      (msg) => this.onServer(msg),
      (unexpected) => {
        this.conn = null;
        this.room = null;
        if (!unexpected) return;
        this.message = 'Connexion au serveur perdue.';
        this.localPort = null;
        if (this.router.go('01', homeScreenPlaceholder(), 'disconnect')) this.showHome();
      },
    );
    return this.conn;
  }

  private disconnect(): void {
    this.conn?.send({ type: 'leave' });
    this.conn?.close();
    this.conn = null;
    this.room = null;
  }

  private showCreate(message: string): void {
    this.go(
      '06',
      createRoomScreen(this.config, this.decks.map((d) => d.deck), this.deckId, message, {
        create: (settings, deck) => {
          const raw = store.importedDecks().find((d) => {
            const r = validateDeck(d);
            return r.ok && r.deck.deck.id === deck.deck.id;
          }) ?? deck;
          this.recapKey = deck.deck.id;
          this.connect().send({ type: 'create', name: playerName(), weaponId: this.weaponId, settings, deck: raw });
        },
        back: () => this.showHome(),
      }),
    );
  }

  private join(code: string): void {
    this.connect().send({ type: 'join', name: playerName(), weaponId: this.weaponId, code });
  }

  private showLobby(message = ''): void {
    if (!this.room) return;
    this.go(
      '07',
      lobbyScreen(this.config, this.room, message, {
        ready: (ready) => this.conn?.send({ type: 'ready', ready }),
        leave: () => {
          this.disconnect();
          this.showHome();
        },
      }),
    );
  }

  private onServer(msg: ServerMessage): void {
    const conn = this.conn;
    if (!conn) return;
    switch (msg.type) {
      case 'error':
        if (this.router.current === '06') this.showCreate(msg.message);
        else if (this.router.current === '07') this.showLobby(msg.message);
        else {
          this.message = msg.message;
          if (this.router.current === '01') this.showHome();
        }
        break;
      case 'room': {
        this.room = msg.room;
        this.recapKey ||= msg.room.deckTitle;
        const here = this.router.current;
        if (msg.room.phase === 'lobby' && (here === '01' || here === '06' || here === '07' || (here === '14' && this.wantLobby))) {
          this.wantLobby = false;
          this.showLobby();
        }
        break;
      }
      case 'quiz': {
        if (!this.remotePort) this.remotePort = new RemoteQuizPort(effectiveConfig(this.config, this.room!.settings), conn, msg.view);
        else this.remotePort.update(msg.view);
        // nouvelle manche : la session repart de zéro
        if (msg.view.answered === 0 && msg.view.phase === 'choosing' && this.router.current !== '08' && this.router.current !== '09') this.shownVersion = -1;
        this.syncQuiz(this.remotePort);
        break;
      }
      case 'transition':
        this.remotePort = null;
        this.fighters = msg.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
        this.go('10', transitionScreen(this.config, { ...msg, youId: this.room!.you }, () => conn.serverNow()));
        break;
      case 'combatStart': {
        const self = msg.fighters.find((f) => f.id === this.room!.you)!;
        this.combat = combatScreen({
          config: effectiveConfig(this.config, this.room!.settings),
          modeId: this.room!.settings.modeId,
          arenaId: this.room!.settings.arenaId,
          weaponId: self.weaponId,
          entries: self.entries,
          net: {
            selfId: self.id,
            lives: this.room!.settings.lives,
            round: msg.round,
            rounds: this.room!.settings.rounds,
            endsAt: msg.endsAt,
            fighters: msg.fighters,
            serverNow: () => conn.serverNow(),
            send: (m) => conn.send(m),
          },
        });
        this.go('11', this.combat);
        break;
      }
      case 'peer':
      case 'peerShot':
      case 'damage':
      case 'vitals':
      case 'respawn':
      case 'peerLeft':
      case 'chests':
      case 'chestQuestion':
      case 'chestResult':
      case 'grenades':
      case 'grenade':
      case 'explosion':
      case 'breaks':
        this.combat?.onServer(msg);
        break;
      case 'roundEnd':
        this.combat?.onServer(msg);
        if (this.room && this.room.settings.rounds > 1) {
          this.combat = null;
          this.go('12', roundEndScreen({ ...msg, youId: this.room.you, players: this.fighters }, () => conn.serverNow()));
        }
        break;
      case 'matchEnd': {
        this.combat = null;
        this.remotePort = null;
        const you = this.room?.you ?? '';
        const outcome = msg.winnerId === null ? 'draw' : msg.winnerId === you ? 'win' : 'loss';
        store.setLastGame({ outcome, correct: msg.recap.correct, total: msg.recap.total, at: Date.now() });
        // pièces calculées par le serveur sur les stats de combat ; matchEnd n'arrive qu'une fois par match
        store.addCoins(msg.results.find((r) => r.id === you)?.coins.total ?? 0);
        this.recap = msg.recap;
        this.results = { match: { youId: you, winnerId: msg.winnerId, forfeit: msg.forfeit, players: msg.results }, recap: msg.recap };
        // abandon de l'adversaire : sortie d'urgence vers le récap (point V-026)
        const reason = this.router.canGo('13') ? 'link' : 'forfeit';
        this.router.go('13', this.recapScreenFor(), reason);
        break;
      }
      case 'left':
        break;
    }
  }

  // ---------- 13 et 14 ----------

  private recapScreenFor() {
    const deckTitle = this.results?.match ? (this.room?.deckTitle ?? '') : this.deck.deck.titre;
    return recapScreen(this.recap!, this.recapKey, () => this.showResults(), deckTitle);
  }

  private showRecap(): void {
    this.go('13', this.recapScreenFor());
  }

  private showResults(): void {
    const multiplayer = this.results?.match !== null && this.conn !== null;
    this.go(
      '14',
      resultsScreen(this.config, this.results!, {
        replay: multiplayer
          ? () => {
              this.wantLobby = true;
              this.conn?.send({ type: 'rematch' });
              if (this.room?.phase === 'lobby') {
                this.wantLobby = false;
                this.showLobby();
              }
            }
          : undefined,
        review: () => this.showRecap(),
        home: () => {
          this.disconnect();
          this.showHome();
        },
      }),
    );
  }

  // ---------- outil de développement : stand de tir ----------

  /** Stand de tir sur cibles (hors ECRANS.md, accessible seulement depuis la console en dev). */
  openShootingRange(): void {
    const screen = combatScreen({
      config: this.config,
      modeId: TRAINING_MODE_ID,
      weaponId: this.weaponId,
      entries: [],
      net: null,
      onEnd: () => {
        this.router.showError(homeScreenPlaceholder());
        this.showHome();
      },
    });
    this.router.showError(screen);
  }
}

/** Écran vide utilisé pour une sortie d'urgence, immédiatement remplacé par le vrai écran. */
function homeScreenPlaceholder() {
  return { el: document.createElement('div') };
}
