import { expect, test } from "@playwright/test";

test("landing is responsive, decks change, and invite links select join", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good estimates start/ }),
  ).toBeVisible();
  expect(response?.headers()["content-security-policy"]).toContain("'nonce-");
  expect(response?.headers()["content-security-policy"]).not.toMatch(
    /script-src[^;]*unsafe-inline/,
  );
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: /T-shirt sizes/ }).check();
  await expect(page.locator(".mini-deck")).toContainText("XXL");
  await page.getByRole("radio", { name: "Custom", exact: true }).check();
  await page
    .getByRole("textbox", { name: /^Card values/ })
    .fill("Tiny, Small, Big");
  await expect(page.locator(".mini-deck")).toContainText("Tiny");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.tmp/landing-${info.project.name}.png`,
    fullPage: true,
  });
  const secret = "a".repeat(64);
  await page.goto(`/#room=${secret}`);
  await expect(page.getByRole("tab", { name: "Join a room" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Invitation link or passphrase")).toHaveValue(
    secret,
  );
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test("practice supports voting, reveal, queue advancement, observation, and admission", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Try a practice room" }).click();
  await expect(
    page.getByRole("heading", { name: "The next good thing" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("The next good thing · Quorum");
  const queue = page.getByRole("button", { name: "Show queued items" });
  await expect(queue).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".queue-list")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Add item", exact: true }),
  ).toBeVisible();
  const lock = page.getByRole("switch", { name: "Lock room" });
  await expect(lock).not.toBeChecked();
  await lock.focus();
  await page.keyboard.press("Space");
  await expect(lock).toBeChecked();
  await expect(page.locator("#lock-help")).toContainText(
    "New people can’t join",
  );
  await page.keyboard.press("Space");
  await expect(lock).not.toBeChecked();
  await expect(lock).toBeFocused();
  await page.getByRole("button", { name: "Admit Casey" }).click();
  await expect(page.getByRole("heading", { name: "At the door" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Vote 5", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Vote 5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: `.tmp/room-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reveal cards" }).click();
  await expect(page.locator(".reveal-countdown")).toHaveText("3");
  await expect(page.locator(".results-panel")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revealing…", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".seat-card.flipped")).toHaveCount(0);
  await expect(page.locator(".results-panel")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next item", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: `.tmp/reveal-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next item", exact: true }).click();
  await expect(page.locator(".current-item h2")).toHaveText(
    "Add keyboard shortcuts to search",
  );
  await expect(page.locator(".queue-list")).not.toContainText(
    "Make onboarding feel",
  );
  await page.getByRole("button", { name: "Just observing?" }).click();
  await expect(
    page.getByRole("heading", { name: "A seat for listening." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vote 5", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Join the vote" }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByLabel("Item name", { exact: true })
    .fill("Improve the dashboard");
  await page.getByLabel("Link optional").fill("https://example.com/ISSUE-7");
  await page.getByRole("button", { name: "Add to queue" }).click();
  await expect(page.locator(".queue-list")).toContainText(
    "Improve the dashboard",
  );
  await expect(
    page.locator('a[href="https://example.com/ISSUE-7"]'),
  ).toHaveAttribute("rel", "noopener noreferrer");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    cookies: document.cookie,
  }));
  expect(storage).toEqual({ local: 0, session: 0, cookies: "" });
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "End room", exact: true }).click();
  await page.getByRole("button", { name: "End & delete room" }).click();
  await expect(
    page.getByRole("heading", { name: /Good estimates start/ }),
  ).toBeVisible();
  await expect(page).not.toHaveTitle("The next good thing · Quorum");
});

test("people removal confirms intent and door sound can be muted", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a practice room" }).click();
  const sound = page.getByRole("button", { name: "Arrival sound" });
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect(sound).toContainText("Sound off");
  const people = page.getByRole("button", { name: "People 5" });
  await people.click();
  await page.getByRole("button", { name: "Remove Alex", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keep in room" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Keep in room" }).click();
  await expect(page.locator(".people-list li")).toHaveCount(5);
  await page.getByRole("button", { name: "Remove Alex", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove person", exact: true })
    .click();
  await expect(page.locator(".people-list li")).toHaveCount(4);
  await expect(page.getByRole("dialog")).toContainText("Alex was removed.");
  await expect(
    page.getByRole("button", { name: "Done", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Remove Riley", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove person", exact: true })
    .click();
  await expect(page.locator(".people-list li")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "People 3" })).toBeFocused();
  await expect(page.locator(".seat-name")).not.toContainText(["Alex"]);
  await expect(page.locator(".observers")).toHaveCount(0);
});

test("security disclosure and dialogs work with keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Privacy & room security" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "don’t receive the keys needed to read it",
  );
  await page.getByText("Encryption and deletion", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "backups stays encrypted and unreadable without your invitation key",
  );
  await page.getByText("Encryption details", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("132 bits");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Privacy & room security" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Try a practice room" }).click();
  await page.getByRole("button", { name: "Invite people" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "practice room is just for you",
  );
});
