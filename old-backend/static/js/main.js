
window.addEventListener("load", () => {
    // Tema yükleme ve kontrolü
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
    }
    updateThemeUI();

    resizeCanvas();
    resetPanOffset();
    fetchSystemStatus(true); // Durumu al ve dropdownları doldur

    // Pencere boyutu değiştiğinde canvası yeniden ayarla
    window.addEventListener("resize", () => {
        resizeCanvas();
        drawMap();
    });

    // Event Dinleyicileri
    customerForm.addEventListener("submit", handleAddCustomer);
    const btnRandomCustomer = document.getElementById("btn-random-customer");
    if (btnRandomCustomer) {
        btnRandomCustomer.addEventListener("click", handleAddRandomCustomer);
    }
    btnStep.addEventListener("click", handleSimulationStep);
    btnReset.addEventListener("click", handleResetSystem);
    btnClearLogs.addEventListener("click", () => {
        systemLogsContainer.innerHTML = `<div class="log-line">Konsol temizlendi.</div>`;
    });

    // Tema Değiştirme Dinleyicisi
    btnThemeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        const isLight = document.body.classList.contains("light-theme");
        localStorage.setItem("theme", isLight ? "light" : "dark");
        updateThemeUI();
        drawMap(); // Haritayı yeni renklere göre yeniden çizdir
    });

    // --- SÜRÜKLE-BIRAK VE ZOOM ÖZELLİKLERİ ETKİNLEŞTİRİLDİ ---
    canvas.style.cursor = "grab";

    // Mouse sürükleme ile harita taşıma (Pan)
    canvas.addEventListener("mousedown", (e) => {
        isDraggingMap = true;
        mapDragStart.x = e.clientX - panOffset.x;
        mapDragStart.y = e.clientY - panOffset.y;
        canvas.style.cursor = "grabbing";
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!isDraggingMap) return;
        panOffset.x = e.clientX - mapDragStart.x;
        panOffset.y = e.clientY - mapDragStart.y;
        clampPanOffset();
        drawMap();
    });

    const endDrag = () => {
        if (isDraggingMap) {
            isDraggingMap = false;
            canvas.style.cursor = "grab";
        }
    };
    canvas.addEventListener("mouseup", endDrag);
    canvas.addEventListener("mouseleave", endDrag);

    // Mouse tekerleği ile cursor merkezli yakınlaşma/uzaklaşma (Zoom)
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomIntensity = 0.08;
        const oldScale = zoomScale;

        if (e.deltaY < 0) {
            zoomScale = Math.min(zoomScale + zoomIntensity, 3.0);
        } else {
            zoomScale = Math.max(zoomScale - zoomIntensity, 0.8);
        }

        panOffset.x = mouseX - (mouseX - panOffset.x) * (zoomScale / oldScale);
        panOffset.y = mouseY - (mouseY - panOffset.y) * (zoomScale / oldScale);

        clampPanOffset();
        drawMap();
    });

    // DOKUNMATIK EKRAN DESTEĞİ
    let lastTouchDist = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    let isTouchPanning = false;

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            isTouchPanning = true;
            mapDragStart.x = e.touches[0].clientX - panOffset.x;
            mapDragStart.y = e.touches[0].clientY - panOffset.y;
        } else if (e.touches.length === 2) {
            isTouchPanning = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist = Math.sqrt(dx * dx + dy * dy);
            lastTouchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
        }
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isTouchPanning) {
            panOffset.x = e.touches[0].clientX - mapDragStart.x;
            panOffset.y = e.touches[0].clientY - mapDragStart.y;
            clampPanOffset();
            drawMap();
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.sqrt(dx * dx + dy * dy);

            if (lastTouchDist > 0) {
                const rect = canvas.getBoundingClientRect();
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

                const oldScale = zoomScale;
                const scaleFactor = newDist / lastTouchDist;
                zoomScale = Math.max(0.8, Math.min(3.0, zoomScale * scaleFactor));

                panOffset.x = centerX - (centerX - panOffset.x) * (zoomScale / oldScale);
                panOffset.y = centerY - (centerY - panOffset.y) * (zoomScale / oldScale);
                clampPanOffset();
                drawMap();
            }
            lastTouchDist = newDist;
        }
    }, { passive: false });

    canvas.addEventListener("touchend", (e) => {
        if (e.touches.length < 2) {
            lastTouchDist = 0;
        }
        if (e.touches.length === 0) {
            isTouchPanning = false;
        }
    });

    // Çift tıklama ile zoom ve pan sıfırlama (Reset)
    canvas.addEventListener("dblclick", () => {
        zoomScale = 0.85;
        resetPanOffset();
        drawMap();
    });


    // Durdur/İptal Et Buton Dinleyicisi
    const btnStopAnim = document.getElementById("btn-stop-anim");
    if (btnStopAnim) {
        btnStopAnim.addEventListener("click", handleStopAnimation);
    }

    // Yolculuk Özeti Kapatma Dinleyicisi
    const btnCloseSummary = document.getElementById("btn-close-summary");
    if (btnCloseSummary) {
        btnCloseSummary.addEventListener("click", () => {
            const summaryOverlay = document.getElementById("trip-summary-overlay");
            if (summaryOverlay) summaryOverlay.classList.add("hidden");

            // Haritadan seçilen rotayı temizle
            systemState.lastMatchedRoute = null;
            drawMap();

            if (activeAnimation && activeAnimation.stepCallback) {
                activeAnimation.stepCallback();
            }
        });
    }

    function updateThemeUI() {
        const isLight = document.body.classList.contains("light-theme");
        if (isLight) {
            btnThemeToggle.innerHTML = '<i class="fa-solid fa-sun"></i> Aydınlık Tema';
        } else {
            btnThemeToggle.innerHTML = '<i class="fa-solid fa-moon"></i> Koyu Tema';
        }
    }
});

// Canvas Boyutlandırma
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}
