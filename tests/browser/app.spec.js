import { test, expect } from "@playwright/test";
test("desktop saves a copy and validates a plan", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Van tekening naar zaaglijst." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.getByText("Opgeslagen op dit apparaat", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Opslagopties" }).click();
  page.once("dialog", (d) => d.accept("Kopie proef"));
  await page.getByRole("button", { name: "Opslaan als…" }).click();
  await expect(page.getByText("Kopie proef", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bekijk zaagplan" }).click();
  await expect(
    page.getByText("Aantallen en materiaalbalans onafhankelijk gecontroleerd."),
  ).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "docs/zaagerij-desktop.png", fullPage: true });
});
test("mobile execution persists individual cuts and confirms removal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Bekijk zaagplan" }).click();
  await page.getByRole("button", { name: "Start uitvoering" }).click();
  await page.locator(".cut-details summary").click();
  await expect(page.getByText("HUIDIGE SNEDE")).toBeVisible();
  await page.getByRole("button", { name: "Snede gereed" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Van tekening naar zaaglijst." }),
  ).toBeVisible();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Uitvoering" })
    .click();
  await page.screenshot({ path: "docs/zaagerij-telefoon.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Invoer", exact: true })
    .click();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Verwijder stuk 001", exact: true })
    .click();
  await expect(page.getByLabel("Aantal 001", { exact: true })).toBeVisible();
});
test("attachment is visibly present after choosing an image", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles({
      name: "tekening.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOuEAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(page.getByRole("img", { name: "tekening.png" })).toBeVisible();
  await expect(page.getByText(/Toegevoegd ·/)).toBeVisible();
});
