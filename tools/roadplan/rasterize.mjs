// Rasterize SVG plans to PNG with system Chrome (puppeteer-core): node tools/roadplan/rasterize.mjs <svg...>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
for (const f of process.argv.slice(2)) {
    const svg = fs.readFileSync(f, 'utf8');
    const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
    await page.setViewport({ width: +w, height: +h });
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await page.screenshot({ path: f.replace(/\.svg$/, '.png') });
}
await browser.close();
