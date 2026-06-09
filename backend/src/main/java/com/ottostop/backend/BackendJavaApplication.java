package com.ottostop.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendJavaApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendJavaApplication.class, args);
		System.out.println("\n---------------------------------------------------------");
		System.out.println("🚀 OttosTop Simülasyonu Başarıyla Çalıştırıldı!");
		System.out.println("🌐 Tarayıcınızdan şu adrese gidebilirsiniz: http://localhost:8080");
		System.out.println("---------------------------------------------------------\n");
	}

}
