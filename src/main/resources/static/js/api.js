// Sistem Durumunu API'den Çekme
async function fetchSystemStatus(fillDropdowns = false) {
    try {
        const response = await fetch("/api/status");
        const data = await response.json();

        if (data.status === "success") {
            systemState.cityMap = data.city_map;
            systemState.vehicles = data.vehicles;
            systemState.waitingCustomers = data.waiting_customers;
            systemState.logs = data.logs;

            updateUI(fillDropdowns);
            if (!activeAnimation) {
                drawMap(systemState.lastMatchedRoute || { pickup: [], trip: [] });
            }
        }
    } catch (error) {
        console.error("Sistem durumu alınamadı:", error);
        addLogLine("HATA: Sunucu ile bağlantı kurulamadı.", "error");
    }
}


// Yeni Müşteri Ekleme (Çağrı Talebi)
async function handleAddCustomer(e) {
    e.preventDefault();
    const name = custNameInput.value.trim();
    const current_location = custStartSelect.value;
    const destination = custEndSelect.value;

    if (current_location === destination) {
        alert("Hata: Başlangıç ve Hedef noktaları aynı olamaz!");
        return;
    }

    try {
        const response = await fetch("/api/customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, current_location, destination })
        });

        const data = await response.json();
        if (data.status === "success") {
            custNameInput.value = "";
            custStartSelect.value = "";
            custEndSelect.value = "";
            addLogLine(data.message, "success");
            fetchSystemStatus();
        } else {
            alert("Sistem Hatası: " + data.message);
        }
    } catch (error) {
        console.error("Müşteri eklenirken hata oluştu:", error);
    }
}

// Rastgele Müşteri/Çağrı Talebi Ekleme
async function handleAddRandomCustomer() {
    const nodes = Object.keys(NODE_COORDINATES);
    if (nodes.length < 2) {
        alert("Hata: Haritada yeterli durak bulunmamaktadır!");
        return;
    }

    const startNode = nodes[Math.floor(Math.random() * nodes.length)];
    let endNode = nodes[Math.floor(Math.random() * nodes.length)];
    while (endNode === startNode) {
        endNode = nodes[Math.floor(Math.random() * nodes.length)];
    }

    systemState.randomCallCount = (systemState.randomCallCount || 0) + 1;
    const name = `AE${systemState.randomCallCount}`;

    try {
        const response = await fetch("/api/customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                current_location: startNode,
                destination: endNode
            })
        });

        const data = await response.json();
        if (data.status === "success") {
            addLogLine(`Rastgele talep oluşturuldu: ${name} (${startNode} → ${endNode})`, "success");
            fetchSystemStatus();
        } else {
            alert("Sistem Hatası: " + data.message);
        }
    } catch (error) {
        console.error("Rastgele müşteri eklenirken hata oluştu:", error);
    }
}

// Sıradaki Çağrıyı İşleme (Simülasyon Adımı)
async function handleSimulationStep() {
    if (activeAnimation) return;

    btnStep.setAttribute("disabled", "true");

    try {
        const vehicleSelect = document.getElementById("sim-vehicle-select");
        const selectedVehicle = vehicleSelect ? vehicleSelect.value : "any";

        const response = await fetch("/api/simulation/step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicle_id: selectedVehicle })
        });
        const data = await response.json();

        if (data.status === "success") {
            const step = data.step_data;

            // Sonuç panelini doldur
            resVehicle.textContent = step.vehicle.id;
            resDist.textContent = `${step.total_distance.toFixed(2)} km`;
            resPickupRoute.textContent = step.pickup.route.join(" → ");
            resTripRoute.textContent = step.trip.route.join(" → ");

            const initialCustomers = [step.customer];
            if (step.customer_2) initialCustomers.push(step.customer_2);
            if (step.customer_3) initialCustomers.push(step.customer_3);
            resTimeline.textContent = getSimplifiedTimeline(step.pickup.route, step.trip.route, initialCustomers);

            if (step.type === "shared") {
                resCustomer.textContent = `${step.customer.name} (Ücret: ${(step.customer.fare || 0).toFixed(2)} TL)`;
                resCustomer2.textContent = `${step.customer_2.name} (Ücret: ${(step.customer_2.fare || 0).toFixed(2)} TL)`;
                resSharedRow.classList.remove("hidden");

                if (step.customer_3) {
                    resCustomer3.textContent = `${step.customer_3.name} (Ücret: ${(step.customer_3.fare || 0).toFixed(2)} TL)`;
                    resSharedRow3.classList.remove("hidden");
                    resMatchType.textContent = "3'lü Paylaşımlı Eşleşme 🚗💨✨";
                } else {
                    resSharedRow3.classList.add("hidden");
                    resMatchType.textContent = "2'li Paylaşımlı Eşleşme 🚗💨";
                }

                const chosenAvgDiscount = initialCustomers.length > 0 
                    ? initialCustomers.reduce((acc, c) => acc + (c.discount_percent || 0), 0) / initialCustomers.length 
                    : 0;
                resSavings.textContent = `Toplam Tasarruf: ${step.savings.toFixed(2)} TL | Kişi Başı İndirim: %${chosenAvgDiscount.toFixed(0)}`;
                resSavingsRow.classList.remove("hidden");
            } else {
                resCustomer.textContent = `${step.customer.name} (Ücret: ${(step.customer.fare || 0).toFixed(2)} TL)`;
                resSharedRow.classList.add("hidden");
                resSharedRow3.classList.add("hidden");
                resMatchType.textContent = "Solo Eşleşme";
                resSavingsRow.classList.add("hidden");
            }

            simResultDiv.classList.remove("hidden");

            // Rota çizgilerini kalıcı çizim için kaydet
            systemState.lastMatchedRoute = {
                pickup: step.pickup.route,
                trip: step.trip.route,
                tripAlternatives: step.trip_alternatives,
                type: step.type
            };

            // Rota Seçim Overlay Paneli Göster ve Kullanıcının Karar Vermesini Bekle!
            showRouteSelector(step);

        } else if (data.status === "warning") {
            addLogLine(`UYARI: ${data.message}`, "error");
            fetchSystemStatus();
            btnStep.removeAttribute("disabled");
        } else {
            alert(data.message);
            fetchSystemStatus();
            btnStep.removeAttribute("disabled");
        }
    } catch (error) {
        console.error("Adım işlenirken hata oluştu:", error);
        btnStep.removeAttribute("disabled");
    }
}
