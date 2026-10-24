package com.dmitro.timemanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Точка входа. После запуска сайт доступен на http://localhost:8080
 */
@SpringBootApplication
public class TimeManagerApplication {

    public static void main(String[] args) {
        SpringApplication.run(TimeManagerApplication.class, args);
    }
}
