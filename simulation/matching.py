from typing import Optional, List, Tuple
from models import Customer

# =============================================
# BÖLÜM 1: YARDIMCI FONKSİYONLAR
# =============================================

def _calculate_distance(manager, u: str, v: str) -> float:
    """İki nokta arasındaki en kısa mesafeyi getirir."""
    dist, _ = manager.find_shortest_path(u, v)
    return dist
 

def _generate_route_permutations(num_passengers: int) -> List[List[Tuple[str, int]]]:
    """
    Yolcuların araca biniş (pickup) ve iniş (deliver) sıralarını belirleyen 
    tüm geçerli kombinasyonları (permutasyonları) oluşturur.
    
    Burada recursive bir fonksiyonla tree search yapıyoruz.
    Örn: 2 yolcu için P0 (Yolcu 0 Biniş), D0 (Yolcu 0 İniş).
    Kural: Bir yolcu araca binmeden inemez. (Önce P, Sonra D olmak zorundadır).
    """
    results = []
    
    def backtrack(path, picked, delivered):
        # Yolcu sayısı kadar binme + inme işlemi var mı?
        if len(path) == 2 * num_passengers:
            results.append(path[:])
            return
            
        # Olasılıkları Dene
        for idx in range(num_passengers):
            # Henüz alınmamışsa
            if idx not in picked:
                backtrack(path + [('pickup', idx)], picked | {idx}, delivered)
            # Alınmış ama henüz bırakılmamışsa
            elif idx not in delivered:
                backtrack(path + [('deliver', idx)], picked, delivered | {idx})
                
    backtrack([], set(), set())
    return results


def _calculate_trip_savings_and_fares(manager, num_passengers: int, actual_path: List[str], active_passengers_at_step: dict, solo_trips: List[float]) -> dict:
    
    # Yolcuların toplam yolculuk maliyetini hesaplar ve adil bir şekilde paylaştırır.
    # 1. Araç içi "aktif" mesafenin hesaplanması
    # Sadece içinde en az 1 yolcu olan zamanı ücretlendiriyoruz.
    active_distance = 0.0
    for idx_step in range(len(actual_path) - 1):
        segment_dist = _calculate_distance(manager, actual_path[idx_step], actual_path[idx_step+1])
        passengers_in_car = active_passengers_at_step.get(idx_step, set())
        
        if len(passengers_in_car) > 0:
            active_distance += segment_dist
            
    # Temel Ücret: Sabit açılış (25.0) + Mesafe Başı (8.0)
    total_journey_cost = 25.0 + active_distance * 8.0
    
    # 2. Ücreti oransal olarak paylaştırma
    discounted_fares = {p_idx: 0.0 for p_idx in range(num_passengers)}
    solo_fares = [25.0 + solo_trips[p_idx] * 8.0 for p_idx in range(num_passengers)]
    sum_solo_fares = sum(solo_fares)
    
    for p_idx in range(num_passengers):
        solo_fare = solo_fares[p_idx]
        
        if sum_solo_fares > 0:
            proportion = solo_fare / sum_solo_fares
        else:
            proportion = 1.0 / num_passengers
            
        shared_fare = total_journey_cost * proportion
        
        # Yolcu koruma garantisi: Hiçbir yolcu yalnız gitme maliyetinden daha fazlasını ödememeli!
        discounted_fares[p_idx] = min(shared_fare, solo_fare)
        
    return discounted_fares


def _evaluate_vehicle_for_passengers(manager, vehicle, passengers_list: List[Customer]) -> Optional[dict]:

    # Belirli bir aracın, verilen yolcu listesini optimum şekilde taşıyıp taşıyamayacağını farklı kısıtlamalar altında kontrol eder ve hesaplar.

    num_passengers = len(passengers_list)
    vehicle_start_loc = vehicle.current_location
    action_sequences = _generate_route_permutations(num_passengers)
    
    best_seq_dist = float('inf')
    best_match_data = None
    
    # Yolcuların "Solo" seyahat mesafelerini hesapla
    solo_trips = []
    for p in passengers_list:
        s_dist = _calculate_distance(manager, p.current_location, p.destination)
        if s_dist == float('inf'):
            return None # Hedefe veya başlangıca ulaşım kapalıysa direkt iptal et.
        solo_trips.append(s_dist)
        
    # Tüm rotalama olasılıklarını (Örn: P0, P1, D0, D1) tek tek test ediyoruz.
    for seq in action_sequences:
        # Durakların Belirlenmesi
        locs = [vehicle_start_loc]
        for action_type, p_idx in seq:
            p = passengers_list[p_idx]
            locs.append(p.current_location if action_type == 'pickup' else p.destination)
            
        # Rotanın Fiziksel Olarak Hesaplanması
        segment_paths = []
        valid_route = True
        for j in range(len(locs) - 1):
            d, path = manager.find_shortest_path(locs[j], locs[j+1])
            if d == float('inf') or not path:
                valid_route = False
                break
            segment_paths.append(path)
            
        if not valid_route: continue
            
        # Segmentleri tek bir devasa "full_path" rota listesinde birleştir
        full_path = []
        for idx, path in enumerate(segment_paths):
            full_path.extend(path if idx == 0 else path[1:])
                
        # Rota Simülasyonu: Araç ilerledikçe kim biniyor, kim iniyor?
        picked_up, delivered = {}, {}
        current_passengers = set()
        active_passengers_at_step = {} 
        
        capacity_valid = True
        capacity_limit = 3 # Aracın taşıyabileceği maksimum yolcu sayısı
        
        for i, node in enumerate(full_path):
            # Önce bu durakta inmesi gerekenleri indir
            to_remove = set()
            for p_idx in current_passengers:
                if passengers_list[p_idx].destination == node:
                    delivered[p_idx] = i
                    to_remove.add(p_idx)
            current_passengers -= to_remove
            
            # Sonra bu duraktan araca binecekleri al
            for p_idx in range(num_passengers):
                if p_idx not in picked_up and passengers_list[p_idx].current_location == node:
                    picked_up[p_idx] = i
                    current_passengers.add(p_idx)
                    
            active_passengers_at_step[i] = set(current_passengers)
            
            # Kısıt 1: Kapasite Kontrolü
            if len(current_passengers) > capacity_limit:
                capacity_valid = False
                break
                
        # Eğer rota sonunda herkes binmemiş/inmemişse geçersizdir.
        if not capacity_valid or len(picked_up) != num_passengers or len(delivered) != num_passengers:
            continue
            
        # Ayrık Yolcu Kontrolü
        # Eğer iki yolcu araçta hiç aynı anda bulunmuyorsa, bu paylaşımlı bir yolculuk değildir.
        if num_passengers >= 2:
            disjoint_found = False
            for p_idx in range(num_passengers):
                max_occupancy = max([len(active_passengers_at_step.get(s, set())) for s in range(picked_up[p_idx], delivered[p_idx])] + [0])
                if max_occupancy <= 1:
                    disjoint_found = True
                    break
            if disjoint_found: continue
                
        # Rotayı son teslim noktasında kesiyoruz
        last_delivery_idx = max(delivered.values())
        actual_path = full_path[:last_delivery_idx + 1]
        
        # Tüm rotanın gerçek mesafesi
        actual_total_dist = sum(_calculate_distance(manager, actual_path[i], actual_path[i+1]) for i in range(len(actual_path) - 1))
            
        # Gecikme Kontrolü
        # Uzatılan yol, yolcunun solo yolculuğundan fazla olamaz.
        detour_valid = True
        detour_limit = 1.3 if num_passengers == 3 else 1.5
        
        for p_idx in range(num_passengers):
            p_travel_dist = sum(_calculate_distance(manager, full_path[i], full_path[i+1]) for i in range(picked_up[p_idx], delivered[p_idx]))
            if p_travel_dist > detour_limit * solo_trips[p_idx]:
                detour_valid = False
                break
                
        if not detour_valid: continue
            
        # --- F. En İyi Rotanın Kaydedilmesi ---
        if actual_total_dist < best_seq_dist:
            best_seq_dist = actual_total_dist
            
            last_pickup_idx = max(picked_up.values())
            pickup_route = actual_path[:last_pickup_idx + 1]
            trip_route = actual_path[last_pickup_idx:]
            
            pickup_dist = sum(_calculate_distance(manager, pickup_route[i], pickup_route[i+1]) for i in range(len(pickup_route) - 1))
            trip_dist = sum(_calculate_distance(manager, trip_route[i], trip_route[i+1]) for i in range(len(trip_route) - 1))
            
            # Ücret (Fare) Hesabı
            discounted_fares = _calculate_trip_savings_and_fares(manager, num_passengers, actual_path, active_passengers_at_step, solo_trips)
            
            best_match_data = {
                "pickup": {"distance": pickup_dist, "route": pickup_route},
                "trip": {"distance": trip_dist, "route": trip_route},
                "total_distance": actual_total_dist,
                "fares": {passengers_list[p_idx].id: discounted_fares[p_idx] for p_idx in range(num_passengers)}
            }
            
    return best_match_data


# =========================
# BÖLÜM 2: ANA FONKSİYONLAR
# =========================

def process_next_customer(manager, selected_vehicle_id: Optional[str] = None) -> Optional[dict]:
    """
    Kuyruktan bekleyen müşteriyi alır (Queue FIFO yapısı kullanılarak),
    tüm müsait araçlar ve kuyruktaki diğer yolcularla olasılıkları tarar.
    En Yüksek Tasarrufu sağlayan eşleşmeyi uygular.
    """
    # Adım 1: Kuyruk Kontrolü ve Yolcu Seçimi
    if not manager.waiting_customers:
        manager.logs.append("Simülasyon Adımı: Bekleyen müşteri kuyruğu boş.")
        return None
        
    c1: Customer = manager.waiting_customers.popleft() # Kuyruğun başından yolcuyu al
    p1, d1 = c1.current_location, c1.destination

    # Adım 2: Müsait Araç Filtreleme
    available_vehicles = [v for v in manager.local_vehicles if v.is_available]
    
    if selected_vehicle_id and selected_vehicle_id != "any":
        available_vehicles = [v for v in available_vehicles if v.id == selected_vehicle_id]
        if not available_vehicles:
            manager.waiting_customers.appendleft(c1) # Araç yoksa yolcuyu kuyruğa geri koy
            return {"success": False, "message": f"Seçilen {selected_vehicle_id} taksisi meşgul!", "customer": c1.to_dict()}
            
    if not available_vehicles:
        manager.waiting_customers.appendleft(c1)
        return {"success": False, "message": "Müsait araç bulunamadı. Yolcu bekletiliyor.", "customer": c1.to_dict()}

    # Adım 3: Yolcu Kombinasyonlarını Oluşturma (Solo, İkili, Üçlü Paylaşım)
    candidates = []
    passenger_combos = [[c1]]
    
    # 2'li kombinasyonlar (Kuyruktaki diğer yolcuları tek tek yanına ekle)
    for c2 in manager.waiting_customers:
        passenger_combos.append([c1, c2])
        
    # 3'lü kombinasyonlar (Kuyruktan ikili gruplar ekle)
    queue_len = len(manager.waiting_customers)
    for i in range(queue_len):
        for j in range(i + 1, queue_len):
            passenger_combos.append([c1, manager.waiting_customers[i], manager.waiting_customers[j]])


    # Adım 4: Aday Eşleşmelerin Hesaplanması ve Puanlanması 

    for combo in passenger_combos:
        for vehicle in available_vehicles:

            match_data = _evaluate_vehicle_for_passengers(manager, vehicle, combo)
            
            if match_data:
                # Toplam Tasarruf Puanı Hesaplama: 
                # (Yolcular ayrı ayrı gitseydi ne öderdi?) - (Şimdi ortak ne ödüyorlar?)
                solo_sum = sum((25.0 + _calculate_distance(manager, p.current_location, p.destination) * 8.0) for p in combo)
                shared_sum = sum(match_data["fares"].values())
                total_savings = max(0.0, solo_sum - shared_sum)
                
                # Puan formülü = Sağlanan Tasarruf (Maliyet Odaklı Optimizasyon)
                # Eşit puan durumunda daha kısa mesafeli rotayı seçmek için çok küçük bir oran çıkartıyoruz.
                score = total_savings - 0.001 * match_data["total_distance"]
                
                candidates.append({
                    "combo": combo, "vehicle": vehicle, 
                    "pickup": match_data["pickup"], "trip": match_data["trip"],
                    "total_distance": match_data["total_distance"], "score": score,
                    "fares": match_data["fares"], "total_savings": total_savings
                })

    # Adayları verimlilik (tasarruf) puanına göre en yüksekten en düşüğe sırala
    candidates.sort(key=lambda x: x["score"], reverse=True)

    # Adım 5: En İyi Eşleşmeyi Uygula ve Sistemi Güncelle

    if not candidates:
        manager.waiting_customers.appendleft(c1)
        return {"success": False, "message": "Hiçbir araç yolcuya ulaşamıyor.", "customer": c1.to_dict()}

    best_match = candidates[0]
    combo = best_match["combo"]
    vehicle = best_match["vehicle"]
    
    old_vehicle_loc = vehicle.current_location # API Loglama için eski konumu sakla
    
    # Eğer paylaşımlıysa, eşleşen diğer müşterileri ana bekleme kuyruğundan temizle
    for extra_c in combo[1:]:
        for idx, c in enumerate(manager.waiting_customers):
            if c.id == extra_c.id:
                del manager.waiting_customers[idx]
                break

    # Aracı güncelle (Yolcular bindi ve araç meşgul oldu)
    vehicle.active_customers = combo[:]
    vehicle.is_available = False
    vehicle.current_location = best_match["trip"]["route"][-1] # Seyahat bittiğinde araç hedefte kalır
    

    # BÖLÜM 3: FRONTEND API ve LOGLAMA VERİLERİNİ HAZIRLAMA 
    
    # Araç simülasyon adımı sonunda tekrar müsait hale gelir ki sıradaki isteği de karşılayabilsin
    vehicle.active_customers = []
    vehicle.is_available = True
    
    return _format_frontend_response(manager, c1, combo, best_match, candidates, vehicle, old_vehicle_loc, available_vehicles)


def _format_frontend_response(manager, c1, combo, best_match, candidates, vehicle, old_vehicle_loc, available_vehicles):
    """
    Oluşan algoritma sonuçlarını Flask API'nin beklediği JSON yapısına dönüştürür.
    Alternatif rotaları ve fiyat indirim bilgilerini zenginleştirir.
    """
    def _extend_customer_dict(cust):
        c_dict = cust.to_dict()
        fare_val = best_match["fares"].get(cust.id, 0.0)
        solo_dist = _calculate_distance(manager, cust.current_location, cust.destination)
        solo_fare_val = (25.0 + solo_dist * 8.0)
        c_dict.update({"fare": fare_val, "solo_fare": solo_fare_val, "saving": max(0.0, solo_fare_val - fare_val)})
        return c_dict

    # Web tarafında gösterilecek alternatif rota kartlarının toplanması
    v_candidates = [c for c in candidates if c["vehicle"].id == vehicle.id]
    candidates_by_count = {count: [c for c in v_candidates if len(c["combo"]) == count] for count in [3, 2, 1]}
    options = [best_match]
    
    for count in [3, 2, 1]:
        if count != len(combo) and candidates_by_count[count]:
            options.append(candidates_by_count[count][0])
            
    # Eğer 3'ten az alternatif varsa (K-Shortest Paths ile Yen's algoritmasından alternatif bul)
    if len(options) < 3:
        solo_alts = manager.find_k_shortest_paths(c1.current_location, c1.destination, k=3)
        solo_cand = candidates_by_count[1][0] if candidates_by_count[1] else None
        if solo_cand:
            for dist, path in solo_alts:
                if not any(opt["trip"]["route"] == path for opt in options):
                    options.append({
                        "combo": [c1], "vehicle": vehicle, "pickup": solo_cand["pickup"],
                        "trip": {"distance": dist, "route": path}, "total_distance": solo_cand["pickup"]["distance"] + dist,
                        "score": 1.0 / (solo_cand["pickup"]["distance"] + dist), "fares": {c1.id: 25.0 + dist * 8.0}
                    })
                    if len(options) == 3: break

    trip_alternatives = []
    for idx, opt in enumerate(options):
        opt_combo, opt_count = opt["combo"], len(opt["combo"])
        opt_savings = sum((25.0 + _calculate_distance(manager, p.current_location, p.destination)*8.0) for p in opt_combo) - sum(opt.get("fares", {}).values()) if opt_count > 1 else 0.0
        
        customers_data = []
        for p in opt_combo:
            c_dict = p.to_dict()
            f_val = opt.get("fares", {}).get(p.id, 0.0)
            sf_val = (25.0 + _calculate_distance(manager, p.current_location, p.destination) * 8.0)
            c_dict.update({"fare": f_val, "solo_fare": sf_val, "saving": max(0.0, sf_val - f_val)})
            customers_data.append(c_dict)

        badge_class = "shortest" if idx == 0 else "alternative"
        if idx == 0: badge_text = f"En Verimli Rota ({opt_count} Kişilik)" if opt_count > 1 else "En Kısa Rota (Solo)"
        else: badge_text = f"Alternatif {opt_count} Kişilik Rota" if opt_count > 1 else f"Alternatif Rota {idx} (Solo)"
            
        trip_alternatives.append({
            "type": "shared" if opt_count > 1 else "solo", "badge_class": badge_class, "badge_text": badge_text,
            "pickup": opt["pickup"], "trip": opt["trip"], "total_distance": opt["total_distance"],
            "passenger_count": opt_count, "customers": customers_data, "savings": opt_savings, "score": opt["score"]
        })

    # Loglama İşlemi
    passenger_names = " ve ".join([c.name for c in combo])
    if len(combo) > 1:
        match_log = f"{len(combo)}'LÜ PAYLAŞIM (Skor: {best_match['score']:.4f}): {passenger_names} taksi {vehicle.id}'de! Rota: {'->'.join(best_match['trip']['route'])} ({best_match['total_distance']:.2f} km)."
    else:
        match_log = f"SOLO (Skor: {best_match['score']:.4f}): {c1.name} -> {vehicle.id}. Rota: {'->'.join(best_match['trip']['route'])} ({best_match['total_distance']:.2f} km)."
    manager.logs.append(match_log)

    response_dict = {
        "success": True, "type": "shared" if len(combo) > 1 else "solo",
        "customer": _extend_customer_dict(c1),
        "vehicle": {"id": vehicle.id, "start_location": old_vehicle_loc, "end_location": vehicle.current_location}, 
        "pickup": best_match["pickup"], "trip": best_match["trip"],
        "trip_alternatives": trip_alternatives, "total_distance": best_match["total_distance"],
        "savings": sum((25.0 + _calculate_distance(manager, p.current_location, p.destination)*8.0) for p in combo) - sum(best_match["fares"].values()) if len(combo)>1 else 0.0, 
        "score": best_match["score"], "log": match_log
    }
    
    if len(combo) >= 2: response_dict["customer_2"] = _extend_customer_dict(combo[1])
    if len(combo) >= 3: response_dict["customer_3"] = _extend_customer_dict(combo[2])
    return response_dict
