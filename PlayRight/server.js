'use strict';

const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE || '2mb';
const DEFAULT_ACTION_TIMEOUT_MS = Number(process.env.DEFAULT_ACTION_TIMEOUT_MS) || 15000;
const MAX_ACTION_TIMEOUT_MS = Number(process.env.MAX_ACTION_TIMEOUT_MS) || 60000;
const GLOBAL_RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS) || 90000;

const app = express();

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: MAX_BODY_SIZE }));

// ---------------------------------------------------------------------------
// Browser lifecycle — a single Chromium instance is reused across requests
// (fast, low memory); each request gets its own isolated BrowserContext so
// the service stays stateless from the caller's point of view.
// ---------------------------------------------------------------------------

let browserPromise = null;

function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser()
      .then((browser) => {
        browser.on('disconnected', () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

function clampTimeout(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ACTION_TIMEOUT_MS;
  return Math.min(n, MAX_ACTION_TIMEOUT_MS);
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// Action executor
// ---------------------------------------------------------------------------

async function executeAction(page, action, ctx) {
  const { type, selector } = action;

  switch (type) {
    case 'goto': {
      const target = action.value || action.url || ctx.baseUrl;
      await page.goto(target, {
        waitUntil: action.waitUntil || 'load',
        timeout: ctx.timeout,
      });
      return { type, url: target, ok: true };
    }

    case 'click': {
      await page.locator(selector).click({ timeout: ctx.timeout });
      return { type, selector, ok: true };
    }

    case 'fill': {
      await page.locator(selector).fill(String(action.value ?? ''), { timeout: ctx.timeout });
      return { type, selector, ok: true };
    }

    case 'type': {
      await page
        .locator(selector)
        .pressSequentially(String(action.value ?? ''), { delay: action.delay || 0, timeout: ctx.timeout });
      return { type, selector, ok: true };
    }

    case 'press': {
      if (selector) {
        await page.locator(selector).press(action.key, { timeout: ctx.timeout });
      } else {
        await page.keyboard.press(action.key);
      }
      return { type, selector: selector || null, key: action.key, ok: true };
    }

    case 'select': {
      const selected = await page.locator(selector).selectOption(action.value, { timeout: ctx.timeout });
      return { type, selector, ok: true, selected };
    }

    case 'check': {
      await page.locator(selector).check({ timeout: ctx.timeout });
      return { type, selector, ok: true };
    }

    case 'uncheck': {
      await page.locator(selector).uncheck({ timeout: ctx.timeout });
      return { type, selector, ok: true };
    }

    case 'wait': {
      if (selector) {
        await page.locator(selector).waitFor({ state: action.state || 'visible', timeout: ctx.timeout });
      } else {
        await page.waitForTimeout(Number(action.value) || 1000);
      }
      return { type, selector: selector || null, ok: true };
    }

    case 'screenshot': {
      const key = action.key || 'screenshot';
      const buffer = selector
        ? await page.locator(selector).screenshot({ timeout: ctx.timeout })
        : await page.screenshot({ fullPage: action.fullPage !== false, timeout: ctx.timeout });
      ctx.data[key] = buffer.toString('base64');
      return { type, selector: selector || null, key, ok: true };
    }

    case 'extractText': {
      const key = action.key || selector;
      const text = await page.locator(selector).innerText({ timeout: ctx.timeout });
      ctx.data[key] = text;
      return { type, selector, key, ok: true };
    }

    case 'extractHTML': {
      const key = action.key || selector;
      const html = await page.locator(selector).innerHTML({ timeout: ctx.timeout });
      ctx.data[key] = html;
      return { type, selector, key, ok: true };
    }

    case 'evaluate': {
      const key = action.key || 'evaluate';
      // action.script runs inside the sandboxed Chromium page context, not on the host Node process.
      const result = await page.evaluate((script) => {
        // eslint-disable-next-line no-eval
        return eval(script);
      }, action.script);
      ctx.data[key] = result;
      return { type, key, ok: true };
    }

    case 'assertText': {
      const actual = (await page.locator(selector).innerText({ timeout: ctx.timeout })).trim();
      const expected = String(action.value ?? '');
      const mode = action.mode === 'equals' ? 'equals' : 'contains';
      const pass = mode === 'equals' ? actual === expected : actual.includes(expected);
      if (!pass) {
        throw new Error(
          `assertText failed for "${selector}": expected ${mode} "${expected}", got "${actual}"`
        );
      }
      return { type, selector, ok: true, actual };
    }

    case 'assertVisible': {
      const visible = await page.locator(selector).isVisible();
      if (!visible) {
        throw new Error(`assertVisible failed: "${selector}" is not visible`);
      }
      return { type, selector, ok: true };
    }

    default:
      throw new Error(`Unsupported action type: "${type}"`);
  }
}

// ---------------------------------------------------------------------------
// Auth (optional — set API_KEY to require it)
// ---------------------------------------------------------------------------

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const header = req.get('authorization') || '';
  const bearer = header.replace(/^Bearer\s+/i, '');
  const provided = req.get('x-api-key') || bearer;
  if (provided !== API_KEY) {
    return res.status(401).json({
      success: false,
      steps: [],
      data: {},
      errors: ['Unauthorized: missing or invalid API key'],
    });
  }
  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/run', requireApiKey, async (req, res) => {
  const body = req.body || {};
  const { url, actions } = body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      steps: [],
      data: {},
      errors: ['"url" is required and must be a string'],
    });
  }

  if (!Array.isArray(actions) || actions.length === 0) {
    return res.status(400).json({
      success: false,
      steps: [],
      data: {},
      errors: ['"actions" is required and must be a non-empty array'],
    });
  }

  const timeout = clampTimeout(body.timeout);
  const steps = [];
  const errors = [];
  const data = {};
  let success = true;
  let context;

  const run = (async () => {
    const browser = await getBrowser();
    context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    const ctx = { baseUrl: url, timeout, data };

    for (const action of actions) {
      try {
        const result = await executeAction(page, action, ctx);
        steps.push(result);
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        steps.push({ type: action.type, selector: action.selector || null, ok: false, error: message });
        errors.push(message);
        success = false;
        break;
      }
    }
  })();

  try {
    await withTimeout(run, GLOBAL_RUN_TIMEOUT_MS, 'Run exceeded the global timeout');
  } catch (err) {
    success = false;
    errors.push(err && err.message ? err.message : String(err));
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }

  res.status(200).json({ success, steps, data, errors });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({ success: false, steps: [], data: {}, errors: [`Not found: ${req.method} ${req.path}`] });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ success: false, steps: [], data: {}, errors: ['Invalid JSON body'] });
  }
  console.error(err);
  res.status(500).json({ success: false, steps: [], data: {}, errors: ['Internal server error'] });
});

// ---------------------------------------------------------------------------
// Startup / shutdown
// ---------------------------------------------------------------------------

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlayRight service listening on port ${PORT}`);
  // Warm the browser so the first real request doesn't pay the launch cost.
  getBrowser().catch((err) => console.error('Browser warm-up failed:', err.message));
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close();
  try {
    if (browserPromise) {
      const browser = await browserPromise;
      await browser.close();
    }
  } catch (err) {
    console.error('Error during browser shutdown:', err.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
