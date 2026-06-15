// Harita üzerindeki duraklar için sabit koordinat belirlemesi (Görsel yerleşim için)
const NODE_COORDINATES = {
    "Meydan": { x: 400, y: 350 },
    "Carsi": { x: 350, y: 310 },
    "Akaretler": { x: 220, y: 380 },
    "Visnezade": { x: 180, y: 320 },
    "Dolmabahce": { x: 250, y: 450 },
    "Macka": { x: 100, y: 260 },
    "Sinanpasa": { x: 380, y: 280 },
    "Turkali": { x: 340, y: 200 },
    "Muradiye": { x: 260, y: 220 },
    "Ihlamur": { x: 300, y: 150 },
    "Abbasaga": { x: 420, y: 220 },
    "Barbaros": { x: 460, y: 250 },
    "YTU": { x: 520, y: 180 },
    "YildizParki": { x: 600, y: 220 },
    "Ciragan": { x: 520, y: 380 },
    "Ortakoy": { x: 700, y: 320 },
    "Balmumcu": { x: 600, y: 100 },
    "Dikilitas": { x: 420, y: 120 },
    "BAU": { x: 440, y: 340 },
    "EvlendirmeDairesi": { x: 380, y: 160 },
    "Karanfilkoy": { x: 680, y: 150 },
    "Kabatas": { x: 160, y: 430 },
    "Nisantasi": { x: 80, y: 200 },
    "Fulya": { x: 200, y: 100 },
    "Gayrettepe": { x: 380, y: 50 },
    "Levent": { x: 550, y: 40 },
    "Levazim": { x: 500, y: 110 },
    "Ulus": { x: 740, y: 100 },
    "Bebek": { x: 780, y: 220 },
    "Kadikoy": { x: 700, y: 650 },
    "Harem": { x: 670, y: 570 },
    "Salacak": { x: 730, y: 520 },
    "Uskudar": { x: 800, y: 480 },
    "Kuzguncuk": { x: 880, y: 460 },
    "Nakkastepe": { x: 920, y: 500 },
    "Beylerbeyi": { x: 980, y: 440 },
    "Cengelkoy": { x: 1060, y: 410 },
    "Kandilli": { x: 1140, y: 380 },
    "Camlica": { x: 950, y: 580 },
    "Umraniye": { x: 1100, y: 550 }
};

// Duraklar arası eğrisel/kıvrımlı yol yatakları koordinat listesi
const ROAD_SHAPES = {
    "Carsi-Meydan": [
        { x: 350, y: 310 },
        { x: 370, y: 330 },
        { x: 400, y: 350 }
    ],
    "Akaretler-Carsi": [
        { x: 220, y: 380 },
        { x: 270, y: 360 },
        { x: 310, y: 320 },
        { x: 350, y: 310 }
    ],
    "Dolmabahce-Meydan": [
        { x: 250, y: 450 },
        { x: 280, y: 440 },
        { x: 340, y: 390 },
        { x: 400, y: 350 }
    ],
    "Dolmabahce-Akaretler": [
        { x: 250, y: 450 },
        { x: 240, y: 410 },
        { x: 220, y: 380 }
    ],
    "Macka-Visnezade": [
        { x: 100, y: 260 },
        { x: 140, y: 280 },
        { x: 180, y: 320 }
    ],
    "Visnezade-Akaretler": [
        { x: 180, y: 320 },
        { x: 200, y: 350 },
        { x: 220, y: 380 }
    ],
    "Visnezade-Muradiye": [
        { x: 180, y: 320 },
        { x: 220, y: 270 },
        { x: 260, y: 220 }
    ],
    "Muradiye-Turkali": [
        { x: 260, y: 220 },
        { x: 300, y: 210 },
        { x: 340, y: 200 }
    ],
    "Muradiye-Ihlamur": [
        { x: 260, y: 220 },
        { x: 280, y: 185 },
        { x: 300, y: 150 }
    ],
    "Turkali-Ihlamur": [
        { x: 340, y: 200 },
        { x: 320, y: 170 },
        { x: 300, y: 150 }
    ],
    "Turkali-Abbasaga": [
        { x: 340, y: 200 },
        { x: 380, y: 210 },
        { x: 420, y: 220 }
    ],
    "Sinanpasa-Turkali": [
        { x: 380, y: 280 },
        { x: 360, y: 240 },
        { x: 340, y: 200 }
    ],
    "Carsi-Sinanpasa": [
        { x: 350, y: 310 },
        { x: 365, y: 295 },
        { x: 380, y: 280 }
    ],
    "Sinanpasa-Meydan": [
        { x: 380, y: 280 },
        { x: 390, y: 315 },
        { x: 400, y: 350 }
    ],
    "Meydan-Ciragan": [
        { x: 400, y: 350 },
        { x: 460, y: 370 },
        { x: 520, y: 380 }
    ],
    "Meydan-Barbaros": [
        { x: 400, y: 350 },
        { x: 430, y: 300 },
        { x: 460, y: 250 }
    ],
    "Sinanpasa-Barbaros": [
        { x: 380, y: 280 },
        { x: 420, y: 265 },
        { x: 460, y: 250 }
    ],
    "Abbasaga-Barbaros": [
        { x: 420, y: 220 },
        { x: 440, y: 235 },
        { x: 460, y: 250 }
    ],
    "Barbaros-YTU": [
        { x: 460, y: 250 },
        { x: 490, y: 215 },
        { x: 520, y: 180 }
    ],
    "YTU-Dikilitas": [
        { x: 520, y: 180 },
        { x: 470, y: 150 },
        { x: 420, y: 120 }
    ],
    "Ihlamur-Dikilitas": [
        { x: 300, y: 150 },
        { x: 360, y: 135 },
        { x: 420, y: 120 }
    ],
    "Dikilitas-Abbasaga": [
        { x: 420, y: 120 },
        { x: 420, y: 170 },
        { x: 420, y: 220 }
    ],
    "YTU-Balmumcu": [
        { x: 520, y: 180 },
        { x: 560, y: 140 },
        { x: 600, y: 100 }
    ],
    "Balmumcu-Dikilitas": [
        { x: 600, y: 100 },
        { x: 510, y: 110 },
        { x: 420, y: 120 }
    ],
    "YTU-YildizParki": [
        { x: 520, y: 180 },
        { x: 560, y: 200 },
        { x: 600, y: 220 }
    ],
    "YildizParki-Ciragan": [
        { x: 600, y: 220 },
        { x: 560, y: 300 },
        { x: 520, y: 380 }
    ],
    "YildizParki-Ortakoy": [
        { x: 600, y: 220 },
        { x: 650, y: 270 },
        { x: 700, y: 320 }
    ],
    "Ciragan-Ortakoy": [
        { x: 520, y: 380 },
        { x: 610, y: 350 },
        { x: 700, y: 320 }
    ],
    "Balmumcu-Ortakoy": [
        { x: 600, y: 100 },
        { x: 660, y: 210 },
        { x: 700, y: 320 }
    ],
    "BAU-Meydan": [
        { x: 440, y: 340 },
        { x: 420, y: 345 },
        { x: 400, y: 350 }
    ],
    "BAU-Barbaros": [
        { x: 440, y: 340 },
        { x: 450, y: 295 },
        { x: 460, y: 250 }
    ],
    "BAU-Ciragan": [
        { x: 440, y: 340 },
        { x: 480, y: 360 },
        { x: 520, y: 380 }
    ],
    "BAU-Sinanpasa": [
        { x: 440, y: 340 },
        { x: 410, y: 310 },
        { x: 380, y: 280 }
    ],
    "EvlendirmeDairesi-Ihlamur": [
        { x: 380, y: 160 },
        { x: 340, y: 155 },
        { x: 300, y: 150 }
    ],
    "Dikilitas-EvlendirmeDairesi": [
        { x: 420, y: 120 },
        { x: 400, y: 140 },
        { x: 380, y: 160 }
    ],
    "Abbasaga-EvlendirmeDairesi": [
        { x: 420, y: 220 },
        { x: 400, y: 190 },
        { x: 380, y: 160 }
    ],
    "Karanfilkoy-Ortakoy": [
        { x: 680, y: 150 },
        { x: 690, y: 235 },
        { x: 700, y: 320 }
    ],
    "Balmumcu-Karanfilkoy": [
        { x: 600, y: 100 },
        { x: 640, y: 125 },
        { x: 680, y: 150 }
    ]
};

// Eğrisel rota koordinatlarını çeken yardımcı fonksiyon
function getRoadPoints(u, v) {
    const key = [u, v].sort().join("-");
    const shape = ROAD_SHAPES[key];
    if (!shape) {
        return [NODE_COORDINATES[u], NODE_COORDINATES[v]];
    }
    if (u === key.split("-")[0]) {
        return [...shape];
    } else {
        return [...shape].reverse();
    }
}

