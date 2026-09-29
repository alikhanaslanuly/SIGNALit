import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';
afterEach(() => vi.unstubAllGlobals());
describe('product route rendering', () => {
  for (const path of ['/', '/register', '/patient', '/dashboard', '/dashboard/requests', '/dashboard/patients', '/dashboard/patients/demo-id', '/dashboard/dialog', '/dashboard/quality']) {
    it(`renders ${path} without throwing`, () => {
      vi.stubGlobal('window', { location: { pathname: path, search: '', origin: 'http://localhost:5173' }, localStorage: { getItem: () => 'light' }, matchMedia: () => ({ matches: false }) });
      const html = renderToStaticMarkup(<App />);
      expect(html).toContain('SIGNAL'); expect(html).toContain('<main'); expect(html).not.toContain('undefined');
      if (path.startsWith('/dashboard')) expect(html).toContain('/dashboard/quality');
    });
  }
});
