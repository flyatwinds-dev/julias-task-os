// Adapter contract: all methods return Promises of detached records.
export const WORKSPACES = [
  { id: "work", name: "Work" },
  { id: "personal", name: "Personal" },
  { id: "side", name: "Side Projects" },
];
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const isOverdue = (task, now = Date.now()) =>
  !task.deleted_at &&
  task.status !== "completed" &&
  !!task.due_at &&
  new Date(task.due_at).getTime() < now;
const copy = (value) => structuredClone(value);
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
export function createDemoAdapter(seed = true) {
  let projects = seed
    ? [
        { project_id: "p1", title: "品牌網站更新", workspace_id: "work" },
        { project_id: "p2", title: "好好生活計畫", workspace_id: "personal" },
        { project_id: "p3", title: "自己的小宇宙", workspace_id: "side" },
      ]
    : [];
  let tasks = [];
  const normalize = (input) => {
    const title = String(input.title || "").trim();
    if (!title || title.length > 180)
      throw new Error("請填寫 1–180 字的任務名稱");
    if (!["open", "doing", "completed"].includes(input.status))
      throw new Error("無效的任務狀態");
    if (!["high", "medium", "low"].includes(input.priority))
      throw new Error("無效的優先級");
    if (
      input.workspace_id &&
      !WORKSPACES.some((w) => w.id === input.workspace_id)
    )
      throw new Error("無效的 Workspace");
    if (
      input.project_id &&
      !projects.some(
        (p) =>
          p.project_id === input.project_id &&
          p.workspace_id === input.workspace_id,
      )
    )
      throw new Error("專案與 Workspace 不一致");
    if (input.due_at && !Number.isFinite(Date.parse(input.due_at)))
      throw new Error("無效的截止時間");
    if (input.planned_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.planned_date))
      throw new Error("無效的計畫日期");
    const parent = input.parent_task_id || null;
    if (parent) {
      const visited = new Set(input.task_id ? [input.task_id] : []);
      let current = parent;
      while (current) {
        if (visited.has(current)) throw new Error("任務不能隸屬自己或其子孫任務");
        visited.add(current);
        const ancestor = tasks.find((t) => t.task_id === current && !t.deleted_at);
        if (!ancestor) throw new Error("找不到上層任務");
        current = ancestor.parent_task_id;
      }
    }
    return { ...input, title, parent_task_id: parent };
  };
  const api = {
    async listTasks() {
      return copy(tasks.filter((t) => !t.deleted_at));
    },
    async createTask(input) {
      const time = now();
      const t = normalize({
        description: "",
        workspace_id: "",
        project_id: "",
        status: "open",
        priority: "medium",
        planned_date: "",
        due_at: null,
        ...input,
      });
      const record = {
        ...t,
        task_id: id(),
        created_at: time,
        updated_at: time,
        completed_at: t.status === "completed" ? time : null,
        deleted_at: null,
      };
      tasks.push(record);
      return copy(record);
    },
    async updateTask(taskId, patch) {
      const index = tasks.findIndex(
        (t) => t.task_id === taskId && !t.deleted_at,
      );
      if (index < 0) throw new Error("找不到任務");
      const previous = tasks[index];
      const allowed = [
        "title",
        "description",
        "workspace_id",
        "project_id",
        "status",
        "priority",
        "planned_date",
        "due_at",
        "parent_task_id",
      ];
      const changes = Object.fromEntries(
        Object.entries(patch).filter(([k]) => allowed.includes(k)),
      );
      const t = normalize({ ...previous, ...changes, updated_at: now() });
      t.completed_at =
        t.status === "completed" ? previous.completed_at || now() : null;
      tasks[index] = t;
      return copy(t);
    },
    async completeTask(taskId, completed = true) {
      return api.updateTask(taskId, {
        status: completed ? "completed" : "open",
      });
    },
    async deleteTask(taskId, { children: policy } = {}) {
      const t = tasks.find((t) => t.task_id === taskId && !t.deleted_at);
      if (!t) throw new Error("找不到任務");
      const children = tasks.filter((child) => !child.deleted_at && child.parent_task_id === taskId);
      if (children.length && policy !== "detach")
        throw new Error("請明確選擇將子任務改為獨立後再刪除上層");
      for (const child of children) {
        child.parent_task_id = null;
        child.updated_at = now();
      }
      t.deleted_at = now();
      t.updated_at = t.deleted_at;
      return copy(t);
    },
    async listProjects() {
      return copy(projects);
    },
    async createProject(input) {
      const title = String(input.title || "").trim();
      if (!title || title.length > 100)
        throw new Error("請填寫 1–100 字的專案名稱");
      if (!WORKSPACES.some((w) => w.id === input.workspace_id))
        throw new Error("請選擇 Workspace");
      const p = { project_id: id(), title, workspace_id: input.workspace_id };
      projects.push(p);
      return copy(p);
    },
  };
  if (seed) {
    const today = localDate();
    const time = now();
    const make = (
      title,
      workspace_id,
      project_id,
      status,
      priority,
      offset,
    ) => ({
      task_id: id(),
      parent_task_id: null,
      title,
      description: "給自己一點空間，慢慢完成就好。",
      workspace_id,
      project_id,
      status,
      priority,
      planned_date: today,
      due_at:
        offset === null
          ? null
          : new Date(Date.now() + offset * 86400000).toISOString(),
      created_at: time,
      updated_at: time,
      completed_at: status === "completed" ? time : null,
      deleted_at: null,
    });
    tasks = [
      make("整理首頁設計靈感", "work", "p1", "doing", "high", 1),
      make("留 30 分鐘，讀一本喜歡的書", "personal", "p2", "open", "low", null),
      make("完成本週專案提案", "work", "p1", "open", "high", -1),
      make("畫下自己的小點子", "side", "p3", "open", "medium", 3),
      make("為自己泡一杯好喝的茶", "personal", "p2", "completed", "low", null),
    ];
  }
  return api;
}
export const data = createDemoAdapter();
