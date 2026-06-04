"""
Akıllı Taksi/Kargo Çağırma ve Rota Optimizasyonu Simülasyonu - Birim Testleri (Unit Tests)
Bu dosya sistemin temel algoritmalarını ve veri yapılarını test etmek için kullanılabilir.
"""

import unittest
from models import Graph, Customer, Vehicle
from simulation import SystemManager

class TestTaxiSimulation(unittest.TestCase):
    """
    Sistemin veri yapılarını ve algoritmalarını test eden birim test sınıfı.
    """
    def setUp(self):
        """Her test öncesi temiz bir test ortamı kurar."""
        self.manager = SystemManager()
        self.manager.initialize_system()

    def test_graph_and_routes(self):
        """Graf yapısının ve düğümlerin doğru oluşturulduğunu test eder."""
        city_map = self.manager.city_map
        # Haritadaki düğüm sayısını doğrula
        self.assertIn("Meydan", city_map.vertices)
        self.assertIn("Akaretler", city_map.vertices)
        self.assertIn("Ortakoy", city_map.vertices)
        self.assertIn("BAU", city_map.vertices)

        # Komşuluk ilişkilerini doğrula
        carsi_vertex = city_map.vertices["Carsi"]
        neighbors = [edge.target.name for edge in carsi_vertex.adjacencies]
        self.assertIn("Meydan", neighbors)
        self.assertIn("Akaretler", neighbors)
        self.assertIn("Sinanpasa", neighbors)

        # BAU komşularını doğrula
        bau_vertex = city_map.vertices["BAU"]
        bau_neighbors = [edge.target.name for edge in bau_vertex.adjacencies]
        self.assertIn("Meydan", bau_neighbors)
        self.assertIn("Barbaros", bau_neighbors)

    def test_dijkstra_shortest_path(self):
        """Dijkstra En Kısa Yol Algoritmasının doğruluğunu test eder."""
        # Akaretler -> Meydan en kısa yol testi
        # Olası yollar:
        # Akaretler -> Carsi (0.6) -> Meydan (0.4) = 1.0 km
        # Akaretler -> Carsi (0.6) -> Sinanpasa (0.5) -> Meydan (0.3) = 1.4 km
        distance, path = self.manager.find_shortest_path("Akaretler", "Meydan")
        
        self.assertAlmostEqual(distance, 1.0)
        self.assertEqual(path, ["Akaretler", "Carsi", "Meydan"])

        # Kopuk veya geçersiz rota testi
        invalid_distance, invalid_path = self.manager.find_shortest_path("Meydan", "BilinmeyenDurak")
        self.assertEqual(invalid_distance, float('inf'))
        self.assertEqual(invalid_path, [])

    def test_customer_queue(self):
        """Müşteri kuyruğu (FIFO Queue) işleyişini test eder."""
        self.assertEqual(len(self.manager.waiting_customers), 0)
        
        cust1 = Customer(1, "Ali", "Ortakoy", "Meydan")
        cust2 = Customer(2, "Ayse", "Akaretler", "Ihlamur")
        
        self.manager.add_customer_to_queue(cust1)
        self.manager.add_customer_to_queue(cust2)
        
        self.assertEqual(len(self.manager.waiting_customers), 2)
        # FIFO sırasını doğrula (İlk giren Ali olmalı)
        self.assertEqual(self.manager.waiting_customers[0].name, "Ali")

    def test_process_next_customer_matching(self):
        """Müşteriye en yakın müsait aracın doğru eşleştirilmesini test eder."""
        # Başlangıçta müsait araçlarımız:
        # 34-TAK-01: Meydan
        # 34-TAK-02: Akaretler
        # 34-TAK-03: Carsi
        # 34-TAK-05: Abbasaga
        # 34-TAK-06: YTU
        
        # Visnezade'de bir müşteri oluşturuyoruz, Akaretler'e gitmek istiyor
        # En yakın müsait araç 34-TAK-02 (Akaretler) olmalıdır:
        # Akaretler -> Visnezade direct road: 0.7 km.
        cust = Customer(10, "Fatma", "Visnezade", "Akaretler")
        self.manager.add_customer_to_queue(cust)
        
        result = self.manager.process_next_customer()
        
        self.assertTrue(result["success"])
        self.assertEqual(result["vehicle"]["id"], "34-TAK-02")
        self.assertEqual(result["pickup"]["distance"], 0.7)
        self.assertEqual(result["trip"]["distance"], 0.7)
        self.assertEqual(result["total_distance"], 1.4)

    def test_shared_carpooling_vehicle_selection(self):
        """İki benzer paylaşımlı çağrı geldiğinde en yakın aracın doğru seçildiğini test eder."""
        # Kuyruğa iki adet Akaretler -> Ortakoy müşterisi ekliyoruz
        cust1 = Customer(11, "Ahmet", "Akaretler", "Ortakoy")
        cust2 = Customer(12, "Mehmet", "Akaretler", "Ortakoy")
        self.manager.add_customer_to_queue(cust1)
        self.manager.add_customer_to_queue(cust2)

        # Müsait araçlarımız ve Akaretler'e olan alış mesafeleri:
        # 34-TAK-01: Meydan (Meydan -> Carsi -> Akaretler = 0.4 + 0.6 = 1.0 km)
        # 34-TAK-02: Akaretler (Akaretler -> Akaretler = 0 km)
        # 34-TAK-03: Carsi (Carsi -> Akaretler = 0.6 km)

        # Bu durumda en yakın araç olan 34-TAK-02 (Akaretler) seçilmelidir.
        result = self.manager.process_next_customer()

        self.assertTrue(result["success"])
        self.assertEqual(result["type"], "shared")
        self.assertEqual(result["vehicle"]["id"], "34-TAK-02")
        self.assertEqual(result["vehicle"]["start_location"], "Akaretler")
        self.assertEqual(result["vehicle"]["end_location"], "Ortakoy")

    def test_k_shortest_paths(self):
        """K-En Kısa Yol (K-Shortest Paths) algoritmasını test eder."""
        # Akaretler -> Meydan arası 3 farklı en kısa yolu bul
        k_paths = self.manager.find_k_shortest_paths("Akaretler", "Meydan", k=3)

        # En fazla 3 yol döndüğünü doğrula
        self.assertLessEqual(len(k_paths), 3)
        self.assertGreater(len(k_paths), 0)

        # Yolların mesafeye göre sıralı olduğunu doğrula
        distances = [dist for dist, path in k_paths]
        self.assertEqual(distances, sorted(distances))

        # En kısa birinci yolun doğruluğunu kontrol et
        shortest_dist, shortest_path = k_paths[0]
        self.assertAlmostEqual(shortest_dist, 1.0)
        self.assertEqual(shortest_path, ["Akaretler", "Carsi", "Meydan"])

        # Yolların birbirinden benzersiz olduğunu doğrula
        paths_tuples = [tuple(path) for dist, path in k_paths]
        self.assertEqual(len(paths_tuples), len(set(paths_tuples)))

        normal_dist, normal_path = self.manager.find_shortest_path("Akaretler", "Meydan")
        self.assertAlmostEqual(normal_dist, 1.0)
        self.assertEqual(normal_path, ["Akaretler", "Carsi", "Meydan"])

    def test_capacity_3_shared_carpooling(self):
        """3 benzer paylaşımlı çağrı geldiğinde 3'lü paylaşımlı yolculuğun (capacity 3) doğru yapıldığını test eder."""
        # Kuyruğa 3 adet Akaretler -> Ortakoy müşterisi ekliyoruz
        cust1 = Customer(21, "Ahmet", "Akaretler", "Ortakoy")
        cust2 = Customer(22, "Mehmet", "Akaretler", "Ortakoy")
        cust3 = Customer(23, "Can", "Akaretler", "Ortakoy")

        self.manager.add_customer_to_queue(cust1)
        self.manager.add_customer_to_queue(cust2)
        self.manager.add_customer_to_queue(cust3)

        # Akaretler'deki müsait araç (34-TAK-02) 3 yolcuyu da almalıdır
        result = self.manager.process_next_customer()

        self.assertTrue(result["success"])
        self.assertEqual(result["type"], "shared")
        self.assertEqual(result["vehicle"]["id"], "34-TAK-02")
        self.assertIn("customer_2", result)
        self.assertIn("customer_3", result)
        self.assertEqual(result["customer"]["name"], "Ahmet")
        self.assertEqual(result["customer_2"]["name"], "Mehmet")
        self.assertEqual(result["customer_3"]["name"], "Can")

    def test_disjoint_passenger_filtering(self):
        """Ayrık yolcu filtreleme mantığını doğrular. Bir yolcu paylaşımlı rotadaki diğer yolcularla araç içinde çakışmıyorsa rotadan ayrılır."""
        cust1 = Customer(31, "AE6", "Ortakoy", "Turkali")
        cust2 = Customer(32, "AE7", "Abbasaga", "Meydan")
        cust3 = Customer(33, "AE12", "Abbasaga", "BAU")

        self.manager.add_customer_to_queue(cust1)
        self.manager.add_customer_to_queue(cust2)
        self.manager.add_customer_to_queue(cust3)

        # AE6'nın seyahati diğerleriyle çakışmadığından solo eşleşmeli, paylaşımlı sürüşe zorlanmamalıdır.
        result = self.manager.process_next_customer()

        self.assertTrue(result["success"])
        self.assertEqual(result["type"], "solo")
        self.assertEqual(result["customer"]["name"], "AE6")

        # Kuyruktaki sonraki müşteriler (AE7 ve AE12) ise kendi aralarında çakıştığı için paylaşımlı eşleşmelidir.
        result2 = self.manager.process_next_customer()
        self.assertTrue(result2["success"])
        self.assertEqual(result2["type"], "shared")
        self.assertEqual(result2["customer"]["name"], "AE7")
        self.assertEqual(result2["customer_2"]["name"], "AE12")

    def test_selected_vehicle_matching(self):
        """Belirli bir araç plakasının seçilmesi durumunda eşleştirmenin sadece o araç için yapılacağını doğrular."""
        cust = Customer(41, "Ahmet", "Meydan", "Ortakoy")
        self.manager.add_customer_to_queue(cust)
        
        # 34-TAK-02 Akaretler'de, 34-TAK-01 Meydan'dadır. Normalde en yakın olan 34-TAK-01 seçilirdi.
        # Ancak özellikle 34-TAK-02'yi seçersek, eşleştirme onunla yapılmalıdır.
        result = self.manager.process_next_customer(selected_vehicle_id="34-TAK-02")
        
        self.assertTrue(result["success"])
        self.assertEqual(result["vehicle"]["id"], "34-TAK-02")

    def test_dynamic_segment_fare_sharing(self):
        """Segment bazlı dinamik ücret paylaşımının, solo ücretlerin ve tasarruf miktarlarının matematiksel doğruluğunu test eder."""
        # İki yolcu ekliyoruz: Aynı başlangıç ve aynı hedef (Meydan -> Ortakoy)
        cust1 = Customer(51, "Umut", "Meydan", "Ortakoy")
        cust2 = Customer(52, "Canan", "Meydan", "Ortakoy")
        self.manager.add_customer_to_queue(cust1)
        self.manager.add_customer_to_queue(cust2)

        # Meydan -> Ortakoy solo mesafesini al (Dijkstra):
        # Meydan -> Ciragan (1.2) -> Ortakoy (1.5) = 2.7 km. Solo Ücret = 13.5 dolar.
        # 34-TAK-01 Meydan'da olduğundan pickup mesafesi 0, seyahat mesafesi 2.7 km.
        result = self.manager.process_next_customer(selected_vehicle_id="34-TAK-01")

        self.assertTrue(result["success"])
        self.assertEqual(result["type"], "shared")
        
        # Her iki yolcu da aynı yolu tamamen paylaştığı için:
        # Ücret = 25.0 + (2.6 km * 8.0) / 2 = 35.4 TL.
        # Solo Ücret = 25.0 + 2.6 km * 8.0 = 45.8 TL.
        # Tasarruf = 45.8 - 35.4 = 10.4 TL.
        u_cust = result["customer"]
        c_cust = result["customer_2"]

        self.assertAlmostEqual(u_cust["fare"], 35.4)
        self.assertAlmostEqual(u_cust["solo_fare"], 45.8)
        self.assertAlmostEqual(u_cust["saving"], 10.4)

        self.assertAlmostEqual(c_cust["fare"], 35.4)
        self.assertAlmostEqual(c_cust["solo_fare"], 45.8)
        self.assertAlmostEqual(c_cust["saving"], 10.4)

    def test_savings_maximizing_and_detour_compensation(self):
        """Uzatılan yol (detour) durumunda indirimlerin ve en az %15 tasarruf garantisinin uygulandığını doğrular."""
        # İki yolcu ekliyoruz: AE6 (Ortakoy -> Turkali) ve AE7 (Abbasaga -> Meydan)
        # AE6 solo: Ortakoy -> Ciragan -> Sinanpasa -> Turkali = 1.5 + 0.8 + 0.5 = 2.8 km. Solo: 28.0 dolar.
        # AE7 solo: Abbasaga -> Barbaros -> Meydan = 0.5 + 0.8 = 1.3 km. Solo: 13.0 dolar.
        cust1 = Customer(61, "AE6", "Ortakoy", "Turkali")
        cust2 = Customer(62, "AE7", "Abbasaga", "Meydan")
        self.manager.add_customer_to_queue(cust1)
        self.manager.add_customer_to_queue(cust2)

        # En verimli taksi veya 34-TAK-01 Meydan'dayken eşleştir
        result = self.manager.process_next_customer()

        self.assertTrue(result["success"])
        if result["type"] == "shared":
            # Paylaşımlı yolculukta hiçbir yolcu solo ücretinin %85'inden fazla ödememelidir!
            # (Guaranteed at least 15% savings)
            u_cust = result["customer"]
            c_cust = result["customer_2"]
            
            self.assertLessEqual(u_cust["fare"], u_cust["solo_fare"] * 0.85)
            self.assertGreaterEqual(u_cust["saving"], u_cust["solo_fare"] * 0.15)
            
            self.assertLessEqual(c_cust["fare"], c_cust["solo_fare"] * 0.85)
            self.assertGreaterEqual(c_cust["saving"], c_cust["solo_fare"] * 0.15)

    def test_empty_miles_and_proportional_sharing(self):
        """Taksi boşken katettiği yolların (empty pickup miles) hariç tutulduğunu ve ücretlerin oransal bölündüğünü doğrular."""
        # 34-TAK-02 Akaretler'dedir.
        # Bir yolcu oluşturuyoruz: Carsi -> Meydan (Carsi -> Meydan = 0.4 km)
        # 34-TAK-02 Akaretler'den Carsi'ye yolcuyu almaya gitmek için 0.6 km seyahat eder (boş yol/pickup).
        # Yolcunun seyahati ise Carsi -> Meydan (0.4 km) sürer (aktif yol).
        # Boş yol muafiyeti sayesinde yolcu sadece 0.4 km aktif seyahat maliyetini ödemelidir!
        # Ücret = 0.4 km * 5 = 2.0 dolar.
        cust = Customer(71, "Kaya", "Carsi", "Meydan")
        self.manager.add_customer_to_queue(cust)

        # 34-TAK-02 Akaretler'dedir, Kaya'yı almak için Carsi'ye gider
        result = self.manager.process_next_customer(selected_vehicle_id="34-TAK-02")

        self.assertTrue(result["success"])
        self.assertEqual(result["vehicle"]["id"], "34-TAK-02")
        self.assertEqual(result["pickup"]["distance"], 0.6) # Boş pickup mesafesi = 0.6 km
        self.assertEqual(result["trip"]["distance"], 0.4)   # Aktif seyahat mesafesi = 0.4 km
        
        # Kaya sadece aktif mesafeyi (0.4 km) öder, 0.6 km'lik boş yolu ödemez!
        # Ücret = 25.0 + 0.4 km * 8.0 = 28.2 TL.
        self.assertAlmostEqual(result["customer"]["fare"], 28.2)
        self.assertAlmostEqual(result["customer"]["solo_fare"], 28.2)
        self.assertAlmostEqual(result["customer"]["saving"], 0.0)


if __name__ == "__main__":
    unittest.main()


