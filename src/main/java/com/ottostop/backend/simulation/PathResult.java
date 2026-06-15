package com.ottostop.backend.simulation;

import java.util.List;

public class PathResult {
    private double distance;
    private List<String> path;

    public PathResult(double distance, List<String> path) {
        this.distance = distance;
        this.path = path;
    }

    public double getDistance() { return distance; }
    public List<String> getPath() { return path; }
}
