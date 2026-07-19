import { mkdir, rename } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const outputRoot = '/private/tmp/devloop-submission-video';
const rawDir = `${outputRoot}/raw`;
const screenshotDir = `${outputRoot}/screenshots`;
const requirement =
  'Set up a minimal Python project with pyproject.toml, a src package, pytest tests, .gitignore, and README setup instructions.';

await mkdir(rawDir, { recursive: true });
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
});

const page = await context.newPage();
const video = page.video();
let captureError;

try {
  console.log('Opening the live application…');
  await page.goto('https://devloop-ai.onrender.com/', {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await page.getByText('OpenAI live', { exact: true }).waitFor({ timeout: 120_000 });
  console.log('OpenAI live is ready.');
  await page.screenshot({ path: `${screenshotDir}/01-hero.png` });

  const requirementInput = page.getByRole('textbox', { name: 'What should we engineer?' });
  await requirementInput.fill(requirement);
  await page.screenshot({ path: `${screenshotDir}/02-requirement.png` });
  await page.getByRole('button', { name: 'Run engineering loop →' }).click();
  console.log('Engineering loop started.');

  await page.getByRole('region', { name: 'Engineering workflow' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: `${screenshotDir}/03-workflow.png` });

  await page.getByText('Generated project package', { exact: true }).waitFor({ timeout: 150_000 });
  console.log('Engineering loop completed.');
  await page.getByText(/Python preview · v\d+/).waitFor({ timeout: 20_000 });
  await page.getByRole('button', { name: /Download \d+ files as ZIP/ }).waitFor({ timeout: 20_000 });

  await page.getByRole('region', { name: 'Evidence of improvement' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: `${screenshotDir}/04-quality-evidence.png` });

  await page.getByText('Generated project package', { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: `${screenshotDir}/05-project-package.png` });

  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('Python preview')) {
    throw new Error('The result did not show a Python preview label.');
  }
  if (!bodyText.includes('Generated project package')) {
    throw new Error('The result did not include a generated project package.');
  }
  if (!/Download \d+ files as ZIP/.test(bodyText)) {
    throw new Error('The project ZIP action was not available.');
  }

  await page.getByRole('link', { name: 'DevLoop AI home' }).click();
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: `${screenshotDir}/06-closing.png` });
} catch (error) {
  captureError = error;
} finally {
  await context.close();
  const recordedPath = await video.path();
  await browser.close();
  await rename(recordedPath, `${rawDir}/devloop.webm`);
}

if (captureError) {
  throw captureError;
}

console.log(`Capture complete: ${rawDir}/devloop.webm`);
