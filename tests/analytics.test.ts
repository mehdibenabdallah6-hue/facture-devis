import { describe, expect, it } from 'vitest';
import {
  bucketAmount,
  sanitizeAnalyticsProps,
  isAllowedAnalyticsEvent,
} from '../src/services/analytics';

describe('analytics sanitizer', () => {
  it('n’autorise que les événements V1 explicitement whitelisted', () => {
    expect(isAllowedAnalyticsEvent('invoice_created')).toBe(true);
    expect(isAllowedAnalyticsEvent('demo_viewed')).toBe(true);
    expect(isAllowedAnalyticsEvent('demo_cta_clicked')).toBe(true);
    expect(isAllowedAnalyticsEvent('login_completed')).toBe(false);
    expect(isAllowedAnalyticsEvent('upsell_banner_shown')).toBe(false);
  });

  it('supprime les propriétés sensibles et non whitelisted', () => {
    const props = sanitizeAnalyticsProps({
      email: 'artisan@example.fr',
      clientEmail: 'client@example.fr',
      address: '1 rue privée',
      siret: '12345678900000',
      signature: 'data:image/png;base64,xxx',
      photo: 'base64-image',
      items: [{ description: 'Pose privée' }],
      prompt: 'Détails chantier privé',
      plan: 'free',
      document_type: 'quote',
      unknown: 'value',
    });

    expect(props).toEqual({
      plan: 'free',
      document_type: 'quote',
    });
  });

  it('convertit les montants exacts en buckets uniquement', () => {
    expect(bucketAmount(0)).toBe('0');
    expect(bucketAmount(75)).toBe('1_100');
    expect(bucketAmount(450)).toBe('101_500');
    expect(bucketAmount(1_250)).toBe('501_2000');
    expect(bucketAmount(8_000)).toBe('2001_plus');

    const props = sanitizeAnalyticsProps({
      totalTTC: 1275,
      amount: 99,
      total_bucket: 'custom',
    });

    expect(props).toEqual({ total_bucket: '501_2000' });
  });

  it('bucketise les compteurs et bloque les valeurs libres trop détaillées', () => {
    const props = sanitizeAnalyticsProps({
      item_count: 13,
      line_count: 2,
      provider: 'password',
      reason: 'quota reached because private text',
      error_type: 'http_500',
    });

    expect(props).toEqual({
      item_count_bucket: '11_20',
      line_count_bucket: '1_2',
      provider: 'password',
      error_type: 'http_500',
    });
  });

  it('autorise uniquement les props non sensibles de la mini-démo', () => {
    const props = sanitizeAnalyticsProps({
      mode: 'photo',
      page: 'generateur-devis-artisan',
      cta: 'create_first_quote',
      text: 'Chez Mme Dupont, salle de bain privée',
      prompt: 'dépose lavabo + adresse privée',
      clientName: 'Mme Dupont',
      amount: 764.5,
    });

    expect(props).toEqual({
      mode: 'photo',
      page: 'generateur-devis-artisan',
      cta: 'create_first_quote',
      total_bucket: '501_2000',
    });
  });
});
