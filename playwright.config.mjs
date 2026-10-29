import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
 testDir:"./tests/browser",
 timeout:30000,
 expect:{timeout:6000},
 fullyParallel:false,
 forbidOnly:Boolean(process.env.CI),
 retries:0,
 workers:1,
 reporter:"line",
 use:{
   baseURL:"http://127.0.0.1:4173",
   headless:true,
   screenshot:"only-on-failure",
   trace:"retain-on-failure"
 },
 projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}},{name:"webkit",use:{...devices["Desktop Safari"]}}],
 webServer:{
   command:"npm start",
   url:"http://127.0.0.1:4173/",
   timeout:45000,
   reuseExistingServer:!process.env.CI
 }
});
