import { makeFixtureGlb } from './fixture.mjs';

const fixtures = {};

/**
 * Serve a stand-in .glb for every model request. Paths listed in `missing` get a
 * 404 instead, which is how the unavailable-layer states are exercised, and
 * `textured` serves a model carrying a base colour texture.
 */
export async function stubModels(page, { missing = [], textured = false, parts = [] } = {}) {
  const key = `${textured ? 'textured' : 'plain'}:${parts.join('+')}`;
  fixtures[key] ??= await makeFixtureGlb({ textured, parts });
  const fixture = fixtures[key];
  await page.route('**/models/**', async (route) => {
    const url = new URL(route.request().url());
    if (missing.some((name) => url.pathname.endsWith(name))) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'model/gltf-binary',
      body: fixture,
    });
  });
}

export const viewerLoaded = (page) =>
  page.waitForFunction(() => document.getElementById('viewer')?.loaded === true, null, {
    timeout: 20_000,
  });

export const cameraOrbit = (page) =>
  page.evaluate(() => document.getElementById('viewer').getCameraOrbit().toString());

/**
 * Real touch input. Playwright exposes taps but not swipes, so these go through
 * CDP — a synthetic click() would skip hit-testing and miss overlay regressions,
 * which is the whole point of this file.
 */
export async function touchDrag(page, from, to, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  const point = (x, y) => [{ x, y, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(from.x, from.y),
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Two-finger pinch, for the zoom path that a single-pointer drag never reaches. */
export async function pinch(page, center, fromGap, toGap, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  const pair = (gap) => [
    { x: center.x - gap / 2, y: center.y, radiusX: 8, radiusY: 8, force: 1 },
    { x: center.x + gap / 2, y: center.y, radiusX: 8, radiusY: 8, force: 1 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pair(fromGap) });
  for (let i = 1; i <= steps; i++) {
    const gap = fromGap + (toGap - fromGap) * (i / steps);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pair(gap) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
