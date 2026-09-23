import { test, expect } from '@playwright/test';
import { stubModels, viewerLoaded, cameraOrbit, touchDrag, pinch } from './helpers.mjs';

test.describe('viewer interaction', () => {
  test.beforeEach(async ({ page }) => {
    await stubModels(page);
    await page.goto('/');
    await viewerLoaded(page);
  });

  // Regression: an overlay with a `display` rule beat the [hidden] attribute and
  // covered the viewer, absorbing every drag while looking perfectly fine.
  test('nothing covers the viewer once a model has loaded', async ({ page }) => {
    const hit = await page.evaluate(() => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { tag: el.tagName, id: el.id };
    });
    expect(hit.tag).toBe('MODEL-VIEWER');

    await expect(page.locator('#no-model')).toBeHidden();
  });

  test('horizontal drag orbits the model', async ({ page }) => {
    const before = await cameraOrbit(page);
    const box = await page.locator('#viewer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    expect(await cameraOrbit(page)).not.toBe(before);
  });

  test('vertical drag orbits rather than scrolling the page', async ({ page }) => {
    const before = await cameraOrbit(page);
    const box = await page.locator('#viewer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 120, { steps: 12 });
    await page.mouse.up();

    expect(await cameraOrbit(page)).not.toBe(before);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('layer buttons switch the loaded model', async ({ page }) => {
    const bar = page.locator('#layer-bar button');
    await expect(bar.first()).toHaveClass(/active/);

    // The app assigns viewer.src as a property; model-viewer does not reflect it
    // back to the attribute, so getAttribute('src') stays empty.
    const src = () => page.evaluate(() => document.getElementById('viewer').src);

    const firstSrc = await src();
    expect(firstSrc).not.toBe('');

    await bar.nth(1).click();
    await viewerLoaded(page);

    expect(await src()).not.toBe(firstSrc);
    await expect(bar.nth(1)).toHaveClass(/active/);
  });

  test('snapshot saves to the gallery with its model and layer', async ({ page }) => {
    await page.locator('#snap-btn').click();
    await page.locator('#gallery-btn').click();

    const item = page.locator('.gallery-item').first();
    await expect(item).toBeVisible();
    await expect(item.locator('img')).toHaveAttribute('src', /^data:image\/jpeg/);

    const label = await page.locator('#model-select option:checked').textContent();
    await expect(item.locator('figcaption')).toContainText(label.trim());

    await item.locator('.delete-btn').click();
    await expect(page.locator('.gallery-item')).toHaveCount(0);
  });
});

test.describe('models that are not downloaded', () => {
  test('unavailable layers are disabled and explained', async ({ page }) => {
    // Second layer of the first model is absent; the first is present.
    await stubModels(page, { missing: ['skull-male.glb'] });
    await page.goto('/');
    await viewerLoaded(page);

    // Match on data-key: hasText 'Male' also matches 'Female'.
    const male = page.locator('#layer-bar button[data-key="male"]');
    await expect(male).toBeDisabled();
    await expect(male).toHaveClass(/missing/);

    await expect(page.locator('#layer-bar button[data-key="female"]')).toBeEnabled();
  });

  test('a model with no files shows the download hint', async ({ page }) => {
    await stubModels(page, {
      missing: ['female-chera-muscle.glb', 'female-chera-bone.glb'],
    });
    await page.goto('/');
    await viewerLoaded(page);

    await page.locator('#model-select').selectOption('female-body');

    const overlay = page.locator('#no-model');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('female-chera-muscle.glb');
    await expect(overlay).toContainText('npm run optimize');
  });
});

test.describe('touch input', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await stubModels(page);
    await page.goto('/');
    await viewerLoaded(page);
  });

  // touch-action must not hand vertical drags to the browser for scrolling.
  test('vertical touch drag orbits the model', async ({ page }) => {
    const before = await cameraOrbit(page);
    await touchDrag(page, { x: 195, y: 560 }, { x: 195, y: 300 });
    await page.waitForTimeout(300);

    expect(await cameraOrbit(page)).not.toBe(before);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('pinch zooms the camera', async ({ page }) => {
    const radius = async () =>
      page.evaluate(() => document.getElementById('viewer').getCameraOrbit().radius);

    const before = await radius();
    await pinch(page, { x: 195, y: 420 }, 80, 320);
    await page.waitForTimeout(300);

    expect(await radius()).not.toBeCloseTo(before, 3);
  });

  test('layer bar stays reachable above the safe area', async ({ page }) => {
    const bar = await page.locator('#layer-bar').boundingBox();
    expect(bar.y + bar.height).toBeLessThanOrEqual(844);

    const button = page.locator('#layer-bar button').first();
    const box = await button.boundingBox();
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y).closest('#layer-bar') !== null,
      [box.x + box.width / 2, box.y + box.height / 2]
    );
    expect(hit).toBe(true);
  });
});
