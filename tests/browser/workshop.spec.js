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

test("drawing review requires missing quantities and a profile before applying", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/session", (r) =>
    r.fulfill({
      json: {
        user: { email: "test@example.com", role: "office" },
        storage: { ai: true },
      },
    }),
  );
  const sources = Object.fromEntries(
    ["length", "qty", "left", "right"].map((k) => [
      k,
      {
        status: k === "qty" ? "missing" : "stated",
        file: 1,
        page: 1,
        text: k === "qty" ? null : "500",
        bbox: [0.1, 0.1, 0.5, 0.2],
      },
    ]),
  );
  sources.qty.bbox = null;
  await page.route("**/api/recognize", (r) =>
    r.fulfill({
      json: {
        complete: true,
        warnings: [],
        pieces: [
          {
            code: "009",
            length: 500,
            qty: null,
            left: 90,
            right: 45,
            basis: "long",
            profileName: "Koker",
            material: "Aluminium",
            note: "Aantal ontbreekt.",
            sources,
          },
        ],
      },
    }),
  );
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
  await page
    .locator(".attachment")
    .getByRole("button", { name: "Uitlezen" })
    .click();
  await page
    .getByRole("button", { name: "Lees tekening uit", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Gecontroleerde regels toevoegen" }),
  ).toBeDisabled();
  await page.getByLabel("Aantal 009", { exact: true }).fill("2");
  await page
    .getByLabel("Profiel 009", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Ik heb deze regel, het profiel en de maatbasis gecontroleerd.")
    .check();
  await expect(
    page.getByRole("button", { name: "Gecontroleerde regels toevoegen" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Gecontroleerde regels toevoegen" })
    .click();
  const doc = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("zaagerij:working")),
  );
  expect(doc.pieces.find((p) => p.code === "009").qty).toBe(2);
  expect(
    doc.pieces.find((p) => p.code === "009").sourceAttachmentId,
  ).toBeTruthy();
});

test("short-point input displays the converted long stop dimension", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "zaagerij:working",
      JSON.stringify({
        id: "x",
        name: "Kortemaat proef",
        order: "",
        revision: 1,
        priority: "time",
        startAngle: 90,
        useRemnants: false,
        combine: false,
        profiles: [
          {
            id: "p",
            name: "Koker",
            width: 60,
            kerf: 3,
            stocks: [6000],
            allowFlip: true,
          },
        ],
        pieces: [
          {
            id: "a",
            code: "001",
            length: 1000,
            qty: 1,
            left: 45,
            right: 45,
            basis: "short",
            profileId: "p",
          },
        ],
        events: [],
        remnants: [],
        attachments: [],
      }),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Bekijk zaagplan" }).click();
  await page.getByRole("button", { name: "Start uitvoering" }).click();
  await page.locator(".cut-details summary").click();
  await expect(page.locator(".cut-length")).toContainText("1120");
});
