package com.ottostop.backend.simulation;

import com.ottostop.backend.models.Customer;
import com.ottostop.backend.models.Graph;
import com.ottostop.backend.models.Vehicle;

import java.util.*;

import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public class SimulationManager {
    private Graph cityMap;
    private List<Vehicle> localVehicles;
    private Deque<Customer> waitingCustomers;
    private List<String> logs;
    private Map<String, Object> pathCache; // Simplified cache key to string for Java

    public SimulationManager() {
        this.cityMap = new Graph();
        this.localVehicles = new CopyOnWriteArrayList<>();
        this.waitingCustomers = new ConcurrentLinkedDeque<>();
        this.logs = new CopyOnWriteArrayList<>();
        this.pathCache = new ConcurrentHashMap<>();
    }

    public Graph getCityMap() { return cityMap; }
    public List<Vehicle> getLocalVehicles() { return localVehicles; }
    public Deque<Customer> getWaitingCustomers() { return waitingCustomers; }
    public List<String> getLogs() { return logs; }
    public Map<String, Object> getPathCache() { return pathCache; }

    public void addLog(String message) {
        this.logs.add(message);
    }

    public void addCustomerToQueue(Customer customer) {
        waitingCustomers.addLast(customer);
        addLog(String.format("Müşteri %s (ID: %d), kuyruğa eklendi. Başlangıç: %s -> Hedef: %s",
                customer.getName(), customer.getId(), customer.getCurrentLocation(), customer.getDestination()));
    }

    public void initializeSystem() {
        Setup.initializeSystem(this);
    }

    public PathResult findShortestPath(String startName, String endName) {
        return Routing.findShortestPath(this, startName, endName);
    }

    public List<PathResult> findKShortestPaths(String startName, String endName, int k) {
        return Routing.findKShortestPaths(this, startName, endName, k);
    }

    public Map<String, Object> processNextCustomer(String selectedVehicleId) {
        return Matching.processNextCustomer(this, selectedVehicleId);
    }
}
