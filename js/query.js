import { isOverdue } from "./data.js";
export function queryTasks(
  tasks,
  {
    search = "",
    status = "",
    project = "",
    priority = "",
    workspace = "",
    sort = "created",
  } = {},
) {
  const rank = { high: 0, medium: 1, low: 2 };
  return tasks
    .filter(
      (t) =>
        !t.deleted_at &&
        (!search ||
          `${t.title} ${t.description}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase())) &&
        (!status ||
          (status === "overdue" ? isOverdue(t) : t.status === status)) &&
        (!project ||
          (project === "none" ? !t.project_id : t.project_id === project)) &&
        (!priority || t.priority === priority) &&
        (!workspace || t.workspace_id === workspace),
    )
    .sort((a, b) =>
      sort === "priority"
        ? rank[a.priority] - rank[b.priority]
        : sort === "due"
          ? (a.due_at ? Date.parse(a.due_at) : Infinity) -
            (b.due_at ? Date.parse(b.due_at) : Infinity)
          : Date.parse(b.created_at) - Date.parse(a.created_at),
    );
}
export function similarTasks(tasks, title, exclude = "") {
  const normalize = (s) =>
    s.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  const target = normalize(title);
  if (!target) return [];
  const pairs = (s) =>
    new Set([...s].slice(1).map((_, i) => s.slice(i, i + 2)));
  return tasks.filter((t) => {
    if (t.task_id === exclude || t.deleted_at) return false;
    const other = normalize(t.title);
    if (other === target) return true;
    if (Math.min(other.length, target.length) < 3) return false;
    if (other.includes(target) || target.includes(other)) return true;
    const a = pairs(other),
      b = pairs(target);
    return (
      (2 * [...a].filter((x) => b.has(x)).length) / (a.size + b.size) >= 0.6
    );
  });
}

// Only matching tasks enter the tree; a filtered-out parent never hides a match.
export function taskAncestors(tasks, task) {
  const byId = new Map(tasks.map((t) => [t.task_id, t]));
  const result = [], seen = new Set([task.task_id]);
  let current = byId.get(task.parent_task_id);
  while (current && !seen.has(current.task_id)) {
    seen.add(current.task_id);
    result.unshift(current);
    current = byId.get(current.parent_task_id);
  }
  return result;
}
export function taskTree(matches, collapsed = new Set()) {
  const ids = new Set(matches.map((t) => t.task_id));
  const children = new Map();
  for (const task of matches) {
    const parent = ids.has(task.parent_task_id) ? task.parent_task_id : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(task);
  }
  const result = [];
  const visit = (parent, depth) => {
    for (const task of children.get(parent) || []) {
      result.push({ task, depth });
      if (!collapsed.has(task.task_id)) visit(task.task_id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}
