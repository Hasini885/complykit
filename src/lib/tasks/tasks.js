/** The task manager (brought over from the CA Task Manager sheet). */

export const TASKS_KEY = "complykit.tasks.v1";
export const EMPTY_TASKS = Object.freeze({ rows: [] });
/** "Client Pending": waiting on the client (documents, approval, payment). */
export const TASK_STATUSES = ["Pending", "Client Pending", "Finished"];

/** Every column, in order; `req` marks the mandatory ones. */
export const TASK_COLUMNS = [
  { key: "client", label: "Client Name", req: true, width: 260 },
  { key: "work", label: "Work", req: true, width: 340 },
  { key: "assigned", label: "Assigned To", req: true, width: 190 },
  { key: "status", label: "Status", req: true, width: 150 },
  { key: "deadline", label: "Deadline", date: true, width: 175 },
  { key: "mobile", label: "Mobile Number", width: 170 },
  { key: "ref", label: "Reference", width: 200 },
  { key: "fee", label: "Fee", number: true, width: 140 },
  { key: "remark1", label: "Remarks 1", width: 230 },
  { key: "remark2", label: "Remarks 2", width: 230 },
  { key: "created", label: "Date Created", date: true, auto: true, width: 150 },
  { key: "completed", label: "Date Completed", date: true, auto: true, width: 165 },
];

export function newTask(id) {
  return {
    id,
    client: "",
    work: "",
    assigned: "",
    status: "Pending",
    deadline: "",
    mobile: "",
    ref: "",
    fee: "",
    remark1: "",
    remark2: "",
    created: "",
    completed: "",
  };
}

export function isoToday(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** "2026-11-13" → "13-11-2026". */
export function dmy(iso) {
  return iso ? iso.split("-").reverse().join("-") : "";
}

export function isOverdue(task, today) {
  return task.status !== "Finished" && !!task.deadline && task.deadline < today;
}

/**
 * The task with one field changed. The creation date is stamped the first
 * time work is entered; the completion date when it is marked Finished (and
 * cleared when it goes back to Pending).
 */
export function withField(task, field, value, today) {
  const next = { ...task, [field]: value };
  if (field === "work" && String(value).trim() && !task.created) next.created = today;
  if (field === "status") next.completed = value === "Finished" ? today : "";
  return next;
}

/**
 * The rows with the one whose id is `fromId` moved to where `toId` is: just
 * before it when moving up, just after it when moving down (so the dragged
 * row lands on the row it was dropped on, as in Excel). Unknown ids, or a row
 * dropped on itself, leave the order as it was.
 */
export function moveRow(rows, fromId, toId) {
  const from = rows.findIndex((r) => r.id === fromId);
  const to = rows.findIndex((r) => r.id === toId);
  if (from < 0 || to < 0 || from === to) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function feeValue(fee) {
  const n = parseFloat(String(fee ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function taskSummary(rows, today) {
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === "Pending").length,
    clientPending: rows.filter((r) => r.status === "Client Pending").length,
    finished: rows.filter((r) => r.status === "Finished").length,
    overdue: rows.filter((r) => isOverdue(r, today)).length,
  };
}

/** The text a cell shows, used by the filters, sorting and the download. */
export function cellValue(task, key) {
  const col = TASK_COLUMNS.find((c) => c.key === key);
  return col?.date ? dmy(task[key]) : String(task[key] ?? "").trim();
}

/** Deadlines by day: { "2026-11-20": { pending, finished } }. */
export function deadlinesByDay(rows) {
  const out = {};
  for (const r of rows) {
    if (!r.deadline) continue;
    const o = (out[r.deadline] ??= { pending: 0, finished: 0 });
    if (r.status === "Finished") o.finished++;
    else o.pending++;
  }
  return out;
}
