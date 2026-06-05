// DOM Elementleri
const canvas = document.getElementById("map-canvas");
const ctx = canvas.getContext("2d");
const mapOverlay = document.getElementById("map-overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayDesc = document.getElementById("overlay-desc");

const custNameInput = document.getElementById("cust-name");
const custStartSelect = document.getElementById("cust-start");
const custEndSelect = document.getElementById("cust-end");
const customerForm = document.getElementById("customer-form");

const btnStep = document.getElementById("btn-step");
const btnReset = document.getElementById("btn-reset");
const btnClearLogs = document.getElementById("btn-clear-logs");
const btnThemeToggle = document.getElementById("btn-theme-toggle");

const queueBadge = document.getElementById("queue-badge");
const queueList = document.getElementById("queue-list");
const vehiclesTableBody = document.getElementById("vehicles-table-body");
const systemLogsContainer = document.getElementById("system-logs");

const simResultDiv = document.getElementById("simulation-result");
const resCustomer = document.getElementById("res-customer");
const resCustomer2 = document.getElementById("res-customer-2");
const resSharedRow = document.getElementById("res-shared-row");
const resCustomer3 = document.getElementById("res-customer-3");
const resSharedRow3 = document.getElementById("res-shared-row-3");
const resVehicle = document.getElementById("res-vehicle");
const resDist = document.getElementById("res-dist");
const resSavingsRow = document.getElementById("res-savings-row");
const resSavings = document.getElementById("res-savings");
const resMatchType = document.getElementById("res-match-type");
const resPickupRoute = document.getElementById("res-pickup-route");
const resTripRoute = document.getElementById("res-trip-route");
const resTimeline = document.getElementById("res-timeline");


// UI Elemanlarını Güncelleme
function updateUI(fillDropdowns = false) {
    // Kuyruk sayacı rozeti ve buton durumu
    queueBadge.textContent = `Kuyruk: ${systemState.waiting_count || systemState.waitingCustomers.length}`;
    if (systemState.waitingCustomers.length > 0 && !activeAnimation) {
        btnStep.removeAttribute("disabled");
    } else {
        btnStep.setAttribute("disabled", "true");
    }

    const vehicleSelect = document.getElementById("sim-vehicle-select");
    if (vehicleSelect) {
        const currentSelected = vehicleSelect.value;

        vehicleSelect.innerHTML = '<option value="any">Herhangi Bir Taksi (En Yakın/Verimli)</option>';

        if (systemState.vehicles && systemState.vehicles.length > 0) {
            const sortedVehicles = [...systemState.vehicles].sort((a, b) => a.id.localeCompare(b.id));
            sortedVehicles.forEach(vehicle => {
                const opt = document.createElement("option");
                opt.value = vehicle.id;
                const statusSuffix = vehicle.is_available ? "" : " [Meşgul]";
                opt.textContent = `${vehicle.id} (${vehicle.current_location})${statusSuffix}`;
                if (!vehicle.is_available) {
                    opt.style.opacity = "0.5";
                }
                vehicleSelect.appendChild(opt);
            });

            if ([...vehicleSelect.options].some(o => o.value === currentSelected)) {
                vehicleSelect.value = currentSelected;
            }
        }
    }

    // Dropdown listelerini doldur (Sadece ilk yüklemede veya sıfırlamada)
    if (fillDropdowns) {
        const sortedNodes = Object.keys(NODE_COORDINATES).sort();

        custStartSelect.innerHTML = '<option value="">Seçiniz...</option>';
        custEndSelect.innerHTML = '<option value="">Seçiniz...</option>';

        sortedNodes.forEach(node => {
            const opt1 = document.createElement("option");
            opt1.value = node;
            opt1.textContent = node;
            custStartSelect.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = node;
            opt2.textContent = node;
            custEndSelect.appendChild(opt2);
        });
    }

    // Kuyruk Listesini Güncelle
    queueList.innerHTML = "";
    if (systemState.waitingCustomers.length === 0) {
        queueList.innerHTML = '<li class="empty-state">Kuyrukta bekleyen çağrı bulunmamaktadır.</li>';
    } else {
        systemState.waitingCustomers.forEach((cust, idx) => {
            const li = document.createElement("li");
            li.className = "queue-item";
            li.innerHTML = `
                <div class="queue-item-info">
                    <h4>${cust.name}</h4>
                    <p>Konum: <span>${cust.current_location}</span> → Hedef: <span>${cust.destination}</span></p>
                </div>
                <span class="queue-badge">${idx + 1}. Sırada</span>
            `;
            queueList.appendChild(li);
        });
    }

    // Araçlar Tablosunu Güncelle
    vehiclesTableBody.innerHTML = "";
    systemState.vehicles.forEach(vehicle => {
        const tr = document.createElement("tr");
        const statusClass = vehicle.is_available ? "available" : "busy";
        const statusText = vehicle.is_available ? "Müsait" : "Meşgul";

        tr.innerHTML = `
            <td><strong>${vehicle.id}</strong></td>
            <td><i class="fa-solid fa-location-dot" style="color: var(--accent); margin-right: 5px;"></i> ${vehicle.current_location}</td>
            <td><span class="status-pill ${statusClass}">${statusText}</span></td>
        `;
        vehiclesTableBody.appendChild(tr);
    });

    // Konsol Loglarını Güncelle
    systemLogsContainer.innerHTML = "";
    systemState.logs.forEach(log => {
        addLogLine(log);
    });
}

// Konsola Tek Satır Log Ekleme
function addLogLine(text, type = "") {
    const div = document.createElement("div");
    div.className = `log-line ${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    systemLogsContainer.appendChild(div);
    systemLogsContainer.scrollTop = systemLogsContainer.scrollHeight;
}

// Arabadaki aktif yolcular pill bileşenini güncelleyen yardımcı fonksiyonlar
function updatePassengersPill(passengersSet) {
    const pill = document.getElementById("active-passengers-pill");
    const list = document.getElementById("active-passengers-list");
    if (!pill || !list) return;

    if (!passengersSet || passengersSet.size === 0) {
        list.textContent = "Boş";
    } else {
        list.textContent = Array.from(passengersSet).join(", ");
    }
}
