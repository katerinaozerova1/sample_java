/**
 * Calculator Spring Boot app — same UI as Playwright/WDIO (data-testid selectors).
 * POST /api/calculate is exercised through the page; API-only checks use cy.request.
 */

describe('CalculatorController via UI (POST /api/calculate)', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('addition (+)', () => {
    cy.get('[data-testid="input-a"]').clear().type('7');
    cy.get('[data-testid="select-op"]').select('+');
    cy.get('[data-testid="input-b"]').clear().type('5');
    cy.get('[data-testid="btn-calculate"]').click();
    cy.get('[data-testid="result"]').should('have.text', '12');
  });

  it('subtraction (-)', () => {
    cy.get('[data-testid="input-a"]').clear().type('10');
    cy.get('[data-testid="select-op"]').select('-');
    cy.get('[data-testid="input-b"]').clear().type('3');
    cy.get('[data-testid="btn-calculate"]').click();
    cy.get('[data-testid="result"]').should('have.text', '7');
  });

  it('multiplication (*)', () => {
    cy.get('[data-testid="input-a"]').clear().type('4');
    cy.get('[data-testid="select-op"]').select('*');
    cy.get('[data-testid="input-b"]').clear().type('5');
    cy.get('[data-testid="btn-calculate"]').click();
    cy.get('[data-testid="result"]').should('have.text', '20');
  });

  it('division (/)', () => {
    cy.get('[data-testid="input-a"]').clear().type('15');
    cy.get('[data-testid="select-op"]').select('/');
    cy.get('[data-testid="input-b"]').clear().type('3');
    cy.get('[data-testid="btn-calculate"]').click();
    cy.get('[data-testid="result"]').should('have.text', '5');
  });

  it('division by zero → NaN', () => {
    cy.get('[data-testid="input-a"]').clear().type('1');
    cy.get('[data-testid="select-op"]').select('/');
    cy.get('[data-testid="input-b"]').clear().type('0');
    cy.get('[data-testid="btn-calculate"]').click();
    cy.get('[data-testid="result"]').should('have.text', 'NaN');
  });
});

describe('CalculatorController via API (cy.request)', () => {
  it('op null defaults to +', () => {
    cy.request({
      method: 'POST',
      url: '/api/calculate',
      headers: { 'Content-Type': 'application/json' },
      body: { a: 3, b: 4, op: null },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property('result', 7);
    });
  });

  it('op trimmed to +', () => {
    cy.request({
      method: 'POST',
      url: '/api/calculate',
      headers: { 'Content-Type': 'application/json' },
      body: { a: 2, b: 3, op: '  +  ' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.result).to.eq(5);
    });
  });

  it('unsupported operator returns 500', () => {
    cy.request({
      method: 'POST',
      url: '/api/calculate',
      headers: { 'Content-Type': 'application/json' },
      body: { a: 1, b: 2, op: '^' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(500);
    });
  });
});
