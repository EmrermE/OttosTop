"""
Akıllı Taksi/Kargo Çağırma ve Rota Optimizasyonu Simülasyonu - Sistem Yöneticisi ve Algoritmalar Modülü
Bu dosya Dijkstra En Kısa Yol Algoritmasını ve taksi eşleştirme/simülasyon yönetim süreçlerini içerir.
"""

import heapq
from collections import deque
from typing import List, Tuple, Dict, Optional
from models import Graph, Vehicle, Customer

class SystemManager:
    """
    Sistemin haritasını, araç listesini, bekleyen müşterileri yöneten 
    ve Dijkstra rotalamasını çalıştıran ana simülasyon yönetim sınıfı.
    """
    def __init__(self):
        self.city_map = Graph()
        self.local_vehicles: List[Vehicle] = []
        self.waiting_customers = deque()  # FIFO (First-In-First-Out) Kuyruğu
        self.logs: List[str] = []         # Simülasyon adımlarının logları

    def initialize_system(self):
        """
        Simülasyon için örnek bir İstanbul Haritası (Graf) oluşturur
        ve başlangıç araçlarını konumlandırır.
        """
        # Haritayı Temizle ve Kur
        self.city_map = Graph()
        self.local_vehicles = []
        self.waiting_customers = deque()
        self.logs = ["Simülasyon sistemi başlatıldı."]

        # 1. Adım: Örnek Beşiktaş Yol Ağını Oluşturma
        self.city_map.add_route("Dolmabahce", "Akaretler", 1.2)
        self.city_map.add_route("Dolmabahce", "Meydan", 0.8)
        self.city_map.add_route("Macka", "Visnezade", 0.9)
        self.city_map.add_route("Visnezade", "Akaretler", 0.7)
        self.city_map.add_route("Akaretler", "Carsi", 0.6)
        self.city_map.add_route("Carsi", "Meydan", 0.4)
        self.city_map.add_route("Carsi", "Sinanpasa", 0.5)
        self.city_map.add_route("Sinanpasa", "Meydan", 0.3)
        self.city_map.add_route("Sinanpasa", "Turkali", 1.0)
        self.city_map.add_route("Muradiye", "Turkali", 0.6)
        self.city_map.add_route("Visnezade", "Muradiye", 0.8)
        self.city_map.add_route("Muradiye", "Ihlamur", 0.7)
        self.city_map.add_route("Turkali", "Ihlamur", 0.5)
        self.city_map.add_route("Turkali", "Abbasaga", 0.8)
        self.city_map.add_route("Ihlamur", "Dikilitas", 0.9)
        self.city_map.add_route("Dikilitas", "Abbasaga", 1.1)
        self.city_map.add_route("Abbasaga", "Barbaros", 0.5)
        self.city_map.add_route("Sinanpasa", "Barbaros", 0.6)
        self.city_map.add_route("Meydan", "Ciragan", 1.2)
        self.city_map.add_route("Meydan", "Barbaros", 0.8)
        self.city_map.add_route("Barbaros", "YTU", 0.9)
        self.city_map.add_route("YTU", "Dikilitas", 1.2)
        self.city_map.add_route("YTU", "Balmumcu", 1.0)
        self.city_map.add_route("Balmumcu", "Dikilitas", 1.4)
        self.city_map.add_route("YTU", "YildizParki", 0.8)
        self.city_map.add_route("YildizParki", "Ciragan", 1.0)
        self.city_map.add_route("Ciragan", "Ortakoy", 1.5)
        self.city_map.add_route("YildizParki", "Ortakoy", 1.3)
        self.city_map.add_route("Balmumcu", "Ortakoy", 2.5)

        # Bahçeşehir Üniversitesi (BAU) ve Yeni Durak Bağlantıları
        self.city_map.add_route("BAU", "Meydan", 0.3)
        self.city_map.add_route("BAU", "Barbaros", 0.5)
        self.city_map.add_route("BAU", "Ciragan", 0.8)
        self.city_map.add_route("BAU", "Sinanpasa", 0.4)
        
        self.city_map.add_route("EvlendirmeDairesi", "Ihlamur", 0.5)
        self.city_map.add_route("EvlendirmeDairesi", "Dikilitas", 0.6)
        self.city_map.add_route("EvlendirmeDairesi", "Abbasaga", 0.7)
        
        self.city_map.add_route("Karanfilkoy", "Ortakoy", 1.8)
        self.city_map.add_route("Karanfilkoy", "Balmumcu", 1.2)

        self.logs.append("Beşiktaş Bölge Haritası oluşturuldu (21 Durak: Meydan, Carsi, Akaretler, Visnezade, Dolmabahce, Macka, Sinanpasa, Turkali, Muradiye, Ihlamur, Abbasaga, Barbaros, YTU, YildizParki, Ciragan, Ortakoy, Balmumcu, Dikilitas, BAU, EvlendirmeDairesi, Karanfilkoy).")

        # 2. Adım: Örnek Araçlar Tanımlama ve Konumlandırma
        # Plakaları ve başlangıç konumlarını belirleyip sisteme ekliyoruz.
        self.local_vehicles.append(Vehicle("34-TAK-01", "Meydan", is_available=True))
        self.local_vehicles.append(Vehicle("34-TAK-02", "Akaretler", is_available=True))
        self.local_vehicles.append(Vehicle("34-TAK-03", "Carsi", is_available=True))
        self.local_vehicles.append(Vehicle("34-TAK-04", "Ortakoy", is_available=False)) # Bu araç meşgul/başlangıçta dolu
        self.local_vehicles.append(Vehicle("34-TAK-05", "Abbasaga", is_available=True))
        self.local_vehicles.append(Vehicle("34-TAK-06", "YTU", is_available=True))

        self.logs.append(f"{len(self.local_vehicles)} adet araç (Avrupa & Asya filosu) sisteme entegre edildi.")

    def add_customer_to_queue(self, customer: Customer):
        """Yeni bir müşteriyi FIFO kuyruğuna ekler."""
        self.waiting_customers.append(customer)
        self.logs.append(f"Müşteri {customer.name} (ID: {customer.id}), kuyruğa eklendi. Başlangıç: {customer.current_location} -> Hedef: {customer.destination}")

    def find_shortest_path(self, start_name: str, end_name: str) -> Tuple[float, List[str]]:
        """
        Dijkstra Algoritmasını kullanarak iki durak arasındaki en kısa mesafeyi 
        ve geçilmesi gereken durakların sıralı listesini hesaplar.
        
        Aşağıda heap veri yapısı ile algoritmanın adım adım çalışması Türkçe açıklanmıştır.
        """
        # Haritada başlangıç ve hedef durakların olup olmadığını kontrol et
        if start_name not in self.city_map.vertices or end_name not in self.city_map.vertices:
            return float('inf'), []

        # -- DIJKSTRA ADIM 1: Mesafeler ve Rota Takip Sözlüklerinin Hazırlanması --
        # Tüm düğümlere olan mesafeleri sonsuz (infinity) olarak başlatıyoruz.
        distances = {name: float('inf') for name in self.city_map.vertices}
        # Başlangıç noktasının kendine olan mesafesi 0'dır.
        distances[start_name] = 0
        
        # En kısa yoldaki ebeveyn düğümleri takip etmek için sözlük (Geriye dönük rota oluşturmak için)
        previous_vertices = {name: None for name in self.city_map.vertices}

        # -- DIJKSTRA ADIM 2: Min-Heap (Öncelikli Kuyruk - Priority Queue) Kurulması --
        # Python'ın 'heapq' modülü min-heap yapısını destekler.
        # heapq içine (mesafe, dugum_adi) şeklinde demetler (tuple) atacağız.
        # Min-Heap her zaman en küçük mesafeye sahip düğümü en üstte (O(1) sürede) tutar.
        priority_queue = []
        heapq.heappush(priority_queue, (0, start_name))

        # -- DIJKSTRA ADIM 3: Arama Döngüsü --
        while priority_queue:
            # Öncelikli kuyruktan en küçük mesafeli düğümü çekiyoruz (Logaritmik sürede O(log V))
            current_distance, current_vertex_name = heapq.heappop(priority_queue)

            # Eğer ulaştığımız mesafe, elimizdeki güncel en kısa mesafeden büyükse bu adımı atla
            # (Çünkü daha kısa bir yol zaten bulunmuş demektir)
            if current_distance > distances[current_vertex_name]:
                continue

            # Hedef düğüme ulaştıysak aramayı erken sonlandırabiliriz (Opsiyonel optimizasyon)
            if current_vertex_name == end_name:
                break

            # Aktif düğümün tüm komşularını (Edge/Kenarlarını) tara
            current_vertex = self.city_map.vertices[current_vertex_name]
            for edge in current_vertex.adjacencies:
                neighbor_name = edge.target.name
                weight = edge.weight
                
                # Yeni toplam mesafeyi hesapla: (Aktif düğüme olan mesafe + komşu yol ağırlığı)
                distance = current_distance + weight

                # Eğer hesaplanan yeni yol, bilinen mevcut en kısa yoldan daha kısaysa güncelle
                if distance < distances[neighbor_name]:
                    distances[neighbor_name] = distance
                    previous_vertices[neighbor_name] = current_vertex_name
                    # Yeni en kısa mesafeyi öncelikli kuyruğa ekle (Heap yapısını korur)
                    heapq.heappush(priority_queue, (distance, neighbor_name))

        # -- DIJKSTRA ADIM 4: Rotanın Yeniden İnşa Edilmesi (Path Reconstruction) --
        path = []
        current = end_name
        # Hedef düğümden geriye doğru başlangıç düğümüne kadar ebeveynleri takip et
        while current is not None:
            path.append(current)
            current = previous_vertices[current]
        
        # Yol listesini ters çevirerek başlangıçtan hedefe sıralı hale getir
        path.reverse()

        # Eğer başlangıç ile hedef arasında hiçbir bağlantı yoksa mesafe sonsuz döner
        if distances[end_name] == float('inf'):
            return float('inf'), []

        return distances[end_name], path

    def process_next_customer(self, selected_vehicle_id: Optional[str] = None) -> Optional[dict]:
        """
        Paylaşımlı Yolculuk (Ride-Sharing / Carpooling) Algoritması:
        Kuyruktaki ilk müşteriyi (C1) çeker. Müsait araçlar arasından Dijkstra ile en yakın 
        olanı bulurken, kuyrukta bekleyen diğer yolcularla (C2) seyahati paylaştırıp paylaştıramayacağını
        dinamik bir VRP (Vehicle Routing Problem) ve Clarke-Wright Savings mantığıyla optimize eder.
        
        Kriterler:
        - Araç kapasitesi maksimum 2 yolcudur.
        - Paylaşımlı seyahatin toplam mesafesi, solo seyahatlerin ardışık toplamından kısa olmalıdır.
        - Her iki yolcunun da paylaşımlı seyahatteki toplam sapma (detour) mesafesi, solo direkt mesafelerinin
          en fazla 1.5 katı olmalıdır (Konfor ve Zaman Optimizasyonu).
        """
        if not self.waiting_customers:
            self.logs.append("Simülasyon Adımı: Bekleyen müşteri kuyruğu boş.")
            return None

        # 1. Müşteriyi kuyruktan al
        c1: Customer = self.waiting_customers.popleft()
        p1, d1 = c1.current_location, c1.destination

        # Müsait olan tüm araçları filtrele
        available_vehicles = [v for v in self.local_vehicles if v.is_available]

        if selected_vehicle_id and selected_vehicle_id != "any":
            available_vehicles = [v for v in available_vehicles if v.id == selected_vehicle_id]
            if not available_vehicles:
                # Müsait araç yoksa müşteriyi kuyruğa geri koy
                self.waiting_customers.appendleft(c1)
                log_msg = f"Simülasyon Adımı UYARI: Seçilen {selected_vehicle_id} taksisi meşgul veya bulunamadı! Yolcu kuyrukta bekletiliyor."
                self.logs.append(log_msg)
                return {
                    "success": False,
                    "message": f"Seçilen {selected_vehicle_id} taksisi şu anda müsait değil veya meşgul! Yolcu bekleme kuyruğuna geri alındı.",
                    "customer": c1.to_dict()
                }

        if not available_vehicles:
            # Müsait araç yoksa müşteriyi kuyruğa geri koy
            self.waiting_customers.appendleft(c1)
            log_msg = f"Simülasyon Adımı UYARI: {c1.name} için müsait taksi bulunamadı! Yolcu kuyrukta bekletiliyor."
            self.logs.append(log_msg)
            return {
                "success": False,
                "message": "Müsait araç bulunamadı. Yolcu bekleme kuyruğuna geri alındı.",
                "customer": c1.to_dict()
            }

        # İki nokta arasındaki en kısa mesafeyi Dijkstra ile çeken yardımcı fonksiyon
        def get_dist(u, v):
            d, _ = self.find_shortest_path(u, v)
            return d

        # Alt rotaları birleştirip toplam mesafe ve tam yol dönen yardımcı fonksiyon
        def get_route_and_distance(nodes_list):
            total_dist = 0.0
            full_path = []
            for i in range(len(nodes_list) - 1):
                dist, path = self.find_shortest_path(nodes_list[i], nodes_list[i+1])
                if dist == float('inf') or not path:
                    return float('inf'), []
                if i == 0:
                    full_path.extend(path)
                else:
                    full_path.extend(path[1:])
                total_dist += dist
            return total_dist, full_path

        # get_valid_action_sequences: generates all valid routing permutations
        def get_valid_action_sequences(n):
            results = []
            def backtrack(path, picked, delivered):
                if len(path) == 2 * n:
                    results.append(path[:])
                    return
                for idx in range(n):
                    if idx not in picked:
                        backtrack(path + [('pickup', idx)], picked | {idx}, delivered)
                    elif idx not in delivered:
                        backtrack(path + [('deliver', idx)], picked, delivered | {idx})
            backtrack([], set(), set())
            return results

        # evaluate_matching: calculates full route, pickups, trips and detours for a list of passengers
        def evaluate_matching(v, passengers_list):
            n = len(passengers_list)
            v_loc = v.current_location
            action_seqs = get_valid_action_sequences(n)
            
            best_seq_dist = float('inf')
            best_match_data = None
            
            solo_trips = []
            for p in passengers_list:
                s_dist = get_dist(p.current_location, p.destination)
                if s_dist == float('inf'):
                    return None
                solo_trips.append(s_dist)
                
            for seq in action_seqs:
                locs = [v_loc]
                for action_type, p_idx in seq:
                    p = passengers_list[p_idx]
                    loc = p.current_location if action_type == 'pickup' else p.destination
                    locs.append(loc)
                    
                segment_distances = []
                segment_paths = []
                valid = True
                
                for j in range(len(locs) - 1):
                    d, path = self.find_shortest_path(locs[j], locs[j+1])
                    if d == float('inf') or not path:
                        valid = False
                        break
                    segment_distances.append(d)
                    segment_paths.append(path)
                    
                if not valid:
                    continue
                    
                # Combine segment paths to get the full path of visited nodes
                full_path = []
                for idx, path in enumerate(segment_paths):
                    if idx == 0:
                        full_path.extend(path)
                    else:
                        full_path.extend(path[1:])
                        
                # Now walk through the combined full_path and simulate boarding/deboarding
                picked_up = {}  # p_idx -> node index in full_path
                delivered = {}  # p_idx -> node index in full_path
                current_passengers = set()
                active_passengers_at_step = {}  # step index -> set of p_idx
                capacity_valid = True
                capacity_limit = 3
                
                for i, node in enumerate(full_path):
                    # 1. Early Dropoffs first (if passenger is in car and we reach their destination)
                    to_remove = set()
                    for p_idx in current_passengers:
                        if passengers_list[p_idx].destination == node:
                            delivered[p_idx] = i
                            to_remove.add(p_idx)
                    current_passengers -= to_remove
                    
                    # 2. Pickups second (if passenger starts here and we haven't picked them up yet)
                    for p_idx in range(n):
                        if p_idx not in picked_up and passengers_list[p_idx].current_location == node:
                            picked_up[p_idx] = i
                            current_passengers.add(p_idx)
                            
                    # Record current passengers traveling on the segment after node `i`
                    active_passengers_at_step[i] = set(current_passengers)
                    
                    # Check capacity limit
                    if len(current_passengers) > capacity_limit:
                        capacity_valid = False
                        break
                        
                if not capacity_valid:
                    continue
                    
                # Check if all passengers were picked up and delivered
                if len(picked_up) != n or len(delivered) != n:
                    continue
                    
                # Disjoint Passenger Check: If n >= 2, no passenger should have a solo-only trip (never overlaps with any other passenger)
                if n >= 2:
                    disjoint_found = False
                    for p_idx in range(n):
                        p_start = picked_up[p_idx]
                        p_end = delivered[p_idx]
                        
                        max_occupancy = 0
                        # They are in the car while moving on segments from step p_start to p_end
                        for step_idx in range(p_start, p_end):
                            occ_size = len(active_passengers_at_step.get(step_idx, set()))
                            if occ_size > max_occupancy:
                                max_occupancy = occ_size
                                
                        if max_occupancy <= 1:
                            disjoint_found = True
                            break
                            
                    if disjoint_found:
                        continue
                    
                # Truncate the path at the last delivery node
                last_delivery_idx = max(delivered.values())
                actual_path = full_path[:last_delivery_idx + 1]
                
                # Calculate actual total distance of the truncated path
                actual_total_dist = 0.0
                for i in range(len(actual_path) - 1):
                    actual_total_dist += get_dist(actual_path[i], actual_path[i+1])
                    
                # Calculate actual travel distance for each passenger and check detours
                detour_valid = True
                detour_limit = 1.3 if n == 3 else 1.5
                
                for p_idx in range(n):
                    p_travel_dist = 0.0
                    for i in range(picked_up[p_idx], delivered[p_idx]):
                        p_travel_dist += get_dist(full_path[i], full_path[i+1])
                    if p_travel_dist > detour_limit * solo_trips[p_idx]:
                        detour_valid = False
                        break
                        
                if not detour_valid:
                    continue
                    
                if actual_total_dist < best_seq_dist:
                    best_seq_dist = actual_total_dist
                    
                    # Find last pickup node index in actual_path
                    last_pickup_idx = max(picked_up.values())
                    
                    pickup_route = actual_path[:last_pickup_idx + 1]
                    trip_route = actual_path[last_pickup_idx:]
                    
                    pickup_dist = sum(get_dist(pickup_route[i], pickup_route[i+1]) for i in range(len(pickup_route) - 1))
                    trip_dist = sum(get_dist(trip_route[i], trip_route[i+1]) for i in range(len(trip_route) - 1))
                    
                    # 1. Calculate total active travel distance (only segments containing at least 1 passenger)
                    active_distance = 0.0
                    for idx_step in range(len(actual_path) - 1):
                        segment_dist = get_dist(actual_path[idx_step], actual_path[idx_step+1])
                        passengers_in_car = active_passengers_at_step.get(idx_step, set())
                        if len(passengers_in_car) > 0:
                            active_distance += segment_dist
                            
                    total_active_cost = active_distance * 10.0
                    
                    # 2. Calculate individual travel distance inside the taxi for each passenger
                    travel_distances = {p_idx: 0.0 for p_idx in range(n)}
                    for p_idx in range(n):
                        t_dist = 0.0
                        for i in range(picked_up[p_idx], delivered[p_idx]):
                            t_dist += get_dist(full_path[i], full_path[i+1])
                        travel_distances[p_idx] = t_dist
                        
                    sum_travel_distances = sum(travel_distances.values())
                    
                    # 3. Share the total active cost proportionally to individual travel distances and apply sustainable discounts
                    discounted_fares = {p_idx: 0.0 for p_idx in range(n)}
                    for p_idx in range(n):
                        p = passengers_list[p_idx]
                        solo_dist = solo_trips[p_idx]
                        solo_fare = solo_dist * 10.0
                        
                        travel_dist = travel_distances[p_idx]
                        if sum_travel_distances > 0:
                            proportion = travel_dist / sum_travel_distances
                        else:
                            proportion = 1.0 / n
                            
                        # Proportional share of the active trip cost
                        raw_share = proportion * total_active_cost
                        
                        if n >= 2:
                            # Proportional share capped at direct solo fare to guarantee they never pay more than traveling alone
                            final_fare = min(raw_share, solo_fare)
                        else:
                            # Solo rides pay their full solo fare
                            final_fare = solo_fare
                            
                        discounted_fares[p_idx] = final_fare
                    
                    best_match_data = {
                        "pickup": {
                            "distance": pickup_dist,
                            "route": pickup_route
                        },
                        "trip": {
                            "distance": trip_dist,
                            "route": trip_route
                        },
                        "total_distance": actual_total_dist,
                        "fares": {passengers_list[p_idx].id: discounted_fares[p_idx] for p_idx in range(n)}
                    }
                    
            return best_match_data

        # 1. ADIM: Tüm eşleşme adaylarını (solo, 2'li paylaşımlı ve 3'lü paylaşımlı) ve verimlilik skorlarını topla.
        # Denklem: Verimlilik Skoru = Yolcu Sayısı / Toplam Mesafe
        candidates = []

        # 1.1. Yolcu Kombinasyonlarını oluştur: [c1], [c1, c2], [c1, c2, c3]
        passenger_combos = [[c1]]
        
        # 2'li kombinasyonlar
        for i, c2 in enumerate(self.waiting_customers):
            passenger_combos.append([c1, c2])
            
        # 3'lü kombinasyonlar (Kapasite 3'e yükseltildi!)
        for i in range(len(self.waiting_customers)):
            for j in range(i + 1, len(self.waiting_customers)):
                c2 = self.waiting_customers[i]
                c3 = self.waiting_customers[j]
                passenger_combos.append([c1, c2, c3])

        # Her kombinasyon ve her müsait araç için rota ve skor hesapla
        for combo in passenger_combos:
            num_passengers = len(combo)
            for v in available_vehicles:
                match_data = evaluate_matching(v, combo)
                if match_data:
                    # Calculate total savings for this candidate
                    solo_sum = 0.0
                    for p in combo:
                        solo_d = get_dist(p.current_location, p.destination)
                        solo_sum += solo_d * 10.0 if solo_d != float('inf') else 0.0
                    
                    shared_sum = sum(match_data["fares"].values())
                    total_savings = max(0.0, solo_sum - shared_sum)
                    
                    # Savings-maximizing score: prioritize routes that save customers the most money!
                    # We subtract a tiny fraction of total_distance to choose the shorter route in case of tie.
                    score = total_savings - 0.001 * match_data["total_distance"]
                    
                    candidates.append({
                        "combo": combo,
                        "vehicle": v,
                        "pickup": match_data["pickup"],
                        "trip": match_data["trip"],
                        "total_distance": match_data["total_distance"],
                        "score": score,
                        "fares": match_data["fares"],
                        "total_savings": total_savings
                    })

        # Adayları verimlilik skoruna göre azalan sırayla diz
        candidates.sort(key=lambda x: x["score"], reverse=True)

        # 2. ADIM: En Verimli Eşleşmeyi Uygula ve Durumları Güncelle
        if not candidates:
            # Ulaşılamaz rota vb. durumlarda (kopuk graf)
            self.waiting_customers.appendleft(c1)
            return {
                "success": False,
                "message": "Hiçbir müsait taksi yolcunun bulunduğu durağa ulaşamıyor.",
                "customer": c1.to_dict()
            }

        best_match = candidates[0]
        combo = best_match["combo"]
        v = best_match["vehicle"]
        old_loc = v.current_location

        # Eşleşen ek müşterileri kuyruktan çıkart
        matched_additional_customers = []
        for extra_c in combo[1:]:
            matched_idx = -1
            for idx, c in enumerate(self.waiting_customers):
                if c.id == extra_c.id:
                    matched_idx = idx
                    break
            if matched_idx != -1:
                matched_additional_customers.append(self.waiting_customers[matched_idx])
                del self.waiting_customers[matched_idx]

        # Aracı meşgul et ve içindeki yolcuları tanımla
        v.active_customers = combo[:]
        v.is_available = False
        
        # Seyahat bitişinde araç en son teslimat durağına yerleşecek
        final_destination = best_match["trip"]["route"][-1]
        v.current_location = final_destination

        # Loglama
        passenger_names = " ve ".join([c.name for c in combo])
        if len(combo) > 1:
            # Rota tasarrufu hesabı için tüm müşterilerin en iyi solo mesafeleri toplamını al
            solo_sum = 0.0
            for p in combo:
                best_p_solo = float('inf')
                for v_temp in available_vehicles:
                    d_p = get_dist(v_temp.current_location, p.current_location) + get_dist(p.current_location, p.destination)
                    if d_p < best_p_solo:
                        best_p_solo = d_p
                if best_p_solo != float('inf'):
                    solo_sum += best_p_solo
            savings = solo_sum - best_match["total_distance"] if solo_sum != float('inf') else 0.0
            
            match_log = (
                f"{len(combo)}'LÜ PAYLAŞIMLI YOLCULUK (Verimlilik Skoru: {best_match['score']:.4f}): {passenger_names} yolcuları {v.id} taksisinde buluştu! "
                f"Araç Başlangıç: {old_loc}. Alış Rotası: {'->'.join(best_match['pickup']['route'])} ({best_match['pickup']['distance']:.2f} km). "
                f"Seyahat Paylaşımlı Rota: {'->'.join(best_match['trip']['route'])} ({best_match['trip']['distance']:.2f} km). "
                f"Toplam Mesafe: {best_match['total_distance']:.2f} km (Rota Optimizasyonu Tasarrufu: {savings:.2f} km!)."
            )
        else:
            savings = 0.0
            match_log = (
                f"EŞLEŞME BAŞARILI (Verimlilik Skoru: {best_match['score']:.4f}): {c1.name} ile {v.id} eşleşti. "
                f"Araç Başlangıç: {old_loc} -> Yolcu Konumu: {p1} (Alış Mesafesi: {best_match['pickup']['distance']:.2f} km, Rota: {'->'.join(best_match['pickup']['route'])}). "
                f"Seyahat Rotası: {p1} -> {d1} (Seyahat Mesafesi: {best_match['trip']['distance']:.2f} km, Rota: {'->'.join(best_match['trip']['route'])})."
            )
        self.logs.append(match_log)

        # Bir sonraki simülasyon adımı için aracı tekrar serbest bırak ve yolcuları indir
        v.active_customers = []
        v.is_available = True

        # Select distinct options to return in trip_alternatives (3-passenger, 2-passenger, solo)
        v_candidates = [c for c in candidates if c["vehicle"].id == v.id]
        
        # Group them by passenger count
        candidates_by_count = {}
        for c in v_candidates:
            count = len(c["combo"])
            if count not in candidates_by_count:
                candidates_by_count[count] = []
            candidates_by_count[count].append(c)
            
        options = []
        
        # 1. Best match is always Option 1
        options.append(best_match)
        best_count = len(best_match["combo"])
        
        # 2. Add other passenger count options (3, 2, 1)
        for count in [3, 2, 1]:
            if count == best_count:
                continue
            if count in candidates_by_count and candidates_by_count[count]:
                options.append(candidates_by_count[count][0])
                
        # 3. Fill with alternative paths using KSP of the solo route if less than 3
        if len(options) < 3:
            solo_alts = self.find_k_shortest_paths(c1.current_location, c1.destination, k=3)
            solo_cand = candidates_by_count.get(1, [None])[0]
            if solo_cand:
                for dist, path in solo_alts:
                    # check if this path is already added (compare trip routes)
                    exists = False
                    for opt in options:
                        if len(opt["combo"]) == 1 and opt["trip"]["route"] == path:
                            exists = True
                            break
                    if not exists:
                        options.append({
                            "combo": [c1],
                            "vehicle": v,
                            "pickup": solo_cand["pickup"],
                            "trip": {"distance": dist, "route": path},
                            "total_distance": solo_cand["pickup"]["distance"] + dist,
                            "score": 1.0 / (solo_cand["pickup"]["distance"] + dist),
                            "fares": {c1.id: dist * 10.0}
                        })
                        if len(options) == 3:
                            break

        # Map to structured trip_alternatives list
        trip_alternatives = []
        for idx, opt in enumerate(options):
            opt_combo = opt["combo"]
            opt_count = len(opt_combo)
            
            # Calculate savings
            opt_savings = 0.0
            if opt_count > 1:
                solo_sum = 0.0
                for p in opt_combo:
                    best_p_solo = float('inf')
                    for v_temp in available_vehicles:
                        d_p = get_dist(v_temp.current_location, p.current_location) + get_dist(p.current_location, p.destination)
                        if d_p < best_p_solo:
                            best_p_solo = d_p
                    if best_p_solo != float('inf'):
                        solo_sum += best_p_solo
                opt_savings = solo_sum - opt["total_distance"] if solo_sum != float('inf') else 0.0
            
            opt_fares = opt.get("fares", {})
            opt_customers = []
            for p in opt_combo:
                p_dict = p.to_dict()
                fare_val = opt_fares.get(p.id, 0.0)
                solo_dist = get_dist(p.current_location, p.destination)
                solo_fare_val = solo_dist * 10.0 if solo_dist != float('inf') else 0.0
                p_dict["fare"] = fare_val
                p_dict["solo_fare"] = solo_fare_val
                p_dict["saving"] = max(0.0, solo_fare_val - fare_val)
                opt_customers.append(p_dict)

            trip_alternatives.append({
                "type": "shared" if opt_count > 1 else "solo",
                "badge_class": "shortest" if idx == 0 else "alternative",
                "badge_text": "",
                "pickup": opt["pickup"],
                "trip": opt["trip"],
                "total_distance": opt["total_distance"],
                "passenger_count": opt_count,
                "customers": opt_customers,
                "savings": opt_savings,
                "score": opt["score"]
            })

        # Sort trip_alternatives by score descending so they are in efficiency order (km per passenger)
        trip_alternatives.sort(key=lambda x: x["score"], reverse=True)

        # Set final badges and texts after sorting
        for idx, alt in enumerate(trip_alternatives):
            opt_count = alt["passenger_count"]
            if idx == 0:
                alt["badge_class"] = "shortest"
                alt["badge_text"] = f"En Verimli Rota ({opt_count} Kişilik)" if opt_count > 1 else "En Kısa Rota (Solo)"
            else:
                alt["badge_class"] = "alternative"
                if opt_count == 3:
                    alt["badge_text"] = "Alternatif 3 Kişilik Rota"
                elif opt_count == 2:
                    alt["badge_text"] = "Alternatif 2 Kişilik Rota"
                else:
                    alt["badge_text"] = f"Alternatif Rota {idx} (Solo)"


        best_fares = best_match.get("fares", {})

        def get_customer_extended_dict(cust):
            c_dict = cust.to_dict()
            fare_val = best_fares.get(cust.id, 0.0)
            solo_dist = get_dist(cust.current_location, cust.destination)
            solo_fare_val = solo_dist * 10.0 if solo_dist != float('inf') else 0.0
            c_dict["fare"] = fare_val
            c_dict["solo_fare"] = solo_fare_val
            c_dict["saving"] = max(0.0, solo_fare_val - fare_val)
            return c_dict

        response_dict = {
            "success": True,
            "type": "shared" if len(combo) > 1 else "solo",
            "customer": get_customer_extended_dict(c1),
            "vehicle": {
                "id": v.id,
                "start_location": old_loc,
                "end_location": final_destination
            },
            "pickup": best_match["pickup"],
            "trip": best_match["trip"],
            "trip_alternatives": trip_alternatives,
            "total_distance": best_match["total_distance"],
            "savings": savings,
            "score": best_match["score"],
            "log": match_log
        }
        
        if len(combo) >= 2:
            response_dict["customer_2"] = get_customer_extended_dict(combo[1])
        if len(combo) >= 3:
            response_dict["customer_3"] = get_customer_extended_dict(combo[2])
            
        return response_dict


    def find_k_shortest_paths(self, start_name: str, end_name: str, k: int = 3) -> List[Tuple[float, List[str]]]:
        """
        Dijkstra tabanlı K-En Kısa Yol (K-Shortest Paths) algoritması (Yen's Algorithm basitleştirilmiş versiyonu).
        Belirtilen başlangıç ve bitiş düğümleri arasında k adet alternatif en kısa rotayı bulur.
        """
        if start_name not in self.city_map.vertices or end_name not in self.city_map.vertices:
            return []

        # 1. En kısa birinci yolu bul
        dist, path = self.find_shortest_path(start_name, end_name)
        if dist == float('inf') or not path:
            return []

        A = [(dist, path)]
        B = []

        for i in range(1, k):
            # A[i-1] yolunun her bir düğümünü (sapma düğümü) kontrol et
            for j in range(len(A[i-1][1]) - 1):
                spur_node = A[i-1][1][j]
                root_path = A[i-1][1][:j+1]

                # Geçici olarak kenarları ve düğümleri kaldıracağız
                removed_edges = []
                
                # A'daki mevcut tüm yollardan, spur_node'dan sonraki kenarı kaldır
                for _, path_a in A:
                    if len(path_a) > j and path_a[:j+1] == root_path:
                        u = path_a[j]
                        v = path_a[j+1]
                        u_vertex = self.city_map.vertices[u]
                        for edge in list(u_vertex.adjacencies):
                            if edge.target.name == v:
                                u_vertex.adjacencies.remove(edge)
                                removed_edges.append((u, edge))

                # root_path üzerindeki düğümleri (spur_node hariç) geçici olarak kaldır
                removed_nodes = []
                for node in root_path[:-1]:
                    if node in self.city_map.vertices:
                        vertex = self.city_map.vertices[node]
                        removed_nodes.append((node, vertex.adjacencies))
                        vertex.adjacencies = []

                # spur_path'i bul spur_node -> end_name
                spur_dist, spur_path = self.find_shortest_path(spur_node, end_name)

                # Geri yükle
                for node, adjs in removed_nodes:
                    self.city_map.vertices[node].adjacencies = adjs
                for u, edge in removed_edges:
                    self.city_map.vertices[u].adjacencies.append(edge)

                if spur_dist != float('inf') and spur_path:
                    total_path = root_path[:-1] + spur_path
                    total_dist = 0.0
                    for m in range(len(total_path) - 1):
                        d, _ = self.find_shortest_path(total_path[m], total_path[m+1])
                        total_dist += d
                    
                    # Eğer bu yol B'de veya A'da yoksa ekle
                    if total_path not in [p for _, p in A] and total_path not in [p for _, p in B]:
                        B.append((total_dist, total_path))

            if not B:
                break

            # B'yi mesafeye göre sırala ve en kısasını A'ya taşı
            B.sort(key=lambda x: x[0])
            A.append(B.pop(0))

        return A

