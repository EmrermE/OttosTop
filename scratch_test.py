from simulation import SystemManager
from models import Customer

manager = SystemManager()
manager.initialize_system()

c1 = Customer(10, "Fatma", "Visnezade", "Akaretler")
p1, d1 = c1.current_location, c1.destination
available_vehicles = [v for v in manager.local_vehicles if v.is_available]

def get_dist(u, v):
    d, _ = manager.find_shortest_path(u, v)
    return d

def get_route_and_distance(nodes_list):
    total_dist = 0.0
    full_path = []
    for i in range(len(nodes_list) - 1):
        dist, path = manager.find_shortest_path(nodes_list[i], nodes_list[i+1])
        if dist == float('inf') or not path:
            return float('inf'), []
        if i == 0:
            full_path.extend(path)
        else:
            full_path.extend(path[1:])
        total_dist += dist
    return total_dist, full_path

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
            print(f"Passenger {p.name} solo trip from {p.current_location} to {p.destination} is inf!")
            return None
        solo_trips.append(s_dist)
        
    print(f"Vehicle {v.id} at {v_loc}. Action seqs: {action_seqs}")
    for seq in action_seqs:
        locs = [v_loc]
        for action_type, p_idx in seq:
            p = passengers_list[p_idx]
            loc = p.current_location if action_type == 'pickup' else p.destination
            locs.append(loc)
            
        print(f"  Seq: {seq}, Locs: {locs}")
        segment_distances = []
        segment_paths = []
        valid = True
        total_dist = 0.0
        
        for j in range(len(locs) - 1):
            d, path = manager.find_shortest_path(locs[j], locs[j+1])
            if d == float('inf') or not path:
                print(f"    Segment {locs[j]} to {locs[j+1]} is inf!")
                valid = False
                break
            segment_distances.append(d)
            segment_paths.append(path)
            total_dist += d
            
        if not valid:
            continue
            
        actual_travels = []
        detour_valid = True
        
        for p_idx in range(n):
            pickup_idx = -1
            deliver_idx = -1
            for idx, (action_type, act_p_idx) in enumerate(seq):
                if act_p_idx == p_idx:
                    if action_type == 'pickup':
                        pickup_idx = idx
                    else:
                        deliver_idx = idx
                        
            p_travel_dist = sum(segment_distances[pickup_idx + 1 : deliver_idx + 1])
            print(f"    Passenger {p_idx} travel dist: {p_travel_dist}, max allowed: {1.5 * solo_trips[p_idx]}")
            if p_travel_dist > 1.5 * solo_trips[p_idx]:
                detour_valid = False
                print(f"    Passenger {p_idx} detour exceeds limit! travel: {p_travel_dist}, limit: {1.5 * solo_trips[p_idx]}")
                break
            actual_travels.append(p_travel_dist)
            
        if not detour_valid:
            continue
            
        if total_dist < best_seq_dist:
            best_seq_dist = total_dist
            
            last_pickup_action_idx = -1
            for idx, (action_type, _) in enumerate(seq):
                if action_type == 'pickup':
                    last_pickup_action_idx = idx
                    
            _, pickup_full_path = get_route_and_distance(locs[:last_pickup_action_idx + 2])
            _, trip_full_path = get_route_and_distance(locs[last_pickup_action_idx + 1:])
            
            best_match_data = {
                "pickup": {
                    "distance": sum(segment_distances[:last_pickup_action_idx + 1]),
                    "route": pickup_full_path
                },
                "trip": {
                    "distance": sum(segment_distances[last_pickup_action_idx + 1:]),
                    "route": trip_full_path
                },
                "total_distance": total_dist
            }
            print(f"    Found match! total_dist: {total_dist}")
            
    return best_match_data

for v in available_vehicles:
    evaluate_matching(v, [c1])
