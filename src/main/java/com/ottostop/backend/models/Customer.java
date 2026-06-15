package com.ottostop.backend.models;

public class Customer {
    private int id;
    private String name;
    private String currentLocation;
    private String destination;

    public Customer(int id, String name, String currentLocation, String destination) {
        this.id = id;
        this.name = name;
        this.currentLocation = currentLocation;
        this.destination = destination;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCurrentLocation() { return currentLocation; }
    public void setCurrentLocation(String currentLocation) { this.currentLocation = currentLocation; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
}
