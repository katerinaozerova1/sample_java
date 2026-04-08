/**
 * Exercises the Spring Boot calculator through the same UI as Playwright:
 * POST /api/calculate via fetch from index.html → CalculatorController.calculate
 *
 * SeaLights: test stage / build session / token come from env or CLI (see wdio.conf.mjs + CI).
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
