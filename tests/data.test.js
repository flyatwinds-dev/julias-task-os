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
