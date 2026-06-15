# OttosTop - Ride-Sharing Simulation Backend

OttosTop is a backend simulation project built with Java and Spring Boot that focuses on ride-sharing and dynamic taxi routing. It simulates a ride-sharing environment where vehicles are optimally matched with passengers based on distance, capacity (up to 3 people), and fare savings.

## Features

- **Dynamic Matching Algorithm:** Evaluates possible combinations of passengers (solo, duo, or trio) to find the most cost-effective and efficient ride-sharing matches.
- **Advanced Routing:** Computes shortest paths using graph-based routing algorithms and offers K-Shortest Paths generation for route alternatives.
- **Fare & Savings Calculation:** Intelligently splits fares among passengers in shared rides, maximizing overall savings while penalizing unnecessary detours.
- **Simulation Management:** Keeps track of active vehicles, idle vehicles, and the queue of waiting customers dynamically.

## Tech Stack

- **Java 17**
- **Spring Boot 4.0.6** (WebMVC)
- **Gradle** for build and dependency management

## Prerequisites

- Java Development Kit (JDK) 17 or higher
- Gradle (optional, since a wrapper is included)

## Running the Application

You can easily run the application using the included Gradle wrapper.

### Windows
```cmd
gradlew.bat bootRun
```

### macOS/Linux
```bash
./gradlew bootRun
```

By default, the application will start on `localhost:8080` (or whatever port is specified in your `application.properties`).

## Running Tests

To run the automated tests:

### Windows
```cmd
gradlew.bat test
```

### macOS/Linux
```bash
./gradlew test
```

## Structure Overview

- `src/main/java/com/ottostop/backend/models/`: Contains the entity definitions such as `Customer`, `Vehicle`, `Edge`, and `Vertex`.
- `src/main/java/com/ottostop/backend/simulation/`: Core algorithmic logic for graph-based `Routing`, passenger `Matching`, and overall `SimulationManager`.
- `src/main/java/com/ottostop/backend/controllers/`: REST API endpoints to interface with the frontend simulation visualizer.
