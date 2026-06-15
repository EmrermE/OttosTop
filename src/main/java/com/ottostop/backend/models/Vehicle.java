package com.ottostop.backend.models;

import java.util.ArrayList;
import java.util.List;

public class Vehicle {
    private String id;
    private String currentLocation;
    private boolean isAvailable;
    private List<Customer> activeCustomers;

    public Vehicle(String id, String currentLocation) {
        this(id, currentLocation, true);
    }

    public Vehicle(String id, String currentLocation, boolean isAvailable) {
        this.id = id;
        this.currentLocation = currentLocation;
        this.isAvailable = isAvailable;
        this.activeCustomers = new ArrayList<>();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCurrentLocation() { return currentLocation; }
    public void setCurrentLocation(String currentLocation) { this.currentLocation = currentLocation; }

    public boolean getIsAvailable() { return isAvailable; }
    public void setIsAvailable(boolean isAvailable) { this.isAvailable = isAvailable; }

    public List<Customer> getActiveCustomers() { return activeCustomers; }
    public void setActiveCustomers(List<Customer> activeCustomers) { this.activeCustomers = activeCustomers; }
}
