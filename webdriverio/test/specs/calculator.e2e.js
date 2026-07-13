/**
 * Exercises the Spring Boot calculator through the same UI as Playwright:
 * POST /api/calculate via fetch from index.html → CalculatorController.calculate
 *
 * SeaLights: test stage, lab, token from env or CLI (see wdio.conf.mjs + CI).
 */
import { strict as assert } from 'node:assert';
import { expect } from '@wdio/globals';

describe('CalculatorController via UI (POST /api/calculate)', () => {
  it('addition (+)', async () => {
    await browser.url('/');
    await $('[data-testid="input-a"]').setValue('7');
    await $('[data-testid="select-op"]').selectByAttribute('value', '+');
    await $('[data-testid="input-b"]').setValue('5');
    await $('[data-testid="btn-calculate"]').click();
    await expect($('[data-testid="result"]')).toHaveText('12');
  });

  it('subtraction (-)', async () => {
    await browser.url('/');
    await $('[data-testid="input-a"]').setValue('10');
    await $('[data-testid="select-op"]').selectByAttribute('value', '-');
    await $('[data-testid="input-b"]').setValue('3');
    await $('[data-testid="btn-calculate"]').click();
    await expect($('[data-testid="result"]')).toHaveText('7');
  });

  it('multiplication (*)', async () => {
    await browser.url('/');
    await $('[data-testid="input-a"]').setValue('4');
    await $('[data-testid="select-op"]').selectByAttribute('value', '*');
    await $('[data-testid="input-b"]').setValue('5');
    await $('[data-testid="btn-calculate"]').click();
    await expect($('[data-testid="result"]')).toHaveText('20');
  });

  it('division (/)', async () => {
    await browser.url('/');
    await $('[data-testid="input-a"]').setValue('15');
    await $('[data-testid="select-op"]').selectByAttribute('value', '/');
    await $('[data-testid="input-b"]').setValue('3');
    await $('[data-testid="btn-calculate"]').click();
    await expect($('[data-testid="result"]')).toHaveText('5');
  });

  it('division by zero → NaN', async () => {
    await browser.url('/');
    await $('[data-testid="input-a"]').setValue('1');
    await $('[data-testid="select-op"]').selectByAttribute('value', '/');
    await $('[data-testid="input-b"]').setValue('0');
    await $('[data-testid="btn-calculate"]').click();
    await expect($('[data-testid="result"]')).toHaveText('NaN');
  });
});

describe('CalculatorController via fetch (same origin)', () => {
  beforeEach(async () => {
    await browser.url('/');
  });

  it('op null defaults to +', async () => {
    const body = await browser.execute(async () => {
      const r = await fetch(`${window.location.origin}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 3, b: 4, op: null }),
      });
      return r.json();
    });
    assert.equal(body.result, 7);
  });

  it('op trimmed to +', async () => {
    const body = await browser.execute(async () => {
      const r = await fetch(`${window.location.origin}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 2, b: 3, op: '  +  ' }),
      });
      return r.json();
    });
    assert.equal(body.result, 5);
  });

  it('unsupported operator returns 500', async () => {
    const status = await browser.execute(async () => {
      const r = await fetch(`${window.location.origin}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 1, b: 2, op: '^' }),
      });
      return r.status;
    });
    assert.equal(status, 500);
  });
});

// Data-driven matrix covering all four operators over a range of inputs.
// Purpose: pad real UI coverage so the suite runs past ~2 minutes, which is
// needed to see a measurable TIA time saving when tests are skipped.
// Mirrors the same matrix used in the Playwright suite (calculator.spec.js).
// Note: wdio.conf.mjs sets maxInstances: 1, so these run serially — expect
// this matrix alone to take longer wall-clock time here than in Playwright.
const OPERATORS = [
  { symbol: '+', calc: (a, b) => a + b },
  { symbol: '-', calc: (a, b) => a - b },
  { symbol: '*', calc: (a, b) => a * b },
  { symbol: '/', calc: (a, b) => (b === 0 ? NaN : a / b) },
];

const PAIRS = [
  [1, 2], [3, 4], [5, 6], [7, 8], [9, 10],
  [11, 12], [13, 14], [15, 16], [17, 18], [19, 20],
  [2, 7], [4, 9], [6, 11], [8, 13], [10, 15],
  [12, 17], [14, 19], [16, 21], [18, 23], [20, 25],
  [1, 10], [2, 20], [3, 30], [4, 40], [5, 50],
  [6, 60], [7, 70], [8, 80], [9, 90], [10, 100],
];

describe('CalculatorController via UI (parameterized matrix)', () => {
  for (const op of OPERATORS) {
    for (const [a, b] of PAIRS) {
      it(`${a} ${op.symbol} ${b}`, async () => {
        await browser.url('/');
        await $('[data-testid="input-a"]').setValue(String(a));
        await $('[data-testid="select-op"]').selectByAttribute('value', op.symbol);
        await $('[data-testid="input-b"]').setValue(String(b));
        await $('[data-testid="btn-calculate"]').click();
        const expected = op.calc(a, b);
        const expectedText = Number.isNaN(expected) ? 'NaN' : String(expected);
        await expect($('[data-testid="result"]')).toHaveText(expectedText);
      });
    }
  }
});
