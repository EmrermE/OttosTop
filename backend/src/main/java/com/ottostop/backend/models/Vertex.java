package com.ottostop.backend.models;

import java.util.ArrayList;
import java.util.List;

public class Vertex {
    private String name;
    private List<Edge> adjacencies;

    public Vertex(String name) {
        this.name = name;
        this.adjacencies = new ArrayList<>();
    }

    public void addEdge(Vertex targetVertex, double weight) {
        Edge edge = new Edge(targetVertex, weight);
        this.adjacencies.add(edge);
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<Edge> getAdjacencies() { return adjacencies; }
    public void setAdjacencies(List<Edge> adjacencies) { this.adjacencies = adjacencies; }
}
