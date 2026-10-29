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
 const result=await page.evaluate(async()=>{
   const cache=await caches.open("unrelated-application-cache");
   await cache.put("./private-note.txt",new Response("not Dexter data"));
   const response=await fetch("./private-note.txt");
   return {status:response.status,body:await response.text()};
 });
 expect(result.status).toBe(404);
 expect(result.body).not.toContain("not Dexter data");
});
