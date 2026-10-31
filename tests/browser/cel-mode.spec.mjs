import {test,expect} from "@playwright/test";

test("approved cel mode is opt-in, interactive, and returns to original 96px mode",async({page})=>{
 const outside=[];
 page.on("request",request=>{
  if(new URL(request.url()).origin!=="http://127.0.0.1:4173")outside.push(request.url());
 });
 await page.goto("/");
 const original=page.locator("#sprite"),player=page.locator("#pet"),video=page.locator("#celVideo"),still=page.locator("#celPoster");
 await expect(original).toBeVisible();
 await expect(video).toBeHidden();await expect(still).toBeHidden();
 await page.getByRole("button",{name:"Settings"}).click();
 await expect(page.locator("#celModeToggle")).not.toBeChecked();
 await page.locator("#celModeToggle").check();
 await expect(player).toHaveAttribute("data-art-mode","cel");
 await expect(original).toBeHidden();
 await expect(still.or(video).first()).toBeAttached();
 await expect.poll(async()=>await still.isVisible()||await video.isVisible()).toBe(true);
 await expect(page.locator("#celClipControl")).toBeVisible();
 await expect(page.locator("#atlasPreviewToggle")).not.toBeChecked();
 await page.locator("#celClipSelect").selectOption("sit_down");
 await expect(page.locator("#celClipSelect")).toHaveValue("sit_down");
 await expect.poll(async()=>await still.isVisible()||await video.isVisible()).toBe(true);
 await page.locator("#celClipSelect").selectOption("auto");
 await page.locator("#doneSettings").click();
 await page.getByRole("button",{name:"Nap"}).click();
 await expect(page.locator("#stateLabel")).toHaveText("ASLEEP");
 await expect.poll(async()=>await still.isVisible()||await video.isVisible()).toBe(true);
 await page.getByRole("button",{name:"Settings"}).click();
 await page.locator("#celModeToggle").uncheck();
 await expect(original).toBeVisible();await expect(still).toBeHidden();await expect(video).toBeHidden();
 await expect(player).not.toHaveAttribute("data-art-mode","cel");
 expect(outside).toEqual([]);
});

test("cel mode respects reduced motion, quiet mode and reverts on reset",async({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:"Settings"}).click();
 await page.locator("#motionToggle").check();
 await page.locator("#celModeToggle").check();
 const video=page.locator("#celVideo"),still=page.locator("#celPoster");
 await expect(video).toBeHidden();await expect(still).toBeVisible();
 await page.locator("#celClipSelect").selectOption("sleep_loop");
 await expect(video).toBeHidden();
 await page.locator("#motionToggle").uncheck();
 await page.locator("#quietToggle").check();
 await expect(still).toBeVisible();
 await page.locator("#celClipSelect").selectOption("auto");
 await page.locator("#resetSettings").click();
 await expect(page.locator("#celModeToggle")).not.toBeChecked();
 await expect(page.locator("#sprite")).toBeVisible();
 await expect(page.locator("#celClipControl")).toBeHidden();
 const storage=await page.evaluate(()=>Object.keys(localStorage));
 expect(storage.every(k=>k==="dexter-desk-familiar:prefs:v1")).toBe(true);
});

test("pixel atlas and cel mode cannot obscure each other",async({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:"Settings"}).click();
 await page.locator("#atlasPreviewToggle").check();
 await expect(page.locator("#atlasCanvas")).toBeVisible();
 await page.locator("#celModeToggle").check();
 await expect(page.locator("#atlasCanvas")).toBeHidden();
 await expect(page.locator("#atlasPreviewToggle")).not.toBeChecked();
 await page.locator("#celModeToggle").uncheck();
 await expect(page.locator("#sprite")).toBeVisible();
 await page.locator("#atlasPreviewToggle").check();
 await expect(page.locator("#celModeToggle")).not.toBeChecked();
 await expect(page.locator("#atlasCanvas")).toBeVisible();
});

test("all approved cel assets are available from the offline shell",async({page,context})=>{
 await page.goto("/");
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const cached=await page.evaluate(async()=>{
  const matches=await caches.keys();
  const dex=matches.find(name=>name.includes("v6-cel-preview"));
  if(!dex)return null;
  const cache=await caches.open(dex);
  return Promise.all(["head_tilt","lie_down","sit_down","sleep_loop","slow_blink","stretch","tail_wag","treat_lick"].map(name=>
    cache.match("./assets/cel-shaded/clips/"+name+".webm").then(Boolean)));
 });
 expect(cached).toEqual([true,true,true,true,true,true,true,true]);
 await context.setOffline(true);
 try{
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Settings"}).click();
  await page.locator("#celModeToggle").check();
  await expect.poll(async()=>await page.locator("#celPoster").isVisible()||await page.locator("#celVideo").isVisible()).toBe(true);
 }finally{await context.setOffline(false);}
});

test("Chromium displays the actual transparent animated frame, not an opaque matte",async({page,browserName})=>{
 test.skip(browserName!=="chromium","WebKit may fall back to local cel stills without VP9 alpha support");
 await page.goto("/");
 await page.getByRole("button",{name:"Settings"}).click();
 await page.locator("#celModeToggle").check();
 const video=page.locator("#celVideo");
 await expect(video).toBeVisible({timeout:10000});
 const inspection=await video.evaluate(v=>{
  const canvas=document.createElement("canvas");canvas.width=24;canvas.height=24;
  const ctx=canvas.getContext("2d");ctx.drawImage(v,0,0,24,24);
  return {src:v.currentSrc,paused:v.paused,frameReady:v.readyState>=2,
    alpha:ctx.getImageData(0,0,1,1).data[3],muted:v.muted};
 });
 expect(inspection.frameReady).toBe(true);
 expect(inspection.alpha).toBeLessThan(24);
 expect(inspection.muted).toBe(true);
 expect(inspection.src).toContain("assets/cel-shaded/clips/");
});

test("Chromium plays lie-down into the approved sleeping loop without switching to pixel art",async({page,browserName})=>{
 test.skip(browserName!=="chromium","Only Chromium has been verified to decode WebM alpha");
 await page.goto("/");
 await page.getByRole("button",{name:"Settings"}).click();
 await page.locator("#celModeToggle").check();
 await page.locator("#doneSettings").click();
 await page.getByRole("button",{name:"Nap"}).click();
 await expect(page.locator("#stateLabel")).toHaveText("ASLEEP");
 const video=page.locator("#celVideo");
 await expect.poll(()=>video.getAttribute("src"),{timeout:6000}).toContain("lie_down.webm");
 await expect.poll(()=>video.getAttribute("src"),{timeout:8000}).toContain("sleep_loop.webm");
 await expect(video).toBeVisible();
 await expect(page.locator("#sprite")).toBeHidden();
 await expect(video).toHaveJSProperty("loop",true);
});

test("all eight owner-approved clips decode and display real alpha in Chromium",async({page,browserName})=>{
 test.skip(browserName!=="chromium","Only Chromium alpha decode has been established");
 await page.goto("/");
 await page.getByRole("button",{name:"Settings"}).click();
 await page.locator("#celModeToggle").check();
 const video=page.locator("#celVideo");
 for(const name of ["lie_down","stretch","slow_blink","head_tilt","tail_wag","treat_lick","sit_down","sleep_loop"]){
  await page.locator("#celClipSelect").selectOption(name);
  await expect(video).toHaveAttribute("src",new RegExp(name+"\\.webm$"));
  await expect(video).toBeVisible({timeout:7000});
  const alpha=await video.evaluate(v=>{
    const c=document.createElement("canvas");c.width=24;c.height=24;
    const ctx=c.getContext("2d");ctx.drawImage(v,0,0,24,24);
    return ctx.getImageData(0,0,1,1).data[3];
  });
  expect(alpha,name).toBeLessThan(24);
 }
});

test("WebKit never exposes an opaque media matte: verified-alpha video or the still fallback",async({page,browserName})=>{
 test.skip(browserName!=="webkit");
 await page.goto("/");
 await page.getByRole("button",{name:"Settings"}).click();
 await page.locator("#celModeToggle").check();
 const video=page.locator("#celVideo"),poster=page.locator("#celPoster");
 await expect.poll(async()=>await video.isVisible()||await poster.isVisible()).toBe(true);
 await page.waitForTimeout(900);
 const active=await video.isVisible();
 if(active){
  const alpha=await video.evaluate(v=>{
   const c=document.createElement("canvas");c.width=24;c.height=24;
   const ctx=c.getContext("2d");ctx.drawImage(v,0,0,24,24);
   return ctx.getImageData(0,0,1,1).data[3];
  });
  expect(alpha).toBeLessThan(24);
 }else{
  await expect(poster).toBeVisible();
  await expect(page.locator("#celStatus")).toContainText(/still|unavailable|unsupported/i);
 }
});
