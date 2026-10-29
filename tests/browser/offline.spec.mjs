import {test,expect} from "@playwright/test";

// A new browsing context/window is deliberately not reused: the original
// controller and its document can disappear while Dexter remains offline.
test("cached Dexter reopens in a fresh window without a network connection",async({browser})=>{
 const context=await browser.newContext({serviceWorkers:"allow"});
 try {
   const first=await context.newPage();
   await first.goto("http://127.0.0.1:4173/");
   await first.evaluate(()=>navigator.serviceWorker.ready);
   await first.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
   await first.close();
   await context.setOffline(true);
   const reopened=await context.newPage();
   await reopened.goto("http://127.0.0.1:4173/",{waitUntil:"domcontentloaded"});
   await expect(reopened.locator("#sprite")).toBeVisible();
   await reopened.getByRole("button",{name:"Huff"}).click();
   await expect(reopened.locator("#stateLabel")).toHaveText("DISAPPROVING");
 } finally {
   await context.setOffline(false);
   await context.close();
 }
});

test("offline worker cannot serve an unrelated resource from Cache Storage",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await page.evaluate(async()=>{
   const cache=await caches.open("unrelated-application-cache");
   await cache.put("./private-note.txt",new Response("not Dexter data"));
 });
 // The app's connect-src 'none' intentionally blocks window.fetch(); use a
 // document navigation so the actual service worker handles this request.
 const response=await page.goto("/private-note.txt",{waitUntil:"domcontentloaded"});
 expect(response.status()).toBe(404);
 expect(await page.locator("body").innerText()).not.toContain("not Dexter data");
});
