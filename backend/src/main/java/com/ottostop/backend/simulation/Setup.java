package com.ottostop.backend.simulation;

import com.ottostop.backend.models.Vehicle;

public class Setup {
    public static void initializeSystem(SimulationManager manager) {
        manager.getCityMap().getVertices().clear();
        manager.getLocalVehicles().clear();
        manager.getWaitingCustomers().clear();
        manager.getLogs().clear();
        manager.getPathCache().clear();

        manager.addLog("Simülasyon sistemi başlatıldı.");

        Object[][] routes = {
                {"Dolmabahce", "Akaretler", 1.2},
                {"Dolmabahce", "Meydan", 0.8},
                {"Macka", "Visnezade", 0.9},
                {"Visnezade", "Akaretler", 0.7},
                {"Akaretler", "Carsi", 0.6},
                {"Carsi", "Meydan", 0.4},
                {"Carsi", "Sinanpasa", 0.5},
                {"Sinanpasa", "Meydan", 0.3},
                {"Sinanpasa", "Turkali", 1.0},
                {"Muradiye", "Turkali", 0.6},
                {"Visnezade", "Muradiye", 0.8},
                {"Muradiye", "Ihlamur", 0.7},
                {"Turkali", "Ihlamur", 0.5},
                {"Turkali", "Abbasaga", 0.8},
                {"Ihlamur", "Dikilitas", 0.9},
                {"Dikilitas", "Abbasaga", 1.1},
                {"Abbasaga", "Barbaros", 0.5},
                {"Sinanpasa", "Barbaros", 0.6},
                {"Meydan", "Ciragan", 1.2},
                {"Meydan", "Barbaros", 0.8},
                {"Barbaros", "YTU", 0.9},
                {"YTU", "Dikilitas", 1.2},
                {"YTU", "Balmumcu", 1.0},
                {"Balmumcu", "Dikilitas", 1.4},
                {"YTU", "YildizParki", 0.8},
                {"YildizParki", "Ciragan", 1.0},
                {"Ciragan", "Ortakoy", 1.5},
                {"YildizParki", "Ortakoy", 1.3},
                {"Balmumcu", "Ortakoy", 2.5},
                {"BAU", "Meydan", 0.3},
                {"BAU", "Barbaros", 0.5},
                {"BAU", "Ciragan", 0.8},
                {"BAU", "Sinanpasa", 0.4},
                {"EvlendirmeDairesi", "Ihlamur", 0.5},
                {"EvlendirmeDairesi", "Dikilitas", 0.6},
                {"EvlendirmeDairesi", "Abbasaga", 0.7},
                {"Karanfilkoy", "Ortakoy", 1.8},
                {"Karanfilkoy", "Balmumcu", 1.2},
                {"Kabatas", "Dolmabahce", 0.8},
                {"Kabatas", "Macka", 1.4},
                {"Nisantasi", "Macka", 0.7},
                {"Nisantasi", "Visnezade", 1.0},
                {"Fulya", "Muradiye", 0.9},
                {"Fulya", "Ihlamur", 0.6},
                {"Gayrettepe", "Dikilitas", 0.8},
                {"Gayrettepe", "Balmumcu", 1.1},
                {"Gayrettepe", "Levazim", 0.9},
                {"Levazim", "Balmumcu", 0.7},
                {"Levazim", "YTU", 0.8},
                {"Levent", "Levazim", 1.0},
                {"Levent", "Karanfilkoy", 1.2},
                {"Ulus", "Karanfilkoy", 0.8},
                {"Ulus", "Ortakoy", 1.4},
                {"Ulus", "Bebek", 1.1},
                {"Bebek", "Ortakoy", 1.2},
                {"Uskudar", "Ortakoy", 2.8},
                {"Harem", "Uskudar", 1.8},
                {"Harem", "Kadikoy", 2.0},
                {"Salacak", "Uskudar", 1.0},
                {"Salacak", "Harem", 1.5},
                {"Kadikoy", "Uskudar", 3.5},
                {"Kuzguncuk", "Uskudar", 1.2},
                {"Kuzguncuk", "Nakkastepe", 0.9},
                {"Kuzguncuk", "Beylerbeyi", 1.5},
                {"Nakkastepe", "Beylerbeyi", 1.1},
                {"Beylerbeyi", "Cengelkoy", 1.8},
                {"Cengelkoy", "Kandilli", 2.0},
                {"Kadikoy", "Camlica", 2.5},
                {"Uskudar", "Camlica", 2.2},
                {"Camlica", "Umraniye", 3.0},
                {"Nakkastepe", "Camlica", 1.5}
        };

        for (Object[] route : routes) {
            manager.getCityMap().addRoute((String) route[0], (String) route[1], (Double) route[2], true);
        }

        manager.addLog("Beşiktaş & Boğaziçi Bölge Haritası oluşturuldu.");

        manager.getLocalVehicles().add(new Vehicle("34-TAK-01", "Meydan", true));
        manager.getLocalVehicles().add(new Vehicle("34-TAK-02", "Akaretler", true));
        manager.getLocalVehicles().add(new Vehicle("34-TAK-03", "Carsi", true));
        manager.getLocalVehicles().add(new Vehicle("34-TAK-04", "Ortakoy", false));
        manager.getLocalVehicles().add(new Vehicle("34-TAK-05", "Abbasaga", true));
        manager.getLocalVehicles().add(new Vehicle("34-TAK-06", "YTU", true));

        manager.addLog(manager.getLocalVehicles().size() + " adet araç (Avrupa & Asya filosu) sisteme entegre edildi.");
    }
}
