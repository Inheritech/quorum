import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function checkAccessibility(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test("wizard validates each step, retains choices, and moves focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Your name", { exact: true }).fill("Taylor");
  await page.getByLabel("Room name", { exact: true }).fill("Planning together");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose your cards." }),
  ).toBeFocused();
  await expect(page.getByLabel("Room name", { exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Custom", exact: true }).check();
  await page
    .getByRole("textbox", { name: "Card values", exact: true })
    .fill("1,1");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Card values", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("textbox", { name: "Card values", exact: true })
    .fill("Small, Medium, Large");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Invite your team." }),
  ).toBeFocused();
  await expect(page.locator(".creation-review")).toContainText(
    "Planning together",
  );
  await page.getByRole("radio", { name: /Passphrase/ }).check();
  await expect(
    page.getByLabel("Automatically delete the room after"),
  ).toBeHidden();
  await page.locator(".retention-settings summary").click();
  await page
    .getByLabel("Automatically delete the room after")
    .selectOption("4");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Card values", exact: true }),
  ).toHaveValue("Small, Medium, Large");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
    "Taylor",
  );
  await expect(page.getByLabel("Room name", { exact: true })).toHaveValue(
    "Planning together",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Passphrase/ })).toBeChecked();
  await expect(page.locator(".retention-settings summary")).toContainText(
    "4 hours",
  );
  await page.getByRole("tab", { name: "Create a room" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Join a room" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Join a room" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Create a room" })).toBeFocused();
});

test("WCAG automated checks cover wizard, join, queue, reveal, and dialogs", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await checkAccessibility(page);
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await checkAccessibility(page);
  await page.getByRole("radio", { name: "Custom", exact: true }).check();
  await checkAccessibility(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator(".retention-settings summary").click();
  await checkAccessibility(page);
  await page.getByRole("tab", { name: "Join a room" }).click();
  await checkAccessibility(page);
  await page.getByRole("button", { name: "Privacy & room security" }).click();
  await page.getByText("Encryption and deletion", { exact: true }).click();
  await checkAccessibility(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Try a practice room" }).click();
  await checkAccessibility(page);
  await page.getByRole("button", { name: "Show queued items" }).click();
  await page.getByRole("switch", { name: "Lock room" }).click();
  await checkAccessibility(page);
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await checkAccessibility(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Vote 5", exact: true }).click();
  await page.getByRole("button", { name: "Reveal cards", exact: true }).click();
  await expect(page.locator(".reveal-countdown")).toBeVisible();
  await checkAccessibility(page);
  await expect(page.locator(".results-panel")).toBeVisible();
  await page.getByRole("button", { name: "People 5" }).click();
  await checkAccessibility(page);
  await page.getByRole("button", { name: "Remove Alex", exact: true }).click();
  await checkAccessibility(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "End room", exact: true }).click();
  await checkAccessibility(page);
});

test("keyboard disclosure and modal focus stay within the active task", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good estimates start/ }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("button", { name: "Try a practice room" }).click();
  await page
    .getByRole("button", { name: "Pause waiting-room animation" })
    .click();
  await expect(page.locator(".waiting-panel")).toHaveCSS(
    "animation-play-state",
    "paused",
  );
  await page
    .getByRole("button", { name: "Resume waiting-room animation" })
    .click();
  const show = page.getByRole("button", { name: "Show queued items" });
  await show.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Hide queued items" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".queue-list")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(".queue-list")).toBeHidden();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByLabel("Item name", { exact: true })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((dialog) => dialog.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Add item", exact: true }),
  ).toBeFocused();
});

test("320px reflow, enlarged text, spacing, and reduced motion remain usable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expectNoOverflow(page);
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "Try a practice room" }).click();
  await page.getByRole("button", { name: "Show queued items" }).click();
  await expectNoOverflow(page);
  await page.screenshot({
    path: `.tmp/reflow-${info.project.name}.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.addStyleTag({
    content:
      "html { font-size: 200% !important; } * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }",
  });
  await expectNoOverflow(page);
  await expect(page.getByRole("switch", { name: "Lock room" })).toBeVisible();
  await page.getByRole("switch", { name: "Lock room" }).click();
  await expect(page.getByRole("switch", { name: "Lock room" })).toBeChecked();
  await page.screenshot({
    path: `.tmp/enlarged-${info.project.name}.png`,
    fullPage: true,
  });
});
