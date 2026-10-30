import { test, expect } from "@playwright/test";
test("shared cuts show actual roll state and finish both adjacent ends", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".advanced-options summary").click();
  await page.getByLabel("Passende schuine sneden combineren").check();
  await page.getByRole("button", { name: "Bekijk zaagplan" }).click();
  await expect(page.getByText(/gedeelde sneden ·/)).toBeVisible();
  await page.getByRole("button", { name: "Start uitvoering" }).click();
  await page.locator(".cut-details summary").click();
  await expect(page.getByText("HUIDIGE SNEDE")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const b = page.getByRole("button", { name: "Snede gereed", exact: true });
    if (!(await b.count())) break;
    await b.click();
  }
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("zaagerij:working")),
  );
  expect(
    state.execution.steps.some((s) => s.shared && s.ends.length === 2),
  ).toBe(true);
  expect(state.cutIds.length).toBeGreaterThan(0);
});
test("progress opens with a swipe and restores exact scroll position", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Bekijk zaagplan" }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo(0, 240));
  const y = await page.evaluate(() => scrollY);
  await page.locator(".app-shell").dispatchEvent("touchstart", {
    changedTouches: [{ identifier: 1, clientX: 280, clientY: 400 }],
  });
  await page.locator(".app-shell").dispatchEvent("touchend", {
    changedTouches: [{ identifier: 1, clientX: 70, clientY: 405 }],
  });
  await expect(
    page.getByRole("region", { name: "Gereedoverzicht" }),
  ).toBeVisible();
  await page.locator(".app-shell").dispatchEvent("touchstart", {
    changedTouches: [{ identifier: 1, clientX: 50, clientY: 400 }],
  });
  await page.locator(".app-shell").dispatchEvent("touchend", {
    changedTouches: [{ identifier: 1, clientX: 270, clientY: 405 }],
  });
  await expect(
    page.getByRole("region", { name: "Gereedoverzicht" }),
  ).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
});
test("quick angles, calculator and bottom append preserve simple input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Bereken linkerhoek 001" }).click();
  await page.getByRole("textbox", { name: "Berekening" }).fill("180-105");
  await page.getByRole("button", { name: "Gebruik 75°" }).click();
  await expect(page.getByLabel("Linkerhoek 001", { exact: true })).toHaveValue(
    "75",
  );
  await page
    .getByRole("button", { name: "Stuk toevoegen", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Stuknummer" }).last(),
  ).toHaveValue("004");
});
