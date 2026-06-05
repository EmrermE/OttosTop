"""
Akıllı Taksi/Kargo Çağırma ve Rota Optimizasyonu Simülasyonu - Flask Backend Uygulaması
Bu dosya web arayüzünü sunar ve REST API endpoint'lerini yönetir.
"""

from flask import Flask, jsonify, request, render_template
from simulation import SystemManager
from models import Customer

app = Flask(__name__)

# Küresel sistem yöneticisi nesnesi
system_manager = SystemManager()
system_manager.initialize_system()

# Benzersiz müşteri ID sayacı
customer_id_counter = 100


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status", methods=["GET"])
def get_status():
    """
    Sistemdeki güncel haritayı, araçları, bekleyen müşteri sayısını 
    ve kuyruktaki müşteri listesini döner.
    """
    vehicles_data = [vehicle.to_dict() for vehicle in system_manager.local_vehicles]
    customers_data = [customer.to_dict() for customer in system_manager.waiting_customers]
    
    return jsonify({
        "status": "success",
        "city_map": system_manager.city_map.to_dict(),
        "vehicles": vehicles_data,
        "waiting_count": len(system_manager.waiting_customers),
        "waiting_customers": customers_data,
        "logs": system_manager.logs
    })


@app.route("/api/customer", methods=["POST"])
def add_customer():
    """ { "name": str, "current_location": str, "destination": str } """
    global customer_id_counter
    data = request.get_json()

    if not data:
        return jsonify({"status": "error", "message": "Geçersiz veya boş veri gövdesi."}), 400

    name = data.get("name")
    current_location = data.get("current_location")
    destination = data.get("destination")

    # Gerekli parametrelerin kontrolü
    if not all([name, current_location, destination]):
        return jsonify({"status": "error", "message": "Eksik parametreler! 'name', 'current_location' ve 'destination' alanları zorunludur."}), 400

    # Durakların haritada var olup olmadığını kontrol et
    if current_location not in system_manager.city_map.vertices:
        return jsonify({"status": "error", "message": f"Başlangıç durağı '{current_location}' haritada mevcut değil."}), 400
    if destination not in system_manager.city_map.vertices:
        return jsonify({"status": "error", "message": f"Hedef durak '{destination}' haritada mevcut değil."}), 400
    if current_location == destination:
        return jsonify({"status": "error", "message": "Başlangıç ve hedef durakları aynı olamaz!"}), 400

    # Müşteri nesnesini oluştur ve kuyruğa ekle
    customer_id_counter += 1
    new_customer = Customer(customer_id_counter, name, current_location, destination)
    system_manager.add_customer_to_queue(new_customer)

    return jsonify({
        "status": "success",
        "message": f"Müşteri {name} kuyruğa başarıyla eklendi.",
        "customer": new_customer.to_dict(),
        "waiting_count": len(system_manager.waiting_customers)
    }), 201


@app.route("/api/simulation/step", methods=["POST"])
def simulation_step():
    """
    Kuyruktaki ilk müşteriyi çeker, ona en yakın uygun aracı 
    Dijkstra algoritması ile bulup eşleştirir ve simülasyon adımını çalıştırır.
    """
    if len(system_manager.waiting_customers) == 0:
        return jsonify({
            "status": "error",
            "message": "Kuyrukta bekleyen müşteri bulunmamaktadır. Lütfen önce yeni bir müşteri ekleyin."
        }), 400

    data = request.get_json(silent=True) or {}
    selected_vehicle_id = data.get("vehicle_id")

    step_result = system_manager.process_next_customer(selected_vehicle_id)
    
    if not step_result:
        return jsonify({
            "status": "error",
            "message": "Simülasyon adımı işlenirken beklenmedik bir hata oluştu veya kuyruk boş."
        }), 500

    if not step_result.get("success"):
        return jsonify({
            "status": "warning",
            "message": step_result.get("message"),
            "customer": step_result.get("customer")
        }), 200

    return jsonify({
        "status": "success",
        "step_data": step_result
    }), 200


@app.route("/api/simulation/revert", methods=["POST"])
def revert_simulation_step():
    """
    Aktif seyahati iptal eder: aracı eski konumuna döndürür, 
    yolcuları kuyruğun en başına geri ekler ve sistemi günceller.
    """
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Boş veri gövdesi."}), 400

    vehicle_id = data.get("vehicle_id")
    start_location = data.get("start_location")
    customers = data.get("customers", [])

    if not vehicle_id or not start_location:
        return jsonify({"status": "error", "message": "Eksik parametreler."}), 400

    # 1. Aracı bul ve eski konumuna geri koy
    vehicle = next((v for v in system_manager.local_vehicles if v.id == vehicle_id), None)
    if vehicle:
        vehicle.current_location = start_location
        vehicle.is_available = True
        vehicle.active_customers = []

    # 2. Yolcuları kuyruğun EN BAŞINA geri ekle (FIFO sırasını bozmamak için)
    existing_ids = {c.id for c in system_manager.waiting_customers}
    for cust_data in reversed(customers):
        if cust_data and cust_data.get("id") not in existing_ids:
            new_cust = Customer(
                cust_data["id"],
                cust_data["name"],
                cust_data["current_location"],
                cust_data["destination"]
            )
            system_manager.waiting_customers.appendleft(new_cust)

    system_manager.logs.append(f"İPTAL: {vehicle_id} taksisinin seyahati iptal edildi. Araç {start_location} noktasına geri döndü ve yolcular kuyruğa geri alındı.")
    return jsonify({
        "status": "success",
        "message": "Seyahat başarıyla iptal edildi ve sistem durumu geri alındı."
    }), 200


@app.route("/api/reset", methods=["POST"])
def reset_system():
    """Sistemi ve haritayı ilk ayarlarına döndürür."""
    system_manager.initialize_system()
    return jsonify({
        "status": "success",
        "message": "Sistem başarıyla sıfırlandı ve yeniden başlatıldı."
    })


if __name__ == "__main__":
    # Flask uygulamasını yerel sunucuda çalıştırıyoruz
    app.run(debug=True, host="127.0.0.1", port=5000)
