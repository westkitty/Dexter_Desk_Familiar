import {test,expect} from "@playwright/test";

test("Dexter responds to direct controls, preserves nap and has no offsite traffic",async({page})=>{
 const outside=[];
 page.on("request",request=>{
  if(new URL(request.url()).origin!=="http://127.0.0.1:4173")outside.push(request.url());
 });
 await page.goto("/");
 await expect(page.locator("#sprite")).toBeVisible();
 await page.getByRole("button",{name:"Huff"}).click();
 await expect(page.locator("#stateLabel")).toHaveText("DISAPPROVING");
 await page.getByRole("button",{name:"Nap"}).click();
 await expect(page.locator("#stateLabel")).toHaveText("ASLEEP");
 await expect(page.locator("#napLabel")).toHaveText("Wake");
 await page.getByRole("button",{name:"Treat"}).click();
 await expect(page.locator("#napLabel")).toHaveText("Nap");
 await expect(page.locator("#stateLabel")).toHaveText("APPEASED");
 expect(outside).toEqual([]);
});

test("typing data remains ephemeral; modifier shortcuts are not counted",async({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:"Desk"}).click();
 const input=page.locator("#typingInput");
 await input.press("Shift");
 await expect(page.locator("#typingRate")).toHaveText("0 keys / 6 seconds");
 await input.pressSequentially("private practice");
 await expect(input).toHaveValue("private practice");
 await expect(page.locator("#typingRate")).not.toHaveText("0 keys / 6 seconds");
 await page.locator("#closeDesk").click();
 await expect(input).toHaveValue("");
 const storage=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
 expect(JSON.stringify(storage)).not.toContain("private practice");
 expect(Object.keys(storage).every(key=>key==="dexter-desk-familiar:prefs:v1")).toBe(true);
});

test("keyboard movement and narrow layouts keep Dexter visible",async({page})=>{
 await page.goto("/");
 const pet=page.locator("#pet");
 await pet.focus();
 await pet.press("ArrowRight");
 await expect(pet).toHaveCSS("left","704px"); // 55% of 1280px viewport
 await pet.press("Home");
 await expect(pet).toHaveCSS("left","640px");
 for(const width of [320,375,768,1440]){
   await page.setViewportSize({width,height:900});
   await expect(page.locator("#sprite")).toBeVisible();
   const result=await page.evaluate(()=>{
     const dock=document.querySelector(".dock").getBoundingClientRect();
     const pet=document.querySelector("#pet").getBoundingClientRect();
     return {overflow:document.documentElement.scrollWidth-window.innerWidth,dockRatio:dock.height/window.innerHeight,
       petVisible:pet.right>0&&pet.left<innerWidth&&pet.bottom>0&&pet.top<innerHeight};
   });
   expect(result.overflow).toBeLessThanOrEqual(1);
   expect(result.petVisible).toBe(true);
   if(width>=768)expect(result.dockRatio).toBeLessThanOrEqual(.2);
 }
});

test("offline reload serves cached app with no network",async({page,context})=>{
 await page.goto("/");
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();
 await expect(page.locator("#stateLabel")).toBeVisible();
 await context.setOffline(true);
 try{
   await page.reload({waitUntil:"domcontentloaded"});
   await expect(page.locator("#sprite")).toBeVisible();
   await expect(page.locator("#stateLabel")).toBeVisible();
 }finally{await context.setOffline(false);}
});

test("Dexter stays onscreen after moving to mobile; time-of-day remains page-local",async({page})=>{
 await page.goto("/");
 const pet=page.locator("#pet");
 await pet.focus();
 for(let i=0;i<9;i++)await pet.press("ArrowRight");
 await page.setViewportSize({width:320,height:670});
 const result=await page.evaluate(()=>{
  const r=document.querySelector("#pet").getBoundingClientRect();
  return {left:r.left,right:r.right,light:document.querySelector("#scene").dataset.light};
 });
 expect(result.left).toBeGreaterThanOrEqual(6);
 expect(result.right).toBeLessThanOrEqual(314);
 expect(["morning","day","evening","night"]).toContain(result.light);
});
