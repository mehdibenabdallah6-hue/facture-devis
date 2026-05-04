export type MiniDemoMode = 'photo' | 'voice' | 'text';

export interface MiniDemoModeConfig {
  id: MiniDemoMode;
  label: string;
  title: string;
  content: string;
}

export interface MiniDemoQuoteLine {
  label: string;
  amountHT: number;
}

export const MINI_DEMO_NOTICE =
  'Démo illustrative · dans votre compte, Photofacto utilise vos propres prestations et vos prix.';

export const MINI_DEMO_MODES: MiniDemoModeConfig[] = [
  {
    id: 'photo',
    label: 'Photo du carnet',
    title: 'Notes fictives prises en photo',
    content:
      'Mme Dupont - SDB\n- dépose ancien lavabo\n- pose meuble vasque\n- mitigeur\n- joints silicone\n- 3h main-d’œuvre\n- déplacement',
  },
  {
    id: 'voice',
    label: 'Dictée',
    title: 'Fausse dictée artisan',
    content:
      'Chez Mme Dupont, salle de bain : déposer l’ancien lavabo, poser un meuble vasque, remplacer le mitigeur, refaire les joints silicone, prévoir 3 heures de main-d’œuvre et le déplacement.',
  },
  {
    id: 'text',
    label: 'Texte rapide',
    title: 'Texte local modifiable',
    content:
      'Dépose ancien lavabo, pose meuble vasque, pose mitigeur, joints silicone, main-d’œuvre 3h et déplacement.',
  },
];

export const MINI_DEMO_QUOTE_LINES: MiniDemoQuoteLine[] = [
  { label: 'Dépose de l’ancien lavabo', amountHT: 85 },
  { label: 'Pose du meuble vasque', amountHT: 280 },
  { label: 'Pose mitigeur', amountHT: 95 },
  { label: 'Joints silicone', amountHT: 45 },
  { label: 'Main-d’œuvre 3h', amountHT: 165 },
  { label: 'Déplacement', amountHT: 25 },
];

export const MINI_DEMO_TOTAL_HT = MINI_DEMO_QUOTE_LINES.reduce(
  (sum, line) => sum + line.amountHT,
  0,
);
export const MINI_DEMO_VAT_RATE = 10;
export const MINI_DEMO_VAT = +(MINI_DEMO_TOTAL_HT * (MINI_DEMO_VAT_RATE / 100)).toFixed(2);
export const MINI_DEMO_TOTAL_TTC = +(MINI_DEMO_TOTAL_HT + MINI_DEMO_VAT).toFixed(2);

export function getMiniDemoMode(mode: MiniDemoMode): MiniDemoModeConfig {
  return MINI_DEMO_MODES.find(item => item.id === mode) || MINI_DEMO_MODES[0];
}
