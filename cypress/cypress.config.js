/**
 * Cypress + SeaLights: https://www.npmjs.com/package/sealights-cypress-plugin
 */
const { defineConfig } = require('cypress');
const { registerSealightsTasks } = require('sealights-cypress-plugin');

const baseUrl = process.env.CYPRESS_BASE_URL || 'http://127.0.0.1:8080';

module.exports = defineConfig({
  e2e: {
    baseUrl,
    experimentalInteractiveRunEvents: true,
    testIsolation: false,
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    async setupNodeEvents(on, config) {
      await registerSealightsTasks(on, config);
      return config;
    },
  },
});
