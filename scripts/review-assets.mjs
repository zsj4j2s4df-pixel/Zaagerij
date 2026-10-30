import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});
await page.route("**/api/session", (r) =>
  r.fulfill({ json: { error: "Niet ingelogd" }, status: 401 }),
);
await page.goto("http://localhost:5173/");
await page.evaluate(() => document.fonts.ready);
for (const size of [180, 192, 512]) {
  const data = await page.evaluate(async (size) => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = "/brand/zaagerij-icon.svg";
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d").drawImage(image, 0, 0, size, size);
    return canvas.toDataURL("image/png").split(",")[1];
  }, size);
  await writeFile(`public/icon-v2-${size}.png`, Buffer.from(data, "base64"));
}
await page.locator(".advanced-options summary").click();
await page.getByLabel("Passende schuine sneden combineren").check();
await page.locator(".advanced-options summary").click();
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/review-screens-r3/${name}.png` });
}
await page.evaluate(() => scrollTo(0, 0));
await capture("invoer");
await page
  .getByRole("heading", { name: "Te zagen stukken", exact: false })
  .evaluate((e) => e.scrollIntoView({ block: "start" }));
await capture("stukken");
await page
  .getByRole("heading", { name: "Begin bij je tekening." })
  .evaluate((e) => e.scrollIntoView({ block: "start" }));
await capture("bijlagen");
await page.getByRole("button", { name: "Bekijk zaagplan" }).click();
await page.evaluate(() => scrollTo(0, 0));
await capture("zaagplan");
await page.getByRole("button", { name: "Start uitvoering" }).click();
await page.evaluate(() => scrollTo(0, 0));
await capture("uitvoering");
await page.locator(".cut-details summary").click();
await page.getByRole("button", { name: "Afwijken", exact: true }).click();
await capture("afwijken");
await page.getByRole("button", { name: "Sluiten", exact: true }).click();
await page.getByRole("button", { name: "Opslagopties" }).click();
await capture("opslaan");
await page.getByRole("button", { name: "Sluiten", exact: true }).click();
await page.getByRole("button", { name: "Account", exact: true }).click();
await capture("inloggen");
await browser.close();
console.log("Icons and eight review screens rendered.");
