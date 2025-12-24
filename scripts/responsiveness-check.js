#!/usr/bin/env node
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4173;
const BASE_URL = `http://localhost:${PORT}`;
const ARTIFACT_DIR = path.join(__dirname, '..', 'artifacts');

const scenarios = [
  {
    label: 'mobile',
    context: { ...devices['iPhone 13 Pro'] },
    screenshot: 'responsive-mobile.png',
  },
  {
    label: 'desktop',
    context: {
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    },
    screenshot: 'responsive-desktop.png',
  },
];

async function waitForServer(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch (err) {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server at ${BASE_URL} did not start in time`);
}

function startServer() {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', 'docs'], {
    stdio: 'inherit',
  });
  return server;
}

async function runScenario({ label, context, screenshot }) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...context });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const overflow = await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    return {
      hasOverflow: scrollWidth - viewportWidth > 1,
      scrollWidth,
      viewportWidth,
    };
  });

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, screenshot),
    fullPage: true,
  });
  await browser.close();

  if (consoleErrors.length) {
    throw new Error(`[${label}] Console errors: ${consoleErrors.join(' | ')}`);
  }
  if (overflow.hasOverflow) {
    throw new Error(
      `[${label}] Horizontal overflow detected (scrollWidth ${overflow.scrollWidth}, viewport ${overflow.viewportWidth})`
    );
  }
}

(async () => {
  await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true });
  const server = startServer();
  try {
    await waitForServer();
    for (const scenario of scenarios) {
      await runScenario(scenario);
    }
    console.log('Responsive check passed for all scenarios');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    server.kill('SIGTERM');
  }
})();
