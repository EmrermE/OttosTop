// Global Durum Değişkenleri
let systemState = {
    cityMap: {},
    vehicles: [],
    waitingCustomers: [],
    logs: [],
    lastMatchedRoute: null,
    randomCallCount: 0
};

// Animasyon Değişkenleri
let activeAnimation = null; // { vehicleId, pickupRoute: [], tripRoute: [], progress: 0, phase: 'pickup'|'trip', stepCallback }

// Zoom & Pan Kontrol Değişkenleri
let zoomScale = 0.85;
let panOffset = { x: 0, y: 0 };
let isDraggingMap = false;
let mapDragStart = { x: 0, y: 0 };


let pendingStep = null;

// Tema Renk Paletleri
const THEME_COLORS = {
    light: {
        success: "#34c759",       // Müsait Taksi - Yeşil
        successGlow: "rgba(52, 199, 89, 0.2)",
        danger: "#ff3b30",        // Meşgul Taksi - Kırmızı
        dangerGlow: "rgba(255, 59, 48, 0.2)",
        warning: "#ff9500",       // Müşteri Konumu - Turuncu
        warningGlow: "rgba(255, 149, 0, 0.3)",
        primary: "#0071e3",        // Hedef Konum - Mavi
        primaryGlow: "rgba(0, 113, 227, 0.3)",
        nodeDefault: "#8e8e93",    // Durak - Gri
        nodeGlow: "rgba(142, 142, 147, 0.15)",
        text: "#1d1d1f",
        road: "rgba(0, 0, 0, 0.08)",
        roadActivePickup: "rgba(52, 199, 89, 0.85)",
        roadActiveTrip: "rgba(52, 199, 89, 0.95)",
        textActive: "rgba(52, 199, 89, 1)",
        textInactive: "rgba(0, 0, 0, 0.45)",
        sea: "#bae6fd",            // Deniz Mavisi
        coast: "rgba(14, 165, 233, 0.25)",
        land: "#f3f4f6",           // Açık Gri Kara Parçası
        park: "rgba(34, 197, 94, 0.12)",   // Parklar ve Ormanlar
        parkStroke: "rgba(34, 197, 94, 0.25)"
    },
    dark: {
        success: "#10b981",       // Müsait Taksi - Yeşil
        successGlow: "rgba(16, 185, 129, 0.25)",
        danger: "#ef4444",        // Meşgul Taksi - Kırmızı
        dangerGlow: "rgba(239, 68, 68, 0.4)",
        warning: "#f59e0b",       // Müşteri Konumu - Turuncu
        warningGlow: "rgba(245, 158, 11, 0.6)",
        primary: "#3b82f6",        // Hedef Konum - Mavi
        primaryGlow: "rgba(59, 130, 246, 0.6)",
        nodeDefault: "#4b5563",    // Durak - Gri
        nodeGlow: "rgba(107, 114, 128, 0.3)",
        text: "#ffffff",
        road: "rgba(255, 255, 255, 0.08)",
        roadActivePickup: "rgba(16, 185, 129, 0.85)",
        roadActiveTrip: "rgba(16, 185, 129, 0.95)",
        textActive: "#38bdf8",
        textInactive: "rgba(255, 255, 255, 0.35)",
        sea: "#0f172a",            // Derin Gece Mavisi Deniz
        coast: "rgba(56, 189, 248, 0.12)",
        land: "#0b0f19",           //Koyu Arayüz Karası
        park: "rgba(16, 185, 129, 0.06)",
        parkStroke: "rgba(16, 185, 129, 0.12)"
    }
};

