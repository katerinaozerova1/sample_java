# Cypress + SeaLights in this project

This folder contains **Cypress** end-to-end tests for the Spring Boot **calculator** app (`../`), integrated with **[sealights-cypress-plugin](https://www.npmjs.com/package/sealights-cypress-plugin)** so SeaLights can receive test execution signals, coverage-related data, and optional TIA behavior from the Cypress run. Backend coverage is collected by the **SeaLights CD Java agent** attached to the same JVM that serves the UI and `/api/calculate`.

Official references:

- Cypress plugin: [sealights-cypress-plugin](https://www.npmjs.com/package/sealights-cypress-plugin)  
- CD agent for Java: [SeaLights CD Agent – Java](https://docs.sealights.io/knowledgebase/setup-and-configuration/sealights-agents-and-plugins/cd-agent/cd-agent-for-java-application)  
- Cypress: [Documentation](https://docs.cypress.io/)

---

## Big picture: two SeaLights touchpoints

| Layer | What runs | Role |
|--------|-----------|------|
| **JVM** | Spring Boot JAR + `sl-cd-agent.jar` as `-javaagent` | Instruments `com.example.*` and reports **backend** coverage to SeaLights. |
| **Node / Cypress** | `cypress run` + **sealights-cypress-plugin** | Registers **Node tasks** (`registerSealightsTasks`) and **support** hooks so SeaLights can integrate with the Cypress lifecycle (coverage, results, skipping per product behavior). |

The app’s static page and API are served by the instrumented process, so UI and `cy.request` tests hit the same code paths the CD agent tracks.

---

## Step-by-step: what was configured and why

### 1. Node project and `package.json`

- **`cypress`** — Test runner (E2E; plugin supports E2E; component testing has extra `CYPRESS_SL_SPEC` rules per [npm docs](https://www.npmjs.com/package/sealights-cypress-plugin#spec-pattern)).  
- **`sealights-cypress-plugin`** — Adds `registerSealightsTasks`, support bundle, and SeaLights-aware behavior.  
- **`engines.node: ">=20"`** — Aligns with other test packages in this repo and CI.

**Scripts:**

| Script | Purpose |
|--------|---------|
| **`npm test`** | `cypress run --browser chrome --headless` — CI-style run against Chrome. |
| **`npm run test:open`** | Interactive **Cypress open** (local debugging). |
| **`npm run test:sealights`** | Runs the official **SeaLights Cypress runner** (`sl-cypress-runner`) in front of Cypress: validates env/connectivity, can patch config/support temporarily. Use when you want the **beta runner** flow; this repo’s **GitHub workflow** uses manual plugin wiring + `npm test` instead. |

After clone, run **`npx cypress install`** once so the Cypress binary is downloaded (CI does this explicitly).

---

### 2. `cypress.config.js` (project root = this folder)

Following [Cypress v10+](https://www.npmjs.com/package/sealights-cypress-plugin#cypress-v10) instructions:

| Setting | Purpose |
|---------|--------|
| **`e2e.baseUrl`** | From `CYPRESS_BASE_URL` or `http://127.0.0.1:8080` for `cy.visit('/')` and relative `cy.request` URLs. |
| **`experimentalInteractiveRunEvents: true`** | Recommended by the plugin README. |
| **`testIsolation: false`** | Recommended by the plugin README for SeaLights integration. |
| **`setupNodeEvents`** | **`await registerSealightsTasks(on, config)`** — must be **async** and **await**ed ([remote agent note](https://www.npmjs.com/package/sealights-cypress-plugin#using-remote-agent-version)). |
| **`specPattern`** | `cypress/e2e/**/*.cy.{js,jsx,ts,tsx}` |

---

### 3. `cypress/support/e2e.js`

Loads the plugin’s support side:

```javascript
require('sealights-cypress-plugin/support');
```

Place **custom commands** *after* this line if you add them.

---

### 4. Tests (`cypress/e2e/*.cy.js`)

- **UI** — `data-testid` selectors aligned with `../src/main/resources/static/index.html` (same as Playwright / WebdriverIO).  
- **API** — `cy.request` to `/api/calculate` with JSON body to exercise **`CalculatorController`** without the DOM.

---

### 5. SeaLights environment variables (Cypress)

Cypress only sees variables that are exposed with the **`CYPRESS_`** prefix (see [Cypress env docs](https://docs.cypress.io/guides/guides/environment-variables) and [plugin configuration](https://www.npmjs.com/package/sealights-cypress-plugin#configuration)).

**Prefixed for Cypress (used in CI):**

| Variable | Purpose |
|----------|---------|
| **`CYPRESS_BASE_URL`** | App origin (here: `http://127.0.0.1:8080`). |
| **`CYPRESS_SL_TOKEN`** | SeaLights token. |
| **`CYPRESS_SL_TEST_STAGE`** | Test stage name (here: `cypress`). |
| **`CYPRESS_SL_TEST_PROJECT_ID`** | Disambiguates projects (here: `sample-java-cypress`). |
| **`CYPRESS_SL_LAB_ID`** | Lab id (from GitHub secret). |
| **`CYPRESS_SL_PROXY`** | Optional proxy. |

The [plugin “minimal” list](https://www.npmjs.com/package/sealights-cypress-plugin#minimal-configuration) also mentions **`SL_BUILD_SESSION_ID`** / **`CYPRESS_SL_BUILD_SESSION_ID`**. This demo pipeline follows the same **lab + token + stage** approach as **`ubuntu-java-wdio.yml`** (no build session secret). If your tenant requires a build session id for Cypress, add **`CYPRESS_SL_BUILD_SESSION_ID`** (and the matching secret) per SeaLights guidance.

**Optional / advanced** (see npm README): `CYPRESS_SL_ENABLE_REMOTE_AGENT`, `CYPRESS_SL_DISABLE_AFTER_RUN_HOOK`, collector URLs, etc.

**Logging:** `NODE_DEBUG=sl` and `SL_LOG_LEVEL=debug` help diagnose connectivity or TLS issues.

---

### 6. GitHub Actions: `Ubuntu-Java-Cypress` (`.github/workflows/ubuntu-java-cypress.yml`)

Manual run: **Actions → Ubuntu-Java-Cypress → Run workflow**.

**Secrets:** **`SL_TOKEN`**, **`SL_LAB_ID`**. Optional: **`SL_PROXY`**.

**Flow (aligned with `ubuntu-java-wdio.yml`):**

1. Checkout, **`sltoken.txt`**, verify secrets.  
2. Download **CD agent** JAR.  
3. **JDK 17**, **`mvn package`**.  
4. Start Spring Boot with **`-javaagent`** — `-Dsl.branchname=**ubuntu-cypress**` so this workflow’s builds are distinct from **ubuntu-wdio** / **ubuntu-playwright** in SeaLights.  
5. **Install Google Chrome** (for `cypress run --browser chrome`).  
6. **Node 20**, **`npm ci`** in `cypress/`, **`npx cypress install`**.  
7. **`npm test`** with **`CYPRESS_*`** env vars set.  
8. Stop the JVM.

---

## Running locally

1. **Node 20+**.  
2. From repo root, start the app on port **8080** (with or without CD agent):

   ```bash
   mvn -B -q clean package -DskipTests
   java -jar target/calculator-demo-*.jar
   ```

3. From **`cypress/`**:

   ```bash
   npm install
   npx cypress install
   export CYPRESS_BASE_URL=http://127.0.0.1:8080
   export CYPRESS_SL_TOKEN=<token>
   export CYPRESS_SL_TEST_STAGE=local-cypress
   export CYPRESS_SL_TEST_PROJECT_ID=sample-java-cypress
   export CYPRESS_SL_LAB_ID=<lab-id>
   npm test
   ```

---

## Optional: SeaLights `sl-cypress-runner` (beta)

The package ships a **runner** that wraps your Cypress command, validates configuration, and temporarily patches config/support:

```bash
npx sealights-cypress-plugin npx cypress run --browser chrome --headless
```

See [Using the Sealights Cypress Runner](https://www.npmjs.com/package/sealights-cypress-plugin#using-the-sealights-cypress-runner-beta). If a run aborts badly, **`npx sealights-cypress-plugin clean`** can restore backups. This repository already includes **manual** `registerSealightsTasks` + support import so you do not depend on the runner for CI.

---

## TLS / proxy

Corporate proxies or TLS inspection may require **`CYPRESS_SL_PROXY`** and/or **`NODE_EXTRA_CA_CERTS`** (PEM). Avoid disabling TLS verification except for short local experiments.

---

## Files in this folder

| Path | Description |
|------|-------------|
| `package.json` / `package-lock.json` | Dependencies and lockfile. |
| `cypress.config.js` | Cypress + `registerSealightsTasks`. |
| `cypress/e2e/calculator.cy.js` | UI + API specs. |
| `cypress/support/e2e.js` | SeaLights support import. |
| Artifacts (gitignored) | `cypress/videos/`, `cypress/screenshots/`, `cypress/downloads/` |

---

## Related project layout

- **Spring Boot app:** `../pom.xml`, `../src/main/java/...`.  
- **Playwright:** `../playwright/` — [sealights-playwright-plugin](https://www.npmjs.com/package/sealights-playwright-plugin).  
- **WebdriverIO:** `../webdriverio/` — [sealights-webdriverio-plugin](https://www.npmjs.com/package/sealights-webdriverio-plugin).
