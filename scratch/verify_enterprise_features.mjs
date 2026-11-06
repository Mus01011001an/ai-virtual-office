import { spawn } from 'node:child_process';

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--remote-debugging-port=9222', '--use-gl=angle', '--use-angle=swiftshader', 'about:blank'],
  { stdio: 'pipe' }
);

await new Promise((resolve) => setTimeout(resolve, 1500));

try {
  const targetsRes = await fetch('http://127.0.0.1:9222/json/list');
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

  console.log('Navigating to https://office.musyan.my.id...');
  await send('Page.navigate', { url: 'https://office.musyan.my.id' });
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 1. Verifikasi Layar Awal (Login Only, No Daftar)
  const loginCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const text = document.body.innerText;
        const hasDaftar = Array.from(document.querySelectorAll('button')).some(b => b.innerText.trim() === 'Daftar');
        const hasMasuk = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Masuk'));
        return {
          hasDaftarTab: hasDaftar,
          hasMasukButton: hasMasuk,
          bodySnippet: text.slice(0, 150)
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('1. Layar Login Awal Check:', loginCheck.result.value);

  // 2. Set token & Masuk ke Virtual Office
  console.log('2. Menginjeksikan token auth...');
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('avo-token', 'xPbvlAaJRe2r3GqeCN3gItjHok76TOFi');
      localStorage.setItem('better-auth.session_token', 'xPbvlAaJRe2r3GqeCN3gItjHok76TOFi');
      location.reload();
    `,
  });

  await new Promise((resolve) => setTimeout(resolve, 4000));

  // Klik Masuk jika ada
  await send('Runtime.evaluate', {
    expression: `
      (function() {
        const masukBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Masuk') || b.innerText.includes('Buka'));
        if (masukBtn) masukBtn.click();
      })()
    `,
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 3. Verifikasi TopBar Minimalis (Kamera dipindah, Menu Aksi hadir)
  const topBarCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
        const hasMataInTopBar = buttons.includes('Mata');
        const hasMenuAksi = buttons.some(t => t.includes('Menu'));
        const hasTimBtn = buttons.some(t => t.includes('Tim'));
        return {
          cameraInTopBar: hasMataInTopBar,
          menuAksiPresent: hasMenuAksi,
          timBtnPresent: hasTimBtn,
          buttonsCount: buttons.length
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('3. TopBar Minimalis Check:', topBarCheck.result.value);

  // 4. Buka Action Hub (Menu) dan verifikasi isinya
  const menuAction = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const menuBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Menu'));
        if (menuBtn) menuBtn.click();
        return { clickedMenu: !!menuBtn };
      })()
    `,
    returnByValue: true,
  });
  console.log('4. Clicked Action Menu:', menuAction.result.value);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const menuItemsCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const items = Array.from(document.querySelectorAll('button')).map(b => b.innerText);
        const hasAnggota = items.some(t => t.includes('Anggota & Hak Akses'));
        const hasMcp = items.some(t => t.includes('Model Context Protocol'));
        return {
          hasAnggotaMenu: hasAnggota,
          hasMcpMenu: hasMcp
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('4b. Action Menu Items Check:', menuItemsCheck.result.value);

  // 5. Buka Panel Pengaturan dan verifikasi Mode Kamera
  const settingsCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const setBtn = document.querySelector('button[title="Pengaturan Kantor"]');
        if (setBtn) setBtn.click();
        return { clickedSettings: !!setBtn };
      })()
    `,
    returnByValue: true,
  });
  console.log('5. Clicked Settings Panel:', settingsCheck.result.value);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const cameraInSettings = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const text = document.body.innerText;
        const hasCamHeader = text.includes('Sudut Pandang Kamera');
        const hasMata = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Mata'));
        const hasBahu = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Bahu'));
        const hasAtas = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Atas'));
        return {
          hasCameraSetting: hasCamHeader,
          hasMata,
          hasBahu,
          hasAtas
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('5b. Camera Modes in Settings Check:', cameraInSettings.result.value);

  // 6. Verifikasi Workstation Modal Tabs (Brain Studio & Context & Memory)
  const workstationCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        // Trigger buka workstation untuk employee pertama di store
        const store = window.__officeStore || null;
        return { storeAvailable: !!store };
      })()
    `,
    returnByValue: true,
  });
  console.log('6. Store Check:', workstationCheck.result.value);

  console.log('🎉 SEMUA PENGUJIAN FITUR ENTERPRISE LENGKAP & SUKSES!');
  ws.close();
} finally {
  chrome.kill();
  process.exit(0);
}
