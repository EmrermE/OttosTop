from collections import deque
from typing import List, Tuple, Optional
from models import Graph, Vehicle, Customer

from .setup import initialize_system as _initialize_system
from .routing import find_shortest_path as _find_shortest_path, find_k_shortest_paths as _find_k_shortest_paths
from .matching import process_next_customer as _process_next_customer

class SystemManager:
    """
    Sistemin haritasını, araç listesini, bekleyen müşterileri yöneten 
    ve rotalamayı çalıştıran ana simülasyon yönetim sınıfı.
    """
    def __init__(self):
        self.city_map = Graph()
        self.local_vehicles: List[Vehicle] = []
        self.waiting_customers = deque()  # FIFO Queue
        self.logs: List[str] = []         # Simülasyon adımlarının logları
        self._path_cache = {}

    def initialize_system(self):
        """Simülasyon için örnek bir İstanbul Haritası (Graph) oluşturur ve araçları konumlandırır."""
        _initialize_system(self)

    def add_customer_to_queue(self, customer: Customer):
        """Yeni bir müşteriyi FIFO kuyruğuna ekler."""
        self.waiting_customers.append(customer)
        self.logs.append(f"Müşteri {customer.name} (ID: {customer.id}), kuyruğa eklendi. Başlangıç: {customer.current_location} -> Hedef: {customer.destination}")

    def find_shortest_path(self, start_name: str, end_name: str) -> Tuple[float, List[str]]:
        """Dijkstra Algoritmasını kullanarak iki durak arasındaki en kısa mesafeyi hesaplar."""
        return _find_shortest_path(self, start_name, end_name)

    def process_next_customer(self, selected_vehicle_id: Optional[str] = None) -> Optional[dict]:
        """Shared Ride Algorithm ile yolcu ve araç eşleştirmesini yapar."""
        return _process_next_customer(self, selected_vehicle_id)

    def find_k_shortest_paths(self, start_name: str, end_name: str, k: int = 3) -> List[Tuple[float, List[str]]]:
        """K-Shortest Paths Algorithm ile k adet alternatif rotayı bulur."""
        return _find_k_shortest_paths(self, start_name, end_name, k)
