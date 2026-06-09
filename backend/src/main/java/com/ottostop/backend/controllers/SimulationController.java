package com.ottostop.backend.controllers;

import com.ottostop.backend.models.Customer;
import com.ottostop.backend.models.Edge;
import com.ottostop.backend.models.Vehicle;
import com.ottostop.backend.models.Vertex;
import com.ottostop.backend.simulation.SimulationManager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class SimulationController {

    private final SimulationManager systemManager;
    private int customerIdCounter = 100;

    public SimulationController() {
        this.systemManager = new SimulationManager();
        this.systemManager.initializeSystem();
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        List<Map<String, Object>> vehiclesData = new ArrayList<>();
        for (Vehicle v : systemManager.getLocalVehicles()) {
            Map<String, Object> vd = new HashMap<>();
            vd.put("id", v.getId());
            vd.put("current_location", v.getCurrentLocation());
            vd.put("is_available", v.getIsAvailable());
            List<Map<String, Object>> acData = new ArrayList<>();
            for (Customer c : v.getActiveCustomers()) {
                acData.add(customerToDict(c));
            }
            vd.put("active_customers", acData);
            vehiclesData.add(vd);
        }

        List<Map<String, Object>> customersData = new ArrayList<>();
        for (Customer c : systemManager.getWaitingCustomers()) {
            customersData.add(customerToDict(c));
        }

        Map<String, Object> cityMapDict = new HashMap<>();
        for (Map.Entry<String, Vertex> entry : systemManager.getCityMap().getVertices().entrySet()) {
            Map<String, Object> vd = new HashMap<>();
            vd.put("name", entry.getValue().getName());
            List<Map<String, Object>> adjData = new ArrayList<>();
            for (Edge edge : entry.getValue().getAdjacencies()) {
                Map<String, Object> ed = new HashMap<>();
                ed.put("target", edge.getTarget().getName());
                ed.put("weight", edge.getWeight());
                adjData.add(ed);
            }
            vd.put("adjacencies", adjData);
            cityMapDict.put(entry.getKey(), vd);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("city_map", cityMapDict);
        response.put("vehicles", vehiclesData);
        response.put("waiting_count", systemManager.getWaitingCustomers().size());
        response.put("waiting_customers", customersData);
        response.put("logs", systemManager.getLogs());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/customer")
    public ResponseEntity<Map<String, Object>> addCustomer(@RequestBody Map<String, String> data) {
        if (data == null) {
            return ResponseEntity.badRequest().body(errorMap("Geçersiz veya boş veri gövdesi."));
        }

        String name = data.get("name");
        String currentLocation = data.get("current_location");
        String destination = data.get("destination");

        if (name == null || currentLocation == null || destination == null) {
            return ResponseEntity.badRequest().body(errorMap("Eksik parametreler! 'name', 'current_location' ve 'destination' alanları zorunludur."));
        }

        if (!systemManager.getCityMap().getVertices().containsKey(currentLocation)) {
            return ResponseEntity.badRequest().body(errorMap("Başlangıç durağı '" + currentLocation + "' haritada mevcut değil."));
        }
        if (!systemManager.getCityMap().getVertices().containsKey(destination)) {
            return ResponseEntity.badRequest().body(errorMap("Hedef durak '" + destination + "' haritada mevcut değil."));
        }
        if (currentLocation.equals(destination)) {
            return ResponseEntity.badRequest().body(errorMap("Başlangıç ve hedef durakları aynı olamaz!"));
        }

        customerIdCounter++;
        Customer newCustomer = new Customer(customerIdCounter, name, currentLocation, destination);
        systemManager.addCustomerToQueue(newCustomer);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Müşteri " + name + " kuyruğa başarıyla eklendi.");
        response.put("customer", customerToDict(newCustomer));
        response.put("waiting_count", systemManager.getWaitingCustomers().size());

        return ResponseEntity.status(201).body(response);
    }

    @PostMapping("/simulation/step")
    public ResponseEntity<Map<String, Object>> simulationStep(@RequestBody(required = false) Map<String, String> data) {
        if (systemManager.getWaitingCustomers().isEmpty()) {
            return ResponseEntity.badRequest().body(errorMap("Kuyrukta bekleyen müşteri bulunmamaktadır. Lütfen önce yeni bir müşteri ekleyin."));
        }

        String selectedVehicleId = data != null ? data.get("vehicle_id") : null;

        Map<String, Object> stepResult = systemManager.processNextCustomer(selectedVehicleId);

        if (stepResult == null) {
            return ResponseEntity.status(500).body(errorMap("Simülasyon adımı işlenirken beklenmedik bir hata oluştu veya kuyruk boş."));
        }

        if (Boolean.FALSE.equals(stepResult.get("success"))) {
            Map<String, Object> warningRes = new HashMap<>();
            warningRes.put("status", "warning");
            warningRes.put("message", stepResult.get("message"));
            warningRes.put("customer", stepResult.get("customer"));
            return ResponseEntity.ok(warningRes);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("step_data", stepResult);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/simulation/revert")
    public ResponseEntity<Map<String, Object>> revertSimulationStep(@RequestBody Map<String, Object> data) {
        if (data == null) {
            return ResponseEntity.badRequest().body(errorMap("Boş veri gövdesi."));
        }

        String vehicleId = (String) data.get("vehicle_id");
        String startLocation = (String) data.get("start_location");
        List<Map<String, Object>> customers = (List<Map<String, Object>>) data.getOrDefault("customers", new ArrayList<>());

        if (vehicleId == null || startLocation == null) {
            return ResponseEntity.badRequest().body(errorMap("Eksik parametreler."));
        }

        Vehicle vehicle = null;
        for (Vehicle v : systemManager.getLocalVehicles()) {
            if (v.getId().equals(vehicleId)) {
                vehicle = v;
                break;
            }
        }

        if (vehicle != null) {
            vehicle.setCurrentLocation(startLocation);
            vehicle.setIsAvailable(true);
            vehicle.setActiveCustomers(new ArrayList<>());
        }

        Set<Integer> existingIds = new HashSet<>();
        for (Customer c : systemManager.getWaitingCustomers()) {
            existingIds.add(c.getId());
        }

        List<Map<String, Object>> reversedCustomers = new ArrayList<>(customers);
        Collections.reverse(reversedCustomers);

        for (Map<String, Object> custData : reversedCustomers) {
            if (custData != null) {
                int id = (Integer) custData.get("id");
                if (!existingIds.contains(id)) {
                    Customer newCust = new Customer(
                            id,
                            (String) custData.get("name"),
                            (String) custData.get("current_location"),
                            (String) custData.get("destination")
                    );
                    systemManager.getWaitingCustomers().addFirst(newCust);
                }
            }
        }

        systemManager.addLog("İPTAL: " + vehicleId + " taksisinin seyahati iptal edildi. Araç " + startLocation + " noktasına geri döndü ve yolcular kuyruğa geri alındı.");

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Seyahat başarıyla iptal edildi ve sistem durumu geri alındı.");

        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetSystem() {
        systemManager.initializeSystem();
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Sistem başarıyla sıfırlandı ve yeniden başlatıldı.");
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> errorMap(String message) {
        Map<String, Object> map = new HashMap<>();
        map.put("status", "error");
        map.put("message", message);
        return map;
    }

    private Map<String, Object> customerToDict(Customer c) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", c.getId());
        map.put("name", c.getName());
        map.put("current_location", c.getCurrentLocation());
        map.put("destination", c.getDestination());
        return map;
    }
}
