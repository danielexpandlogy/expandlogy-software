import { defineConfig, devices } from "@playwright/test";

// e2e contra el proyecto de Supabase configurado en .env. Cada archivo crea sus
// propias identidades temporales (service role en .env.e2e.local) y las borra.
export default defineConfig({
  testDir: "./e2e",
  // Holgado: todo corre contra el Supabase real (remoto), cuya latencia varía.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8080",
    trace: "retain-on-failure",
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 8080 --strictPort",
    url: "http://127.0.0.1:8080",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
