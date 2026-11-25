// Registre des types de questions.
// Ajouter un type = ajouter une entrée ici (schéma + correction). Le reste du moteur
// (validateur, session de quiz) passe par ce registre et ne connaît aucun type en dur.
import { z } from '../zod';
import { BaseQuestionShape } from './deckSchema';

export interface QuestionTypeDefinition {
  /** Valeur du champ « type » dans le deck. */
  type: string;
  /** Schéma complet d'une question de ce type (champs communs inclus). */
  schema: z.ZodType<Question>;
  /** Vérifie qu'une réponse a la bonne forme (ex. index de choix existant). */
  isValidAnswer(question: Question, answer: unknown): boolean;
  isCorrect(question: Question, answer: unknown): boolean;
  /** Texte de la bonne réponse, pour le retour et le récap. */
  correctAnswerText(question: Question): string;
  /** Texte d'une réponse donnée, pour le récap. */
  answerText(question: Question, answer: unknown): string;
}

/** Question à choix (qcm, vrai_faux) : « reponse » est l'index du bon choix, base 0. */
export interface ChoiceQuestion {
  id: string;
  type: 'qcm' | 'vrai_faux';
  difficulte: number;
  enonce: string;
  choix: string[];
  reponse: number;
  explication: string;
  tags?: string[];
}

/** Union de tous les types de questions connus. */
export type Question = ChoiceQuestion;

const TRUE_FALSE_CHOICES = ['Vrai', 'Faux'] as const;

const qcmSchema = z
  .strictObject({
    ...BaseQuestionShape,
    type: z.literal('qcm'),
    choix: z.array(z.string().min(1)).min(2).max(4),
    reponse: z.number().int().min(0),
  })
  .superRefine((q, ctx) => {
    if (q.reponse >= q.choix.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['reponse'],
        message: `index ${q.reponse} hors des choix : doit être entre 0 et ${q.choix.length - 1} (base 0)`,
      });
    }
  });

const trueFalseSchema = z.strictObject({
  ...BaseQuestionShape,
  type: z.literal('vrai_faux'),
  choix: z.tuple([z.literal(TRUE_FALSE_CHOICES[0]), z.literal(TRUE_FALSE_CHOICES[1])], {
    error: `doit valoir exactement ["${TRUE_FALSE_CHOICES[0]}", "${TRUE_FALSE_CHOICES[1]}"]`,
  }),
  reponse: z.union([z.literal(0), z.literal(1)], { error: 'doit valoir 0 (Vrai) ou 1 (Faux)' }),
});

function choiceType(type: ChoiceQuestion['type'], schema: z.ZodType): QuestionTypeDefinition {
  const isIndex = (q: Question, a: unknown): a is number =>
    typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < q.choix.length;
  return {
    type,
    schema: schema as z.ZodType<Question>,
    isValidAnswer: isIndex,
    isCorrect: (q, a) => isIndex(q, a) && a === q.reponse,
    correctAnswerText: (q) => q.choix[q.reponse] ?? '',
    answerText: (q, a) => (isIndex(q, a) ? (q.choix[a] ?? '') : '—'),
  };
}

const REGISTRY = new Map<string, QuestionTypeDefinition>(
  [choiceType('qcm', qcmSchema), choiceType('vrai_faux', trueFalseSchema)].map((def) => [def.type, def]),
);

export function getQuestionType(type: string): QuestionTypeDefinition | undefined {
  return REGISTRY.get(type);
}

export function knownQuestionTypes(): string[] {
  return [...REGISTRY.keys()];
}

/** Raccourci pour le moteur : lève une erreur si le type est inconnu (ne doit pas arriver après validation). */
export function questionType(question: Question): QuestionTypeDefinition {
  const def = REGISTRY.get(question.type);
  if (!def) throw new Error(`Type de question inconnu : ${question.type}`);
  return def;
}
