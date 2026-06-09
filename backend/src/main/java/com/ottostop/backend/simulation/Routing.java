package com.ottostop.backend.simulation;

import com.ottostop.backend.models.Edge;
import com.ottostop.backend.models.Vertex;

import java.util.*;

public class Routing {

    public static PathResult findShortestPath(SimulationManager manager, String startName, String endName) {
        String cacheKey = startName + "->" + endName;
        if (manager.getPathCache().containsKey(cacheKey)) {
            return (PathResult) manager.getPathCache().get(cacheKey);
        }

        if (!manager.getCityMap().getVertices().containsKey(startName) || !manager.getCityMap().getVertices().containsKey(endName)) {
            return new PathResult(Double.POSITIVE_INFINITY, new ArrayList<>());
        }

        Map<String, Double> distances = new HashMap<>();
        Map<String, String> previousVertices = new HashMap<>();

        for (String name : manager.getCityMap().getVertices().keySet()) {
            distances.put(name, Double.POSITIVE_INFINITY);
            previousVertices.put(name, null);
        }
        distances.put(startName, 0.0);

        PriorityQueue<NodeDistance> priorityQueue = new PriorityQueue<>(Comparator.comparingDouble(nd -> nd.distance));
        priorityQueue.add(new NodeDistance(startName, 0.0));

        while (!priorityQueue.isEmpty()) {
            NodeDistance current = priorityQueue.poll();
            String currentVertexName = current.nodeName;
            double currentDistance = current.distance;

            if (currentDistance > distances.get(currentVertexName)) {
                continue;
            }

            if (currentVertexName.equals(endName)) {
                break;
            }

            Vertex currentVertex = manager.getCityMap().getVertices().get(currentVertexName);
            for (Edge edge : currentVertex.getAdjacencies()) {
                String neighborName = edge.getTarget().getName();
                double distance = currentDistance + edge.getWeight();

                if (distance < distances.get(neighborName)) {
                    distances.put(neighborName, distance);
                    previousVertices.put(neighborName, currentVertexName);
                    priorityQueue.add(new NodeDistance(neighborName, distance));
                }
            }
        }

        List<String> path = new ArrayList<>();
        String current = endName;

        while (current != null) {
            path.add(current);
            current = previousVertices.get(current);
        }

        Collections.reverse(path);

        PathResult res;
        if (distances.get(endName) == Double.POSITIVE_INFINITY) {
            res = new PathResult(Double.POSITIVE_INFINITY, new ArrayList<>());
        } else {
            res = new PathResult(distances.get(endName), path);
        }

        manager.getPathCache().put(cacheKey, res);
        return res;
    }

    public static List<PathResult> findKShortestPaths(SimulationManager manager, String startName, String endName, int k) {
        if (!manager.getCityMap().getVertices().containsKey(startName) || !manager.getCityMap().getVertices().containsKey(endName)) {
            return new ArrayList<>();
        }

        PathResult shortest = findShortestPath(manager, startName, endName);
        if (shortest.getDistance() == Double.POSITIVE_INFINITY || shortest.getPath().isEmpty()) {
            return new ArrayList<>();
        }

        List<PathResult> A = new ArrayList<>();
        A.add(shortest);
        List<PathResult> B = new ArrayList<>();

        for (int i = 1; i < k; i++) {
            for (int j = 0; j < A.get(i - 1).getPath().size() - 1; j++) {
                String spurNode = A.get(i - 1).getPath().get(j);
                List<String> rootPath = new ArrayList<>(A.get(i - 1).getPath().subList(0, j + 1));

                List<RemovedEdge> removedEdges = new ArrayList<>();

                for (PathResult pathResultA : A) {
                    List<String> pathA = pathResultA.getPath();
                    if (pathA.size() > j && pathA.subList(0, j + 1).equals(rootPath)) {
                        String u = pathA.get(j);
                        String v = pathA.get(j + 1);
                        Vertex uVertex = manager.getCityMap().getVertices().get(u);

                        Iterator<Edge> iterator = uVertex.getAdjacencies().iterator();
                        while (iterator.hasNext()) {
                            Edge edge = iterator.next();
                            if (edge.getTarget().getName().equals(v)) {
                                removedEdges.add(new RemovedEdge(u, edge));
                                iterator.remove();
                            }
                        }
                    }
                }

                List<RemovedNode> removedNodes = new ArrayList<>();
                for (int m = 0; m < rootPath.size() - 1; m++) {
                    String node = rootPath.get(m);
                    if (manager.getCityMap().getVertices().containsKey(node)) {
                        Vertex vertex = manager.getCityMap().getVertices().get(node);
                        removedNodes.add(new RemovedNode(node, new ArrayList<>(vertex.getAdjacencies())));
                        vertex.setAdjacencies(new ArrayList<>());
                    }
                }

                // Temporary clear cache to force recalculation without removed edges
                Map<String, Object> oldCache = new HashMap<>(manager.getPathCache());
                manager.getPathCache().clear();

                PathResult spurResult = findShortestPath(manager, spurNode, endName);

                manager.getPathCache().clear();
                manager.getPathCache().putAll(oldCache);

                // Restore
                for (RemovedNode rn : removedNodes) {
                    manager.getCityMap().getVertices().get(rn.nodeName).setAdjacencies(rn.adjacencies);
                }
                for (RemovedEdge re : removedEdges) {
                    manager.getCityMap().getVertices().get(re.u).getAdjacencies().add(re.edge);
                }

                if (spurResult.getDistance() != Double.POSITIVE_INFINITY && !spurResult.getPath().isEmpty()) {
                    List<String> totalPath = new ArrayList<>(rootPath.subList(0, rootPath.size() - 1));
                    totalPath.addAll(spurResult.getPath());

                    double totalDist = 0.0;
                    for (int m = 0; m < totalPath.size() - 1; m++) {
                        PathResult segRes = findShortestPath(manager, totalPath.get(m), totalPath.get(m + 1));
                        totalDist += segRes.getDistance();
                    }

                    boolean inA = false;
                    for (PathResult pA : A) {
                        if (pA.getPath().equals(totalPath)) { inA = true; break; }
                    }
                    boolean inB = false;
                    for (PathResult pB : B) {
                        if (pB.getPath().equals(totalPath)) { inB = true; break; }
                    }

                    if (!inA && !inB) {
                        B.add(new PathResult(totalDist, totalPath));
                    }
                }
            }

            if (B.isEmpty()) {
                break;
            }

            B.sort(Comparator.comparingDouble(PathResult::getDistance));
            A.add(B.remove(0));
        }

        return A;
    }

    private static class NodeDistance {
        String nodeName;
        double distance;
        NodeDistance(String nodeName, double distance) {
            this.nodeName = nodeName;
            this.distance = distance;
        }
    }

    private static class RemovedEdge {
        String u;
        Edge edge;
        RemovedEdge(String u, Edge edge) {
            this.u = u;
            this.edge = edge;
        }
    }

    private static class RemovedNode {
        String nodeName;
        List<Edge> adjacencies;
        RemovedNode(String nodeName, List<Edge> adjacencies) {
            this.nodeName = nodeName;
            this.adjacencies = adjacencies;
        }
    }
}
