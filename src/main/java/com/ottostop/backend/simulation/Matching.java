package com.ottostop.backend.simulation;

import com.ottostop.backend.models.Customer;
import com.ottostop.backend.models.Vehicle;

import java.util.*;

public class Matching {

    private static double calculateDistance(SimulationManager manager, String u, String v) {
        return Routing.findShortestPath(manager, u, v).getDistance();
    }

    private static void backtrack(List<String> path, Set<Integer> picked, Set<Integer> delivered, int numPassengers, List<List<String>> results) {
        if (path.size() == 2 * numPassengers) {
            results.add(new ArrayList<>(path));
            return;
        }

        for (int idx = 0; idx < numPassengers; idx++) {
            if (!picked.contains(idx)) {
                path.add("pickup_" + idx);
                picked.add(idx);
                backtrack(path, picked, delivered, numPassengers, results);
                picked.remove(idx);
                path.remove(path.size() - 1);
            } else if (!delivered.contains(idx)) {
                path.add("deliver_" + idx);
                delivered.add(idx);
                backtrack(path, picked, delivered, numPassengers, results);
                delivered.remove(idx);
                path.remove(path.size() - 1);
            }
        }
    }

    private static List<List<String>> generateRoutePermutations(int numPassengers) {
        List<List<String>> results = new ArrayList<>();
        backtrack(new ArrayList<>(), new HashSet<>(), new HashSet<>(), numPassengers, results);
        return results;
    }

    private static Map<Integer, Double> calculateTripSavingsAndFares(SimulationManager manager, int numPassengers, List<String> actualPath, Map<Integer, Set<Integer>> activePassengersAtStep, List<Double> soloTrips) {
        double activeDistance = 0.0;
        for (int i = 0; i < actualPath.size() - 1; i++) {
            double segmentDist = calculateDistance(manager, actualPath.get(i), actualPath.get(i + 1));
            Set<Integer> passengersInCar = activePassengersAtStep.getOrDefault(i, new HashSet<>());
            if (!passengersInCar.isEmpty()) {
                activeDistance += segmentDist;
            }
        }

        double totalJourneyCost = 25.0 + activeDistance * 8.0;

        Map<Integer, Double> discountedFares = new HashMap<>();
        List<Double> soloFares = new ArrayList<>();
        double sumSoloFares = 0.0;
        for (int i = 0; i < numPassengers; i++) {
            double fare = 25.0 + soloTrips.get(i) * 8.0;
            soloFares.add(fare);
            sumSoloFares += fare;
        }

        for (int pIdx = 0; pIdx < numPassengers; pIdx++) {
            double soloFare = soloFares.get(pIdx);
            double proportion = sumSoloFares > 0 ? soloFare / sumSoloFares : 1.0 / numPassengers;
            double sharedFare = totalJourneyCost * proportion;
            discountedFares.put(pIdx, Math.min(sharedFare, soloFare));
        }

        return discountedFares;
    }

    private static Map<String, Object> evaluateVehicleForPassengers(SimulationManager manager, Vehicle vehicle, List<Customer> passengersList) {
        int numPassengers = passengersList.size();
        String vehicleStartLoc = vehicle.getCurrentLocation();
        List<List<String>> actionSequences = generateRoutePermutations(numPassengers);

        double bestSeqDist = Double.POSITIVE_INFINITY;
        Map<String, Object> bestMatchData = null;

        List<Double> soloTrips = new ArrayList<>();
        for (Customer p : passengersList) {
            double sDist = calculateDistance(manager, p.getCurrentLocation(), p.getDestination());
            if (sDist == Double.POSITIVE_INFINITY) return null;
            soloTrips.add(sDist);
        }

        for (List<String> seq : actionSequences) {
            List<String> locs = new ArrayList<>();
            locs.add(vehicleStartLoc);
            for (String action : seq) {
                String[] parts = action.split("_");
                String actionType = parts[0];
                int pIdx = Integer.parseInt(parts[1]);
                Customer p = passengersList.get(pIdx);
                locs.add(actionType.equals("pickup") ? p.getCurrentLocation() : p.getDestination());
            }

            List<List<String>> segmentPaths = new ArrayList<>();
            boolean validRoute = true;
            for (int j = 0; j < locs.size() - 1; j++) {
                PathResult pathRes = Routing.findShortestPath(manager, locs.get(j), locs.get(j + 1));
                if (pathRes.getDistance() == Double.POSITIVE_INFINITY || pathRes.getPath().isEmpty()) {
                    validRoute = false;
                    break;
                }
                segmentPaths.add(pathRes.getPath());
            }

            if (!validRoute) continue;

            List<String> fullPath = new ArrayList<>();
            for (int idx = 0; idx < segmentPaths.size(); idx++) {
                List<String> path = segmentPaths.get(idx);
                if (idx == 0) fullPath.addAll(path);
                else fullPath.addAll(path.subList(1, path.size()));
            }

            Map<Integer, Integer> pickedUp = new HashMap<>();
            Map<Integer, Integer> delivered = new HashMap<>();
            Set<Integer> currentPassengers = new HashSet<>();
            Map<Integer, Set<Integer>> activePassengersAtStep = new HashMap<>();

            boolean capacityValid = true;
            int capacityLimit = 3;

            for (int i = 0; i < fullPath.size(); i++) {
                String node = fullPath.get(i);
                Set<Integer> toRemove = new HashSet<>();
                for (int pIdx : currentPassengers) {
                    if (passengersList.get(pIdx).getDestination().equals(node)) {
                        delivered.put(pIdx, i);
                        toRemove.add(pIdx);
                    }
                }
                currentPassengers.removeAll(toRemove);

                for (int pIdx = 0; pIdx < numPassengers; pIdx++) {
                    if (!pickedUp.containsKey(pIdx) && passengersList.get(pIdx).getCurrentLocation().equals(node)) {
                        pickedUp.put(pIdx, i);
                        currentPassengers.add(pIdx);
                    }
                }

                activePassengersAtStep.put(i, new HashSet<>(currentPassengers));

                if (currentPassengers.size() > capacityLimit) {
                    capacityValid = false;
                    break;
                }
            }

            if (!capacityValid || pickedUp.size() != numPassengers || delivered.size() != numPassengers) continue;

            if (numPassengers >= 2) {
                boolean disjointFound = false;
                for (int pIdx = 0; pIdx < numPassengers; pIdx++) {
                    int maxOccupancy = 0;
                    for (int s = pickedUp.get(pIdx); s < delivered.get(pIdx); s++) {
                        maxOccupancy = Math.max(maxOccupancy, activePassengersAtStep.getOrDefault(s, new HashSet<>()).size());
                    }
                    if (maxOccupancy <= 1) {
                        disjointFound = true;
                        break;
                    }
                }
                if (disjointFound) continue;
            }

            int lastDeliveryIdx = 0;
            for (int v : delivered.values()) lastDeliveryIdx = Math.max(lastDeliveryIdx, v);
            List<String> actualPath = new ArrayList<>(fullPath.subList(0, lastDeliveryIdx + 1));

            double actualTotalDist = 0.0;
            for (int i = 0; i < actualPath.size() - 1; i++) {
                actualTotalDist += calculateDistance(manager, actualPath.get(i), actualPath.get(i + 1));
            }

            boolean detourValid = true;
            double detourLimit = numPassengers == 3 ? 1.3 : 1.5;

            for (int pIdx = 0; pIdx < numPassengers; pIdx++) {
                double pTravelDist = 0.0;
                for (int i = pickedUp.get(pIdx); i < delivered.get(pIdx); i++) {
                    pTravelDist += calculateDistance(manager, fullPath.get(i), fullPath.get(i + 1));
                }
                if (pTravelDist > detourLimit * soloTrips.get(pIdx)) {
                    detourValid = false;
                    break;
                }
            }

            if (!detourValid) continue;

            if (actualTotalDist < bestSeqDist) {
                bestSeqDist = actualTotalDist;

                int lastPickupIdx = 0;
                for (int v : pickedUp.values()) lastPickupIdx = Math.max(lastPickupIdx, v);

                List<String> pickupRoute = new ArrayList<>(actualPath.subList(0, lastPickupIdx + 1));
                List<String> tripRoute = new ArrayList<>(actualPath.subList(lastPickupIdx, actualPath.size()));

                double pickupDist = 0.0;
                for (int i = 0; i < pickupRoute.size() - 1; i++) pickupDist += calculateDistance(manager, pickupRoute.get(i), pickupRoute.get(i + 1));

                double tripDist = 0.0;
                for (int i = 0; i < tripRoute.size() - 1; i++) tripDist += calculateDistance(manager, tripRoute.get(i), tripRoute.get(i + 1));

                Map<Integer, Double> discountedFares = calculateTripSavingsAndFares(manager, numPassengers, actualPath, activePassengersAtStep, soloTrips);

                Map<String, Object> pickupMap = new HashMap<>();
                pickupMap.put("distance", pickupDist);
                pickupMap.put("route", pickupRoute);

                Map<String, Object> tripMap = new HashMap<>();
                tripMap.put("distance", tripDist);
                tripMap.put("route", tripRoute);

                Map<Integer, Double> faresMap = new HashMap<>();
                for (int pIdx = 0; pIdx < numPassengers; pIdx++) {
                    faresMap.put(passengersList.get(pIdx).getId(), discountedFares.get(pIdx));
                }

                bestMatchData = new HashMap<>();
                bestMatchData.put("pickup", pickupMap);
                bestMatchData.put("trip", tripMap);
                bestMatchData.put("total_distance", actualTotalDist);
                bestMatchData.put("fares", faresMap);
            }
        }

        return bestMatchData;
    }

    public static Map<String, Object> processNextCustomer(SimulationManager manager, String selectedVehicleId) {
        if (manager.getWaitingCustomers().isEmpty()) {
            manager.addLog("Simülasyon Adımı: Bekleyen müşteri kuyruğu boş.");
            return null;
        }

        Customer c1 = manager.getWaitingCustomers().pollFirst();

        List<Vehicle> availableVehicles = new ArrayList<>();
        for (Vehicle v : manager.getLocalVehicles()) {
            if (v.getIsAvailable()) availableVehicles.add(v);
        }

        if (selectedVehicleId != null && !selectedVehicleId.equals("any")) {
            availableVehicles.removeIf(v -> !v.getId().equals(selectedVehicleId));
            if (availableVehicles.isEmpty()) {
                manager.getWaitingCustomers().addFirst(c1);
                Map<String, Object> res = new HashMap<>();
                res.put("success", false);
                res.put("message", "Seçilen " + selectedVehicleId + " taksisi meşgul!");
                res.put("customer", customerToDict(c1));
                return res;
            }
        }

        if (availableVehicles.isEmpty()) {
            manager.getWaitingCustomers().addFirst(c1);
            Map<String, Object> res = new HashMap<>();
            res.put("success", false);
            res.put("message", "Müsait araç bulunamadı. Yolcu bekletiliyor.");
            res.put("customer", customerToDict(c1));
            return res;
        }

        List<List<Customer>> passengerCombos = new ArrayList<>();
        passengerCombos.add(Collections.singletonList(c1));

        List<Customer> waitingList = new ArrayList<>(manager.getWaitingCustomers());

        for (Customer c2 : waitingList) {
            passengerCombos.add(Arrays.asList(c1, c2));
        }

        int queueLen = waitingList.size();
        for (int i = 0; i < queueLen; i++) {
            for (int j = i + 1; j < queueLen; j++) {
                passengerCombos.add(Arrays.asList(c1, waitingList.get(i), waitingList.get(j)));
            }
        }

        List<Map<String, Object>> candidates = new ArrayList<>();

        for (List<Customer> combo : passengerCombos) {
            for (Vehicle vehicle : availableVehicles) {
                Map<String, Object> matchData = evaluateVehicleForPassengers(manager, vehicle, combo);

                if (matchData != null) {
                    double soloSum = 0.0;
                    for (Customer p : combo) {
                        soloSum += 25.0 + calculateDistance(manager, p.getCurrentLocation(), p.getDestination()) * 8.0;
                    }
                    Map<Integer, Double> fares = (Map<Integer, Double>) matchData.get("fares");
                    double sharedSum = 0.0;
                    for (Double fare : fares.values()) sharedSum += fare;

                    double totalSavings = Math.max(0.0, soloSum - sharedSum);
                    double totalDist = (double) matchData.get("total_distance");
                    
                    double sumPercentageSavings = 0.0;
                    for (Customer p : combo) {
                        double sFare = 25.0 + calculateDistance(manager, p.getCurrentLocation(), p.getDestination()) * 8.0;
                        double fVal = fares.get(p.getId());
                        sumPercentageSavings += Math.max(0.0, (sFare - fVal) / sFare);
                    }
                    double avgDiscountPercent = (sumPercentageSavings / combo.size()) * 100.0;

                    double score = avgDiscountPercent - 0.001 * totalDist;

                    Map<String, Object> cand = new HashMap<>();
                    cand.put("combo", combo);
                    cand.put("vehicle", vehicle);
                    cand.put("pickup", matchData.get("pickup"));
                    cand.put("trip", matchData.get("trip"));
                    cand.put("total_distance", totalDist);
                    cand.put("score", score);
                    cand.put("fares", fares);
                    cand.put("total_savings", totalSavings);
                    cand.put("average_discount_percent", avgDiscountPercent);

                    candidates.add(cand);
                }
            }
        }

        candidates.sort((a, b) -> Double.compare((double) b.get("score"), (double) a.get("score")));

        if (candidates.isEmpty()) {
            manager.getWaitingCustomers().addFirst(c1);
            Map<String, Object> res = new HashMap<>();
            res.put("success", false);
            res.put("message", "Hiçbir araç yolcuya ulaşamıyor.");
            res.put("customer", customerToDict(c1));
            return res;
        }

        Map<String, Object> bestMatch = candidates.get(0);
        List<Customer> combo = (List<Customer>) bestMatch.get("combo");
        Vehicle vehicle = (Vehicle) bestMatch.get("vehicle");

        String oldVehicleLoc = vehicle.getCurrentLocation();

        for (int i = 1; i < combo.size(); i++) {
            Customer extraC = combo.get(i);
            manager.getWaitingCustomers().removeIf(c -> c.getId() == extraC.getId());
        }

        vehicle.setActiveCustomers(new ArrayList<>(combo));
        vehicle.setIsAvailable(false);
        List<String> tripRoute = (List<String>) ((Map<String, Object>) bestMatch.get("trip")).get("route");
        vehicle.setCurrentLocation(tripRoute.get(tripRoute.size() - 1));

        vehicle.setActiveCustomers(new ArrayList<>());
        vehicle.setIsAvailable(true);

        return formatFrontendResponse(manager, c1, combo, bestMatch, candidates, vehicle, oldVehicleLoc, availableVehicles);
    }

    private static Map<String, Object> formatFrontendResponse(SimulationManager manager, Customer c1, List<Customer> combo, Map<String, Object> bestMatch, List<Map<String, Object>> candidates, Vehicle vehicle, String oldVehicleLoc, List<Vehicle> availableVehicles) {
        // A simplified version of formatting for the response that mimics the python behavior
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("type", combo.size() > 1 ? "shared" : "solo");
        
        Map<String, Object> customer1Ext = customerToDict(c1);
        double fVal1 = ((Map<Integer, Double>)bestMatch.get("fares")).getOrDefault(c1.getId(), 0.0);
        double soloDist1 = calculateDistance(manager, c1.getCurrentLocation(), c1.getDestination());
        double sFare1 = 25.0 + soloDist1 * 8.0;
        customer1Ext.put("fare", fVal1);
        customer1Ext.put("solo_fare", sFare1);
        customer1Ext.put("saving", Math.max(0.0, sFare1 - fVal1));
        customer1Ext.put("discount_percent", Math.max(0.0, (sFare1 - fVal1) / sFare1 * 100.0));
        response.put("customer", customer1Ext);

        Map<String, Object> vDict = new HashMap<>();
        vDict.put("id", vehicle.getId());
        vDict.put("start_location", oldVehicleLoc);
        vDict.put("end_location", vehicle.getCurrentLocation());
        response.put("vehicle", vDict);

        response.put("pickup", bestMatch.get("pickup"));
        response.put("trip", bestMatch.get("trip"));

        List<Map<String, Object>> tripAlternatives = new ArrayList<>();
        // Add best match as first alternative
        Map<String, Object> bestAlt = new HashMap<>();
        bestAlt.put("type", combo.size() > 1 ? "shared" : "solo");
        bestAlt.put("badge_class", "shortest");
        bestAlt.put("badge_text", combo.size() > 1 ? "En Verimli Rota (" + combo.size() + " Kişilik)" : "En Kısa Rota (Solo)");
        bestAlt.put("pickup", bestMatch.get("pickup"));
        bestAlt.put("trip", bestMatch.get("trip"));
        bestAlt.put("total_distance", bestMatch.get("total_distance"));
        bestAlt.put("passenger_count", combo.size());
        
        List<Map<String, Object>> bestCustData = new ArrayList<>();
        for (Customer p : combo) {
            Map<String, Object> cd = customerToDict(p);
            double fVal = ((Map<Integer, Double>)bestMatch.get("fares")).getOrDefault(p.getId(), 0.0);
            double sDist = calculateDistance(manager, p.getCurrentLocation(), p.getDestination());
            double sFare = 25.0 + sDist * 8.0;
            cd.put("fare", fVal);
            cd.put("solo_fare", sFare);
            cd.put("saving", Math.max(0.0, sFare - fVal));
            cd.put("discount_percent", Math.max(0.0, (sFare - fVal) / sFare * 100.0));
            bestCustData.add(cd);
        }
        bestAlt.put("customers", bestCustData);
        bestAlt.put("savings", bestMatch.get("total_savings"));
        bestAlt.put("score", bestMatch.get("score"));
        tripAlternatives.add(bestAlt);

        List<String> addedRoutes = new ArrayList<>();
        addedRoutes.add(String.join("->", (List<String>) ((Map<String, Object>) bestMatch.get("trip")).get("route")));

        for (int i = 1; i < candidates.size() && tripAlternatives.size() < 3; i++) {
            Map<String, Object> cand = candidates.get(i);
            List<String> candRoute = (List<String>) ((Map<String, Object>) cand.get("trip")).get("route");
            String candRouteStr = String.join("->", candRoute);
            
            if (!addedRoutes.contains(candRouteStr)) {
                addedRoutes.add(candRouteStr);

                Map<String, Object> alt = new HashMap<>();
                List<Customer> cCombo = (List<Customer>) cand.get("combo");
                alt.put("type", cCombo.size() > 1 ? "shared" : "solo");
                alt.put("badge_class", "alternative");
                alt.put("badge_text", "Alternatif " + tripAlternatives.size() + " (" + cCombo.size() + " Kişilik)");
                alt.put("pickup", cand.get("pickup"));
                alt.put("trip", cand.get("trip"));
                alt.put("total_distance", cand.get("total_distance"));
                alt.put("passenger_count", cCombo.size());

                List<Map<String, Object>> bestCustDataCand = new ArrayList<>();
                for (Customer p : cCombo) {
                    Map<String, Object> cd = customerToDict(p);
                    double fVal = ((Map<Integer, Double>) cand.get("fares")).getOrDefault(p.getId(), 0.0);
                    double sDist = calculateDistance(manager, p.getCurrentLocation(), p.getDestination());
                    double sFare = 25.0 + sDist * 8.0;
                    cd.put("fare", fVal);
                    cd.put("solo_fare", sFare);
                    cd.put("saving", Math.max(0.0, sFare - fVal));
                    cd.put("discount_percent", Math.max(0.0, (sFare - fVal) / sFare * 100.0));
                    bestCustDataCand.add(cd);
                }
                alt.put("customers", bestCustDataCand);
                alt.put("savings", cand.get("total_savings"));
                alt.put("score", cand.get("score"));
                tripAlternatives.add(alt);
            }
        }

        // K-Shortest for Solo 
        if (tripAlternatives.size() < 3 && combo.size() == 1) {
            List<PathResult> kPaths = Routing.findKShortestPaths(manager, c1.getCurrentLocation(), c1.getDestination(), 3);
            for (int i=0; i<kPaths.size() && tripAlternatives.size() < 3; i++) {
                PathResult pRes = kPaths.get(i);
                Map<String, Object> alt = new HashMap<>();
                alt.put("type", "solo");
                alt.put("badge_class", "alternative");
                alt.put("badge_text", "Alternatif Rota " + i + " (Solo)");
                Map<String, Object> pickup = (Map<String, Object>) bestMatch.get("pickup");
                alt.put("pickup", pickup);
                Map<String, Object> trip = new HashMap<>();
                trip.put("distance", pRes.getDistance());
                trip.put("route", pRes.getPath());
                alt.put("trip", trip);
                double puDist = (double) pickup.get("distance");
                alt.put("total_distance", puDist + pRes.getDistance());
                alt.put("passenger_count", 1);
                
                List<Map<String, Object>> cData = new ArrayList<>();
                Map<String, Object> cd = customerToDict(c1);
                double sFare = 25.0 + pRes.getDistance() * 8.0;
                cd.put("fare", sFare);
                cd.put("solo_fare", sFare);
                cd.put("saving", 0.0);
                cd.put("discount_percent", 0.0);
                cData.add(cd);
                alt.put("customers", cData);
                alt.put("savings", 0.0);
                alt.put("score", 1.0 / (puDist + pRes.getDistance()));
                tripAlternatives.add(alt);
            }
        }

        response.put("trip_alternatives", tripAlternatives);
        response.put("total_distance", bestMatch.get("total_distance"));
        response.put("savings", combo.size() > 1 ? bestMatch.get("total_savings") : 0.0);
        response.put("score", bestMatch.get("score"));

        StringBuilder names = new StringBuilder();
        for (int i = 0; i < combo.size(); i++) {
            names.append(combo.get(i).getName());
            if (i < combo.size() - 1) names.append(" ve ");
        }

        List<String> tripRoute = (List<String>) ((Map<String, Object>) bestMatch.get("trip")).get("route");
        String matchLog;
        if (combo.size() > 1) {
            matchLog = String.format(Locale.US, "%d'LÜ PAYLAŞIM (Skor: %.4f): %s taksi %s'de! Rota: %s (%.2f km).",
                    combo.size(), (double)bestMatch.get("score"), names.toString(), vehicle.getId(), String.join("->", tripRoute), (double)bestMatch.get("total_distance"));
        } else {
            matchLog = String.format(Locale.US, "SOLO (Skor: %.4f): %s -> %s. Rota: %s (%.2f km).",
                    (double)bestMatch.get("score"), c1.getName(), vehicle.getId(), String.join("->", tripRoute), (double)bestMatch.get("total_distance"));
        }
        manager.addLog(matchLog);
        response.put("log", matchLog);

        if (combo.size() >= 2) {
            Map<String, Object> customer2Ext = customerToDict(combo.get(1));
            double fVal = ((Map<Integer, Double>)bestMatch.get("fares")).getOrDefault(combo.get(1).getId(), 0.0);
            double sDist = calculateDistance(manager, combo.get(1).getCurrentLocation(), combo.get(1).getDestination());
            double sFare = 25.0 + sDist * 8.0;
            customer2Ext.put("fare", fVal);
            customer2Ext.put("solo_fare", sFare);
            customer2Ext.put("saving", Math.max(0.0, sFare - fVal));
            response.put("customer_2", customer2Ext);
        }
        if (combo.size() >= 3) {
            Map<String, Object> customer3Ext = customerToDict(combo.get(2));
            double fVal = ((Map<Integer, Double>)bestMatch.get("fares")).getOrDefault(combo.get(2).getId(), 0.0);
            double sDist = calculateDistance(manager, combo.get(2).getCurrentLocation(), combo.get(2).getDestination());
            double sFare = 25.0 + sDist * 8.0;
            customer3Ext.put("fare", fVal);
            customer3Ext.put("solo_fare", sFare);
            customer3Ext.put("saving", Math.max(0.0, sFare - fVal));
            response.put("customer_3", customer3Ext);
        }

        return response;
    }

    private static Map<String, Object> customerToDict(Customer c) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", c.getId());
        map.put("name", c.getName());
        map.put("current_location", c.getCurrentLocation());
        map.put("destination", c.getDestination());
        return map;
    }
}
