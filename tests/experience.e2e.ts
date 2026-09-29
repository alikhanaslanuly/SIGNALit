import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function english(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('signal.locale', 'en'); localStorage.setItem('signal-theme', 'light'); });
}
async function createSession(page: Page) {
  await english(page); await page.goto('/register?demo=1');
  await page.getByLabel('Display name').fill('Demo experience'); await page.getByLabel('Room', {exact: true}).fill('204');
  await page.getByRole('button', {name:'Create patient session',exact:true}).click();
  const href = (await page.getByRole('link', {name:'Open patient view',exact:true}).getAttribute('href'))!;
  return {href, id:new URL(href,'http://local').searchParams.get('patientId')!};
}
async function scan(page: Page) {
  await expect(page.locator('.loading-skeleton')).toHaveCount(0);
  const result = await new AxeBuilder({page}).analyze();
  expect(result.violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.map(n=>({target:n.target, summary:n.failureSummary}))}))).toEqual([]);
  expect(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(n=>n.id); return ids.filter((id,i)=>ids.indexOf(id)!==i); })).toEqual([]);
}
// Reach controls by actual Tab traversal; focus() would conceal keyboard traps.
async function tabTo(page: Page, target: Locator) {
  for(let i=0;i<100;i++) {
    if(await target.evaluate(el=>el === document.activeElement)) {
      await expect(target).toBeFocused();
      expect(await target.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none'); return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error('Control is not reachable by Tab');
}

test('axe accessibility — major routes, RU/EN, light/dark and active patient states', async ({page: setup,browser}) => {
  test.setTimeout(240000);
  const {href,id}=await createSession(setup);
  const routes=['/','/register','/patient',href,'/dashboard','/dashboard/requests','/dashboard/patients',`/dashboard/patients/${id}`,'/dashboard/dialog','/dashboard/quality','/dashboard/quality/camera-test'];
  for(const theme of ['light','dark']) for(const locale of ['en','ru']) {
    const context=await browser.newContext({baseURL:'http://127.0.0.1:5180'}); const page=await context.newPage();
    await page.addInitScript(({theme,locale})=>{localStorage.setItem('signal-theme',theme);localStorage.setItem('signal.locale',locale);},{theme,locale});
    for(const route of routes) { await page.goto(route); await expect(page.locator('main')).toBeVisible(); await scan(page); }
    await page.goto('/src/ui/patient/dev/index.html');
    await page.getByRole('button',{name:locale.toUpperCase(),exact:true}).click();
    for(const state of ['HELP correction','Calibration','Training + hint','Question','Confirm request','Urgent request','Acknowledged','Results']) {
      await page.getByRole('button',{name:state,exact:true}).click(); await scan(page);
    }
    await context.close();
  }
});

test('keyboard staff lifecycle and locale changes preserve selection and patient session',async({page:staff,browser})=>{
  const {href,id}=await createSession(staff);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5180'}); const patient=await context.newPage();await english(patient);
  await patient.goto(href+'&debug=1');await patient.getByRole('button',{name:'Start mock',exact:true}).click();
  await patient.getByRole('button',{name:'HELP confirmed',exact:true}).click();
  await staff.goto(`/dashboard/requests?demo=1&patientId=${id}`);await expect(staff.locator('.queue-row')).toHaveCount(1);
  await tabTo(staff,staff.locator('.queue-row'));await staff.keyboard.press('Enter');
  await tabTo(staff,staff.getByRole('button',{name:'Acknowledge',exact:true}));await staff.keyboard.press('Enter');
  await expect(patient.locator('.signal-request--acknowledged')).toBeVisible();
  await tabTo(staff,staff.getByRole('button',{name:'I’m coming',exact:true}));await staff.keyboard.press('Enter');
  await expect(patient.locator('.signal-nurse-note')).toContainText('coming');
  await tabTo(staff,staff.getByRole('button',{name:'RU',exact:true}));await staff.keyboard.press('Enter');
  await expect(staff.locator('.queue-row')).toHaveAttribute('aria-pressed','true');
  await tabTo(staff,staff.getByRole('button',{name:'EN',exact:true}));await staff.keyboard.press('Enter');
  await expect(staff.locator('.request-detail')).toContainText('I’m coming');
  await tabTo(staff,staff.locator('.staff-topbar button[aria-pressed]').first());await staff.keyboard.press('Space');
  await expect(staff.locator('.staff-topbar button[aria-pressed]').first()).toHaveAttribute('aria-pressed','true');
  await tabTo(patient,patient.getByRole('button',{name:'RU',exact:true}));await patient.keyboard.press('Enter');
  await expect(patient.locator('.signal-patient')).toHaveAttribute('data-active','true');
  await expect(patient.locator('.signal-request--acknowledged')).toBeVisible(); await expect(patient.locator('.signal-nurse-note')).not.toBeEmpty();
  await expect(patient.locator('.connection--connected')).toBeVisible();
  await tabTo(patient,patient.getByRole('button',{name:'EN',exact:true}));await patient.keyboard.press('Enter');
  await tabTo(patient,patient.locator('.signal-speech'));await patient.keyboard.press('Space');
  expect(await patient.evaluate(()=>localStorage.getItem('signal.speech'))).toBe('true');
  await tabTo(staff,staff.getByRole('button',{name:'Complete request',exact:true}));await staff.keyboard.press('Enter');
  await expect(patient.locator('.signal-request--completed')).toBeVisible();
  for(const path of ['/dashboard','/dashboard/requests','/dashboard/patients','/dashboard/dialog','/dashboard/quality']) {
    await tabTo(staff,staff.locator(`nav a[href="${path}"]`));await staff.keyboard.press('Enter'); await expect.poll(()=>new URL(staff.url()).pathname).toBe(path);
  }
  await context.close();
});

test('keyboard camera retry and neutral audio diagnostic work without physical output claims',async({page})=>{
  const {href}=await createSession(page);
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Test denial','NotAllowedError');};});
  await page.goto(href);await tabTo(page,page.getByRole('button',{name:'Turn on camera',exact:true}));await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Camera access is blocked');
  await tabTo(page,page.getByRole('button',{name:'Try again',exact:true}));await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeEnabled();
  await page.goto('/dashboard/quality');
  await page.evaluate(()=>{(window as any).__spoken=[];window.speechSynthesis.speak=u=>{(window as any).__spoken.push({text:u.text,lang:u.lang});};});
  await tabTo(page,page.getByRole('checkbox',{name:'Enable test sound',exact:true}));await page.keyboard.press('Space');
  await tabTo(page,page.getByRole('button',{name:'Play test sound',exact:true}));await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>(window as any).__spoken)).toEqual([{text:'SIGNALit audio test.',lang:'en-US'}]);
  await page.getByRole('button',{name:'RU',exact:true}).click();
  await page.getByRole('button',{name:'Воспроизвести тест',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__spoken.at(-1))).toEqual({text:'Проверка звука SIGNALit.',lang:'ru-RU'});
});

// Double computed font sizes (including px declarations), preserving viewport width.
// This is text enlargement stress coverage, not a claim of OS-level zoom testing.
async function enlarge(page:Page) {
 await page.evaluate(()=>{
   const elements=[...document.querySelectorAll<HTMLElement>('body *')];
   const sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize));
   elements.forEach((el,i)=>el.style.setProperty('font-size',`${sizes[i]*2}px`,'important'));
 });
}
async function noClippedText(page:Page,scope:string) {
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:[...document.querySelectorAll('body *')].flatMap(el=>[...el.childNodes]).filter(n=>n.nodeType===Node.TEXT_NODE && n.textContent?.trim()).filter(n=>{const range=document.createRange();range.selectNodeContents(n);return range.getBoundingClientRect().right>innerWidth+1;}).map(n=>({text:n.textContent,cls:n.parentElement?.className}))}));
 expect(overflow.scroll,JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width);

 expect(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>1 && r.right>innerWidth+1;}).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent?.slice(0,60)}))), page.url()).toEqual([]);
 const clipped=await page.locator(scope).evaluateAll(roots=>roots.flatMap(root=>[root,...root.querySelectorAll('*')]).filter(el=>{
   const s=getComputedStyle(el);const rect=el.getBoundingClientRect();
   return rect.width>1 && rect.height>1 && [...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE && n.textContent?.trim()) &&
     ((['hidden','clip'].includes(s.overflowX) && el.scrollWidth>el.clientWidth+2) || (['hidden','clip'].includes(s.overflowY) && el.scrollHeight>el.clientHeight+2));
 }).map(el=>el.textContent));
 expect(clipped).toEqual([]);
}

test('200 percent text stress — Russian guidance, Error Mode, request/reply and staff detail at four widths',async({page})=>{
 test.setTimeout(120000); const {href,id}=await createSession(page);
 await page.goto(href+'&debug=1');await page.getByRole('button',{name:'Start mock',exact:true}).click();await page.getByRole('button',{name:'HELP confirmed',exact:true}).click();
 await page.goto(`/dashboard/requests?demo=1&patientId=${id}`);await page.getByRole('button',{name:'Acknowledge',exact:true}).click();await page.getByRole('button',{name:'I’m coming',exact:true}).click();

 for(const width of [390,430,768,1024]) {
  await page.setViewportSize({width,height:1000});
  for(const route of [href,`/dashboard/requests?demo=1&patientId=${id}`]) {
   await page.goto(route);await expect(page.locator(route===href?'.signal-nurse-note':'.request-detail .status-chip')).toBeVisible();await page.getByRole('button',{name:'RU',exact:true}).click();await expect(page.locator('[lang=ru]').first()).toBeVisible();await enlarge(page);await noClippedText(page,route===href?'.signal-patient':'.request-detail');
  }
  for(const state of ['HELP correction','Calibration','Urgent request']) {
   await page.goto('/src/ui/patient/dev/index.html');await page.getByRole('button',{name:state,exact:true}).click();await enlarge(page);await noClippedText(page,'.signal-patient');
  }
 }
});

test('patient live regions exclude countdown ticks, hold percentages and future request steps',async({page})=>{
 await english(page);await page.goto('/src/ui/patient/dev/index.html');await page.getByRole('button',{name:'EN',exact:true}).click();
 await page.getByRole('button',{name:'Urgent request',exact:true}).click();await expect(page.locator('.signal-urgent')).not.toHaveAttribute('role','status');
 await page.getByRole('button',{name:'Calibration',exact:true}).click();
 expect((await page.locator('[role="status"]').allTextContents()).join(' ')).not.toContain('62%');
 await page.getByRole('button',{name:'Acknowledged',exact:true}).click();
 await expect(page.locator('.patient-announcement')).toContainText('Your nurse has seen the request');
 await expect(page.locator('.patient-announcement')).not.toContainText('Completed');
});

test('patient speech emits once for live actions and stays silent on locale, reconnect and refresh',async({page:staff,browser})=>{
 const {href,id}=await createSession(staff);
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5180'});const patient=await context.newPage();
 await patient.addInitScript(()=>{
  localStorage.setItem('signal.locale','en');localStorage.setItem('signal.speech','true');
  (window as any).__spoken=[];window.speechSynthesis.speak=u=>(window as any).__spoken.push(u.text);
 });
 await patient.goto(href+'&debug=1');await patient.getByRole('button',{name:'Start mock',exact:true}).click();
 await patient.getByRole('button',{name:'HELP confirmed',exact:true}).click();
 await staff.goto(`/dashboard/requests?demo=1&patientId=${id}`);await staff.getByRole('button',{name:'Acknowledge',exact:true}).click();
 await staff.getByRole('button',{name:'I’m coming',exact:true}).click();
 await expect.poll(()=>patient.evaluate(()=>(window as any).__spoken)).toEqual(['HELP',"I'm coming"]);
 await patient.getByRole('button',{name:'RU',exact:true}).click();await expect(patient.locator('.signal-nurse-note')).toContainText('Иду');
 await context.setOffline(true);await expect(patient.locator('.connection--connected')).toHaveCount(0);await context.setOffline(false);await expect(patient.locator('.connection--connected')).toBeVisible();
 expect(await patient.evaluate(()=>(window as any).__spoken)).toEqual(['HELP',"I'm coming"]);
 await patient.reload();await expect(patient.locator('.signal-nurse-note')).toContainText('coming');
 expect(await patient.evaluate(()=>(window as any).__spoken)).toEqual([]);await expect(patient.locator('.signal-speech')).toHaveAttribute('aria-pressed','true');
 await context.close();
});

test('production preserves the team simulated fallback with explicit labeling and isolated transport',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5181'});const page=await context.newPage();await english(page);
 const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST' && request.url().includes('/api/'))writes.push(request.url());});
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Start mock',exact:true}).click();
 await expect(page.locator('.signal-demo-badge')).toContainText('Demo without camera');
 await page.getByRole('button',{name:'HELP confirmed',exact:true}).click();await expect(page.locator('.signal-request--pending')).toBeVisible();
 expect(writes).toEqual([]);await context.close();
});
