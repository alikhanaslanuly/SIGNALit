import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('renders localized, labeled light and dark controls', () => {
    const html = renderToStaticMarkup(<ThemeToggle locale="ru" theme="dark" onChange={() => {}} />);
    expect(html).toContain('Тема');
    expect(html).toContain('Светлая');
    expect(html).toContain('Тёмная');
    expect(html).toContain('aria-pressed="true"');
  });
});
