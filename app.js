const taskForm = document.getElementById("task-form");
const taskList = document.getElementById("task-list");
const formError = document.getElementById("form-error");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toast-text");
const toastUndo = document.getElementById("toast-undo");
const netStatus = document.getElementById("net-status");

const STORAGE_KEY = "syncroTasks";
const ADHERENCE = [
    ["very-well", "Very well"],
    ["well", "Well"],
    ["somewhat", "Somewhat"],
    ["poorly", "Poorly"]
];

let tasks = [];
const editing = new Set(); // ids whose saved report is being edited
let undoTimer = null;
let lastSignature = "";

/* ---------- storage ---------- */
function loadTasks() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
        tasks = Array.isArray(parsed) ? parsed : [];
    } catch {
        tasks = [];
    }
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        console.error("Could not save tasks:", error);
    }
}

/* ---------- helpers ---------- */
function esc(value) {
    const el = document.createElement("div");
    el.textContent = value ?? "";
    return el.innerHTML;
}

function makeId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDeadline(value) {
    const date = new Date(value);
    if (isNaN(date)) return value;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

// pending -> open (deadline passed or marked done) -> reported
function getStatus(task) {
    if (task.selfReport.saved) return "reported";
    if (task.done || Date.now() >= new Date(task.deadline).getTime()) return "open";
    return "pending";
}

const BADGES = {
    pending: ["badge", "Pending"],
    open: ["badge badge-open", "Check-in open"],
    reported: ["badge badge-done", "✓ Reported"]
};

/* ---------- rendering ---------- */
function reportMarkup(task, status) {
    const r = task.selfReport;

    if (status === "reported" && !editing.has(task.id)) {
        const label = (ADHERENCE.find(a => a[0] === r.adherence) || [, "Not answered"])[1];
        return `
            <div class="report">
                <dl class="report-summary">
                    <dt>How well you followed it</dt>
                    <dd>${esc(label)}</dd>
                    <dt>How SYNCRO performed</dt>
                    <dd>${esc(r.comment) || "No comment"}</dd>
                </dl>
                <div class="task-actions">
                    <button type="button" class="btn" data-action="edit">Edit check-in</button>
                </div>
            </div>`;
    }

    if (status === "pending") {
        return `
            <p class="muted">Check-in opens at ${esc(formatDeadline(task.deadline))}.</p>
            <div class="task-actions">
                <button type="button" class="btn" data-action="done">I finished early</button>
                <button type="button" class="btn btn-ghost btn-danger" data-action="delete">Delete</button>
            </div>`;
    }

    // open, or editing a saved report
    const radios = ADHERENCE.map(([value, text]) => `
        <label>
            <input type="radio" name="adh-${esc(task.id)}" value="${value}" ${r.adherence === value ? "checked" : ""}>
            <span>${text}</span>
        </label>`).join("");

    return `
        <form class="report stack" data-form="report">
            <fieldset>
                <legend>How well did you follow this task?</legend>
                <div class="seg">${radios}</div>
            </fieldset>
            <div class="field">
                <label for="c-${esc(task.id)}">How did SYNCRO perform?</label>
                <textarea id="c-${esc(task.id)}" name="comment" rows="4">${esc(r.comment)}</textarea>
            </div>
            <p class="error" role="alert" hidden></p>
            <div class="task-actions">
                <button type="submit" class="btn btn-primary">Save check-in</button>
                <button type="button" class="btn btn-ghost btn-danger" data-action="delete">Delete</button>
            </div>
        </form>`;
}

function render() {
    const sorted = [...tasks].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    lastSignature = signature();

    if (!sorted.length) {
        taskList.innerHTML = `
            <li class="empty">
                <p><strong>No tasks yet.</strong></p>
                <p class="muted">Add what you plan to do today. You'll check in on it once it's due.</p>
                <button type="button" class="btn btn-primary" data-action="focus-form">Add your first task</button>
            </li>`;
        return;
    }

    taskList.innerHTML = sorted.map(task => {
        const status = getStatus(task);
        const [badgeClass, badgeText] = BADGES[status];
        return `
            <li class="task" data-id="${esc(task.id)}" data-status="${status}">
                <div class="task-head">
                    <div class="task-meta">
                        <h3>${esc(task.task)}</h3>
                        <p class="muted">Due ${esc(formatDeadline(task.deadline))}</p>
                    </div>
                    <span class="${badgeClass}">${badgeText}</span>
                </div>
                ${reportMarkup(task, status)}
            </li>`;
    }).join("");
}

function signature() {
    return tasks.map(t => t.id + getStatus(t) + (editing.has(t.id) ? "e" : "")).join("|") + tasks.length;
}

/* ---------- toast / undo ---------- */
function showToast(message, onUndo) {
    clearTimeout(undoTimer);
    toastText.textContent = message;
    toast.hidden = false;
    toastUndo.onclick = function () {
        onUndo();
        hideToast();
    };
    undoTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
    clearTimeout(undoTimer);
    toast.hidden = true;
}

/* ---------- events ---------- */
taskForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const taskInput = document.getElementById("task");
    const deadlineInput = document.getElementById("deadline");
    const name = taskInput.value.trim();

    if (!name || !deadlineInput.value) {
        formError.textContent = !name
            ? "Enter what you'll do before adding the task."
            : "Choose a due date and time.";
        formError.hidden = false;
        (!name ? taskInput : deadlineInput).focus();
        return;
    }
    formError.hidden = true;

    tasks.push({
        id: makeId(),
        task: name,
        deadline: deadlineInput.value,
        done: false,
        createdAt: new Date().toISOString(),
        selfReport: { adherence: "", comment: "", saved: false, reportedAt: null, history: [] }
    });

    saveTasks();
    render();
    taskForm.reset();
});

taskList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const card = button.closest("[data-id]");
    const task = card && tasks.find(t => t.id === card.dataset.id);

    switch (button.dataset.action) {
        case "focus-form":
            document.getElementById("task").focus();
            break;
        case "done":
            task.done = true;
            saveTasks();
            render();
            break;
        case "edit":
            editing.add(task.id);
            render();
            break;
        case "delete": {
            const index = tasks.indexOf(task);
            tasks.splice(index, 1);
            editing.delete(task.id);
            saveTasks();
            render();
            showToast(`Deleted "${task.task}".`, function () {
                tasks.splice(index, 0, task);
                saveTasks();
                render();
            });
            break;
        }
    }
});

// keep drafts safe: write as the participant types or selects
taskList.addEventListener("input", function (event) {
    const card = event.target.closest("[data-id]");
    const task = card && tasks.find(t => t.id === card.dataset.id);
    if (!task || !event.target.closest("[data-form='report']")) return;

    if (event.target.name === "comment") task.selfReport.comment = event.target.value;
    else if (event.target.type === "radio") task.selfReport.adherence = event.target.value;
    saveTasks();
});

taskList.addEventListener("submit", function (event) {
    event.preventDefault();
    const card = event.target.closest("[data-id]");
    const task = tasks.find(t => t.id === card.dataset.id);
    const r = task.selfReport;

    if (!r.adherence) {
        const error = event.target.querySelector(".error");
        error.textContent = "Choose how well you followed this task.";
        error.hidden = false;
        event.target.querySelector("input[type='radio']").focus();
        return;
    }

    if (r.saved) r.history.push({ at: r.reportedAt });
    r.saved = true;
    r.reportedAt = new Date().toISOString();
    editing.delete(task.id);
    saveTasks();
    render();
});

/* ---------- lifecycle ---------- */
function updateNetwork() {
    netStatus.hidden = navigator.onLine;
}
window.addEventListener("online", updateNetwork);
window.addEventListener("offline", updateNetwork);

// flip pending -> open without wiping anything the participant is typing
setInterval(function () {
    if (signature() !== lastSignature && !taskList.contains(document.activeElement)) render();
}, 30000);

loadTasks();
updateNetwork();
render();

if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("./service-worker.js")
            .then(function () { console.log("Service worker registered."); })
            .catch(function (error) { console.error("Service worker registration failed:", error); });
    });
}