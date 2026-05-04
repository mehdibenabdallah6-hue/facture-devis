import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MINI_DEMO_MODES,
  MINI_DEMO_NOTICE,
  MINI_DEMO_QUOTE_LINES,
  MINI_DEMO_TOTAL_HT,
  MINI_DEMO_TOTAL_TTC,
  MINI_DEMO_VAT,
  MINI_DEMO_VAT_RATE,
} from './miniDevisDemo';

describe('mini devis demo marketing', () => {
  it('affiche une démo illustrative avec les 3 modes simulés', () => {
    expect(MINI_DEMO_NOTICE).toContain('Démo illustrative');
    expect(MINI_DEMO_NOTICE).toContain('vos propres prestations et vos prix');
    expect(MINI_DEMO_MODES.map(mode => mode.id)).toEqual(['photo', 'voice', 'text']);
    expect(MINI_DEMO_MODES.map(mode => mode.label)).toEqual([
      'Photo du carnet',
      'Dictée',
      'Texte rapide',
    ]);
  });

  it('utilise des lignes fixes issues du catalogue démo', () => {
    expect(MINI_DEMO_QUOTE_LINES).toEqual([
      { label: 'Dépose de l’ancien lavabo', amountHT: 85 },
      { label: 'Pose du meuble vasque', amountHT: 280 },
      { label: 'Pose mitigeur', amountHT: 95 },
      { label: 'Joints silicone', amountHT: 45 },
      { label: 'Main-d’œuvre 3h', amountHT: 165 },
      { label: 'Déplacement', amountHT: 25 },
    ]);
    expect(MINI_DEMO_TOTAL_HT).toBe(695);
    expect(MINI_DEMO_VAT_RATE).toBe(10);
    expect(MINI_DEMO_VAT).toBe(69.5);
    expect(MINI_DEMO_TOTAL_TTC).toBe(764.5);
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
  });
});
