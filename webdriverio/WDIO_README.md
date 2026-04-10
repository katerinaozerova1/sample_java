# WebdriverIO + SeaLights in this project

This folder contains **WebdriverIO** end-to-end tests for the Spring Boot **calculator** app (`../`), integrated with the **[sealights-webdriverio-plugin](https://www.npmjs.com/package/sealights-webdriverio-plugin)** so SeaLights can associate test execution with your lab and (together with the **CD Java agent** on the JVM) collect coverage-related data from the pipeline.

Official references:

- WebdriverIO plugin: [sealights-webdriverio-plugin](https://www.npmjs.com/package/sealights-webdriverio-plugin)  
- CD agent for Java: [SeaLights CD Agent – Java](https://docs.sealights.io/knowledgebase/setup-and-configuration/sealights-agents-and-plugins/cd-agent/cd-agent-for-java-application)

---

## Big picture: two SeaLights touchpoints

| Layer | What runs | Role |
|--------|-----------|------|
| **JVM** | Spring Boot JAR + `sl-cd-agent.jar` as `-javaagent` | Instruments `com.example.*`, reports **backend** coverage to SeaLights for the configured app / lab / build / branch. |
| **Node / WebdriverIO** | `wdio` + `sealights-webdriverio-plugin` | Registers a **test stage**, sends **start/end test** (and related) events, optional TIA exclusions, coordinates with SeaLights for the **browser** side per plugin behavior. |

The UI under test is served by the same JVM that carries the CD agent, so exercising `/` and `/api/calculate` drives the instrumented code paths.

---

## Step-by-step: what was configured and why

### 1. Node project and `package.json`

- **`"type": "module"`** — Config and specs use **ESM** (`import` / `wdio.conf.mjs`).
- **`engines.node: ">=20"`** — The SeaLights stack (e.g. `slnodejs` pulled by the plugin) expects a current Node; **GitHub Actions uses Node 20**.
- **Dependencies (high level):**
  - **`webdriverio`**, **`@wdio/cli`**, **`@wdio/local-runner`**, **`@wdio/mocha-framework`**, **`@wdio/spec-reporter`**, **`@wdio/globals`** — Standard WebdriverIO 8 **Mocha** setup.
  - **`wdio-chromedriver-service`** + **`chromedriver`** — Starts **ChromeDriver** and must use a **binary whose major version matches the installed Google Chrome** (see [Chrome / ChromeDriver](#chrome--chromedriver-version-mismatch)).
  - **`sealights-webdriverio-plugin`** — SeaLights integration (service + launcher).
  - **`expect-webdriverio`** (via `@wdio/globals`) — Assertions such as `toHaveText` on elements.

**Script:** `npm test` runs `wdio run wdio.conf.mjs`.

---

### 2. `wdio.conf.mjs` (WebdriverIO config)

| Setting | Purpose |
|---------|--------|
| **`runner: 'local'`** | Tests run on the same machine as the WDIO CLI (typical for CI). |
| **`baseUrl`** | From `BASE_URL` or default `http://127.0.0.1:8080` so specs can use `browser.url('/')`. |
| **`specs`** | `./test/specs/**/*.js` — Mocha spec files. |
| **`framework: 'mocha'`** | Required by the SeaLights plugin (Cucumber uses a different plugin). |
| **`services`** | **`['chromedriver', …]`** — Manages ChromeDriver. **`[SealightsService]`** — Loads the plugin **service** (hooks for tests / SeaLights). The package is not named `wdio-*-service`, so the **module is passed directly**, as in the npm README. |
| **`capabilities`** | Chrome with **headless** flags suitable for Linux CI (`--no-sandbox`, `--disable-dev-shm-usage`, etc.). |
| **`onPrepare`** | **`await new SealightsLauncher().onPrepare()`** — Runs **once** before workers: fetches TIA exclusions when enabled and writes **`.sl/.wdio-excluded-tests.json`** under `webdriverio/`. |

Imports use the **named exports** recommended for ESM:

```js
import {
  service as SealightsService,
  launcher as SealightsLauncher,
} from 'sealights-webdriverio-plugin';
```

---

### 3. Tests (`test/specs/`)

- **`calculator.e2e.js`** — Mocha `describe` / `it` blocks.
- **UI tests** — Use `browser.url`, `$('[data-testid="…"]')`, and `@wdio/globals` `expect` for the calculator page (same `data-testid` attributes as the Playwright tests in `../playwright`).
- **API checks via browser** — Extra `describe` uses `browser.execute` + `fetch` to the same origin so JSON hits **`CalculatorController`** without a separate Node HTTP client.

---

### 4. SeaLights environment variables (WebdriverIO / Node)

The plugin reads configuration from the environment (and optional `--sl-*` CLI flags). In **this** repo’s CI we set:

| Variable | Purpose in this workflow |
|----------|---------------------------|
| **`SL_TOKENFILE`** | Absolute path to `sltoken.txt` at repo root (written from `secrets.SL_TOKEN`). |
| **`SL_TESTSTAGE`** | Test stage name in SeaLights (here: `wdio`). |
| **`SL_TESTPROJECTID`** | Separates test stages when names collide across teams/products (here: `sample-java-wdio`). |
| **`SL_LABID`** | Lab ID (from `secrets.SL_LAB_ID`), aligned with the CD agent. |
| **`SL_PROXY`** | Optional corporate proxy for SeaLights API calls. |

**Note:** This demo pipeline does **not** pass `SL_BUILDSESSIONID` / build session file; correlation is done with token, lab, and test stage per your org policy. If your tenant requires a build session, add the variables described in the [plugin README](https://www.npmjs.com/package/sealights-webdriverio-plugin).

**Debugging:** `NODE_DEBUG=sl` and/or `SL_LOG_LEVEL=debug` increase SeaLights logging (useful for TLS or auth issues).

---

### 5. GitHub Actions: `Ubuntu-Java-WebdriverIO` (`.github/workflows/ci-webdriverio.yml`)

Manual run: **Actions → Ubuntu-Java-WebdriverIO → Run workflow**.

**Secrets (repository → Settings → Secrets and variables → Actions):**

- **`SL_TOKEN`** — SeaLights API token (written to `sltoken.txt`).
- **`SL_LAB_ID`** — Lab ID for both JVM and WebdriverIO.

Optional: **`SL_PROXY`**.

**Steps (order matters):**

1. **Checkout** — Clone the repo.  
2. **Create SeaLights token file** — `sltoken.txt` for `-Dsl.tokenFile` and `SL_TOKENFILE`.  
3. **Verify secrets** — Fail fast if token or lab is missing.  
4. **Download CD agent** — Unzip `sl-cd-agent-latest.zip` to `sealights-cd-agent/sl-cd-agent.jar`.  
5. **JDK 17 + Maven build** — `mvn clean package` produces `target/calculator-demo-*.jar`.  
6. **Start Spring Boot with CD agent** — `java -javaagent:…/sl-cd-agent.jar` with JVM system properties (see table below); app listens on **8080**; PID saved for teardown.  
7. **Install Chrome** — If the runner has no `google-chrome-stable`, install from Google’s `.deb`.  
8. **Node 20 + `npm ci`** in `webdriverio/` — Install test dependencies from lockfile.  
9. **Align `chromedriver` npm package** — Install `chromedriver@<Chrome major>` so the driver matches the runner’s Chrome.  
10. **Run WebdriverIO** — `npx wdio run wdio.conf.mjs` with `BASE_URL` and `SL_*` env vars.  
11. **Stop app** — Kill the JVM process (`always()` so cleanup runs even if tests fail).

**JVM / CD agent properties used here (build identity in SeaLights):**

| Property | Example / value | Role |
|----------|-----------------|------|
| `-Dsl.tokenFile` | Path to `sltoken.txt` | Authenticates the CD agent. |
| `-Dsl.appName` | `calculator-demo` | Application name in SeaLights. |
| `-Dsl.labId` | From secret | Lab. |
| `-Dsl.buildname` | `${{ github.run_number }}` | Build number (per workflow). |
| `-Dsl.branchname` | `ubuntu-wdio` | Fixed branch label for this pipeline so it does not collide with other workflows on the same Git branch + same `run_number`. |
| `-Dsl.includes` | `com.example.*` | Packages to instrument. |
| `-Dsl.proxy` | Optional | If `SL_PROXY` is set. |

---

## Running locally

1. **Node 20+** installed.  
2. **Build and run** the calculator from the repo root (with the CD agent):

   ```bash
   mvn -B -q clean package -DskipTests
   java -jar target/calculator-demo-*.jar
   ```

3. In another terminal, from **`webdriverio/`**:

   ```bash
   export BASE_URL=http://127.0.0.1:8080
   export SL_TOKENFILE=/absolute/path/to/sltoken.txt
   export SL_TESTSTAGE=local-wdio
   export SL_TESTPROJECTID=sample-java-wdio
   export SL_LABID=<your-lab-id>
   npm install
   npm install "chromedriver@$(google-chrome-stable --version 2>/dev/null | sed -E 's/.* ([0-9]+)\..*/\1/' || echo 131)" --save-dev
   npm test
   ```

   On macOS, replace `google-chrome-stable` with the path/version command you use for Chrome.

---

## Chrome / ChromeDriver version mismatch

Symptoms: `This version of ChromeDriver only supports Chrome version X` while the browser is `Y`.

**Cause:** The **`chromedriver` npm** binary must match the **major** version of **Google Chrome**.

**Fix:** Install a matching major, e.g. `npm install chromedriver@146 --save-dev` if Chrome is 146. CI runs an **“Align npm chromedriver”** step after `npm ci` so the runner’s Chrome and `chromedriver` stay aligned when the image updates.

---

## TLS / proxy (corporate networks)

If SeaLights API calls fail with certificate errors, your team may set **`NODE_EXTRA_CA_CERTS`** to a PEM bundle or configure **`SL_PROXY`**. Avoid **`NODE_TLS_REJECT_UNAUTHORIZED=0`** except for short-lived debugging.

---

## Files in this folder

| Path | Description |
|------|-------------|
| `package.json` / `package-lock.json` | Dependencies and lockfile. |
| `wdio.conf.mjs` | WebdriverIO + SeaLights service/launcher + Chrome. |
| `test/specs/calculator.e2e.js` | Calculator UI + API-via-browser tests. |
| `.sl/` (gitignored) | SeaLights plugin exclusions cache, e.g. `.sl/.wdio-excluded-tests.json`. |

---

## Related project layout

- **Spring Boot app:** `../pom.xml`, `../src/main/java/...`, static UI in `../src/main/resources/static/`.  
- **Playwright + SeaLights:** `../playwright/` (parallel test stack with `sealights-playwright-plugin`).
