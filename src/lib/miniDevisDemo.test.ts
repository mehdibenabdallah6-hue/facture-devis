import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MINI_DEMO_ALT,
  MINI_DEMO_CTA,
  MINI_DEMO_IMAGE_HEIGHT,
  MINI_DEMO_IMAGE_SRC,
  MINI_DEMO_IMAGE_WIDTH,
  MINI_DEMO_LABEL,
  MINI_DEMO_REASSURANCE,
  MINI_DEMO_SUBTITLE,
  MINI_DEMO_TITLE,
} from './miniDevisDemo';

describe('mini devis demo marketing', () => {
  it('expose le nouveau contenu marketing en HTML', () => {
    expect(MINI_DEMO_LABEL).toBe('MINI DÉMO');
    expect(MINI_DEMO_TITLE).toBe('De vos notes au devis prêt à signer');
    expect(MINI_DEMO_SUBTITLE).toContain('Dictez une prestation');
    expect(MINI_DEMO_SUBTITLE).toContain('réutilisez votre catalogue');
    expect(MINI_DEMO_CTA).toBe('Créer mon premier devis');
    expect(MINI_DEMO_REASSURANCE).toBe('Gratuit · sans carte bancaire');
  });

  it('pointe vers la nouvelle image premium avec dimensions stables', () => {
    expect(MINI_DEMO_IMAGE_SRC).toBe('/images/photofacto-mini-demo.png');
    expect(MINI_DEMO_IMAGE_WIDTH).toBe(2600);
    expect(MINI_DEMO_IMAGE_HEIGHT).toBe(1462);
    expect(MINI_DEMO_ALT).toContain('notes');
    expect(MINI_DEMO_ALT).toContain('audio');
    expect(MINI_DEMO_ALT).toContain('catalogue');
  });

  it('ne contient pas d’appel IA, upload ou Firestore dans le composant public', () => {
    const component = readFileSync(
      resolve(process.cwd(), 'src/components/MiniDevisDemo.tsx'),
      'utf8',
    );

    expect(component).not.toMatch(/fetch\s*\(/);
    expect(component).not.toContain('/api/gemini');
    expect(component).not.toContain('/api/catalog-import-ai');
    expect(component).not.toMatch(/firebase|firestore|storage/i);
    expect(component).not.toMatch(/input[^>]+type=["']file["']/i);
    expect(component).not.toContain('Photo du carnet');
    expect(component).not.toContain('Dictée');
    expect(component).not.toContain('Texte rapide');
  });
});
