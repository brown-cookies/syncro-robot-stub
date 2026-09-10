const taskForm = document.getElementById("task-form");
const taskList = document.getElementById("task-list");


let tasks = [];


function saveTasks() {
    localStorage.setItem("syncroTasks", JSON.stringify(tasks));
}


function loadTasks() {
    const savedTasks = localStorage.getItem("syncroTasks");

    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
}


taskForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const task = document.getElementById("task").value;
    const deadline = document.getElementById("deadline").value;

    const taskId = crypto.randomUUID();

    const newTask = {
        id: taskId,
        task: task,
        deadline: deadline,
        selfReport: {
            adherence: "",
            comment: "",
            saved: false
        }
    };

    tasks.push(newTask);

    saveTasks();

    createTask(newTask);

    taskForm.reset();
});


function createTask(taskData) {

    const taskContainer = document.createElement("div");

    taskContainer.innerHTML = `
        <h3>${taskData.task}</h3>

        <p>Task ID: ${taskData.id}</p>

        <p>Deadline: ${taskData.deadline}</p>

        <button class="delete-task">
            Delete Task
        </button>

        <div class="self-report">

            <h4>Self-Report</h4>

            <label>
                How well did you follow this task?
            </label>

            <br><br>

            <select class="adherence">
                <option value="">Select an answer</option>
                <option value="very-well">Very well</option>
                <option value="well">Well</option>
                <option value="somewhat">Somewhat</option>
                <option value="poorly">Poorly</option>
            </select>

            <br><br>

            <label>
                How did SYNCRO perform for this task?
            </label>

            <br><br>

            <textarea
                class="syncro-comment"
                rows="5"
                placeholder="Write your comments here..."
            ></textarea>

            <br><br>

            <button class="save-report">
                Save Self-Report
            </button>

            <button class="edit-report" style="display: none;">
                Edit Self-Report
            </button>

        </div>
    `;

    taskList.appendChild(taskContainer);


    const adherence = taskContainer.querySelector(".adherence");
    const comment = taskContainer.querySelector(".syncro-comment");
    const saveButton = taskContainer.querySelector(".save-report");
    const editButton = taskContainer.querySelector(".edit-report");
    const deleteButton = taskContainer.querySelector(".delete-task");


    adherence.value = taskData.selfReport.adherence;
    comment.value = taskData.selfReport.comment;

    if (taskData.selfReport.saved) {
    adherence.disabled = true;
    comment.disabled = true;

    saveButton.style.display = "none";
    editButton.style.display = "inline-block";
    }

    saveButton.addEventListener("click", function() {

        taskData.selfReport.adherence = adherence.value;
        taskData.selfReport.comment = comment.value;
        taskData.selfReport.saved = true;
        saveTasks();

        adherence.disabled = true;
        comment.disabled = true;

        saveButton.style.display = "none";
        editButton.style.display = "inline-block";

        console.log("Self-report saved for:", taskData.id);
    });


    editButton.addEventListener("click", function() {

        adherence.disabled = false;
        comment.disabled = false;

        editButton.style.display = "none";
        saveButton.style.display = "inline-block";

        console.log("Editing self-report for:", taskData.id);
    });


    deleteButton.addEventListener("click", function() {

        const confirmed = confirm(
            `Are you sure you want to delete ${taskData.id}?`
        );

        if (confirmed) {

            tasks = tasks.filter(function(task) {
                return task.id !== taskData.id;
            });

            saveTasks();

            taskContainer.remove();

            console.log("Task deleted:", taskData.id);
        }
    });
}


loadTasks();

tasks.forEach(function(task) {
    createTask(task);
});


if ("serviceWorker" in navigator) {
    window.addEventListener("load", function() {
        navigator.serviceWorker.register("./service-worker.js")
            .then(function() {
                console.log("Service worker registered.");
            })
            .catch(function(error) {
                console.error("Service worker registration failed:", error);
            });
    });
}