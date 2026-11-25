// Petit utilitaire de création de DOM, pour éviter un framework UI.

type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  /** Balisage de confiance uniquement (icônes SVG du code), jamais de contenu de deck. */
  html?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
  style?: Record<string, string>;
  on?: { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const [name, value] of Object.entries(props.style ?? {})) el.style.setProperty(name, value);
  for (const [type, handler] of Object.entries(props.on ?? {})) el.addEventListener(type, handler as EventListener);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'number' ? String(child) : child);
  }
  return el;
}

/** Variables CSS d'une famille (couleur pastel + ton profond), avec repli si le thème ne la connaît pas. */
export function familyVars(familyId: string): Record<string, string> {
  return {
    '--fam': `var(--family-${familyId}, var(--family-fallback))`,
    '--fam-deep': `var(--family-${familyId}-deep, var(--family-fallback-deep))`,
  };
}

/** Variable CSS du contour de rareté. */
export function rarityVars(rarityId: string): Record<string, string> {
  return { '--rar': `var(--rarity-${rarityId}, var(--rarity-fallback))` };
}
