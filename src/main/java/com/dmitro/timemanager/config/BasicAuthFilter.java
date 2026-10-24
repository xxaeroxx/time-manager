package com.dmitro.timemanager.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Простая защита паролем (HTTP Basic Auth) для всего сайта.
 * Браузер (и на телефоне тоже) один раз спросит логин и пароль и запомнит их.
 *
 * Логин и пароль задаются в application.properties:
 *   app.auth.username=...
 *   app.auth.password=...
 * Если пароль пустой — защита выключена.
 */
@Component
public class BasicAuthFilter extends OncePerRequestFilter {

    private final String username;
    private final String password;

    public BasicAuthFilter(@Value("${app.auth.username:admin}") String username,
                           @Value("${app.auth.password:}") String password) {
        this.username = username;
        this.password = password;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (password.isBlank() || isAuthorized(request.getHeader("Authorization"))) {
            chain.doFilter(request, response);
            return;
        }
        response.setHeader("WWW-Authenticate", "Basic realm=\"Time Manager\", charset=\"UTF-8\"");
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Нужен логин и пароль");
    }

    private boolean isAuthorized(String header) {
        if (header == null || !header.startsWith("Basic ")) return false;
        String decoded;
        try {
            decoded = new String(Base64.getDecoder().decode(header.substring(6).trim()), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return false;
        }
        int colon = decoded.indexOf(':');
        if (colon < 0) return false;
        // Сравнение за постоянное время — чтобы пароль нельзя было подобрать по времени ответа
        boolean userOk = MessageDigest.isEqual(
                decoded.substring(0, colon).getBytes(StandardCharsets.UTF_8),
                username.getBytes(StandardCharsets.UTF_8));
        boolean passOk = MessageDigest.isEqual(
                decoded.substring(colon + 1).getBytes(StandardCharsets.UTF_8),
                password.getBytes(StandardCharsets.UTF_8));
        return userOk & passOk;
    }
}
