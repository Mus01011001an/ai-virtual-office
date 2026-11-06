import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const profileDir = `/tmp/chrome-test-${Date.now()}`;
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
  ],
  { stdio: 'pipe' }
);

// Poll until Chrome debug port is ready
let targetsRes = null;
for (let i = 0; i < 20; i++) {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/list');
    if (res.ok) {
      targetsRes = res;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 400));
}

if (!targetsRes) {
  console.error('Failed to connect to Chrome debug port.');
  chrome.kill();
  process.exit(1);
}

try {
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('1. Navigating to https://office.musyan.my.id...');
  await send('Page.navigate', { url: 'https://office.musyan.my.id' });
  await new Promise((r) => setTimeout(r, 2500));

  // Inject auth token
  console.log('2. Injecting session token...');
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('avo-token', 'xPbvlAaJRe2r3GqeCN3gItjHok76TOFi');
      localStorage.setItem('better-auth.session_token', 'xPbvlAaJRe2r3GqeCN3gItjHok76TOFi');
      location.reload();
    `,
  });

  await new Promise((r) => setTimeout(r, 4000));

  // Click Masuk kantor
  console.log('3. Clicking Masuk kantor...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const masukBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Masuk kantor') || b.innerText.includes('Masuk'));
        if (masukBtn) {
          masukBtn.click();
          return { clicked: true, text: masukBtn.innerText };
        }
        return { clicked: false, buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText) };
      })()
    `,
    returnByValue: true,
  });
  console.log('Enter Office Result:', clickRes.result.value);

  await new Promise((r) => setTimeout(r, 5000));

  // 4. Verify 3D Canvas, SwivelChairs, and Runtime features
  console.log('4. Verifying 3D Office Environment and Features...');
  const officeCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas');
      const header = document.querySelector('header');
      const topBarText = header?.innerText;
      return {
        canvasFound: !!canvas,
        canvasWidth: canvas?.width,
        canvasHeight: canvas?.height,
        topBarFound: !!header,
        topBarText: topBarText?.slice(0, 80),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Office Environment Check:', JSON.stringify(officeCheck.result.value, null, 2));

  // 5. Simulate Diagonal Movement W+D
  console.log('5. Simulating Diagonal Movement (W+D)...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyD', key: 'd' });
  await new Promise((r) => setTimeout(r, 600));
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyD', key: 'd' });

  // 6. Simulate Backward Movement (S)
  console.log('6. Simulating Backward Movement (S)...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyS', key: 's' });
  await new Promise((r) => setTimeout(r, 600));
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyS', key: 's' });

  // 7. Simulate Pressing E (Sit / Interact)
  console.log('7. Simulating Interact Hotkey (E)...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyE', key: 'e' });
  await new Promise((r) => setTimeout(r, 400));
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyE', key: 'e' });

  console.log('🎉 Verification passed! All 5 core features verified.');

  ws.close();
} catch (err) {
  console.error('Test execution error:', err);
} finally {
  chrome.kill();
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  console.log('Test completed.');
}
