/** Bilingual copy for the desktop showcase landing — see demo-showcase.component.ts.
 *  Not a general i18n setup (ARCHITECTURE.md: "No i18n — single-tenant
 *  single-locale for now"), just this one public-facing page having both
 *  languages, matching the README's EN/ES split. The app itself (inside
 *  the phone) stays Spanish-only regardless of this toggle. */
export type ShowcaseLang = 'en' | 'es';

export interface ShowcaseCopy {
  eyebrow: string;
  tagline: string;
  features: readonly string[];
  githubLabel: string;
  caption: string;
}

export const SHOWCASE_COPY: Record<ShowcaseLang, ShowcaseCopy> = {
  en: {
    eyebrow: 'Public demo',
    tagline: "Workout tracker for Proteus's gym module. This is the real app running on sample data, not screenshots.",
    features: [
      'Routines in folders, with drag-and-drop between them',
      'Live session with a rest timer',
      'Real-time personal record detection',
      'Ghost values from your last session',
    ],
    githubLabel: 'View on GitHub',
    caption: 'Atlas is a mobile app — this is a desktop preview.',
  },
  es: {
    eyebrow: 'Demo pública',
    tagline: 'Tracker de entrenamientos para el módulo Gimnasio de Proteus. Esto es la app real corriendo con datos de prueba, no capturas.',
    features: [
      'Rutinas en carpetas, con drag-and-drop entre ellas',
      'Sesión en vivo con cronómetro de descanso',
      'Detección de récords personales en tiempo real',
      'Valores fantasma de tu entrenamiento anterior',
    ],
    githubLabel: 'Ver en GitHub',
    caption: 'Atlas es una app mobile — esto es una vista previa de escritorio.',
  },
};
