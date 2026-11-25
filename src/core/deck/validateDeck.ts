// Validateur de decks : refuse un deck mal formé avec des messages clairs,
// qui citent le numéro de la question, son id et le champ fautif.
import { formatPath } from '../zod';
import { DeckMetaSchema, type DeckMeta } from './deckSchema';
import { getQuestionType, knownQuestionTypes, type Question } from './questionTypes';

export interface Deck {
  deck: DeckMeta;
  questions: Question[];
}

export type DeckResult = { ok: true; deck: Deck } | { ok: false; errors: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Libellé d'un champ : « reponse », « choix[2] »… */
const field = (path: readonly PropertyKey[]) => (path.length === 0 ? 'question' : `champ « ${formatPath(path)} »`);

export function validateDeck(raw: unknown, source = 'deck'): DeckResult {
  const errors: string[] = [];
  const err = (where: string, message: string) => errors.push(`${source} · ${where} : ${message}`);

  if (!isRecord(raw)) {
    err('fichier', 'un objet JSON { "deck": …, "questions": [ … ] } est attendu');
    return { ok: false, errors };
  }

  for (const key of Object.keys(raw)) {
    if (key !== 'deck' && key !== 'questions') err('fichier', `clé non reconnue « ${key} » (attendues : deck, questions)`);
  }

  // --- En-tête du deck
  const meta = DeckMetaSchema.safeParse(raw.deck);
  if (!meta.success) {
    for (const issue of meta.error.issues) {
      err(issue.path.length ? `deck, champ « ${formatPath(issue.path)} »` : 'deck', issue.message);
    }
  }

  // --- Questions
  const questions: Question[] = [];
  if (!Array.isArray(raw.questions)) {
    err('questions', 'une liste de questions est attendue');
  } else if (raw.questions.length === 0) {
    err('questions', 'le deck doit contenir au moins une question');
  } else {
    const firstIndexById = new Map<string, number>();

    raw.questions.forEach((q: unknown, index) => {
      const num = index + 1;
      const id = isRecord(q) && typeof q.id === 'string' ? q.id : undefined;
      const where = id ? `question n°${num} (id « ${id} »)` : `question n°${num}`;

      if (!isRecord(q)) {
        err(where, 'un objet est attendu');
        return;
      }

      const def = typeof q.type === 'string' ? getQuestionType(q.type) : undefined;
      if (!def) {
        const got = q.type === undefined ? 'absent' : `« ${String(q.type)} »`;
        err(`${where}, champ « type »`, `type ${got} inconnu (types acceptés : ${knownQuestionTypes().join(', ')})`);
        return;
      }

      const parsed = def.schema.safeParse(q);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) err(`${where}, ${field(issue.path)}`, issue.message);
        return;
      }

      if (id !== undefined) {
        const first = firstIndexById.get(id);
        if (first !== undefined) {
          err(`${where}, champ « id »`, `identifiant déjà utilisé par la question n°${first + 1}`);
          return;
        }
        firstIndexById.set(id, index);
      }
      questions.push(parsed.data);
    });
  }

  if (errors.length > 0 || !meta.success) return { ok: false, errors };
  return { ok: true, deck: { deck: meta.data, questions } };
}
