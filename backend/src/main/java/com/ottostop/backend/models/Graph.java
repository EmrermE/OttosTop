package com.ottostop.backend.models;

import java.util.HashMap;
import java.util.Map;

public class Graph {
    private Map<String, Vertex> vertices;

    public Graph() {
        this.vertices = new HashMap<>();
    }

    public Vertex getOrCreateVertex(String name) {
        if (!vertices.containsKey(name)) {
            vertices.put(name, new Vertex(name));
        }
        return vertices.get(name);
    }

    public void addRoute(String source, String dest, double distance, boolean bidirectional) {
        Vertex sourceVertex = getOrCreateVertex(source);
        Vertex destVertex = getOrCreateVertex(dest);

        sourceVertex.addEdge(destVertex, distance);

        if (bidirectional) {
            destVertex.addEdge(sourceVertex, distance);
        }
    }

    public Map<String, Vertex> getVertices() {
        return vertices;
    }
}
