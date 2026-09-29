import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

async function english(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('signal.locale', 'en'); localStorage.setItem('signal-theme', 'light'); });
}
async function session(page: Page, name = 'Demo patient') {
  await english(page); await page.goto('/register?demo=1');
  await page.getByLabel('Display name').fill(name); await page.getByLabel('Room', { exact: true }).fill('204');
  await page.getByRole('button', { name: 'Create patient session', exact: true }).click();
  const href = await page.getByRole('link', { name: 'Open patient view', exact: true }).getAttribute('href');
  expect(href).toContain('patientId='); return href!;
}
async function pair(browser: Browser, staff: Page) {
  const href = await session(staff); const id = new URL(href, 'http://local').searchParams.get('patientId')!;
  const patientContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5180' }); const patient = await patientContext.newPage(); await english(patient);
  await patient.goto(`${href}&debug=1`); await patient.getByRole('button', { name: 'Start mock', exact: true }).click();
  await staff.goto(`/dashboard/requests?demo=1&patientId=${id}`); await expect(staff.getByText('No open requests', { exact: true })).toBeVisible();
  return { patient, patientContext, id, href };
}

test('judge demo lifecycle — two independent contexts: intent, acknowledgement, two replies, completion, refresh and history', async ({ page: staff, browser }) => {
  const { patient, patientContext, id } = await pair(browser, staff);
  await patient.getByRole('button', { name: 'HELP confirmed', exact: true }).click();
  await expect(staff.locator('.queue-row')).toHaveCount(1); await expect(staff.locator('.request-toast')).toContainText('New request');
  await staff.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(patient.locator('.signal-request--acknowledged')).toBeVisible();
  await staff.getByRole('button', { name: 'Please wait a moment', exact: true }).click();
  await expect(patient.locator('.signal-nurse-note')).toContainText('Please wait');
  await staff.getByRole('button', { name: 'I’m coming', exact: true }).click();
  await expect(patient.locator('.signal-nurse-note')).toContainText('coming');
  await staff.getByRole('button', { name: 'Complete request', exact: true }).click();
  await expect(patient.locator('.signal-request--completed')).toBeVisible();
  await expect(staff.locator('.request-detail .status-chip')).toHaveText('Completed');
  await expect(staff.locator('.request-timeline')).toContainText('Please wait a moment');
  await patient.reload(); await expect(patient.locator('.signal-request--completed')).toBeVisible();
  await staff.reload(); await expect(staff.locator('.request-toast')).toHaveCount(0);
  await staff.getByRole('button', { name: 'All', exact: true }).click(); await expect(staff.locator('.queue-row')).toHaveCount(1);
  await staff.goto(`/dashboard/dialog?demo=1&patientId=${id}`);
  await expect(staff.locator('.message--nurse')).toHaveCount(2);
  await expect(staff.locator('.message--nurse time')).toHaveCount(2);
  await patientContext.close();
});

test('lost connection, explicit retry, delayed HTTP/socket overlap, and reconnect recovery', async ({ page: staff, browser }) => {
  const { patient, patientContext } = await pair(browser, staff);
  await patientContext.setOffline(true); await patient.getByRole('button', { name: 'HELP confirmed', exact: true }).click();
  await expect(patient.locator('.patient-delivery-error')).toContainText('Delivery has not been confirmed');
  await expect(staff.locator('.queue-row')).toHaveCount(0);
  await patientContext.setOffline(false);
  await patient.route('**/api/requests', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 1200)); await route.fulfill({ response });
  });
  await patient.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(staff.locator('.queue-row')).toHaveCount(1);
  await staff.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(patient.locator('.signal-request--acknowledged')).toBeVisible();
  await patient.unroute('**/api/requests');
  await patientContext.setOffline(true);
  await staff.getByRole('button', { name: 'I’m coming', exact: true }).click();
  await staff.getByRole('button', { name: 'Complete request', exact: true }).click();
  await patientContext.setOffline(false); await expect(patient.locator('.signal-request--completed')).toBeVisible({ timeout: 20000 });
  await expect(patient.locator('.signal-nurse-note')).toContainText('coming');
  await staff.context().setOffline(true); await staff.context().setOffline(false); await staff.reload();
  await staff.getByRole('button', { name: 'All', exact: true }).click(); await expect(staff.locator('.queue-row')).toHaveCount(1);
  await expect(staff.locator('.request-toast')).toHaveCount(0); await patientContext.close();
});

test('camera denial produces an actionable recovery screen', async ({ page }) => {
  const href = await session(page, 'Demo camera check');
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Test denial', 'NotAllowedError'); }; });
  await page.goto(href); await page.getByRole('button', { name: 'Turn on camera', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Camera access is blocked');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
});

test('route and width audit with documentation screenshots', async ({ page: staff, browser }) => {
  test.setTimeout(120000); mkdirSync('docs/assets', { recursive: true });
  const { patient, patientContext, id } = await pair(browser, staff);
  const errors: string[] = []; staff.on('pageerror', error => errors.push(error.message)); staff.on('console', message => { if (message.type() === 'error') errors.push(message.text()); }); patient.on('pageerror', error => errors.push(error.message));
  await patient.getByRole('button', { name: 'HELP confirmed', exact: true }).click(); await expect(staff.locator('.queue-row')).toHaveCount(1);
  await staff.getByRole('button', { name: 'Acknowledge', exact: true }).click(); await staff.getByRole('button', { name: 'I’m coming', exact: true }).click();
  await expect(patient.locator('.signal-request--acknowledged')).toBeVisible();
  await patient.getByText('Debug · mock engine', { exact: true }).click();
  await patient.locator('.signal-patient').screenshot({ path: 'docs/assets/patient-test-input.png', style: '.signal-debug { visibility: hidden !important; }' });
  const paths = ['/', '/register', '/patient', '/dashboard', '/dashboard/requests', '/dashboard/patients', '/dashboard/patients/new', `/dashboard/patients/${id}`, `/dashboard/dialog?patientId=${id}`, '/dashboard/quality', '/dashboard/quality/camera-test', '/demo'];
  for (const width of [390, 430, 768, 1024, 1440, 1920]) {
    await staff.setViewportSize({ width, height: 1000 });
    for (const path of paths) {
      await staff.goto(path); await expect(staff.locator('main').first()).toBeVisible();
      await expect(staff.getByRole('heading', { name: 'This screen could not load' })).toHaveCount(0);
      await expect.poll(() => staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await patient.setViewportSize({ width, height: 1000 });
    await expect.poll(() => patient.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await staff.setViewportSize({ width: 1440, height: 1000 });
  for (const [name, path] of [['entry', '/'], ['overview', '/dashboard'], ['request-queue', '/dashboard/requests'], ['patient-profile', `/dashboard/patients/${id}`], ['dialog', `/dashboard/dialog?patientId=${id}`], ['quality', '/dashboard/quality'], ['camera-qa', '/dashboard/quality/camera-test']]) {
    await staff.goto(path === '/' ? path : `${path}${path.includes('?')?'&':'?'}demo=1&patientId=${id}`); await expect(staff.locator('.loading-skeleton')).toHaveCount(0);
    await staff.screenshot({ path: `docs/assets/${name}.png`, fullPage: true });
  }
  await patient.setViewportSize({ width: 390, height: 844 }); await patient.locator('.signal-patient').screenshot({ path: 'docs/assets/patient-mobile-test-input.png', style: '.signal-debug { visibility: hidden !important; }' });
  await staff.goto('/src/ui/patient/dev/index.html'); await staff.getByRole('button', { name: 'EN', exact: true }).click();
  await staff.getByRole('button', { name: 'HELP correction', exact: true }).click();
  await expect(staff.locator('.signal-hint__text')).toContainText('little finger');
  await staff.locator('.signal-patient').screenshot({ path: 'docs/assets/error-mode-fixture.png' });
  expect(errors).toEqual([]); await patientContext.close();
});

test('real model initializes and analyzes a synthetic browser camera; stream interruption is recoverable', async () => {
  test.setTimeout(60000);
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5180', permissions: ['camera'] }); const page = await context.newPage(); await english(page);
  await page.goto('/dashboard/quality'); await page.getByRole('button', { name: 'Start camera check', exact: true }).click();
  await expect(page.getByText('Ready on this device', { exact: false })).toBeVisible({ timeout: 40000 });
  const cameraTrack = await page.locator('video').evaluate(video => ((video as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0].id);
  await page.getByRole('button', {name:'RU',exact:true}).click();
  await expect(page.locator('video')).toBeVisible();
  expect(await page.locator('video').evaluate(video => ((video as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0].id)).toBe(cameraTrack);
  await page.getByRole('button', {name:'EN',exact:true}).click();
  await page.evaluate(() => { const track = (document.querySelector('video')!.srcObject as MediaStream).getVideoTracks()[0]; track.dispatchEvent(new Event('ended')); });
  await expect(page.getByRole('alert')).toContainText('Camera stream interrupted');
  await expect(page.getByText('Ready on this device', { exact: false })).toHaveCount(0);
  await page.goto('/dashboard/quality/camera-test');await page.getByLabel('Device name',{exact:true}).fill('Synthetic test camera');
  await page.getByRole('button',{name:'Start QA camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start attempt',exact:true})).toBeEnabled({timeout:30000});
  await page.getByRole('button',{name:'Start attempt',exact:true}).click();
  await page.getByRole('button',{name:'Finish attempt',exact:true}).click();
  await page.getByRole('combobox',{name:'Was the intended gesture recognized correctly?',exact:true}).selectOption('no');
  await page.getByRole('combobox',{name:'Was the finger highlight aligned with your actual finger?',exact:true}).selectOption('na');
  await page.getByRole('combobox',{name:'Did any false confirmation occur?',exact:true}).selectOption('no');
  await page.getByRole('button',{name:'Save review & next gesture',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download JSON',exact:true}).click();
  const download=await downloadPromise;const report=JSON.parse(readFileSync((await download.path())!,'utf8'));
  expect(report.attempts).toHaveLength(1);expect(report.summary.ready).toBe(false);
  expect(report.attempts[0].review.correctRecognition).toBe(false);expect(report.attempts[0]).not.toHaveProperty('landmarks');
  const csvPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();
  const csv=readFileSync((await (await csvPromise).path())!,'utf8');expect(csv).toContain('Synthetic test camera');expect(csv).not.toMatch(/data:image|landmarks/);
  await page.getByRole('button',{name:'Stop camera',exact:true}).click();
  await browser.close();
});

test('Russian, dark theme, reduced motion and keyboard entry remain usable', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('signal.locale', 'ru'); localStorage.setItem('signal-theme', 'dark'); });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/dashboard');
  await page.keyboard.press('Tab'); await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('#staff-content')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/dashboard/quality');
  await expect(page.getByRole('heading', { name: 'Проверка системы', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.signalTheme)).toBe('dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('production presentation routes use the backend and cannot enable mock controls', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5181' }); const page = await context.newPage();
  const href = await session(page, 'Demo production'); await page.goto(`${href}&debug=1`);
  await expect(page.getByRole('button', { name: 'Turn on camera', exact: true })).toBeVisible();
  await expect(page.getByText('Presentation session', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start mock', exact: true })).toHaveCount(0);
  await page.goto('/dashboard/quality'); await expect(page.getByRole('heading', { name: 'System check', exact: true })).toBeVisible();
  await expect(page.locator('.connection--connected')).toBeVisible(); await context.close();
});


test('session URLs, QR and clipboard fallback preserve the exact session', async ({ page }) => {
 const href=await session(page,'Demo links');
 const patientUrl=await page.getByLabel('Patient URL',{exact:true}).inputValue();
 expect(patientUrl).toBe(new URL(href,'http://127.0.0.1:5180').href);
 expect(await page.getByLabel('Staff URL',{exact:true}).inputValue()).toContain(new URL(patientUrl).searchParams.get('patientId')!);
 await expect(page.getByRole('img',{name:'Patient session QR code'})).toBeVisible();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied');}},configurable:true}));
 await page.getByRole('button',{name:'Copy Patient URL',exact:true}).click();
 await expect(page.getByText('Link selected. Copy it manually.')).toBeVisible();
 await expect(page.getByLabel('Patient URL',{exact:true})).toBeFocused();
});

test('team camera QA is separate, empty and honest before real trials',async({page})=>{
 await english(page);await page.goto('/dashboard/quality/camera-test');
 await expect(page.getByRole('heading',{name:'Team camera QA',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Download JSON',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Start attempt',exact:true})).toBeDisabled();
 await expect(page.getByText('NEEDS REVIEW',{exact:true})).toBeVisible();
});

test('HTTP parser rejects malformed and oversized bodies; untrusted text stays text',async({page,request})=>{
 const url='http://127.0.0.1:4610/api/patients';
 expect((await request.post(url,{headers:{'content-type':'application/json'},data:'{broken'})).status()).toBe(400);
 expect((await request.post(url,{data:{displayName:'x'.repeat(40000),room:'204'}})).status()).toBe(413);
 const markup='<script>alert(1)</script>';await session(page,markup);
 await expect(page.locator('.session-ready')).toContainText(markup);
 expect(await page.locator('.session-ready script').count()).toBe(0);
});
