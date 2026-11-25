import { describe, expect, it } from 'vitest';
import { validateDeck } from '../src/core/deck/validateDeck';
import { loadDeck, rawDeck } from './helpers';

type Json = Record<string, any>;

function errorsOf(mutate: (raw: Json) => void): string[] {
  const raw = rawDeck() as Json;
  mutate(raw);
  const result = validateDeck(raw, 'test.json');
  return result.ok ? [] : result.errors;
}

describe('deck cesi-reseaux-tcp-ip', () => {
  const { deck, questions } = loadDeck();

  it('est valide et contient 30 questions', () => {
    expect(deck.id).toBe('cesi-reseaux-tcp-ip');
    expect(questions).toHaveLength(30);
  });

  it('couvre toutes les difficultés, avec plus de questions faciles que difficiles', () => {
    const count = (d: number) => questions.filter((q) => q.difficulte === d).length;
    for (let d = 1; d <= 5; d++) expect(count(d), `difficulté ${d}`).toBeGreaterThan(0);
    for (let d = 1; d < 5; d++) expect(count(d), `difficulté ${d} vs ${d + 1}`).toBeGreaterThanOrEqual(count(d + 1));
    expect(count(1) + count(2)).toBeGreaterThan(count(4) + count(5));
  });

  it('mélange QCM et vrai/faux, avec une explication pour chaque question', () => {
    expect(questions.some((q) => q.type === 'qcm')).toBe(true);
    expect(questions.some((q) => q.type === 'vrai_faux')).toBe(true);
    for (const q of questions) expect(q.explication.length, q.id).toBeGreaterThan(20);
  });
});

describe('validateDeck', () => {
  it('refuse un index de réponse hors des choix, en citant la question et le champ', () => {
    const errors = errorsOf((raw) => {
      raw.questions[2].reponse = 5; // q003, vrai_faux
      raw.questions[0].reponse = 4; // q001, qcm à 4 choix
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('question n°1 (id « q001 »)');
    expect(errors[0]).toContain('champ « reponse »');
    expect(errors[0]).toContain('entre 0 et 3');
    expect(errors[1]).toContain('question n°3 (id « q003 »)');
    expect(errors[1]).toContain('0 (Vrai) ou 1 (Faux)');
  });

  it('refuse un vrai/faux dont les choix ne sont pas ["Vrai", "Faux"]', () => {
    const errors = errorsOf((raw) => {
      raw.questions[2].choix = ['Oui', 'Non'];
    });
    expect(errors.join('\n')).toContain('question n°3');
    expect(errors.join('\n')).toContain('choix');
  });

  it('refuse un QCM avec 1 ou 5 choix', () => {
    expect(errorsOf((raw) => (raw.questions[0].choix = ['seul']))).not.toEqual([]);
    expect(errorsOf((raw) => (raw.questions[0].choix = ['a', 'b', 'c', 'd', 'e']))).not.toEqual([]);
  });

  it('refuse une difficulté hors de 1 à 5 ou non entière', () => {
    const errors = errorsOf((raw) => {
      raw.questions[0].difficulte = 6;
      raw.questions[1].difficulte = 2.5;
    });
    expect(errors).toHaveLength(2);
    expect(errors.every((e) => e.includes('champ « difficulte »'))).toBe(true);
  });

  it('refuse un type inconnu en listant les types acceptés', () => {
    const errors = errorsOf((raw) => {
      raw.questions[4].type = 'texte_libre';
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('question n°5');
    expect(errors[0]).toContain('« texte_libre » inconnu');
    expect(errors[0]).toContain('qcm, vrai_faux');
  });

  it('refuse deux questions avec le même id', () => {
    const errors = errorsOf((raw) => {
      raw.questions[9].id = 'q001';
    });
    expect(errors).toEqual(['test.json · question n°10 (id « q001 »), champ « id » : identifiant déjà utilisé par la question n°1']);
  });

  it('refuse une explication manquante et un champ inconnu', () => {
    const errors = errorsOf((raw) => {
      delete raw.questions[0].explication;
      raw.questions[1].explanation = 'faute de frappe';
    });
    expect(errors.some((e) => e.includes('question n°1') && e.includes('explication'))).toBe(true);
    expect(errors.some((e) => e.includes('question n°2') && e.includes('explanation'))).toBe(true);
  });

  it("refuse un en-tête de deck incomplet", () => {
    const errors = errorsOf((raw) => {
      delete raw.deck.titre;
      raw.deck.version = 0;
    });
    expect(errors.some((e) => e.includes('deck, champ « titre »'))).toBe(true);
    expect(errors.some((e) => e.includes('deck, champ « version »'))).toBe(true);
  });

  it('refuse un fichier qui n’est pas un deck', () => {
    expect(validateDeck([], 'x.json').ok).toBe(false);
    expect(validateDeck({ deck: {}, questions: [] }, 'x.json').ok).toBe(false);
  });
});
