import heapq
from typing import List, Tuple

def find_shortest_path(manager, start_name: str, end_name: str) -> Tuple[float, List[str]]:
    """
    Dijkstra Algoritması kullanarak iki durak (node) arasındaki en kısa mesafeyi 
    ve geçilmesi gereken durakların sıralı listesini hesaplar.
    """
    cache_key = (start_name, end_name)
    if hasattr(manager, '_path_cache') and cache_key in manager._path_cache:
        return manager._path_cache[cache_key]

    if start_name not in manager.city_map.vertices or end_name not in manager.city_map.vertices:
        return float('inf'), []

    distances = {name: float('inf') for name in manager.city_map.vertices}
    distances[start_name] = 0
    previous_vertices = {name: None for name in manager.city_map.vertices}

    priority_queue = []
    heapq.heappush(priority_queue, (0, start_name))

    while priority_queue:
        current_distance, current_vertex_name = heapq.heappop(priority_queue)

        if current_distance > distances[current_vertex_name]:
            continue

        if current_vertex_name == end_name:
            break

        current_vertex = manager.city_map.vertices[current_vertex_name]
        for edge in current_vertex.adjacencies:
            neighbor_name = edge.target.name
            distance = current_distance + edge.weight
            
            if distance < distances[neighbor_name]:
                distances[neighbor_name] = distance
                previous_vertices[neighbor_name] = current_vertex_name
                heapq.heappush(priority_queue, (distance, neighbor_name))

    path = []
    current = end_name
    
    while current is not None:
        path.append(current)
        current = previous_vertices[current]
    
    path.reverse()

    if distances[end_name] == float('inf'):
        res = float('inf'), []
    else:
        res = distances[end_name], path
        
    if hasattr(manager, '_path_cache'):
        manager._path_cache[cache_key] = res
        
    return res


def find_k_shortest_paths(manager, start_name: str, end_name: str, k: int = 3) -> List[Tuple[float, List[str]]]:
    """
    K-En Kısa Yol (K-Shortest Paths) algoritması (Yen's Algorithm).
    Belirtilen iki düğüm arasında k adet en iyi alternatif rotayı bulur.
    """
    if start_name not in manager.city_map.vertices or end_name not in manager.city_map.vertices:
        return []

    dist, path = manager.find_shortest_path(start_name, end_name)
    if dist == float('inf') or not path:
        return []

    A = [(dist, path)]
    B = []

    for i in range(1, k):
        for j in range(len(A[i-1][1]) - 1):
            spur_node = A[i-1][1][j]
            root_path = A[i-1][1][:j+1]

            removed_edges = []
            
            for _, path_a in A:
                if len(path_a) > j and path_a[:j+1] == root_path:
                    u = path_a[j]
                    v = path_a[j+1]
                    u_vertex = manager.city_map.vertices[u]
                    
                    for edge in list(u_vertex.adjacencies):
                        if edge.target.name == v:
                            u_vertex.adjacencies.remove(edge)
                            removed_edges.append((u, edge))

            removed_nodes = []
            for node in root_path[:-1]:
                if node in manager.city_map.vertices:
                    vertex = manager.city_map.vertices[node]
                    removed_nodes.append((node, vertex.adjacencies))
                    vertex.adjacencies = []

            spur_dist, spur_path = manager.find_shortest_path(spur_node, end_name)

            for node, adjs in removed_nodes:
                manager.city_map.vertices[node].adjacencies = adjs
            for u, edge in removed_edges:
                manager.city_map.vertices[u].adjacencies.append(edge)

            if spur_dist != float('inf') and spur_path:
                total_path = root_path[:-1] + spur_path
                
                total_dist = 0.0
                for m in range(len(total_path) - 1):
                    d, _ = manager.find_shortest_path(total_path[m], total_path[m+1])
                    total_dist += d
                
                if total_path not in [p for _, p in A] and total_path not in [p for _, p in B]:
                    B.append((total_dist, total_path))

        if not B:
            break

        B.sort(key=lambda x: x[0])
        A.append(B.pop(0))

    return A
