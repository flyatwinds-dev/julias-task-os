import { data, WORKSPACES, isOverdue, localDate } from "./data.js";
import { queryTasks, similarTasks } from "./query.js";
const $ = (s) => document.querySelector(s);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let tasks = [],
  projects = [],
  view = "dashboard",
  workspace = "",
  visibleIds = [],
  focusIds = [],
  timer;
const priorityLabels = { high: "高優先", medium: "中優先", low: "低優先" };
const statusLabels = { open: "Open", doing: "Doing", completed: "Completed" };
const form = $("#task-form");
const field = (name) => form.elements.namedItem(name);
const workspaceName = (id) =>
  WORKSPACES.find((w) => w.id === id)?.name || "未分類";
const projectName = (id) =>
  projects.find((p) => p.project_id === id)?.title || "未分類";
function toast(message) {
  $("#toast").textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => ($("#toast").textContent = ""), 4000);
}
async function run(fn) {
  try {
    await fn();
  } catch (error) {
    toast(error.message || "操作失敗，請再試一次");
  }
}
const options = (items, valueKey, labelKey) =>
  items
    .map(
      (x) =>
        `<option value="${escape(x[valueKey])}">${escape(x[labelKey])}</option>`,
    )
    .join("");
function renderProjectOptions() {
  const selected = $("#project-filter").value;
  $("#project-filter").innerHTML =
    '<option value="">所有專案</option><option value="none">未分類</option>' +
    options(projects, "project_id", "title");
  $("#project-filter").value = selected;
}
async function refresh(requery = true) {
  [tasks, projects] = await Promise.all([
    data.listTasks(),
    data.listProjects(),
  ]);
  renderProjectOptions();
  render(requery);
}
function render(requery = true) {
  for (const status of ["open", "doing", "completed"])
    $(`#stat-${status}`).textContent = tasks.filter(
      (t) => t.status === status,
    ).length;
  $("#stat-overdue").textContent = tasks.filter((t) => isOverdue(t)).length;
  if (requery) {
    visibleIds = queryTasks(tasks, {
      search: $("#search").value,
      status: $("#status-filter").value,
      project: $("#project-filter").value,
      priority: $("#priority-filter").value,
      sort: $("#sort").value,
      workspace,
    }).map((t) => t.task_id);
    focusIds = queryTasks(
      tasks.filter(
        (t) => t.planned_date === localDate() && t.status !== "completed",
      ),
      { sort: "priority" },
    )
      .slice(0, 3)
      .map((t) => t.task_id);
  }
  const visible = visibleIds
    .map((id) => tasks.find((t) => t.task_id === id))
    .filter(Boolean);
  $("#task-count").textContent = `${visible.length} 個任務`;
  $("#task-list").innerHTML = visible.length
    ? visible.map(taskRow).join("")
    : '<div class="empty">目前沒有符合的任務，為今天留下一個小目標吧 ✧</div>';
  const focus = focusIds
    .map((id) => tasks.find((t) => t.task_id === id))
    .filter(Boolean);
  $("#focus-list").innerHTML = focus.length
    ? focus
        .map(
          (t) =>
            `<div class="focus-row ${t.status === "completed" ? "completed" : ""}"><input type="checkbox" data-complete="${t.task_id}" aria-label="完成 ${escape(t.title)}" ${t.status === "completed" ? "checked" : ""}><div><strong>${escape(t.title)}</strong><small>${escape(projectName(t.project_id))} · ${statusLabels[t.status]}</small></div><span class="priority ${t.priority}">${priorityLabels[t.priority]}</span></div>`,
        )
        .join("")
    : '<div class="empty">今天留點空間給自己。<br>新增任務時設定今天為計畫日期，就會出現在這裡。</div>';
  $("#project-list").innerHTML = WORKSPACES.map(
    (w) =>
      `<article class="project-card"><h3>${escape(w.name)}</h3>${
        projects
          .filter((p) => p.workspace_id === w.id)
          .map(
            (p) =>
              `<div class="project-item">${escape(p.title)}<small>${tasks.filter((t) => t.project_id === p.project_id).length} 個任務</small></div>`,
          )
          .join("") || '<p class="muted">還沒有專案，慢慢開始吧。</p>'
      }</article>`,
  ).join("");
}
function taskRow(t) {
  const overdue = isOverdue(t);
  return `<article class="task-row ${t.status === "completed" ? "completed" : ""}" data-task-id="${t.task_id}"><div class="task-title"><input type="checkbox" data-complete="${t.task_id}" aria-label="完成 ${escape(t.title)}" ${t.status === "completed" ? "checked" : ""}><div><button class="title-button" data-edit="${t.task_id}">${escape(t.title)}</button><small>${statusLabels[t.status]}${t.planned_date === localDate() ? " · 今日計畫" : ""}</small></div></div><div class="task-project"><span class="project-name">${escape(projectName(t.project_id))}</span><span class="workspace-name">${escape(workspaceName(t.workspace_id))}</span></div><span class="priority ${t.priority}">${priorityLabels[t.priority]}</span><span class="due ${overdue ? "overdue" : ""}">${t.due_at ? escape(new Date(t.due_at).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })) : "無截止日期"}${overdue ? "<br>已逾期" : ""}</span><div class="row-actions"><button data-edit="${t.task_id}" aria-label="編輯 ${escape(t.title)}">✎</button><button data-delete="${t.task_id}" aria-label="刪除 ${escape(t.title)}">×</button></div></article>`;
}
function setView(next) {
  view = next;
  $("#dashboard").hidden = next !== "dashboard";
  $("#task-section").hidden = next === "projects";
  $("#projects-section").hidden = next !== "projects";
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === next);
    b.setAttribute("aria-current", b.dataset.view === next ? "page" : "false");
  });
  $("#breadcrumb").textContent =
    `My space / ${{ dashboard: "Dashboard", tasks: "Tasks", projects: "Projects" }[next]}`;
  $("#page-title").textContent =
    next === "dashboard"
      ? "早安，Julia ☀"
      : next === "tasks"
        ? "每一件小事，都算數。"
        : "讓想法，有個家。";
  $("#page-subtitle").textContent =
    next === "dashboard"
      ? "慢慢來，你正在成為自己喜歡的樣子。"
      : next === "tasks"
        ? "整理眼前的事，空出心裡的位置。"
        : "在生活的不同角落，種下喜歡的計畫。";
  render();
}
function fillTaskProjects(selected = "") {
  field("project_id").innerHTML =
    '<option value="">暫不分類</option>' +
    options(
      projects.filter((p) => p.workspace_id === field("workspace_id").value),
      "project_id",
      "title",
    );
  field("project_id").value = selected;
}
function duplicateMessage() {
  const matches = similarTasks(
    tasks,
    field("title").value,
    field("task_id").value,
  );
  $("#duplicate-warning").hidden = !matches.length;
  $("#duplicate-warning").textContent = matches.length
    ? `發現相似任務：「${matches[0].title}」。若是不同的小事，仍可按「儲存任務」繼續新增。`
    : "";
}
function openTask(task = null, title = "") {
  form.reset();
  field("task_id").value = task?.task_id || "";
  field("workspace_id").innerHTML =
    '<option value="">暫不分類</option>' + options(WORKSPACES, "id", "name");
  field("workspace_id").value = task?.workspace_id || workspace;
  fillTaskProjects(task?.project_id || "");
  for (const key of [
    "title",
    "description",
    "status",
    "priority",
    "planned_date",
  ])
    if (task) field(key).value = task[key];
  if (!task) field("title").value = title;
  if (task?.due_at) {
    const d = new Date(task.due_at);
    field("due_at").value =
      `${localDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  $("#task-dialog-title").textContent = task ? "編輯任務" : "新增任務";
  duplicateMessage();
  $("#task-dialog").showModal();
  field("title").focus();
}
$("#date-label").textContent = new Date()
  .toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  .toUpperCase();
$("#add-task").addEventListener("click", () => openTask());
$("#quick-form").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    const title = $("#quick-title").value.trim();
    if (!title) return;
    const matches = similarTasks(tasks, title);
    if (matches.length) {
      openTask(null, title);
      return;
    }
    await data.createTask({ title });
    $("#quick-form").reset();
    await refresh();
    toast("小念頭已收好 ✧");
  });
});
field("workspace_id").addEventListener("change", () => fillTaskProjects());
field("title").addEventListener("input", duplicateMessage);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    const input = Object.fromEntries(new FormData(form));
    const taskId = input.task_id;
    delete input.task_id;
    input.due_at = input.due_at ? new Date(input.due_at).toISOString() : null;
    if (taskId) await data.updateTask(taskId, input);
    else await data.createTask(input);
    $("#task-dialog").close();
    $("#quick-title").value = "";
    await refresh();
    toast(taskId ? "任務已更新" : "新任務已加入，慢慢來就好 ✧");
  });
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-complete]"))
    run(async () => {
      await data.completeTask(
        event.target.dataset.complete,
        event.target.checked,
      );
      await refresh(false);
      toast(event.target.checked ? "完成了，給自己一點掌聲 ✧" : "已取消完成");
    });
});
document.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  const close = event.target.closest("[data-close]");
  if (edit) openTask(tasks.find((t) => t.task_id === edit.dataset.edit));
  if (del && confirm("要將這個任務移到已刪除嗎？（Demo 軟刪除）"))
    run(async () => {
      await data.deleteTask(del.dataset.delete);
      await refresh(false);
      toast("任務已軟刪除");
    });
  if (close) $(`#${close.dataset.close}`).close();
});
document.querySelectorAll("[data-view]").forEach((b) =>
  b.addEventListener("click", () => {
    workspace = "";
    $("#tasks-heading").innerHTML = "所有任務 <span>All Tasks</span>";
    setView(b.dataset.view);
  }),
);
document.querySelectorAll("[data-workspace]").forEach((b) =>
  b.addEventListener("click", () => {
    workspace = b.dataset.workspace;
    setView("tasks");
    $("#tasks-heading").textContent = workspaceName(workspace);
  }),
);
for (const id of [
  "search",
  "status-filter",
  "project-filter",
  "priority-filter",
  "sort",
])
  $(`#${id}`).addEventListener(id === "search" ? "input" : "change", () =>
    render(),
  );
$("#add-project").addEventListener("click", () => {
  $("#project-form").reset();
  $("#project-form").elements.workspace_id.innerHTML = options(
    WORKSPACES,
    "id",
    "name",
  );
  $("#project-dialog").showModal();
});
$("#project-form").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    await data.createProject(Object.fromEntries(new FormData(event.target)));
    $("#project-dialog").close();
    await refresh();
    toast("專案已建立");
  });
});
const mobileTheme = $("#theme").cloneNode(true);
mobileTheme.id = "mobile-theme";
mobileTheme.className = "mobile-theme";
mobileTheme.setAttribute("aria-label", "切換主題");
$(".topbar").insertBefore(mobileTheme, $(".demo-badge"));
function theme(value) {
  document.body.dataset.theme = value;
  $("#theme").value = value;
  mobileTheme.value = value;
  try {
    localStorage.setItem("julia-theme", value);
  } catch {
    /* Preference storage is optional. */
  }
}
$("#theme").addEventListener("change", (event) => theme(event.target.value));
mobileTheme.addEventListener("change", (event) => theme(event.target.value));
try {
  theme(localStorage.getItem("julia-theme") === "cozy" ? "cozy" : "pastel");
} catch {
  theme("pastel");
}
await run(() => refresh());
// Refresh time-derived indicators without moving completed rows.
setInterval(() => render(false), 60000);
