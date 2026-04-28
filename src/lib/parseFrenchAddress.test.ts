import { describe, it, expect } from 'vitest';
import { parseFrenchAddress } from '../services/facturx';

describe('parseFrenchAddress', () => {
  it('returns empty parts for empty input', () => {
    expect(parseFrenchAddress('')).toEqual({ street: '', postcode: '', city: '' });
    expect(parseFrenchAddress('   ')).toEqual({ street: '', postcode: '', city: '' });
  });

  it('parses the canonical 2-segment form', () => {
    expect(parseFrenchAddress('12 rue Lafayette, 75001 Paris')).toEqual({
      street: '12 rue Lafayette',
      postcode: '75001',
      city: 'Paris',
    });
  });

  it('parses 3-segment form (street, postcode, city)', () => {
    expect(parseFrenchAddress('12 rue Lafayette, 75001, Paris')).toEqual({
      street: '12 rue Lafayette',
      postcode: '75001',
      city: 'Paris',
    });
  });

  it('parses newline-separated form', () => {
    expect(parseFrenchAddress('12 rue Lafayette\n75001 Paris')).toEqual({
      street: '12 rue Lafayette',
      postcode: '75001',
      city: 'Paris',
    });
  });

  it('handles overseas postcodes (97xxx, 98xxx)', () => {
    expect(parseFrenchAddress('Bd. Maritime, 97200 Fort-de-France')).toEqual({
      street: 'Bd. Maritime',
      postcode: '97200',
      city: 'Fort-de-France',
    });
    expect(parseFrenchAddress('Av. Paul Doumer, 98800 Nouméa')).toEqual({
      street: 'Av. Paul Doumer',
      postcode: '98800',
      city: 'Nouméa',
    });
  });

  it('keeps multi-segment streets (e.g. building + floor)', () => {
    expect(parseFrenchAddress('Tour Eiffel, Champ de Mars, 75007 Paris')).toEqual({
      street: 'Tour Eiffel, Champ de Mars',
      postcode: '75007',
      city: 'Paris',
    });
  });

  it('falls back to {street: full input} when no postcode is found', () => {
    expect(parseFrenchAddress('12 rue Lafayette')).toEqual({
      street: '12 rue Lafayette',
      postcode: '',
      city: '',
    });
  });

  it('handles "75001 Paris" alone (no street)', () => {
    expect(parseFrenchAddress('75001 Paris')).toEqual({
      street: '',
      postcode: '75001',
      city: 'Paris',
    });
  });
});
