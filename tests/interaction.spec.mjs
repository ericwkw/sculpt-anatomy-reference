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

test.describe('credits', () => {
  test.beforeEach(async ({ page }) => {
    await stubModels(page);
    await page.goto('/');
    await viewerLoaded(page);
  });

  // CC-BY requires the credit to stay visible, so every source model in the
  // registry must appear here — a layer added without one is a licence breach.
  test('every model in the registry is credited', async ({ page }) => {
    const expected = await page.evaluate(async () => {
      const { listCredits } = await import('/src/models.js');
      return listCredits();
    });
    expect(expected.length).toBeGreaterThan(0);

    await page.locator('#credits-btn').click();
    const dialog = page.locator('#credits-dialog');
    await expect(dialog).toBeVisible();

    for (const credit of expected) {
      const entry = dialog.locator('li', { hasText: credit.title });
      await expect(entry).toContainText(credit.author);
      await expect(entry).toContainText(credit.licence);
      await expect(entry.locator('a')).toHaveAttribute('href', credit.url);
    }

    await page.locator('#credits-close').click();
    await expect(dialog).toBeHidden();
  });

  test('every layer carries a credit', async ({ page }) => {
    const uncredited = await page.evaluate(async () => {
      const { MODELS } = await import('/src/models.js');
      return MODELS.flatMap((m) =>
        m.layers
          .filter((l) => !l.credit?.title || !l.credit?.author || !l.credit?.url)
          .map((l) => `${m.id}/${l.key}`)
      );
    });
    expect(uncredited).toEqual([]);
  });
});

test.describe('clay and skin render modes', () => {
  const textureAttached = (page) =>
    page.evaluate(() =>
      document
        .getElementById('viewer')
        .model.materials.some((m) => m.pbrMetallicRoughness?.baseColorTexture?.texture != null)
    );

  test('an untextured model renders as clay with nothing to switch to', async ({ page }) => {
    await stubModels(page);
    await page.goto('/');
    await viewerLoaded(page);

    const toggle = page.locator('#render-mode-btn');
    await expect(toggle).toHaveText('Clay');
    await expect(toggle).toBeDisabled();
  });

  test('a textured model shows its own surface and can be switched to clay', async ({ page }) => {
    await stubModels(page, { textured: true });
    await page.goto('/');
    await viewerLoaded(page);

    const toggle = page.locator('#render-mode-btn');
    await expect(toggle).toHaveText('Skin');
    await expect(toggle).toBeEnabled();
    expect(await textureAttached(page)).toBe(true);

    // Clay has to detach the texture, since baseColorFactor only tints it.
    await toggle.click();
    await expect(toggle).toHaveText('Clay');
    expect(await textureAttached(page)).toBe(false);

    await toggle.click();
    await expect(toggle).toHaveText('Skin');
    expect(await textureAttached(page)).toBe(true);
  });
});

test.describe('auto-discovery', () => {
  // A .glb dropped into public/models/ should be viewable without editing the
  // registry first, but must not reach the credits screen — it has no attribution.
  const stubManifest = (page, files) =>
    page.route('**/models/manifest.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(files) })
    );

  test('an unregistered model appears under Unsorted', async ({ page }) => {
    await stubModels(page);
    await stubManifest(page, ['skull-proportions.glb', 'mystery-thing.glb']);
    await page.goto('/');
    await viewerLoaded(page);

    await expect(page.locator('#model-select option[value="unsorted"]')).toHaveCount(1);
    await page.locator('#model-select').selectOption('unsorted');
    await viewerLoaded(page);

    // Filename becomes a readable label.
    await expect(page.locator('#layer-bar button')).toHaveText(['Mystery thing']);
    expect(await page.evaluate(() => document.getElementById('viewer').src)).toContain(
      'mystery-thing.glb'
    );
  });

  test('discovered models stay out of the credits screen', async ({ page }) => {
    await stubModels(page);
    await stubManifest(page, ['mystery-thing.glb']);
    await page.goto('/');
    await viewerLoaded(page);

    await page.locator('#credits-btn').click();
    await expect(page.locator('#credits-dialog')).toBeVisible();
    await expect(page.locator('#credits-dialog')).not.toContainText('Mystery');
    await expect(page.locator('#credits-dialog')).not.toContainText('mystery-thing');
  });

  test('no Unsorted entry when every file is registered', async ({ page }) => {
    await stubModels(page);
    await stubManifest(page, ['skull-proportions.glb', 'skull-male.glb']);
    await page.goto('/');
    await viewerLoaded(page);

    await expect(page.locator('#model-select option[value="unsorted"]')).toHaveCount(0);
  });

  test('a missing manifest is not fatal', async ({ page }) => {
    await stubModels(page);
    await page.route('**/models/manifest.json', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/');
    await viewerLoaded(page);

    await expect(page.locator('#model-select option')).not.toHaveCount(0);
    await expect(page.locator('#model-select option[value="unsorted"]')).toHaveCount(0);
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
  // These poll rather than sleeping a fixed interval: model-viewer keeps
  // interpolating the camera after the gesture ends, and under parallel load a
  // short sleep lands before it has moved.
  test('vertical touch drag orbits the model', async ({ page }) => {
    const before = await cameraOrbit(page);
    await touchDrag(page, { x: 195, y: 560 }, { x: 195, y: 300 });

    await expect.poll(() => cameraOrbit(page), { timeout: 5000 }).not.toBe(before);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('pinch zooms the camera', async ({ page }) => {
    const radius = () =>
      page.evaluate(() => document.getElementById('viewer').getCameraOrbit().radius);

    const before = await radius();
    await pinch(page, { x: 195, y: 420 }, 80, 320);

    await expect
      .poll(async () => Math.abs((await radius()) - before), { timeout: 5000 })
      .toBeGreaterThan(0.001);
  });

  // A third topbar button once pushed the others off-screen: the select is
  // flex:1 and its longest option label was setting a minimum width.
  test('every topbar control fits on screen', async ({ page }) => {
    for (const id of ['model-select', 'snap-btn', 'gallery-btn', 'render-mode-btn', 'credits-btn']) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box.x, `${id} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${id} right edge`).toBeLessThanOrEqual(390);
    }

    // And each button is still big enough to hit with a finger.
    for (const id of ['snap-btn', 'gallery-btn', 'render-mode-btn', 'credits-btn']) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box.width, `${id} width`).toBeGreaterThanOrEqual(40);
    }
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
