// Başlangıç Kurulumu
// Haritayı merkeze yerleştiren fonksiyon
function resetPanOffset() {
    const refWidth = 1150;
    const refHeight = 650;
    const scaleX = (canvas.width * 0.95) / refWidth;
    const scaleY = (canvas.height * 0.95) / refHeight;
    const baseScale = Math.min(scaleX, scaleY);

    const mapWidth = refWidth * baseScale * zoomScale;
    const mapHeight = refHeight * baseScale * zoomScale;

    panOffset.x = (canvas.width - mapWidth) / 2;
    panOffset.y = (canvas.height - mapHeight) / 2;
}

// --- YOL BULMA VE MESAFE HESAPLAMA FONKSİYONLARI ---
function findShortestPathJS(start, end) {
    if (!systemState.cityMap || !systemState.cityMap[start] || !systemState.cityMap[end]) {
        return [];
    }
    const vertices = Object.keys(systemState.cityMap);
    let distances = {};
    let previous = {};
    let queue = [];

    vertices.forEach(v => {
        distances[v] = Infinity;
        previous[v] = null;
        queue.push(v);
    });
    distances[start] = 0;

    while (queue.length > 0) {
        queue.sort((a, b) => distances[a] - distances[b]);
        let u = queue.shift();

        if (u === end) break;
        if (distances[u] === Infinity) break;

        const adjacencies = systemState.cityMap[u].adjacencies || [];
        adjacencies.forEach(edge => {
            const v = edge.target;
            const alt = distances[u] + edge.weight;
            if (alt < distances[v]) {
                distances[v] = alt;
                previous[v] = u;
            }
        });
    }

    let path = [];
    let curr = end;
    while (curr !== null) {
        path.push(curr);
        curr = previous[curr];
    }
    path.reverse();
    return path[0] === start ? path : [];
}

function calculatePathDistance(path) {
    if (!path || path.length < 2) return 0;
    let distance = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        if (systemState.cityMap[u]) {
            const edge = systemState.cityMap[u].adjacencies.find(e => e.target === v);
            if (edge) {
                distance += edge.weight;
            }
        }
    }
    return distance;
}

function combineRoutes(pickup, trip) {
    if (!pickup || pickup.length === 0) return trip || [];
    if (!trip || trip.length === 0) return pickup || [];
    if (pickup[pickup.length - 1] === trip[0]) {
        return pickup.concat(trip.slice(1));
    }
    return pickup.concat(trip);
}

function getSimplifiedTimeline(pickupRoute, tripRoute, customers) {
    if (!customers || customers.length === 0) return "-";

    const fullPath = combineRoutes(pickupRoute, tripRoute);

    let timelineEvents = [];
    let inCar = new Set();
    let pickedUp = new Set();

    fullPath.forEach(node => {
        // 1. Dropoffs first
        let dropoffsHere = [];
        customers.forEach(c => {
            if (inCar.has(c.id) && c.destination === node) {
                dropoffsHere.push(c);
                inCar.delete(c.id);
            }
        });
        if (dropoffsHere.length > 0) {
            timelineEvents.push({
                type: 'dropoff',
                node: node,
                customers: dropoffsHere
            });
        }

        // 2. Pickups second
        let pickupsHere = [];
        customers.forEach(c => {
            if (!pickedUp.has(c.id) && c.current_location === node) {
                pickupsHere.push(c);
                pickedUp.add(c.id);
                inCar.add(c.id);
            }
        });
        if (pickupsHere.length > 0) {
            timelineEvents.push({
                type: 'pickup',
                node: node,
                customers: pickupsHere
            });
        }
    });

    let pickups = [];
    let dropoffs = [];

    timelineEvents.forEach(evt => {
        const namesStr = evt.customers.map(c => c.name).join(", ");
        if (evt.type === 'pickup') {
            pickups.push(`${evt.node} (${namesStr})`);
        } else {
            dropoffs.push(`${evt.node} (${namesStr})`);
        }
    });

    if (pickups.length === 0 && dropoffs.length === 0) {
        return "-";
    }

    return `Alış: ${pickups.join(" + ")} ➔ İniş: ${dropoffs.join(" ➔ ")}`;
}

// İnteraktif Rota Seçim Overlay'i ve Olay Yönetimi

function showRouteSelector(step) {
    pendingStep = step;

    const overlay = document.getElementById("route-selector-overlay");
    const optionsList = document.getElementById("route-options-list");

    // Listeyi temizle
    optionsList.innerHTML = "";

    // Fare liste dışına çıktığında ilk seçeneğin önizlemesine dön
    optionsList.onmouseleave = () => {
        const firstBtn = optionsList.children[0];
        if (firstBtn) firstBtn.dispatchEvent(new Event("mouseenter"));
    };

    const alternatives = step.trip_alternatives;

    if (!alternatives || alternatives.length === 0) {
        // Alternatif bulunamadıysa doğrudan varsayılan animasyonla başla
        startRouteAnimation(step);
        return;
    }

    const isLight = document.body.classList.contains("light-theme");

    // Seçim panelini görünür yap
    overlay.classList.remove("hidden");

    // Seçenekler listesini oluştur
    let selectorOptions = [];
    alternatives.forEach(alt => {
        selectorOptions.push({
            isShared: alt.type === "shared",
            badgeClass: alt.badge_class,
            badgeText: alt.badge_text,
            tripDistance: alt.trip.distance,
            pickupDistance: alt.pickup.distance,
            totalDistance: alt.total_distance,
            tripRoute: alt.trip.route,
            pickupRoute: alt.pickup.route,
            combinedRoute: combineRoutes(alt.pickup.route, alt.trip.route),
            passengerCount: alt.passenger_count,
            customers: alt.customers,
            savings: alt.savings,
            score: alt.score
        });
    });

    // Varsayılan olarak 0. rota önizlemede seçili gelsin
    let activeIdx = 0;

    // Haritayı güncelleyen önizleme yardımcısı
    const updatePreview = (idx) => {
        const opt = selectorOptions[idx];

        // Collect all alternative paths to draw in orange
        let allAlts = [];
        selectorOptions.forEach(o => {
            allAlts.push(o.pickupRoute);
            allAlts.push(o.tripRoute);
        });

        drawMap({
            pickup: opt.pickupRoute,
            trip: opt.tripRoute,
            tripAlternatives: allAlts
        });
    };

    // Başlangıç önizlemesi çizdir
    updatePreview(activeIdx);

    // Her bir alternatif rota seçeneği için buton oluştur
    selectorOptions.forEach((opt, idx) => {
        const btn = document.createElement("div");
        btn.className = "route-option-btn";

        if (idx === activeIdx) {
            btn.style.borderColor = "var(--accent)";
            btn.style.background = isLight ? "rgba(94, 92, 230, 0.05)" : "rgba(139, 92, 246, 0.08)";
        }

        const timeline = getSimplifiedTimeline(opt.pickupRoute, opt.tripRoute, opt.customers);
        const faresList = opt.customers.map(c => `${c.name}: ${(c.fare || 0).toFixed(2)} TL`).join(", ");

        btn.innerHTML = `
            <div class="route-option-header" style="align-items: flex-start;">
                <span class="route-option-badge ${opt.badgeClass}">${opt.badgeText}</span>
                <span class="route-option-dist" style="display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 2px;">
                    <strong style="font-size: 0.95rem; color: var(--text-primary); font-weight: 700;">${opt.totalDistance.toFixed(2)} km</strong>
                    <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 500;">(Alış: ${opt.pickupDistance.toFixed(2)} km + Seyahat: ${opt.tripDistance.toFixed(2)} km)</span>
                </span>
            </div>
            <div class="route-option-timeline" style="margin-top: 6px; font-size: 0.9rem; font-weight: 600; color: var(--accent-light); display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-route" style="color: var(--accent); font-size: 0.85rem;"></i> ${timeline}
            </div>
            <div class="route-option-stops" style="margin-top: 4px; font-size: 0.75rem; color: var(--text-muted); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <strong>Detay:</strong> ${opt.combinedRoute.join(" ➔ ")}
            </div>
            <div class="route-option-passengers" style="font-size: 0.75rem; color: var(--accent-light); margin-top: 5px; display: flex; align-items: center; gap: 6px; font-weight: 500;">
                <i class="fa-solid fa-users"></i> Hizmet Verilecek: <strong>${opt.passengerCount} Yolcu</strong> <span style="color: var(--text-muted);">(${faresList})</span>
            </div>
        `;

        // Fare üzerine geldiğinde o rotayı haritada kalın yeşil çizgiyle önizle, diğer alternatifleri turuncu çiz
        btn.addEventListener("mouseenter", () => {
            document.querySelectorAll(".route-option-btn").forEach((b) => {
                b.style.borderColor = "rgba(255, 255, 255, 0.06)";
                b.style.background = "rgba(255, 255, 255, 0.02)";
                if (isLight) {
                    b.style.borderColor = "rgba(0, 0, 0, 0.06)";
                    b.style.background = "rgba(0, 0, 0, 0.01)";
                }
            });
            btn.style.borderColor = "var(--accent-light)";
            btn.style.background = isLight ? "rgba(94, 92, 230, 0.08)" : "rgba(139, 92, 246, 0.12)";
            updatePreview(idx);
        });

        // Tıklandığında seçilen rotayı onayla ve animasyonu başlat
        btn.addEventListener("click", () => {
            overlay.classList.add("hidden");

            // Seçilen rotayı seyahat ve alış rotası olarak ata
            step.pickup = { route: opt.pickupRoute, distance: opt.pickupDistance };
            step.trip = { route: opt.tripRoute, distance: opt.tripDistance };
            step.total_distance = opt.totalDistance;
            step.type = opt.isShared ? "shared" : "solo";
            step.savings = opt.savings;
            step.score = opt.score;

            // Yolcuları güncelle
            step.customer = opt.customers[0];
            if (opt.customers.length >= 2) {
                step.customer_2 = opt.customers[1];
            } else {
                delete step.customer_2;
            }
            if (opt.customers.length >= 3) {
                step.customer_3 = opt.customers[2];
            } else {
                delete step.customer_3;
            }

            // Sonuç panelini güncelle
            resVehicle.textContent = step.vehicle.id;
            resDist.textContent = `${step.total_distance.toFixed(2)} km`;
            resPickupRoute.textContent = step.pickup.route.join(" → ");
            resTripRoute.textContent = step.trip.route.join(" → ");

            // Timeline metnini oluştur ve ata
            const timelineText = getSimplifiedTimeline(step.pickup.route, step.trip.route, opt.customers);
            resTimeline.textContent = timelineText;

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

                resSavings.textContent = `${step.savings.toFixed(2)} km`;
                resSavingsRow.classList.remove("hidden");
            } else {
                resCustomer.textContent = `${step.customer.name} (Ücret: ${(step.customer.fare || 0).toFixed(2)} TL)`;
                resSharedRow.classList.add("hidden");
                resSharedRow3.classList.add("hidden");
                resMatchType.textContent = "Solo Eşleşme";
                resSavingsRow.classList.add("hidden");
            }

            // Son karar verilen rotayı kalıcı çizim için kaydet
            systemState.lastMatchedRoute = {
                pickup: opt.pickupRoute,
                trip: opt.tripRoute,
                tripAlternatives: [], // Animasyon esnasında sadece seçilen rotayı göster
                type: step.type
            };

            // Animasyonu tetikle
            startRouteAnimation(step);
            pendingStep = null;
        });

        optionsList.appendChild(btn);
    });
}

// Aktif Taksi Seyahatini ve Animasyonu İptal Etme / Durdurma
async function handleStopAnimation() {
    if (!activeAnimation) return;

    const confirmStop = confirm("Taksi seyahatini durdurup iptal etmek istediğinize emin misiniz? Yolcular bekleme kuyruğuna geri alınacaktır.");
    if (!confirmStop) return;

    // 1. Gerekli parametreleri topla
    const vehicleId = activeAnimation.id;
    const startLocation = activeAnimation.pickupRoute[0] || "Meydan";

    let customers = [];
    if (activeAnimation.customerLoc) {
        customers.push({
            id: activeAnimation.customer ? activeAnimation.customer.id : 100,
            name: activeAnimation.customer ? activeAnimation.customer.name : "Müşteri",
            current_location: activeAnimation.customerLoc,
            destination: activeAnimation.destLoc
        });
    }
    if (activeAnimation.customerLoc2) {
        customers.push({
            id: activeAnimation.customer_2 ? activeAnimation.customer_2.id : 101,
            name: activeAnimation.customer_2 ? activeAnimation.customer_2.name : "Müşteri 2",
            current_location: activeAnimation.customerLoc2,
            destination: activeAnimation.destLoc2
        });
    }
    if (activeAnimation.customerLoc3) {
        customers.push({
            id: activeAnimation.customer_3 ? activeAnimation.customer_3.id : 102,
            name: activeAnimation.customer_3 ? activeAnimation.customer_3.name : "Müşteri 3",
            current_location: activeAnimation.customerLoc3,
            destination: activeAnimation.destLoc3
        });
    }

    // 2. Animasyonu sıfırla ve gizle
    activeAnimation = null;
    mapOverlay.classList.add("hidden");
    simResultDiv.classList.add("hidden");
    systemState.lastMatchedRoute = null;
    const pill = document.getElementById("active-passengers-pill");
    if (pill) pill.classList.add("hidden");

    // 3. Sunucuya POST isteği göndererek seyahati iptal et
    try {
        const response = await fetch("/api/simulation/revert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                vehicle_id: vehicleId,
                start_location: startLocation,
                customers: customers
            })
        });

        const data = await response.json();
        if (data.status === "success") {
            addLogLine(`İPTAL BAŞARILI: ${vehicleId} taksisinin seyahati durduruldu ve durumlar başarıyla geri alındı.`, "success");
        } else {
            addLogLine(`UYARI: İptal sunucu tarafında tam uygulanamadı.`, "error");
        }
    } catch (error) {
        console.error("Seyahat iptal edilirken hata:", error);
        addLogLine("HATA: Seyahat iptali sunucuya iletilemedi.", "error");
    }

    // 4. Sistem durumunu ve haritayı yeniden yükle
    fetchSystemStatus(true);
}

// Sistem Sıfırlama
async function handleResetSystem() {
    if (!confirm("Sistemi sıfırlamak istediğinize emin misiniz? Tüm kuyruk temizlenecek ve araçlar başlangıç noktalarına dönecektir.")) return;

    try {
        const response = await fetch("/api/reset", { method: "POST" });
        const data = await response.json();
        if (data.status === "success") {
            simResultDiv.classList.add("hidden");
            activeAnimation = null;
            resetPanOffset();
            systemState.lastMatchedRoute = null;
            systemState.randomCallCount = 0;
            mapOverlay.classList.add("hidden");
            const pill = document.getElementById("active-passengers-pill");
            if (pill) pill.classList.add("hidden");
            addLogLine(data.message, "success");
            fetchSystemStatus(true);
        }
    } catch (error) {
        console.error("Sistem sıfırlanırken hata oluştu:", error);
    }
}

// ---------------- CANVAS HARİTA VE ANİMASYON MANTIĞI ----------------


// Haritayı Çizme Fonksiyonu
function drawMap(highlightedRoutes = systemState.lastMatchedRoute || { pickup: [], trip: [] }, animVehicle = null) {
    const isLight = document.body.classList.contains("light-theme");
    const theme = isLight ? THEME_COLORS.light : THEME_COLORS.dark;
    const scale = getMapScaleFactors();

    // 1. ADIM: Deniz Arka Plan Çizimi — Tüm canvas deniz rengiyle doldurulur
    // Bu sayede pan/zoom yapıldığında deniz her yerde sabit kalır
    ctx.fillStyle = theme.sea;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. ADIM: Kara Parçası (Land) Çokgenleri — Kıyı çizgilerinin üstünde ve altında kalan alanlar
    // Kıyı hattı referans koordinatları (800x600 grid üzerinde)
    const coastlinePoints = [
        { x: -10000, y: 480 },
        { x: 180, y: 480 },
        { x: 210, y: 480 },
        { x: 380, y: 380 },
        { x: 520, y: 400 },
        { x: 670, y: 340 },
        { x: 800, y: 350 },
        { x: 1150, y: 240 },
        { x: 20000, y: 240 }
    ];

    const asianCoastlinePoints = [
        { x: -10000, y: 600 },
        { x: 350, y: 600 },
        { x: 550, y: 500 },
        { x: 700, y: 470 },
        { x: 820, y: 420 },
        { x: 920, y: 390 },
        { x: 1150, y: 320 },
        { x: 20000, y: 320 }
    ];

    // Kara çokgeni: Kıyı çizgisinin üst kısmını + canvasın tüm üst bölgelerini kapsar (Avrupa)
    ctx.fillStyle = theme.land;
    ctx.beginPath();
    const extL = -10000, extR = 20000, extT = -10000, extB = 20000;
    ctx.moveTo(extL * scale.x + scale.offsetX, extT * scale.y + scale.offsetY);
    ctx.lineTo(extR * scale.x + scale.offsetX, extT * scale.y + scale.offsetY);
    ctx.lineTo(extR * scale.x + scale.offsetX, coastlinePoints[coastlinePoints.length - 1].y * scale.y + scale.offsetY);
    for (let i = coastlinePoints.length - 1; i >= 0; i--) {
        const pt = coastlinePoints[i];
        ctx.lineTo(pt.x * scale.x + scale.offsetX, pt.y * scale.y + scale.offsetY);
    }
    ctx.lineTo(extL * scale.x + scale.offsetX, coastlinePoints[0].y * scale.y + scale.offsetY);
    ctx.closePath();
    ctx.fill();

    // Asya Yakası Kara Parçası Çokgeni — Kıyı çizgisinin altında kalan alan (Asya)
    ctx.beginPath();
    ctx.moveTo(extR * scale.x + scale.offsetX, extB * scale.y + scale.offsetY);
    ctx.lineTo(extL * scale.x + scale.offsetX, extB * scale.y + scale.offsetY);
    ctx.lineTo(extL * scale.x + scale.offsetX, asianCoastlinePoints[0].y * scale.y + scale.offsetY);
    for (let i = 0; i < asianCoastlinePoints.length; i++) {
        const pt = asianCoastlinePoints[i];
        ctx.lineTo(pt.x * scale.x + scale.offsetX, pt.y * scale.y + scale.offsetY);
    }
    ctx.lineTo(extR * scale.x + scale.offsetX, asianCoastlinePoints[asianCoastlinePoints.length - 1].y * scale.y + scale.offsetY);
    ctx.closePath();
    ctx.fill();

    // 3. ADIM: İnce Koordinat Izgarası (Premium Coordinate Grid) — Tüm ekran üzerinde
    ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.015)" : "rgba(255, 255, 255, 0.015)";
    ctx.lineWidth = 1;
    const gridSpacing = 50;

    // Zoom/Pan ile birlikte hareket eden ızgara çizgileri
    const startX = panOffset.x % (gridSpacing * scale.x);
    const startY = panOffset.y % (gridSpacing * scale.y);

    for (let x = startX; x < canvas.width; x += gridSpacing * scale.x) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += gridSpacing * scale.y) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // 4. ADIM: Ormanlık ve Yeşil Alanların (Park / Forest) Çizilmesi
    const parkPolygons = [
        // Yıldız Parkı (Huge green forest park next to Yıldız/Çırağan/Ortaköy)
        [
            { x: 530, y: 200 },
            { x: 620, y: 200 },
            { x: 650, y: 280 },
            { x: 550, y: 340 },
            { x: 510, y: 260 }
        ],
        // Abbasağa Parkı (Beşiktaş center park)
        [
            { x: 400, y: 210 },
            { x: 440, y: 200 },
            { x: 450, y: 230 },
            { x: 410, y: 240 }
        ],
        // Ihlamur Parkı / Kasrı
        [
            { x: 280, y: 140 },
            { x: 320, y: 130 },
            { x: 330, y: 160 },
            { x: 290, y: 170 }
        ],
        // Maçka Demokrasi Parkı (West border park)
        [
            { x: 90, y: 240 },
            { x: 150, y: 220 },
            { x: 190, y: 300 },
            { x: 130, y: 320 }
        ]
    ];

    parkPolygons.forEach(polygon => {
        ctx.beginPath();
        polygon.forEach((pt, i) => {
            const px = pt.x * scale.x + scale.offsetX;
            const py = pt.y * scale.y + scale.offsetY;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = theme.park;
        ctx.fill();
        ctx.strokeStyle = theme.parkStroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    });

    // 5. ADIM: Kıyı Çizgisi Parlaması (Coastline Glow Effect)
    // Kıyı Çizgisi Parlaması (Avrupa)
    ctx.beginPath();
    coastlinePoints.forEach((pt, i) => {
        const px = pt.x * scale.x + scale.offsetX;
        const py = pt.y * scale.y + scale.offsetY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = theme.coast;
    ctx.stroke();

    // İkinci ince parlak kıyı çizgisi (Avrupa)
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = isLight ? "rgba(14, 165, 233, 0.15)" : "rgba(56, 189, 248, 0.08)";
    ctx.stroke();
    ctx.restore();

    // Kıyı Çizgisi Parlaması (Asya)
    ctx.beginPath();
    asianCoastlinePoints.forEach((pt, i) => {
        const px = pt.x * scale.x + scale.offsetX;
        const py = pt.y * scale.y + scale.offsetY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = theme.coast;
    ctx.stroke();

    // İkinci ince parlak kıyı çizgisi (Asya)
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = isLight ? "rgba(14, 165, 233, 0.15)" : "rgba(56, 189, 248, 0.08)";
    ctx.stroke();
    ctx.restore();

    // 5. ADIM: Asma Köprü ve Alt Yapı Görselleştirmeleri (Ortaköy-Üsküdar & Eminönü-Karaköy)
    // 15 Temmuz Şehitler Köprüsü (Bosphorus Bridge)
    const bp1 = NODE_COORDINATES["Ortakoy"];
    const bp2 = NODE_COORDINATES["Uskudar"];
    if (bp1 && bp2) {
        const bx1 = bp1.x * scale.x + scale.offsetX;
        const by1 = bp1.y * scale.y + scale.offsetY;
        const bx2 = bp2.x * scale.x + scale.offsetX;
        const by2 = bp2.y * scale.y + scale.offsetY;

        // A. Köprü Taban Yol Yatağı (Roadway Deck)
        // Alt gölge şeridi
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        ctx.lineTo(bx2, by2);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 8;
        ctx.stroke();

        // Metal/Beton yan kirişler (koyu şerit)
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        ctx.lineTo(bx2, by2);
        ctx.strokeStyle = isLight ? "#4b5563" : "#374151";
        ctx.lineWidth = 5;
        ctx.stroke();

        // Asfalt yol yüzeyi
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        ctx.lineTo(bx2, by2);
        ctx.strokeStyle = isLight ? "#9ca3af" : "#6b7280";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Yol ortasındaki beyaz kesik şeritler (Ultra Premium detay)
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        ctx.lineTo(bx2, by2);
        ctx.strokeStyle = "#ffffff";
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.setLineDash([]); // Sıfırla

        // B. Köprü Kuleleri/Direkleri (Pillars - %30 ve %70 noktalarında)
        const towerX1 = bx1 + (bx2 - bx1) * 0.3;
        const towerY1 = by1 + (by2 - by1) * 0.3;
        const towerX2 = bx1 + (bx2 - bx1) * 0.7;
        const towerY2 = by1 + (by2 - by1) * 0.7;

        // Kule çizimi
        [{ x: towerX1, y: towerY1 }, { x: towerX2, y: towerY2 }].forEach((tower) => {
            // Kulenin taban ayağı (Suya inen derin kısım)
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y + 15 * scale.y);
            ctx.lineTo(tower.x, tower.y - 30 * scale.y);
            ctx.strokeStyle = isLight ? "#374151" : "#1f2937";
            ctx.lineWidth = 5;
            ctx.stroke();

            // Kulenin beton gövdesi (Açık gri premium beton)
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y + 15 * scale.y);
            ctx.lineTo(tower.x, tower.y - 30 * scale.y);
            ctx.strokeStyle = isLight ? "#e5e7eb" : "#9ca3af";
            ctx.lineWidth = 3;
            ctx.stroke();

            // Kule tepesinde kırmızı uyarı ışığı
            ctx.beginPath();
            ctx.arc(tower.x, tower.y - 30 * scale.y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = "#ef4444";
            ctx.fill();
        });

        // C. Ana Çelik Halat (Suspension Cable) ve Askı Halatları
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        // Sol ankrajdan sol kule tepesine
        ctx.quadraticCurveTo(
            (bx1 + towerX1) / 2, (by1 + towerY1) / 2 - 15 * scale.y,
            towerX1, towerY1 - 28 * scale.y
        );
        // İki kule arasındaki asma sarkması (Bükülme efekti)
        ctx.quadraticCurveTo(
            (towerX1 + towerX2) / 2, (towerY1 + towerY2) / 2 - 5 * scale.y,
            towerX2, towerY2 - 28 * scale.y
        );
        // Sağ kule tepesinden sağ ankraja
        ctx.quadraticCurveTo(
            (towerX2 + bx2) / 2, (towerY2 + by2) / 2 - 15 * scale.y,
            bx2, by2
        );
        ctx.strokeStyle = "#e74c3c"; // İstanbul Kırmızısı Çelik Halat
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Dikey Askı Halatları (Hangers - İnce beyaz çelik teller)
        ctx.strokeStyle = isLight ? "rgba(75, 85, 99, 0.4)" : "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 0.6;
        const hangerCount = 24;
        for (let i = 1; i < hangerCount; i++) {
            const t = i / hangerCount;
            const rx = bx1 + (bx2 - bx1) * t;
            const ry = by1 + (by2 - by1) * t;

            // Halat üzerindeki dikey yükseklik hesabı (quadratic curve interpolasyonu)
            let cx, cy;
            if (t < 0.3) {
                const nt = t / 0.3;
                cx = bx1 + (towerX1 - bx1) * nt;
                const cy1 = by1 - 15 * scale.y;
                cy = (1 - nt) * (1 - nt) * by1 + 2 * (1 - nt) * nt * cy1 + nt * nt * (towerY1 - 28 * scale.y);
            } else if (t < 0.7) {
                const nt = (t - 0.3) / 0.4;
                cx = towerX1 + (towerX2 - towerX1) * nt;
                const cy1 = (towerY1 + towerY2) / 2 - 5 * scale.y;
                cy = (1 - nt) * (1 - nt) * (towerY1 - 28 * scale.y) + 2 * (1 - nt) * nt * cy1 + nt * nt * (towerY2 - 28 * scale.y);
            } else {
                const nt = (t - 0.7) / 0.3;
                cx = towerX2 + (bx2 - towerX2) * nt;
                const cy1 = towerY2 - 15 * scale.y;
                cy = (1 - nt) * (1 - nt) * (towerY2 - 28 * scale.y) + 2 * (1 - nt) * nt * cy1 + nt * nt * by2;
            }

            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx, cy);
            ctx.stroke();
        }
    }

    // 5.1. ADIM: Arka Plan Dekoratif Yolların (Urban Arteries) Çizilmesi
    const DECORATIVE_ROADS = [
        // Barbaros Bulvarı uzantısı
        [
            { x: 460, y: 250 },
            { x: 460, y: -50 }
        ],
        // Dolmabahçe-Çırağan-Ortaköy sahil yolu uzantısı
        [
            { x: 100, y: 490 },
            { x: 250, y: 450 },
            { x: 400, y: 350 },
            { x: 520, y: 380 },
            { x: 700, y: 320 },
            { x: 820, y: 290 }
        ],
        // Nişantaşı-Çarşı-Ihlamur tünel / sokak arterleri
        [
            { x: 50, y: 320 },
            { x: 100, y: 260 },
            { x: 180, y: 320 },
            { x: 220, y: 380 },
            { x: 350, y: 310 }
        ],
        // Balmumcu - Yıldız bağlantı otoyolu
        [
            { x: 600, y: 100 },
            { x: 520, y: 180 },
            { x: 460, y: 250 }
        ]
    ];

    ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.025)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([]);
    DECORATIVE_ROADS.forEach(road => {
        ctx.beginPath();
        road.forEach((pt, i) => {
            const px = pt.x * scale.x + scale.offsetX;
            const py = pt.y * scale.y + scale.offsetY;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
    });

    // 5.2. ADIM: Pusula ve Ölçek Çizimi (Estetik Köşe Ayrıntıları)
    const scaleWidth = 35 * scale.x; // 35 referans piksel = 1.0 km
    const sx = 30;
    const sy = canvas.height - 30;

    // Harita Ölçeği (Sol Alt)
    ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx + scaleWidth, sy);
    ctx.lineTo(sx + scaleWidth, sy - 4);
    ctx.stroke();

    ctx.fillStyle = theme.text;
    ctx.font = "bold 9px 'Space Grotesk'";
    ctx.textAlign = "center";
    ctx.fillText("1.0 km", sx + scaleWidth / 2, sy - 7);

    // Pusula Gülü (Sağ Üst Köşe - Minimalist Kuzey Oku)
    const cx = canvas.width - 40;
    const cy = 40;

    ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
    ctx.stroke();

    // Kuzey oku kırmızı ucu
    ctx.fillStyle = "#ff453a";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx - 3, cy - 2);
    ctx.lineTo(cx + 3, cy - 2);
    ctx.closePath();
    ctx.fill();

    // Güney oku alt ucu
    ctx.fillStyle = isLight ? "#7f8c8d" : "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.moveTo(cx, cy + 11);
    ctx.lineTo(cx - 3, cy + 2);
    ctx.lineTo(cx + 3, cy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.text;
    ctx.font = "bold 8px 'Space Grotesk'";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy - 16);

    // 5.3. ADIM: Harita Filigranı Bölge ve Su İsimleri (Watermark Labels)
    const DISTRICT_LABELS = [
        { text: "AKARETLER", x: 220, y: 410, size: 9, isWater: false },
        { text: "BEŞİKTAŞ ÇARŞI", x: 320, y: 330, size: 9, isWater: false },
        { text: "YILDIZ", x: 480, y: 150, size: 9, isWater: false },
        { text: "ORTAKÖY", x: 720, y: 290, size: 9, isWater: false },
        { text: "IHLAMUR", x: 320, y: 110, size: 8, isWater: false },
        { text: "DİKİLİTAŞ", x: 460, y: 100, size: 8, isWater: false },
        { text: "TURKALİ", x: 360, y: 180, size: 8, isWater: false },
        { text: "BALMUMCU", x: 630, y: 80, size: 9, isWater: false },
        { text: "KABATAŞ", x: 160, y: 490, size: 8, isWater: false },
        { text: "NİŞANTAŞI", x: 80, y: 225, size: 8, isWater: false },
        { text: "LEVENT", x: 550, y: 70, size: 9, isWater: false },
        { text: "ULUS", x: 740, y: 120, size: 9, isWater: false },
        { text: "BEBEK", x: 780, y: 240, size: 9, isWater: false },
        { text: "ÜSKÜDAR", x: 810, y: 505, size: 9, isWater: false },
        { text: "KADIKÖY", x: 740, y: 575, size: 9, isWater: false },
        { text: "KUZGUNCUK", x: 850, y: 470, size: 8, isWater: false },
        { text: "NAKKAŞTEPE", x: 850, y: 395, size: 8, isWater: false },
        { text: "BEYLERBEYI", x: 890, y: 430, size: 8, isWater: false },

        // Boğaz ve Deniz Etiketleri
        { text: "İSTANBUL BOĞAZI", x: 520, y: 450, size: 12, isWater: true, rotation: -Math.PI / 8 },
        { text: "YILDIZ PARKI", x: 580, y: 260, size: 10, isWater: false, isForest: true }
    ];

    DISTRICT_LABELS.forEach(label => {
        const px = label.x * scale.x + scale.offsetX;
        const py = label.y * scale.y + scale.offsetY;

        ctx.save();
        ctx.translate(px, py);
        if (label.rotation) {
            ctx.rotate(label.rotation);
        }

        if (label.isWater) {
            ctx.fillStyle = isLight ? "rgba(14, 165, 233, 0.4)" : "rgba(56, 189, 248, 0.25)";
            ctx.font = `bold ${label.size}px 'Space Grotesk'`;
        } else if (label.isForest) {
            ctx.fillStyle = isLight ? "rgba(34, 197, 94, 0.45)" : "rgba(16, 185, 129, 0.25)";
            ctx.font = `bold ${label.size}px 'Space Grotesk'`;
        } else {
            ctx.fillStyle = isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.12)";
            ctx.font = `bold ${label.size}px 'Space Grotesk'`;
        }

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label.text, 0, 0);
        ctx.restore();
    });

    // 1. ADIM: Yolları (Edge) Çizme
    // A. Önce tüm yolları kalın, estetik gri sokak şeritleri (grey road beds) olarak çiziyoruz
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = isLight ? 8 : 10;
    ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)";

    let drawnEdges = new Set();
    for (const sourceName in systemState.cityMap) {
        systemState.cityMap[sourceName].adjacencies.forEach(edge => {
            const targetName = edge.target;
            const edgeKey = [sourceName, targetName].sort().join("-");
            if (drawnEdges.has(edgeKey)) return;
            drawnEdges.add(edgeKey);

            const points = getRoadPoints(sourceName, targetName);
            ctx.beginPath();
            points.forEach((pt, idx) => {
                const px = pt.x * scale.x + scale.offsetX;
                const py = pt.y * scale.y + scale.offsetY;
                if (idx === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.stroke();
        });
    }

    // B. Alternatif rotaları (tripAlternatives) ince, yarı şeffaf turuncu kesikli çizgiler olarak altta çiziyoruz
    drawnEdges = new Set();
    for (const sourceName in systemState.cityMap) {
        systemState.cityMap[sourceName].adjacencies.forEach(edge => {
            const targetName = edge.target;
            const edgeKey = [sourceName, targetName].sort().join("-");
            if (drawnEdges.has(edgeKey)) return;
            drawnEdges.add(edgeKey);

            let isPickupEdge = isEdgeInPath(sourceName, targetName, highlightedRoutes.pickup);
            let isTripEdge = isEdgeInPath(sourceName, targetName, highlightedRoutes.trip);

            let isAltEdge = false;
            if (highlightedRoutes.tripAlternatives) {
                highlightedRoutes.tripAlternatives.forEach(alt => {
                    const path = alt.route || alt;
                    if (isEdgeInPath(sourceName, targetName, path)) {
                        isAltEdge = true;
                    }
                });
            }

            if (isAltEdge && !isTripEdge && !isPickupEdge) {
                ctx.strokeStyle = "rgba(245, 158, 11, 0.7)"; // Belirgin düz turuncu
                ctx.setLineDash([]); // Düz çizgi yapıldı
                ctx.lineWidth = 3.5;

                const points = getRoadPoints(sourceName, targetName);
                ctx.beginPath();
                points.forEach((pt, idx) => {
                    const px = pt.x * scale.x + scale.offsetX;
                    const py = pt.y * scale.y + scale.offsetY;
                    if (idx === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.stroke();
            }
        });
    }

    // C. Aktif rotaları (pickup/trip) bu gri yatakların üzerine kalın şeritler olarak çiziyoruz (Trip yeşil renkte)
    drawnEdges = new Set();
    for (const sourceName in systemState.cityMap) {
        systemState.cityMap[sourceName].adjacencies.forEach(edge => {
            const targetName = edge.target;
            const edgeKey = [sourceName, targetName].sort().join("-");
            if (drawnEdges.has(edgeKey)) return;
            drawnEdges.add(edgeKey);

            let isPickupEdge = isEdgeInPath(sourceName, targetName, highlightedRoutes.pickup);
            let isTripEdge = isEdgeInPath(sourceName, targetName, highlightedRoutes.trip);

            if (isPickupEdge || isTripEdge) {
                if (isPickupEdge) {
                    ctx.strokeStyle = theme.roadActivePickup;
                    ctx.setLineDash([]); // Düz çizgi yapıldı
                    ctx.lineWidth = 4;
                } else {
                    ctx.strokeStyle = theme.roadActiveTrip;
                    ctx.setLineDash([]);
                    ctx.lineWidth = 5;
                }

                const points = getRoadPoints(sourceName, targetName);
                ctx.beginPath();
                points.forEach((pt, idx) => {
                    const px = pt.x * scale.x + scale.offsetX;
                    const py = pt.y * scale.y + scale.offsetY;
                    if (idx === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Alternatiflerden birinin veya en kısa yolun içindeyse aktif renkte yazalım
            let isAnyActiveOrAlt = isPickupEdge || isTripEdge;
            if (highlightedRoutes.tripAlternatives) {
                highlightedRoutes.tripAlternatives.forEach(alt => {
                    if (isEdgeInPath(sourceName, targetName, alt.route)) {
                        isAnyActiveOrAlt = true;
                    }
                });
            }

            // Kilometre etiketlerini yolun gerçek eğri merkezine yazıyoruz
            const points = getRoadPoints(sourceName, targetName);
            const midPt = points[Math.floor(points.length / 2)];
            const midX = midPt.x * scale.x + scale.offsetX;
            const midY = midPt.y * scale.y + scale.offsetY;

            ctx.fillStyle = isPickupEdge || isTripEdge ? theme.textActive : theme.textInactive;
            ctx.font = "bold 10px 'Space Grotesk'";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = isLight ? "rgba(255, 255, 255, 0.8)" : "black";
            ctx.shadowBlur = isLight ? 1 : 3;
            ctx.fillText(`${edge.weight.toFixed(1)} km`, midX, midY - 10);
            ctx.shadowBlur = 0;
        });
    }

    ctx.setLineDash([]);

    // 2. ADIM: Durakları (Vertex / Nodes) Çizme
    for (const nodeName in NODE_COORDINATES) {
        const coord = NODE_COORDINATES[nodeName];
        const x = coord.x * scale.x + scale.offsetX;
        const y = coord.y * scale.y + scale.offsetY;

        let nodeColor = theme.nodeDefault;
        let nodeRadius = 9;
        let glowColor = theme.nodeGlow;
        let glowSize = 10;

        // Müşteri varlığını kontrol et (Kuyrukta bekleyen veya aktif alım aşamasında olanlar)
        let hasCustomer = false;
        if (systemState.waitingCustomers && systemState.waitingCustomers.length > 0) {
            hasCustomer = systemState.waitingCustomers.some(cust => {
                // Eğer bu yolcu aktif olarak taşınıyorsa ve yolculuk aşamasına (trip) geçildiyse VEYA alım durağında alınma eventi tetiklendiyse, highlight kalksın
                if (activeAnimation) {
                    if (activeAnimation.phase === 'trip' || (activeAnimation.triggeredEvents && activeAnimation.triggeredEvents.has('pickup-' + nodeName))) {
                        if (cust.current_location === activeAnimation.customerLoc ||
                            (activeAnimation.customerLoc2 && cust.current_location === activeAnimation.customerLoc2) ||
                            (activeAnimation.customerLoc3 && cust.current_location === activeAnimation.customerLoc3)) {
                            return false;
                        }
                    }
                }
                return cust.current_location === nodeName;
            });
        }
        if (activeAnimation && activeAnimation.phase === 'pickup') {
            if (nodeName === activeAnimation.customerLoc ||
                (activeAnimation.customerLoc2 && nodeName === activeAnimation.customerLoc2) ||
                (activeAnimation.customerLoc3 && nodeName === activeAnimation.customerLoc3)) {
                // Eğer alım eventi henüz tetiklenmediyse highlight var
                if (!activeAnimation.triggeredEvents.has('pickup-' + nodeName)) {
                    hasCustomer = true;
                }
            }
        }

        if (animVehicle) {
            const customerLoc = animVehicle.customerLoc;
            const destLoc = animVehicle.destLoc;
            const customerLoc2 = animVehicle.customerLoc2;
            const destLoc2 = animVehicle.destLoc2;
            const customerLoc3 = animVehicle.customerLoc3;
            const destLoc3 = animVehicle.destLoc3;

            if (nodeName === customerLoc || nodeName === customerLoc2 || nodeName === customerLoc3) {
                nodeColor = theme.warning;
                nodeRadius = 11;
                glowColor = theme.warningGlow;
                glowSize = 16;
            } else if (nodeName === destLoc || nodeName === destLoc2 || nodeName === destLoc3) {
                nodeColor = theme.primary;
                nodeRadius = 11;
                glowColor = theme.primaryGlow;
                glowSize = 16;
            }
        }


        // Eğer durakta müşteri varsa, çevresini mavi parlamayla (glow) zenginleştir
        if (hasCustomer) {
            glowColor = isLight ? "rgba(0, 113, 227, 0.45)" : "rgba(59, 130, 246, 0.65)";
            glowSize = 22;
        }

        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + glowSize / 2, 0, 2 * Math.PI);
        ctx.fillStyle = glowColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = nodeColor;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isLight ? "#ffffff" : "rgba(255, 255, 255, 0.8)";
        ctx.fill();
        ctx.stroke();

        // Eğer durakta müşteri varsa çevresini göz alıcı premium mavi halkayla (highlight) çevrele
        if (hasCustomer) {
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius + 5.5, 0, 2 * Math.PI);
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = isLight ? "#0071e3" : "#3b82f6";
            ctx.stroke();
        }

        ctx.fillStyle = theme.text;
        ctx.font = "600 11px 'Space Grotesk'";
        ctx.textAlign = "center";
        ctx.fillText(nodeName, x, y - nodeRadius - 8);
    }


    // 3. ADIM: Araçları Çizme
    systemState.vehicles.forEach(vehicle => {
        if (animVehicle && vehicle.id === animVehicle.id) return;

        const coord = NODE_COORDINATES[vehicle.current_location];
        if (!coord) return;

        const x = coord.x * scale.x + scale.offsetX;
        const y = coord.y * scale.y + scale.offsetY;

        drawVehicleIcon(x, y, vehicle.id, vehicle.is_available);
    });

    // 4. ADIM: Aktif Hareket Eden Animasyon Aracını Çizme
    if (animVehicle) {
        drawVehicleIcon(animVehicle.x, animVehicle.y, animVehicle.id, false, true, animVehicle.angle);
    }

    // 5. ADIM: Estetik Baloncuk Pop-up (Speech Bubble) Çizimi (Yolcu Alındı/Bırakıldı)
    if (activeAnimation && activeAnimation.popup) {
        const popup = activeAnimation.popup;
        const coord = NODE_COORDINATES[popup.nodeName];
        if (coord) {
            const nx = coord.x * scale.x + scale.offsetX;
            const ny = coord.y * scale.y + scale.offsetY;

            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;

            const text = popup.text;
            ctx.font = "bold 12px 'Space Grotesk', system-ui";
            const textWidth = ctx.measureText(text).width;
            const padX = 14;
            const padY = 8;
            const bubbleW = textWidth + padX * 2;
            const bubbleH = 28;
            const bubbleX = nx - bubbleW / 2;
            const bubbleY = ny - 45; // 45px above node

            // Draw bubble body
            ctx.beginPath();
            ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 6);
            ctx.fillStyle = isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 23, 42, 0.95)";
            ctx.strokeStyle = isLight ? "rgba(0, 113, 227, 0.8)" : "rgba(56, 189, 248, 0.8)";
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();

            // Draw bubble pointer (downward triangle)
            ctx.beginPath();
            ctx.moveTo(nx - 6, bubbleY + bubbleH);
            ctx.lineTo(nx, bubbleY + bubbleH + 6);
            ctx.lineTo(nx + 6, bubbleY + bubbleH);
            ctx.closePath();
            ctx.fillStyle = isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 23, 42, 0.95)";
            ctx.strokeStyle = isLight ? "rgba(0, 113, 227, 0.8)" : "rgba(56, 189, 248, 0.8)";
            ctx.fill();
            // Stroke only diagonal sides of pointer
            ctx.beginPath();
            ctx.moveTo(nx - 6, bubbleY + bubbleH);
            ctx.lineTo(nx, bubbleY + bubbleH + 6);
            ctx.lineTo(nx + 6, bubbleY + bubbleH);
            ctx.stroke();

            ctx.restore();

            // Draw text
            ctx.fillStyle = isLight ? "#1d1d1f" : "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 12px 'Space Grotesk', system-ui";
            ctx.fillText(text, nx, bubbleY + bubbleH / 2);
        }
    }
}

// Araç Simgesi Çizme Yardımcısı
function drawVehicleIcon(x, y, plate, isAvailable, isAnimating = false, angle = null) {
    const isLight = document.body.classList.contains("light-theme");
    const theme = isLight ? THEME_COLORS.light : THEME_COLORS.dark;
    const size = 10;
    const color = isAvailable ? theme.success : theme.danger;
    const glow = isAvailable ? theme.successGlow : theme.dangerGlow;

    ctx.beginPath();
    ctx.arc(x, y, size + 8, 0, 2 * Math.PI);
    ctx.fillStyle = glow;
    ctx.fill();

    if (isAnimating && angle !== null) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(size + 4, 0);
        ctx.lineTo(-size, -size * 0.8);
        ctx.lineTo(-size * 0.5, 0);
        ctx.lineTo(-size, size * 0.8);
        ctx.closePath();

        ctx.fillStyle = "#f59e0b"; // GPS yellow
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    } else {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
    }

    ctx.fillStyle = isLight ? "#0071e3" : "#38bdf8";
    ctx.font = "bold 9px 'Space Grotesk'";
    ctx.textAlign = "center";
    ctx.fillText(plate, x, y + size + 12);
}

// Pan Sınırlandırma Fonksiyonu - Haritanın ekran dışına sürüklenmesini önler
function clampPanOffset() {
    const refWidth = 1150;
    const refHeight = 650;
    const scaleX = (canvas.width * 0.95) / refWidth;
    const scaleY = (canvas.height * 0.95) / refHeight;
    const baseScale = Math.min(scaleX, scaleY);

    const mapWidth = refWidth * baseScale * zoomScale;
    const mapHeight = refHeight * baseScale * zoomScale;

    // Yatay Sınırlandırma (Akıllı Kenetleme)
    if (mapWidth > canvas.width) {
        panOffset.x = Math.max(canvas.width - mapWidth, Math.min(0, panOffset.x));
    } else {
        panOffset.x = (canvas.width - mapWidth) / 2;
    }

    // Dikey Sınırlandırma (Akıllı Kenetleme)
    if (mapHeight > canvas.height) {
        panOffset.y = Math.max(canvas.height - mapHeight, Math.min(0, panOffset.y));
    } else {
        panOffset.y = (canvas.height - mapHeight) / 2;
    }
}

// Koordinat Ölçeklendirme Faktörleri (En-Boy Oranını Koruyan Responsive Uyum ve Zoom/Pan Desteği)
function getMapScaleFactors() {
    // Koordinatlar 1150x650 piksel referans alınarak yazılmıştır.
    const refWidth = 1150;
    const refHeight = 650;

    // Canvas alanına sığdırmak için ideal taban ölçek hesabı (Kenarlardan %2.5 boşluk bırakarak)
    const scaleX = (canvas.width * 0.95) / refWidth;
    const scaleY = (canvas.height * 0.95) / refHeight;
    const baseScale = Math.min(scaleX, scaleY);

    // Zoom ve Pan katsayılarının taban değerlerle birleştirilmesi
    const finalScaleX = baseScale * zoomScale;
    const finalScaleY = baseScale * zoomScale;

    return { x: finalScaleX, y: finalScaleY, offsetX: panOffset.x, offsetY: panOffset.y };
}

// Bir kenarın rotanın içinde olup olmadığını doğrular
function isEdgeInPath(u, v, path) {
    if (!path || path.length < 2) return false;
    for (let i = 0; i < path.length - 1; i++) {
        if ((path[i] === u && path[i + 1] === v) || (path[i] === v && path[i + 1] === u)) {
            return true;
        }
    }
    return false;
}



function startRouteAnimation(step) {
    const pickupRoute = step.pickup.route;
    const tripRoute = step.trip.route;
    const fullPath = combineRoutes(pickupRoute, tripRoute);

    // Build a chronological list of events along the unified path
    const eventsPerIndex = {}; // index i -> { pickups: [], dropoffs: [] }

    const customers = [];
    if (step.customer) customers.push(step.customer);
    if (step.customer_2) customers.push(step.customer_2);
    if (step.customer_3) customers.push(step.customer_3);

    let inCar = new Set();
    let pickedUp = new Set();

    fullPath.forEach((node, i) => {
        let dropoffs = [];
        customers.forEach(c => {
            if (inCar.has(c.id) && c.destination === node) {
                dropoffs.push(c.name);
                inCar.delete(c.id);
            }
        });

        let pickups = [];
        customers.forEach(c => {
            if (!pickedUp.has(c.id) && c.current_location === node) {
                pickups.push(c.name);
                pickedUp.add(c.id);
                inCar.add(c.id);
            }
        });

        if (pickups.length > 0 || dropoffs.length > 0) {
            eventsPerIndex[i] = {
                pickups: pickups,
                dropoffs: dropoffs
            };
        }
    });

    let lastPickupIdx = 0;
    for (let i = 0; i < fullPath.length; i++) {
        if (eventsPerIndex[i] && eventsPerIndex[i].pickups.length > 0) {
            lastPickupIdx = i;
        }
    }

    let startAngle = 0;
    if (fullPath.length >= 2) {
        const n0 = NODE_COORDINATES[fullPath[0]];
        const n1 = NODE_COORDINATES[fullPath[1]];
        if (n0 && n1) {
            startAngle = Math.atan2(n1.y - n0.y, n1.x - n0.x);
        }
    }

    activeAnimation = {
        id: step.vehicle.id,
        pickupRoute: pickupRoute,
        tripRoute: tripRoute,
        fullPath: fullPath,
        tripAlternatives: (systemState.lastMatchedRoute && systemState.lastMatchedRoute.tripAlternatives)
            ? systemState.lastMatchedRoute.tripAlternatives
            : step.trip_alternatives,
        customerLoc: step.customer.current_location,
        destLoc: step.customer.destination,
        customerLoc2: step.customer_2 ? step.customer_2.current_location : null,
        destLoc2: step.customer_2 ? step.customer_2.destination : null,
        customerLoc3: step.customer_3 ? step.customer_3.current_location : null,
        destLoc3: step.customer_3 ? step.customer_3.destination : null,
        customer: step.customer,
        customer_2: step.customer_2 || null,
        customer_3: step.customer_3 || null,
        progress: 0,
        phase: 'pickup',
        speed: 0.0005, // Daha yavaş, yumuşak animasyon akışı
        angle: startAngle,
        eventsPerIndex: eventsPerIndex,
        lastPickupIdx: lastPickupIdx,
        triggeredEvents: new Set(),
        currentPassengersInCar: new Set(),
        isPaused: false,
        popup: null,
        stepCallback: () => {
            fetchSystemStatus();
            activeAnimation = null;
            mapOverlay.classList.add("hidden");
            const pill = document.getElementById("active-passengers-pill");
            if (pill) pill.classList.add("hidden");
            btnStep.removeAttribute("disabled");
        }
    };

    const pill = document.getElementById("active-passengers-pill");
    if (pill) {
        pill.classList.remove("hidden");
        updatePassengersPill(activeAnimation.currentPassengersInCar);
    }

    mapOverlay.classList.remove("hidden");

    if (step.type === "shared") {
        overlayTitle.innerHTML = `<i class="fa-solid fa-people-arrows overlay-icon"></i> Paylaşımlı Rota Bulundu`;
        if (step.customer_3) {
            overlayDesc.textContent = `${step.vehicle.id} taksisi, ${step.customer.name}, ${step.customer_2.name} ve ${step.customer_3.name} yolcularını paylaşımlı olarak alıyor.`;
        } else {
            overlayDesc.textContent = `${step.vehicle.id} taksisi, ${step.customer.name} ve ${step.customer_2.name} yolcularını paylaşımlı olarak alıyor.`;
        }
    } else {
        overlayTitle.innerHTML = `<i class="fa-solid fa-taxi overlay-icon animate-bounce"></i> Rota Optimize Edildi`;
        overlayDesc.textContent = `${step.vehicle.id} plakalı araç, ${step.customer.name} için hareket ediyor.`;
    }

    requestAnimationFrame(animateStep);
}

// Adım Adım Animasyon Döngüsü
function animateStep() {
    if (!activeAnimation) return;

    const scale = getMapScaleFactors();
    const fullPath = activeAnimation.fullPath;
    let currentX, currentY;

    // --- ENTEGRE TEK DÜĞÜMLÜ ROTALARDA VARIŞ VE PAUSE MANTIĞI ---
    if (fullPath.length < 2) {
        const nodeName = fullPath[0];
        if (nodeName && !activeAnimation.triggeredEvents.has(0)) {
            if (activeAnimation.eventsPerIndex[0]) {
                const coord = NODE_COORDINATES[nodeName];
                const cx = coord ? coord.x * scale.x + scale.offsetX : 0;
                const cy = coord ? coord.y * scale.y + scale.offsetY : 0;
                triggerEventAtIndex(0, nodeName, cx, cy);
                return;
            }
        }
        completeAnimation();
        return;
    }

    const totalSegments = fullPath.length - 1;
    const scaledProgress = activeAnimation.progress * totalSegments;
    const segmentIndex = Math.floor(scaledProgress);
    const segmentProgress = scaledProgress - segmentIndex;

    // Dynamically update animation phase for UI overlay and node highlights
    activeAnimation.phase = (segmentIndex < activeAnimation.lastPickupIdx) ? 'pickup' : 'trip';

    if (segmentIndex >= totalSegments) {
        // Last node of the unified path
        const lastNodeIdx = fullPath.length - 1;
        const lastNode = fullPath[lastNodeIdx];
        if (!activeAnimation.triggeredEvents.has(lastNodeIdx)) {
            if (activeAnimation.eventsPerIndex[lastNodeIdx]) {
                const lastCoord = NODE_COORDINATES[lastNode];
                const snapX = lastCoord ? lastCoord.x * scale.x + scale.offsetX : currentX;
                const snapY = lastCoord ? lastCoord.y * scale.y + scale.offsetY : currentY;
                triggerEventAtIndex(lastNodeIdx, lastNode, snapX, snapY);
                return;
            }
        }
        completeAnimation();
        return;
    }

    // Check if starting node has a pickup/dropoff at the very start (progress 0)
    if (activeAnimation.progress === 0 && !activeAnimation.triggeredEvents.has(0)) {
        if (activeAnimation.eventsPerIndex[0]) {
            const startNode = fullPath[0];
            const startCoord = NODE_COORDINATES[startNode];
            const snapX = startCoord ? startCoord.x * scale.x + scale.offsetX : 0;
            const snapY = startCoord ? startCoord.y * scale.y + scale.offsetY : 0;
            triggerEventAtIndex(0, startNode, snapX, snapY);
            return;
        }
    }

    const startNode = fullPath[segmentIndex];
    const endNode = fullPath[segmentIndex + 1];

    const streetPoints = getRoadPoints(startNode, endNode);
    const totalStreetSegments = streetPoints.length - 1;
    const scaledStreetProgress = segmentProgress * totalStreetSegments;
    const streetSegmentIndex = Math.min(Math.floor(scaledStreetProgress), totalStreetSegments - 1);
    const streetSegmentProgress = scaledStreetProgress - streetSegmentIndex;

    const ptStart = streetPoints[streetSegmentIndex];
    const ptEnd = streetPoints[streetSegmentIndex + 1];

    const startPx = ptStart.x * scale.x + scale.offsetX;
    const startPy = ptStart.y * scale.y + scale.offsetY;
    const endPx = ptEnd.x * scale.x + scale.offsetX;
    const endPy = ptEnd.y * scale.y + scale.offsetY;

    currentX = startPx + (endPx - startPx) * streetSegmentProgress;
    currentY = startPy + (endPy - startPy) * streetSegmentProgress;
    activeAnimation.angle = Math.atan2(endPy - startPy, endPx - startPx);

    // --- ENTEGRE COĞRAFİ UZAKLIK TABANLI DURAK VARIŞ VE DURAKLAMA MANTIĞI ---
    // Check if we are physically close to the next node (segmentIndex + 1)
    const nextNodeIdx = segmentIndex + 1;
    const nextNodeName = fullPath[nextNodeIdx];

    if (nextNodeName && !activeAnimation.triggeredEvents.has(nextNodeIdx)) {
        if (activeAnimation.eventsPerIndex[nextNodeIdx]) {
            const nodeCoord = NODE_COORDINATES[nextNodeName];
            if (nodeCoord) {
                const nx = nodeCoord.x * scale.x + scale.offsetX;
                const ny = nodeCoord.y * scale.y + scale.offsetY;

                const dx = currentX - nx;
                const dy = currentY - ny;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 15) {
                    currentX = nx;
                    currentY = ny;
                    activeAnimation.progress = nextNodeIdx / Math.max(1, fullPath.length - 1);
                    triggerEventAtIndex(nextNodeIdx, nextNodeName, currentX, currentY);
                    return;
                }
            }
        }
    }

    // Render map frame
    drawMap({
        pickup: activeAnimation.pickupRoute,
        trip: activeAnimation.tripRoute,
        tripAlternatives: activeAnimation.tripAlternatives
    }, {
        id: activeAnimation.id,
        x: currentX,
        y: currentY,
        angle: activeAnimation.angle,
        customerLoc: activeAnimation.customerLoc,
        destLoc: activeAnimation.destLoc,
        customerLoc2: activeAnimation.customerLoc2,
        destLoc2: activeAnimation.destLoc2,
        customerLoc3: activeAnimation.customerLoc3,
        destLoc3: activeAnimation.destLoc3
    });

    if (!activeAnimation.isPaused) {
        activeAnimation.progress += activeAnimation.speed;

        if (activeAnimation.progress < 1.0) {
            requestAnimationFrame(animateStep);
        } else {
            completeAnimation();
        }
    }
}

// Bir Duraktaki Tüm Biniş/İniş Eylemlerini Sırayla Tetikler ve Pop-up Gösterir
function triggerEventAtIndex(idx, nodeName, cx, cy) {
    if (!activeAnimation) return;

    activeAnimation.isPaused = true;
    activeAnimation.triggeredEvents.add(idx);

    const events = activeAnimation.eventsPerIndex[idx];
    const pickups = events.pickups || [];
    const dropoffs = events.dropoffs || [];

    // Compatibility keys for drawMap node highlight rendering
    if (pickups.length > 0) {
        activeAnimation.triggeredEvents.add('pickup-' + nodeName);
    }

    // Board and deboard passengers
    pickups.forEach(name => activeAnimation.currentPassengersInCar.add(name));
    dropoffs.forEach(name => activeAnimation.currentPassengersInCar.delete(name));
    updatePassengersPill(activeAnimation.currentPassengersInCar);

    // Generate beautiful speech bubble strings
    let eventTexts = [];
    if (dropoffs.length > 0) {
        eventTexts.push(`${dropoffs.join(" & ")} bırakıldı! 🏁`);
        addLogLine(`SİMÜLASYON: ${dropoffs.join(" ve ")} bırakıldı.`, "success");
    }
    if (pickups.length > 0) {
        eventTexts.push(`${pickups.join(" & ")} alındı! 🚗`);
        addLogLine(`SİMÜLASYON: ${pickups.join(" ve ")} alındı.`, "success");
    }

    // Update the big overlay title and description on the map
    if (pickups.length > 0 && dropoffs.length > 0) {
        overlayTitle.innerHTML = `<i class="fa-solid fa-people-arrows overlay-icon"></i> Eşzamanlı Durak İşlemleri`;
        overlayDesc.textContent = `${nodeName} durağında hem indirme hem bindirme işlemleri yapılıyor.`;
    } else if (dropoffs.length > 0) {
        overlayTitle.innerHTML = `<i class="fa-solid fa-circle-check overlay-icon"></i> Yolcu İndirme`;
        overlayDesc.textContent = `${nodeName} durağında ${dropoffs.join(" ve ")} araçtan iniyor.`;
    } else if (pickups.length > 0) {
        overlayTitle.innerHTML = `<i class="fa-solid fa-user-plus overlay-icon"></i> Yolcu Binişi`;
        overlayDesc.textContent = `${nodeName} durağında ${pickups.join(" ve ")} araca biniyor.`;
    }

    const popupDuration = 1500;

    const showPopup = (textIndex) => {
        if (!activeAnimation) return;
        if (textIndex >= eventTexts.length) {
            // Restore regular phase title when resume moving
            const segmentIndex = Math.floor(activeAnimation.progress * (activeAnimation.fullPath.length - 1));
            const isPickupPhase = segmentIndex < activeAnimation.lastPickupIdx;

            if (isPickupPhase) {
                if (activeAnimation.customerLoc3 || activeAnimation.customerLoc2) {
                    overlayTitle.innerHTML = `<i class="fa-solid fa-people-arrows overlay-icon"></i> Paylaşımlı Rota Bulundu`;
                    overlayDesc.textContent = `${activeAnimation.id} taksisi yolcuları paylaşımlı olarak alıyor.`;
                } else {
                    overlayTitle.innerHTML = `<i class="fa-solid fa-taxi overlay-icon animate-bounce"></i> Rota Optimize Edildi`;
                    overlayDesc.textContent = `${activeAnimation.id} plakalı araç, ${activeAnimation.customer.name} için hareket ediyor.`;
                }
            } else {
                if (activeAnimation.customerLoc3 || activeAnimation.customerLoc2) {
                    overlayTitle.innerHTML = `<i class="fa-solid fa-people-carry-box overlay-icon"></i> Yolcular Alındı`;
                    overlayDesc.textContent = `Araç paylaşımlı seyahat rotasındaki teslimat noktalarına doğru ilerliyor.`;
                } else {
                    overlayTitle.innerHTML = `<i class="fa-solid fa-people-carry-box overlay-icon"></i> Müşteri Alındı`;
                    overlayDesc.textContent = `Araç müşteriyi hedefe (${activeAnimation.destLoc}) götürüyor.`;
                }
            }

            activeAnimation.isPaused = false;
            activeAnimation.popup = null;
            requestAnimationFrame(animateStep);
            return;
        }

        activeAnimation.popup = {
            nodeName: nodeName,
            text: eventTexts[textIndex]
        };

        drawMap({
            pickup: activeAnimation.pickupRoute,
            trip: activeAnimation.tripRoute,
            tripAlternatives: activeAnimation.tripAlternatives
        }, {
            id: activeAnimation.id,
            x: cx,
            y: cy,
            angle: activeAnimation.angle,
            customerLoc: activeAnimation.customerLoc,
            destLoc: activeAnimation.destLoc,
            customerLoc2: activeAnimation.customerLoc2,
            destLoc2: activeAnimation.destLoc2,
            customerLoc3: activeAnimation.customerLoc3,
            destLoc3: activeAnimation.destLoc3
        });

        setTimeout(() => {
            showPopup(textIndex + 1);
        }, popupDuration);
    };

    showPopup(0);
}

// Yolculuk Başarıyla Bittiğinde Çalışan Temizlik ve Loglama Metodu
function completeAnimation() {
    if (!activeAnimation) return;

    overlayTitle.innerHTML = `<i class="fa-solid fa-flag-checkered overlay-icon"></i> Ulaşımlar Başarılı`;
    if (activeAnimation.customerLoc3 || activeAnimation.customerLoc2) {
        overlayDesc.textContent = "Tüm yolcular hedeflerine güvenle ulaştırıldı!";
    } else {
        overlayDesc.textContent = "Yolcu hedefine ulaştırıldı.";
    }

    const finalLoc = activeAnimation.destLoc3 || activeAnimation.destLoc2 || activeAnimation.destLoc;
    addLogLine(`SİMÜLASYON: ${activeAnimation.id} taksisi yolculuğu tamamladı. Mevcut konumu artık: ${finalLoc}`, "success");

    // Yolculuk özeti overlay'ini doldur ve göster
    const summaryOverlay = document.getElementById("trip-summary-overlay");
    const summaryList = document.getElementById("trip-summary-customers-list");

    if (summaryOverlay && summaryList) {
        summaryList.innerHTML = "";

        const summaryCustomers = [];
        if (activeAnimation.customer) summaryCustomers.push(activeAnimation.customer);
        if (activeAnimation.customer_2) summaryCustomers.push(activeAnimation.customer_2);
        if (activeAnimation.customer_3) summaryCustomers.push(activeAnimation.customer_3);

        const isLight = document.body.classList.contains("light-theme");

        summaryCustomers.forEach(c => {
            const card = document.createElement("div");
            card.className = "route-option-btn"; // consistent Routex buttons style!
            card.style.background = isLight ? "rgba(0, 0, 0, 0.02)" : "rgba(255, 255, 255, 0.02)";
            card.style.borderColor = isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.06)";
            card.style.cursor = "default";
            card.style.padding = "14px 16px";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.gap = "8px";
            card.style.transform = "none";
            card.style.boxShadow = "none";

            const name = c.name || "Yolcu";
            const fare = c.fare || 0.0;
            const soloFare = c.solo_fare || 0.0;
            const saving = c.saving || 0.0;
            const startLoc = c.current_location || "";
            const destLoc = c.destination || "";

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${name}</span>
                    <span class="route-option-badge shortest" style="background: rgba(16, 185, 129, 0.1); color: var(--success-light); font-size: 0.7rem; border-color: rgba(16, 185, 129, 0.2); font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px; margin-left: auto;">
                        Ödenen: ${fare.toFixed(2)} TL
                    </span>
                </div>
                <div style="font-size: 0.8rem; color: var(--accent-light); font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-route" style="color: var(--accent); font-size: 0.85rem;"></i> Rota: ${startLoc} ➔ ${destLoc}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px; width: 100%;">
                    <span>Tek Başına Gitseydi: <strong style="color: var(--text-secondary);">${soloFare.toFixed(2)} TL</strong></span>
                    <span style="color: var(--success-light);">Tasarruf: <strong style="color: var(--success-light); font-weight: 700;">${saving.toFixed(2)} TL</strong></span>
                </div>
            `;
            summaryList.appendChild(card);
        });

        // Show summary overlay
        summaryOverlay.classList.remove("hidden");
    } else {
        // Fallback in case elements are missing
        setTimeout(() => {
            if (activeAnimation && activeAnimation.stepCallback) {
                activeAnimation.stepCallback();
            }
        }, 1500);
    }
}

