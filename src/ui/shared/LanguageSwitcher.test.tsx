import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageSwitcher } from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('uses semantic buttons and exposes the selected language', () => {
    const html = renderToStaticMarkup(<LanguageSwitcher locale="ru" onChange={vi.fn()} label="Язык" />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Язык"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('RU');
    expect(html).toContain('EN');
  });
});
