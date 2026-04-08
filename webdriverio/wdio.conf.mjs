/**
 * WebdriverIO + SeaLights (Mocha).
 * SeaLights CLI/env: https://www.npmjs.com/package/sealights-webdriverio-plugin
 */
import {
  service as SealightsService,
  launcher as SealightsLauncher,
} from 'sealights-webdriverio-plugin';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8080';

export const config = {
  runner: 'local',
  baseUrl,
  specs: ['./test/specs/**/*.js'],
  maxInstances: 1,
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },
  reporters: ['spec'],
  logLevel: 'info',
  services: [['chromedriver', { logLevel: 'silent' }], [SealightsService]],
  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: [
          '--headless=new',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1280,800',
        ],
      },
    },
  ],
  onPrepare: async () => {
    await new SealightsLauncher().onPrepare();
  },
};
