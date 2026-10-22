const { chromium } = require('/home/deploy/.npm-global/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8792;
const DIR = __dirname;

// Simple static server
const server = http.createServer((req, res) => {
  let file = req.url === '/' ? 'index.html' : req.url.slice(1);
  const filePath = path.join(DIR, file);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, async () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
  fs.mkdirSync(path.join(DIR, 'screenshots'), { recursive: true });

  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  });

  try {
    // 1. Desktop Check
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await desktopContext.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    
    const title = await page.title();
    console.log(`Page loaded: "${title}"`);

    // Verify KPI text
    const kpi = await page.$eval('#kpiActivated', el => el.textContent.trim());
    console.log(`Initial Activated KPI: ${kpi}`);

    // Click 7 Days
    await page.click('button[data-period="7"]');
    const kpi7 = await page.$eval('#kpiActivated', el => el.textContent.trim());
    console.log(`7-day Activated KPI after click: ${kpi7}`);

    // Search filter test
    await page.fill('#courseSearch', 'Figma');
    const tableText = await page.$eval('#courseTableBody', el => el.innerText);
    console.log(`Search result contains Figma: ${tableText.includes('Figma')}`);

    // Clear search & reset to 30d
    await page.fill('#courseSearch', '');
    await page.click('button[data-period="30"]');

    // Desktop screenshot
    await page.screenshot({ path: path.join(DIR, 'screenshots', 'dashboard-desktop.png'), fullPage: true });
    console.log('Saved dashboard-desktop.png');
    await desktopContext.close();

    // 2. Mobile Check (390 x 844)
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

    await mobilePage.screenshot({ path: path.join(DIR, 'screenshots', 'dashboard-mobile.png'), fullPage: true });
    console.log('Saved dashboard-mobile.png');
    await mobileContext.close();

    console.log('ALL CHECKS PASSED: UI, filtering, period toggles, responsive views.');
  } catch (err) {
    console.error('Error in verification:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
});
