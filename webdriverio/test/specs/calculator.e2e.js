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
// Purpose: pad real UI coverage so the suite runs well past ~2 minutes, which
// is needed to see a measurable TIA time saving when tests are skipped.
// Mirrors the same matrix used in the Playwright suite (calculator.spec.js):
// 10 x 80 input grid x 4 operators = 3200 matrix tests (+ 8 named tests above).
// This is ~10x the size of the previous 10 x 8 grid. Note: wdio.conf.mjs sets
// maxInstances: 1, so these run serially — expect this matrix alone to take
// substantially longer wall-clock time here than in Playwright (potentially
// well over an hour). Confirm that's actually desired before running it,
// since it will consume a lot more CI/compute time than before.
const OPERATORS = [
  { symbol: '+', calc: (a, b) => a + b },
  { symbol: '-', calc: (a, b) => a - b },
  { symbol: '*', calc: (a, b) => a * b },
  { symbol: '/', calc: (a, b) => (b === 0 ? NaN : a / b) },
];

const A_VALUES = Array.from({ length: 10 }, (_, i) => i + 1); // 1..10
const B_VALUES = Array.from({ length: 80 }, (_, i) => i + 1); // 1..80 (0 is covered by the dedicated NaN test above)
const PAIRS = A_VALUES.flatMap((a) => B_VALUES.map((b) => [a, b]));

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
