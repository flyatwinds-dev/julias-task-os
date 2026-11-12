import test from "node:test";
import assert from "node:assert/strict";
import { createDemoAdapter, isOverdue } from "../js/data.js";
import { queryTasks, similarTasks } from "../js/query.js";
test("task lifecycle, detached records, completion timestamps and soft deletion", async () => {
  const api = createDemoAdapter(false);
  const t = await api.createTask({ title: "任務" });
  assert.equal(t.status, "open");
  for (const k of [
    "task_id",
    "title",
    "description",
    "workspace_id",
    "project_id",
    "status",
    "priority",
    "planned_date",
    "due_at",
    "created_at",
    "updated_at",
    "completed_at",
    "deleted_at",
  ])
    assert.ok(k in t);
  t.title = "changed";
  assert.equal((await api.listTasks())[0].title, "任務");
  await api.updateTask(t.task_id, { title: "新名稱", status: "doing" });
  assert.equal((await api.listTasks())[0].title, "新名稱");
  const done = await api.completeTask(t.task_id);
  assert.ok(done.completed_at);
  assert.equal(done.status, "completed");
  const undone = await api.completeTask(t.task_id, false);
  assert.equal(undone.completed_at, null);
  const removed = await api.deleteTask(t.task_id);
  assert.ok(removed.deleted_at);
  assert.equal((await api.listTasks()).length, 0);
  await assert.rejects(api.updateTask(t.task_id, { title: "no" }));
});
test("projects classify tasks and reject workspace mismatch", async () => {
  const api = createDemoAdapter(false);
  const p = await api.createProject({ title: "計畫", workspace_id: "work" });
  assert.equal((await api.listProjects()).length, 1);
  const t = await api.createTask({
    title: "分類",
    workspace_id: "work",
    project_id: p.project_id,
  });
  assert.equal(t.project_id, p.project_id);
  await assert.rejects(
    api.createTask({
      title: "錯誤",
      workspace_id: "personal",
      project_id: p.project_id,
    }),
  );
  await assert.rejects(api.createTask({ title: " " }));
  await assert.rejects(api.createProject({ title: "計畫", workspace_id: "" }));
});
test("overdue is derived from deadline and completion, never independent status", async () => {
  const api = createDemoAdapter(false);
  const t = await api.createTask({
    title: "過期",
    due_at: "2020-01-01T12:00:00Z",
  });
  assert.ok(isOverdue(t));
  assert.equal(isOverdue(await api.completeTask(t.task_id)), false);
  assert.equal(isOverdue({ ...t, deleted_at: "now" }), false);
  assert.equal(isOverdue({ ...t, due_at: null }), false);
  await assert.rejects(api.createTask({ title: "錯誤", status: "overdue" }));
});
test("search, combined filters, all sort modes and duplicate detection", () => {
  const tasks = [
    {
      task_id: "1",
      title: "首頁 設計",
      description: "粉色",
      status: "doing",
      project_id: "p",
      workspace_id: "work",
      priority: "high",
      created_at: "2026-01-01",
      due_at: "2026-01-03",
    },
    {
      task_id: "2",
      title: "讀書",
      description: "",
      status: "open",
      project_id: "",
      workspace_id: "personal",
      priority: "low",
      created_at: "2026-01-02",
      due_at: null,
    },
  ];
  assert.equal(
    queryTasks(tasks, {
      search: "粉色",
      status: "doing",
      project: "p",
      priority: "high",
      workspace: "work",
    }).length,
    1,
  );
  assert.equal(queryTasks(tasks, { project: "none" })[0].task_id, "2");
  assert.equal(queryTasks(tasks, { sort: "created" })[0].task_id, "2");
  assert.equal(queryTasks(tasks, { sort: "due" })[0].task_id, "1");
  assert.equal(queryTasks(tasks, { sort: "priority" })[0].task_id, "1");
  assert.equal(queryTasks(tasks, { status: "completed" }).length, 0);
  assert.equal(similarTasks(tasks, "首頁設計").length, 1);
  assert.equal(similarTasks(tasks, "首頁設計稿").length, 1);
  assert.equal(similarTasks(tasks, "首頁設計", "1").length, 0);
});

test("hierarchy validates parents and cycles, preserves independent task fields and deletion", async () => {
  const api = createDemoAdapter(false);
  const a = await api.createTask({ title: "上層" });
  const b = await api.createTask({ title: "子任務", parent_task_id: a.task_id, priority: "high", planned_date: "2026-11-12" });
  const c = await api.createTask({ title: "孫任務", parent_task_id: b.task_id });
  assert.equal(a.parent_task_id, null);
  await assert.rejects(api.createTask({ title: "無效", parent_task_id: "missing" }));
  await assert.rejects(api.updateTask(a.task_id, { parent_task_id: a.task_id }));
  await assert.rejects(api.updateTask(a.task_id, { parent_task_id: c.task_id }));
  await api.completeTask(a.task_id);
  assert.deepEqual((await api.listTasks()).find((t) => t.task_id === b.task_id), b);
  await assert.rejects(api.deleteTask(a.task_id));
  assert.equal((await api.listTasks()).length, 3);
  await api.deleteTask(a.task_id, { children: "detach" });
  const remaining = await api.listTasks();
  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].parent_task_id, null);
  assert.equal(remaining[0].priority, "high");
  assert.equal(remaining[0].planned_date, "2026-11-12");
  assert.equal(remaining[1].parent_task_id, b.task_id);
  await assert.rejects(api.updateTask(b.task_id, { parent_task_id: a.task_id }));
  const other = await api.createTask({ title: "另一上層" });
  assert.equal((await api.updateTask(b.task_id, { parent_task_id: other.task_id })).parent_task_id, other.task_id);
  assert.equal((await api.updateTask(b.task_id, { parent_task_id: null })).parent_task_id, null);
});

test("hierarchy keeps query order among siblings, paths and matches with filtered parents", async () => {
  const { taskAncestors, taskTree } = await import("../js/query.js");
  const tasks = [
    { task_id: "a", title: "A", parent_task_id: null, priority: "low" },
    { task_id: "b", title: "B", parent_task_id: "a", priority: "medium" },
    { task_id: "c", title: "C", parent_task_id: "b", priority: "high" },
    { task_id: "d", title: "D", parent_task_id: "a", priority: "high" },
  ];
  assert.deepEqual(taskAncestors(tasks, tasks[2]).map((t) => t.task_id), ["a", "b"]);
  assert.deepEqual(taskTree(queryTasks(tasks, { sort: "priority" })).map(({ task }) => task.task_id), ["a", "d", "b", "c"]);
  assert.deepEqual(taskTree(tasks, new Set(["b"])).map(({ task }) => task.task_id), ["a", "b", "d"]);
  assert.equal(taskTree(queryTasks(tasks, { search: "C" }), new Set(["a", "b"]))[0].task.task_id, "c");
});
