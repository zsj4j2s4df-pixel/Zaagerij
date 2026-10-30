import { test, expect } from "@playwright/test";
test("all mobile screens fit 320px and piece fields are readable cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(
    page.getByText("Lokaal gebruik · niet ingelogd", { exact: true }),
  ).toBeVisible();
  const table = page.locator(".pieces-table");
  expect(await table.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(
    true,
  );
  for (const name of ["Invoer", "Zaagplan", "Uitvoering", "Projecten"]) {
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Invoer", exact: true })
    .click();
  await page.getByRole("button", { name: "Opslagopties" }).click();
  expect(
    await page
      .locator(".modal")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
});
test("review saves comment and drawing across navigation and exports zip", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/review/");
  await expect(
    page.getByRole("img", { name: "Voorbeeldscherm Materiaal & instellingen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tekenen", exact: true }).click();
  const box = await page.locator(".review-screen canvas").boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 70);
  await page.mouse.up();
  await expect(page.getByText("1 lijnen", { exact: true })).toBeVisible();
  await page
    .locator(".review-nav")
    .getByRole("button", { name: "Opmerking", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Jouw opmerking" })
    .fill("Deze knop graag groter.");
  await page.getByRole("button", { name: "Klaar", exact: true }).click();
  await page
    .locator(".review-nav")
    .getByRole("button", { name: "Volgende", exact: true })
    .click();
  await page
    .locator(".review-nav")
    .getByRole("button", { name: "Vorige", exact: true })
    .click();
  await expect(
    page.getByText("Deze knop graag groter.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Deze knop graag groter.", { exact: true }),
  ).toBeVisible();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download beoordeling (ZIP)" })
    .click();
  expect((await dl).suggestedFilename()).toBe("zaagerij-beoordeling.zip");
});
test("installed icon URLs are versioned and available", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  for (const icon of m.icons) {
    expect(icon.src).toContain("icon-v2-");
    expect((await request.get(icon.src)).status()).toBe(200);
  }
});
