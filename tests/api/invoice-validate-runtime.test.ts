import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('api invoice-validate runtime safety', () => {
  it('importe api/invoice-validate sans planter au chargement du module', async () => {
    const mod = await import('../../api/invoice-validate');
    expect(mod.default).toEqual(expect.any(Function));
  });

  it('empêche les fonctions API d’importer du code frontend depuis src/', () => {
    const apiFiles = listTsFiles(join(process.cwd(), 'api'));
    const offenders = apiFiles
      .map(file => ({
        file,
        content: readFileSync(file, 'utf8'),
      }))
      .filter(({ content }) => /\bfrom\s+['"][^'"]*\/src\//.test(content) || /\bimport\s*\([^)]*['"][^'"]*\/src\//.test(content))
      .map(({ file }) => file.replace(`${process.cwd()}/`, ''));

    expect(offenders).toEqual([]);
  });

  it('api/_lib/billing importe le billing partagé, pas src/lib/billing', () => {
    const content = readFileSync(join(process.cwd(), 'api/_lib/billing.ts'), 'utf8');
    expect(content).toContain('../../shared/billing');
    expect(content).not.toContain('../../src/lib/billing');
  });
});

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listTsFiles(fullPath);
    return fullPath.endsWith('.ts') ? [fullPath] : [];
  });
}
