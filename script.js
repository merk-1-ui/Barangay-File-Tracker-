
let records = [];
let db;

// OPEN BROWSER DATABASE
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("BarangayTrackerDB", 1);

        request.onupgradeneeded = function () {
            request.result.createObjectStore("files", {
                keyPath: "id"
            });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// SAVE RECORD
function saveRecord(record) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("files", "readwrite");

        transaction.objectStore("files").put(record);

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

// GET ALL RECORDS
function getRecords() {
    return new Promise((resolve, reject) => {
        const request = db.transaction("files", "readonly")
            .objectStore("files").getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// DELETE RECORD
function deleteRecord(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("files", "readwrite");

        transaction.objectStore("files").delete(id);

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

// LOAD DATA
async function loadRecords() {
    records = await getRecords();
    updateDashboard();
    renderRecords();
}

// DASHBOARD
function updateDashboard() {
    document.getElementById("totalCount").textContent =
        records.length;

    document.getElementById("pendingCount").textContent =
        records.filter(r =>
            r.status === "Pending" || r.status === "In Process"
        ).length;

    document.getElementById("releasedCount").textContent =
        records.filter(r => r.status === "Released").length;

    document.getElementById("categoryCount").textContent =
        new Set(records.map(r => r.category)).size;

    const recent = [...records].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
    ).slice(0, 5);

    document.getElementById("recentTable").innerHTML =
        recent.length ? recent.map(r => `
            <tr>
                <td>${escapeHTML(r.title)}</td>
                <td>${escapeHTML(r.category)}</td>
                <td>${escapeHTML(r.dateReceived)}</td>
                <td>
                    <span class="status status-${statusClass(r.status)}">
                        ${escapeHTML(r.status)}
                    </span>
                </td>
            </tr>
        `).join("") :
        '<tr><td colspan="4">No files yet.</td></tr>';
}

// SAFE HTML OUTPUT
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function statusClass(status) {
    return status.toLowerCase().replaceAll(" ", "-");
}

// DISPLAY RECORDS
function renderRecords() {
    const search = document.getElementById("searchInput")
        .value.toLowerCase();

    const category = document.getElementById("categoryFilter").value;
    const status = document.getElementById("statusFilter").value;

    const filtered = records.filter(r => {
        const text = [
            r.title, r.controlNo, r.owner,
            r.category, r.location, r.notes
        ].join(" ").toLowerCase();

        return text.includes(search) &&
            (!category || r.category === category) &&
            (!status || r.status === status);
    });

    document.getElementById("recordsTable").innerHTML =
        filtered.length ? filtered.map(r => `
            <tr>
                <td>${escapeHTML(r.title)}</td>
                <td>${escapeHTML(r.category)}</td>
                <td>${escapeHTML(r.dateReceived)}</td>
                <td>
                    <span class="status status-${statusClass(r.status)}">
                        ${escapeHTML(r.status)}
                    </span>
                </td>
                <td>
                    <button class="action-btn"
                        onclick="editFile('${r.id}')">Edit</button>

                    <button class="action-btn delete-btn"
                        onclick="removeFile('${r.id}')">Delete</button>
                </td>
            </tr>
        `).join("") :
        '<tr><td colspan="5">No matching records found.</td></tr>';
}

// NAVIGATION
function showPage(page) {
    document.getElementById("dashboard")
        .classList.toggle("hidden", page !== "dashboard");

    document.getElementById("records")
        .classList.toggle("hidden", page !== "records");

    document.getElementById("pageTitle").textContent =
        page === "dashboard" ? "Dashboard" : "All Records";

    document.querySelectorAll(".sidebar nav a")
        .forEach(a => a.classList.remove("active"));

    event.currentTarget?.classList.add("active");
}

// OPEN FORM
function openForm() {
    document.getElementById("fileForm").reset();
    document.getElementById("recordId").value = "";

    document.getElementById("formTitle").textContent =
        "Add New File";

    document.getElementById("dateReceived").value =
        new Date().toISOString().slice(0, 10);

    document.getElementById("fileModal").style.display = "flex";
}

// CLOSE FORM
function closeForm() {
    document.getElementById("fileModal").style.display = "none";
}

// ADD / UPDATE FILE
document.getElementById("fileForm").addEventListener("submit",
async function(e) {
    e.preventDefault();

    const id = document.getElementById("recordId").value;
    const old = records.find(r => r.id === id);
    const file = document.getElementById("attachment").files[0];

    if (file && file.size > 10 * 1024 * 1024) {
        alert("Please select a file smaller than 10 MB.");
        return;
    }

    let fileData = old?.fileData || null;
    let fileName = old?.fileName || "";

    if (file) {
        fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        fileName = file.name;
    }

    const record = {
        id: id || crypto.randomUUID(),

        title: document.getElementById("title").value.trim(),
        controlNo: document.getElementById("controlNo").value.trim(),
        category: document.getElementById("category").value,
        owner: document.getElementById("owner").value.trim(),
        dateReceived: document.getElementById("dateReceived").value,
        status: document.getElementById("status").value,
        location: document.getElementById("location").value.trim(),
        notes: document.getElementById("notes").value.trim(),

        fileData,
        fileName,

        createdAt: old?.createdAt || new Date().toISOString()
    };

    try {
        await saveRecord(record);
        closeForm();
        await loadRecords();
        showPage("records");
    } catch (error) {
        alert("Unable to save record. Browser storage may be full.");
    }
});

// EDIT FILE
function editFile(id) {
    const r = records.find(item => item.id === id);
    if (!r) return;

    document.getElementById("recordId").value = r.id;
    document.getElementById("title").value = r.title;
    document.getElementById("controlNo").value = r.controlNo;
    document.getElementById("category").value = r.category;
    document.getElementById("owner").value = r.owner;
    document.getElementById("dateReceived").value = r.dateReceived;
    document.getElementById("status").value = r.status;
    document.getElementById("location").value = r.location;
    document.getElementById("notes").value = r.notes;

    document.getElementById("formTitle").textContent =
        "Edit File Record";

    document.getElementById("fileModal").style.display = "flex";
}

// DELETE FILE
async function removeFile(id) {
    const r = records.find(item => item.id === id);
    if (!r) return;

    if (confirm("Are you sure you want to delete this file?")) {
        await deleteRecord(id);
        await loadRecords();
    }
}

// START SYSTEM
async function init() {
    try {
        db = await openDatabase();
        await loadRecords();
    } catch (error) {
        alert("Unable to open browser database.");
    }
}

init();
