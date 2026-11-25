// Format d'un deck (voir CLAUDE.md, « Format d'un deck »).
// Les champs sont en français car c'est le format public des decks.
import { z } from '../zod';

export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;

export const DeckMetaSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'identifiant attendu en minuscules séparées par des tirets (ex. « cesi-reseaux-tcp-ip »)'),
  titre: z.string().min(1),
  matiere: z.string().min(1),
  niveau: z.string().min(1),
  auteur: z.string().min(1),
  version: z.number().int().min(1),
  langue: z.string().min(2),
});

/** Champs communs à tous les types de questions. */
export const BaseQuestionShape = {
  id: z.string().min(1),
  difficulte: z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX),
  enonce: z.string().min(1),
  explication: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
};

export type DeckMeta = z.infer<typeof DeckMetaSchema>;
