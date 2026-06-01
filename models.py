"""
Akıllı Taksi/Kargo Çağırma ve Rota Optimizasyonu Simülasyonu - Veri Yapıları Modülü
Bu dosya projenin nesne yönelimli programlama (OOP) ve saf Python veri yapılarını barındırır.
"""

class Customer:
    """
    Sistemdeki müşterileri veya kargo taleplerini temsil eden sınıf.
    """
    def __init__(self, customer_id: int, name: str, current_location: str, destination: str):
        self.id = customer_id
        self.name = name
        self.current_location = current_location  # Vertex ismi (str)
        self.destination = destination            # Hedef Vertex ismi (str)

    def to_dict(self) -> dict:
        """Nesneyi JSON serileştirmesi için bir Python sözlüğüne dönüştürür."""
        return {
            "id": self.id,
            "name": self.name,
            "current_location": self.current_location,
            "destination": self.destination
        }


class Vehicle:
    """
    Taksi veya kargo araçlarını temsil eden sınıf.
    """
    def __init__(self, vehicle_id: str, current_location: str, is_available: bool = True):
        self.id = vehicle_id
        self.current_location = current_location  # Vertex ismi (str)
        self.is_available = is_available          # Boşta mı/Müsait mi? (bool)
        self.active_customers = []                # Şu an araçta olan/eşleşen aktif müşteriler

    def to_dict(self) -> dict:
        """Nesneyi JSON serileştirmesi için bir Python sözlüğüne dönüştürür."""
        return {
            "id": self.id,
            "current_location": self.current_location,
            "is_available": self.is_available,
            "active_customers": [c.to_dict() for c in self.active_customers]
        }


class Edge:
    """
    Vertex'ler (Düğümler) arasındaki yolları/kenarları temsil eden sınıf.
    Her kenar bir hedef düğüm ve bu düğüme olan mesafeyi (ağırlığı) barındırır.
    """
    def __init__(self, target, weight: float):
        self.target = target   # Hedef Vertex nesnesi
        self.weight = weight   # Mesafe veya Süre (float / int)

    def to_dict(self) -> dict:
        """Serileştirme için basit bir sözlük döner."""
        return {
            "target": self.target.name,
            "weight": self.weight
        }


class Vertex:
    """
    Haritadaki durakları/düğümleri temsil eden sınıf.
    Her düğümün bir ismi ve o düğümden çıkan yolları (Edge) tutan bir komşuluk listesi vardır.
    """
    def __init__(self, name: str):
        self.name = name
        self.adjacencies = []  # Edge nesnelerini barındıran komşuluk listesi (Python listesi)

    def add_edge(self, target_vertex, weight: float):
        """Bu düğümden başka bir düğüme yol (Edge) ekler."""
        edge = Edge(target_vertex, weight)
        self.adjacencies.append(edge)

    def to_dict(self) -> dict:
        """Düğümün komşularıyla birlikte sözlük gösterimini döner."""
        return {
            "name": self.name,
            "adjacencies": [edge.to_dict() for edge in self.adjacencies]
        }


class Graph:
    """
    Durakları (Vertex) ve yolları (Edge) içeren haritayı/grafı temsil eden ana sınıf.
    """
    def __init__(self):
        # Düğümleri saklayan sözlük -> anahtar: düğüm adı (str), değer: Vertex objesi
        self.vertices = {}

    def get_or_create_vertex(self, name: str) -> Vertex:
        """Belirtilen isimde düğüm yoksa oluşturur, varsa mevcut düğümü döner."""
        if name not in self.vertices:
            self.vertices[name] = Vertex(name)
        return self.vertices[name]

    def add_route(self, source: str, dest: str, distance: float, bidirectional: bool = True):
        """
        Graf üzerine iki düğüm arasında yol (kenar) ekler.
        Varsayılan olarak yollar çift yönlüdür (undirected).
        """
        source_vertex = self.get_or_create_vertex(source)
        dest_vertex = self.get_or_create_vertex(dest)

        # Kaynaktan hedefe yol ekle
        source_vertex.add_edge(dest_vertex, distance)

        # Çift yönlü yol ise hedeften kaynağa da yol ekle
        if bidirectional:
            dest_vertex.add_edge(source_vertex, distance)

    def to_dict(self) -> dict:
        """Tüm graf yapısını JSON uyumlu bir sözlüğe dönüştürür."""
        return {name: vertex.to_dict() for name, vertex in self.vertices.items()}
