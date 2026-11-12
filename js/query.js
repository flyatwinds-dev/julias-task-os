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
