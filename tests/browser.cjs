const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8000");
  await page.waitForSelector(".task-row");
  assert.equal(await page.locator(".task-row").count(), 5);
  await page.screenshot({ path: "/tmp/julia-desktop.png", fullPage: true });
  await page.locator("#quick-title").fill("測試小事");
  await page.locator("#quick-form button").click();
  await page.getByRole("button", { name: "測試小事", exact: true }).waitFor();
  let row = page
    .locator(".task-row")
    .filter({
      has: page.getByRole("button", { name: "測試小事", exact: true }),
    });
  await row.getByRole("button", { name: "編輯 測試小事" }).click();
  await page.locator("#task-form [name=title]").fill("修改的小事");
  await page.locator("#task-form [name=description]").fill("專屬搜尋描述");
  await page.locator("#task-form [name=priority]").selectOption("high");
  await page.locator("#task-form button[type=submit]").click();
  await page.getByRole("button", { name: "修改的小事", exact: true }).waitFor();
  row = page
    .locator(".task-row")
    .filter({
      has: page.getByRole("button", { name: "修改的小事", exact: true }),
    });
  let before = await page
    .locator(".task-row")
    .evaluateAll((rs) => rs.map((r) => r.dataset.taskId));
  await row.locator("[data-complete]").check();
  await page.waitForFunction(
    () =>
      document.querySelector(".task-row.completed .title-button")
        ?.textContent === "修改的小事",
  );
  assert.deepEqual(
    await page
      .locator(".task-row")
      .evaluateAll((rs) => rs.map((r) => r.dataset.taskId)),
    before,
  );
  await row.locator("[data-complete]").uncheck();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".task-row")]
        .find((r) => r.textContent.includes("修改的小事"))
        ?.classList.contains("completed") === false,
  );
  console.log("Task lifecycle passed");
  await page.locator("#search").fill("專屬搜尋");
  assert.equal(await page.locator(".task-row").count(), 1);
  await page.locator("#search").fill("");
  await page.locator("#priority-filter").selectOption("high");
  assert.equal(await page.locator(".task-row").count(), 3);
  await page.locator("#sort").selectOption("due");
  assert.ok(
    (await page.locator(".task-row").first().innerText()).includes("已逾期"),
  );
  await page.locator("#priority-filter").selectOption("");
  await page.locator("#status-filter").selectOption("doing");
  assert.equal(await page.locator(".task-row").count(), 1);
  await page.locator("#status-filter").selectOption("");
  console.log("Queries passed");
  await page.locator("button[data-view=projects]").click();
  await page.locator("#add-project").click();
  await page.locator("#project-form [name=title]").fill("測試專案");
  await page.locator("#project-form [name=workspace_id]").selectOption("side");
  await page.locator("#project-form button.primary").click();
  await page.locator(".project-item").filter({ hasText: "測試專案" }).waitFor();
  await page.locator("#add-task").click();
  await page.locator("#task-form [name=title]").fill("專案任務");
  await page.locator("#task-form [name=workspace_id]").selectOption("side");
  await page
    .locator("#task-form [name=project_id]")
    .selectOption({ label: "測試專案" });
  await page.locator("#task-form button[type=submit]").click();
  await page.waitForSelector("#task-dialog", { state: "hidden" });
  await page.locator("button[data-view=tasks]").click();
  await page.locator("#project-filter").selectOption({ label: "測試專案" });
  assert.equal(await page.locator(".task-row").count(), 1);
  await page.locator("#project-filter").selectOption("");
  await page.locator("#add-task").click();
  await page.locator("#task-form [name=title]").fill("專案任務");
  assert.ok(await page.locator("#duplicate-warning").isVisible());
  await page.locator("#task-form button[type=submit]").click();
  await page.waitForSelector("#task-dialog", { state: "hidden" });
  assert.equal(
    await page.getByRole("button", { name: "專案任務", exact: true }).count(),
    2,
  );
  console.log("Projects and duplicates passed");
  await page.locator("#theme").selectOption("cozy");
  assert.equal(await page.locator("body").getAttribute("data-theme"), "cozy");
  await page.locator("#theme").selectOption("pastel");
  await page.locator("#search").fill("修改的小事");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "刪除 修改的小事", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".task-row").length === 0,
  );
  await page.locator("#search").fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("button[data-view=dashboard]").click();
  assert.ok(await page.getByText("Demo Mode", { exact: false }).isVisible());
  assert.ok(
    await page
      .getByText(
        "Demo 資料僅保留在本頁記憶體，重新整理即重設，尚未連接雲端同步。",
        { exact: true },
      )
      .isVisible(),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.locator("#mobile-theme").selectOption("cozy");
  await page.screenshot({ path: "/tmp/julia-mobile.png", fullPage: true });
  await page.locator("#add-task").click();
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector("#task-dialog").getBoundingClientRect().right <=
        innerWidth,
    ),
    true,
  );
  await page.getByRole("button", { name: "關閉", exact: true }).first().click();
  await page.reload();
  await page.waitForSelector(".task-row");
  assert.equal(await page.locator(".task-row").count(), 5);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile, task CRUD, completion order, projects, search/filters/sorts, duplicates, themes, demo notices and reload reset; zero page errors.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
