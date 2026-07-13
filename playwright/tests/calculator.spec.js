/**
 * SeaLights / Playwright: exercise `com.example.calculator` types the UI talks to:
 * - `CalculatorController.calculate` → uses `CalculateRequest` / `CalculateResponse` records
 * - `CalculatorApplication.main` runs once when the JVM starts the JAR (before these tests);
 *   Playwright cannot call `main` again; coverage for startup is separate from in-request code.
 *
 * `expect` stays from @playwright/test; `test` from sealights-playwright-plugin.
 */
const { test } = require('sealights-playwright-plugin');
const { expect } = require('@playwright/test');

test.describe('CalculatorController via UI (POST /api/calculate)', () => {
  test('addition (+)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-a').fill('7');
    await page.getByTestId('select-op').selectOption('+');
    await page.getByTestId('input-b').fill('5');
    await page.getByTestId('btn-calculate').click();
    await expect(page.getByTestId('result')).toHaveText('12');
  });

  test('subtraction (-)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-a').fill('10');
    await page.getByTestId('select-op').selectOption('-');
    await page.getByTestId('input-b').fill('3');
    await page.getByTestId('btn-calculate').click();
    await expect(page.getByTestId('result')).toHaveText('7');
  });

  test('multiplication (*)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-a').fill('4');
    await page.getByTestId('select-op').selectOption('*');
    await page.getByTestId('input-b').fill('5');
    await page.getByTestId('btn-calculate').click();
    await expect(page.getByTestId('result')).toHaveText('20');
  });

  test('division (/)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-a').fill('15');
    await page.getByTestId('select-op').selectOption('/');
    await page.getByTestId('input-b').fill('3');
    await page.getByTestId('btn-calculate').click();
    await expect(page.getByTestId('result')).toHaveText('5');
  });

  test('division by zero → NaN (double branch in calculate)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-a').fill('1');
    await page.getByTestId('select-op').selectOption('/');
    await page.getByTestId('input-b').fill('0');
    await page.getByTestId('btn-calculate').click();
    await expect(page.getByTestId('result')).toHaveText('NaN');
  });
});

test.describe('CalculatorController via API (same JVM, JSON → records)', () => {
  test('op null defaults to + (CalculateRequest + calculate)', async ({ request }) => {
    const res = await request.post('/api/calculate', {
      data: { a: 3, b: 4, op: null },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.result).toBe(7);
  });

  test('op trimmed (req.op().trim())', async ({ request }) => {
    const res = await request.post('/api/calculate', {
      data: { a: 2, b: 3, op: '  +  ' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.result).toBe(5);
  });

  test('unsupported operator → IllegalArgumentException (default branch)', async ({
    request,
  }) => {
    const res = await request.post('/api/calculate', {
      data: { a: 1, b: 2, op: '^' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(500);
  });
});

// Data-driven matrix covering all four operators over a range of inputs.
// Purpose: pad real UI coverage so the suite runs well past ~2 minutes, which
// is needed to see a measurable TIA time saving when tests are skipped.
// 10 x 80 input grid x 4 operators = 3200 matrix tests (+ 8 named tests above).
// This is ~10x the size of the previous 10 x 8 grid. Even with this repo's CI
// config (workers: 2, see playwright.config.js), expect this suite to take on
// the order of tens of minutes — confirm that's actually desired before
// running it in CI, since it will consume a lot more CI minutes than before.
const OPERATORS = [
  { symbol: '+', calc: (a, b) => a + b },
  { symbol: '-', calc: (a, b) => a - b },
  { symbol: '*', calc: (a, b) => a * b },
  { symbol: '/', calc: (a, b) => (b === 0 ? NaN : a / b) },
];

const A_VALUES = Array.from({ length: 10 }, (_, i) => i + 1); // 1..10
const B_VALUES = Array.from({ length: 80 }, (_, i) => i + 1); // 1..80 (0 is covered by the dedicated NaN test above)
const PAIRS = A_VALUES.flatMap((a) => B_VALUES.map((b) => [a, b]));

test.describe('CalculatorController via UI (parameterized matrix)', () => {
  for (const op of OPERATORS) {
    for (const [a, b] of PAIRS) {
      test(`${a} ${op.symbol} ${b}`, async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('input-a').fill(String(a));
        await page.getByTestId('select-op').selectOption(op.symbol);
        await page.getByTestId('input-b').fill(String(b));
        await page.getByTestId('btn-calculate').click();
        const expected = op.calc(a, b);
        const expectedText = Number.isNaN(expected) ? 'NaN' : String(expected);
        await expect(page.getByTestId('result')).toHaveText(expectedText);
      });
    }
  }
});
