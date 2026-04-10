# Playwright + SeaLights in this project

This folder contains **Playwright** tests for the Spring Boot **calculator** app (`../`), integrated with **[sealights-playwright-plugin](https://www.npmjs.com/package/sealights-playwright-plugin)** so SeaLights can track tests, apply TIA-based skipping when enabled, and correlate runs with your lab. Backend coverage comes from the **SeaLights CD Java agent** running on the same JVM that serves the app.

Official references:

- Playwright plugin: [sealights-playwright-plugin](https://www.npmjs.com/package/sealights-playwright-plugin)  
- CD agent for Java: [SeaLights CD Agent – Java](https://docs.sealights.io/knowledgebase/setup-and-configuration/sealights-agents-and-plugins/cd-agent/cd-agent-for-java-application)  
- Playwright: [@playwright/test](https://playwright.dev/docs/intro)

---

## Big picture: two SeaLights touchpoints

| Layer | What runs | Role |
|--------|-----------|------|
| **JVM** | Spring Boot JAR + `sl-cd-agent.jar` as `-javaagent` | Instruments `com.example.*` and sends **backend** coverage to SeaLights for the configured app / lab / build / branch. |
| **Node / Playwright** | `playwright test` + **`sealights-playwright-plugin`** | Supplies a wrapped **`test`** fixture so SeaLights can hook workers/tests, report execution, and optional TIA; **`expect`** and other APIs stay on `@playwright/test`. |

The static UI and `/api/calculate` are served by the instrumented JVM, so UI and API tests exercise the same code the CD agent is watching.

---

## Step-by-step: what was configured and why

### 1. Node project and `package.json`

- **`@playwright/test`** — Playwright test runner and browsers API.  
- **`sealights-playwright-plugin`** — Wraps Playwright’s `test` with SeaLights-aware fixtures ([fixtures-based implementation](https://www.npmjs.com/package/sealights-playwright-plugin#implementation)).

**Scripts:**

| Script | Purpose |
|--------|---------|
| **`npm test`** | `playwright test` — run the suite. |
| **`npm run test:headed`** | Run with a visible browser (local debugging). |
| **`npm run sealights:rewrite-imports`** | Runs `npx sealights-playwright-plugin replace-imports --test-dir ./tests` to bulk-replace `test` imports from `@playwright/test` with `sealights-playwright-plugin` (see [plugin README](https://www.npmjs.com/package/sealights-playwright-plugin#optional-using-the-import-replacement-utility)). |

**Requirements (from plugin):** Node **18+**, Playwright **1.20+**. This repo uses **Node 20** in CI.

---

### 2. `playwright.config.js`

Playwright config stays **standard** — no SeaLights-specific plugin registration in the config file. SeaLights is activated by **importing `test` from `sealights-playwright-plugin`** in spec files and by **environment variables** at runtime.

| Setting | Purpose |
|---------|--------|
| **`defineConfig`** | Standard Playwright config shape. |
| **`baseURL`** | From `BASE_URL` or `http://127.0.0.1:8080` for `page.goto('/')` and `request` relative URLs. |
| **`testDir: './tests'`** | Spec location. |
| **`projects`** | Single **chromium** project (`channel: 'chromium'`) for consistent CI/local behavior. |
| **`use.trace`** | `on-first-retry` for debugging flakes. |
| **CI tuning** | `forbidOnly`, `retries`, `workers` when `CI` is set. |

---

### 3. Tests (`tests/*.spec.js`)

**Critical pattern for SeaLights:**

```javascript
const { test } = require('sealights-playwright-plugin');
const { expect } = require('@playwright/test');
```

- **`test`** — Must come from **`sealights-playwright-plugin`** so SeaLights hooks run.  
- **`expect`** (and anything else you need) — Stays from **`@playwright/test`** as in the [plugin examples](https://www.npmjs.com/package/sealights-playwright-plugin#example-test-file).

Tests use **`data-testid`** selectors aligned with `../src/main/resources/static/index.html`. UI specs drive the calculator; additional specs use Playwright **`request`** to POST JSON to `/api/calculate` and assert on the same JVM.

---

### 4. SeaLights environment variables (Playwright / Node)

Per the [plugin documentation](https://www.npmjs.com/package/sealights-playwright-plugin#environment-variables-setup):

**Required:**

| Variable | Purpose |
|----------|---------|
| **`SL_TOKEN`** | SeaLights agent token. |
| **`SL_TEST_STAGE`** | Logical test stage name (e.g. `github-actions` in default CI). |
| **`SL_BUILD_SESSION_ID` *or* `SL_LAB_ID`** | Either a fixed build session id **or** a lab id. If only **`SL_LAB_ID`** is set, the backend can **resolve** the build session at runtime (this demo relies on that). |

**Optional (examples):**

| Variable | Purpose |
|----------|---------|
| **`SL_TEST_PROJECT_ID`** | Disambiguates test stages with the same name across teams/products (here: `calculator-demo`). |
| **`SL_PROXY`** | HTTP(S) proxy for SeaLights traffic. |
| **`SL_COLLECTOR_URL`** | Override collector URL (advanced). |
| **`SL_TIA_DISABLED`** | Set to disable TIA recommendations / test skipping. |
| **`SL_DISABLE`** | Disable the plugin while keeping imports (no SeaLights errors from missing config). |
| **`SL_PR_ID`** | Identify PR pipeline runs vs other runs of the same stage. |

**Logging:** `NODE_DEBUG=sl` and `SL_LOG_LEVEL=debug` (see [Logging](https://www.npmjs.com/package/sealights-playwright-plugin#logging)).

This repo’s **default `ci.yml`** passes `SL_TOKEN`, `SL_LAB_ID`, `SL_TEST_STAGE`, `SL_TEST_PROJECT_ID`, and optional `SL_PROXY` — **not** `SL_BUILD_SESSION_ID`, consistent with lab-only resolution.

---

### 5. GitHub Actions: `CI` workflow (`.github/workflows/ci.yml`)

Manual run: **Actions → CI → Run workflow**.

**Secrets:** **`SL_TOKEN`**, **`SL_LAB_ID`** (Actions → Secrets and variables → Actions). Optional: **`SL_PROXY`**. Use a job-level **`environment:`** if secrets live in a GitHub Environment.

**Steps (order matters):**

1. **Checkout** — Clone the repository.  
2. **Create SeaLights token file** — Writes `sltoken.txt` for the JVM (`-Dsl.tokenFile`).  
3. **Verify secrets** — Ensures token file and `SL_LAB_ID` are present.  
4. **Download CD agent** — `sl-cd-agent-latest.zip` → `sealights-cd-agent/sl-cd-agent.jar`.  
5. **JDK 17 + Maven** — `mvn clean package` → `target/calculator-demo-*.jar`.  
6. **Start Spring Boot with CD agent** — `java -javaagent:…` with SeaLights system properties; app on **port 8080**; process id stored for shutdown.  
7. **Node 20 + npm** — Install Playwright dependencies (`npm ci` or `npm install` in `playwright/`).  
8. **Install Chromium** — `npx playwright install chromium --with-deps` (browsers + OS deps on Ubuntu).  
9. **Run Playwright** — `npm test` with `BASE_URL` and `SL_*` env vars (see table below).  
10. **Stop app** — Kill JVM (`always()` so cleanup runs on failure).

**JVM / CD agent properties in `ci.yml`:**

| Property | Typical value | Role |
|----------|----------------|------|
| `-Dsl.tokenFile` | Path to `sltoken.txt` | CD agent authentication. |
| `-Dsl.appName` | `calculator-demo` | App name in SeaLights. |
| `-Dsl.labId` | From secret | Lab. |
| `-Dsl.buildname` | `${{ github.run_number }}` | Build id (per workflow). |
| `-Dsl.branchname` | `${{ github.ref_name }}` | Git branch name. |
| `-Dsl.includes` | `com.example.*` | Instrumented packages. |
| `-Dsl.proxy` | Optional | If `SL_PROXY` is set. |

**Playwright step env in `ci.yml`:**

| Variable | Value (conceptually) |
|----------|----------------------|
| `BASE_URL` | `http://127.0.0.1:8080` |
| `SL_TOKEN` | From secret |
| `SL_LAB_ID` | From secret |
| `SL_TEST_STAGE` | `github-actions` |
| `SL_TEST_PROJECT_ID` | `calculator-demo` |
| `SL_PROXY` | Optional |

**Related workflows:** `ci-debug.yml` (extra `NODE_DEBUG` / `SL_LOG_LEVEL`), `ci-windows.yml` (Windows runner). Same SeaLights ideas; adjust paths/shell as needed.

---

## Running locally

1. **Node 20+** recommended (match CI).  
2. From repo root, build and start the app (optionally with the CD agent, same JVM flags as CI):

   ```bash
   mvn -B -q clean package -DskipTests
   java -jar target/calculator-demo-*.jar
   ```

3. From **`playwright/`**:

   ```bash
   npm install
   npx playwright install chromium
   export BASE_URL=http://127.0.0.1:8080
   export SL_TOKEN=<your-token>
   export SL_LAB_ID=<your-lab-id>
   export SL_TEST_STAGE=local-playwright
   export SL_TEST_PROJECT_ID=calculator-demo
   npm test
   ```

---

## Migrating existing Playwright tests to SeaLights

1. Replace **`test`** imports from `@playwright/test` with **`sealights-playwright-plugin`** (keep **`expect`** from `@playwright/test` unless you use only APIs from the plugin).  
2. Or run **`npm run sealights:rewrite-imports`** (see [import replacement utility](https://www.npmjs.com/package/sealights-playwright-plugin#optional-using-the-import-replacement-utility)) and **review** the diff.  
3. Set the **required env vars** in CI and locally.  
4. Run **`npx playwright install`** after cloning so browsers are present.

---

## TLS / proxy (corporate networks)

If SeaLights API calls fail TLS verification, configure your corporate **CA** (`NODE_EXTRA_CA_CERTS`) or **`SL_PROXY`** as your network team recommends. Prefer fixing trust over disabling TLS verification.

---

## Files in this folder

| Path | Description |
|------|-------------|
| `package.json` | Dependencies and scripts. |
| `playwright.config.js` | Playwright runner config (base URL, chromium project, CI options). |
| `tests/calculator.spec.js` | Calculator UI + API tests with SeaLights `test` import. |
| Playwright artifacts | `playwright-report/`, `test-results/` (often gitignored at repo root). |

---

## Related project layout

- **Spring Boot app:** `../pom.xml`, `../src/main/java/...`, UI in `../src/main/resources/static/`.  
- **WebdriverIO + SeaLights:** `../webdriverio/` — same app, alternate test runner with [sealights-webdriverio-plugin](https://www.npmjs.com/package/sealights-webdriverio-plugin).
