package com.dmitro.timemanager.controller;

import com.dmitro.timemanager.model.Event;
import com.dmitro.timemanager.repository.EventRepository;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * REST API календаря. Его вызывает calendar.js.
 *
 * GET    /api/events?start=2026-10-01T00:00:00&end=2026-11-01T00:00:00
 * POST   /api/events
 * PUT    /api/events/{id}
 * DELETE /api/events/{id}
 */
@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventRepository repository;

    public EventController(EventRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Event> getInRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return repository.findByStartLessThanAndEndGreaterThan(end, start);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Event create(@Valid @RequestBody Event event) {
        event.setId(null);
        normalize(event);
        return repository.save(event);
    }

    @PutMapping("/{id}")
    public Event update(@PathVariable Long id, @Valid @RequestBody Event updated) {
        Event event = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Событие не найдено"));
        event.setTitle(updated.getTitle());
        event.setDescription(updated.getDescription());
        event.setStart(updated.getStart());
        event.setEnd(updated.getEnd());
        event.setAllDay(updated.isAllDay());
        event.setColor(updated.getColor());
        normalize(event);
        return repository.save(event);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Событие не найдено");
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Проверяем и исправляем время окончания и цвет. */
    private void normalize(Event e) {
        if (e.isAllDay()) {
            // весь день: от 00:00 до 00:00 следующего дня (минимум один день)
            e.setStart(e.getStart().toLocalDate().atStartOfDay());
            if (e.getEnd() == null || !e.getEnd().isAfter(e.getStart())) {
                e.setEnd(e.getStart().plusDays(1));
            } else {
                e.setEnd(e.getEnd().toLocalDate().atStartOfDay());
                if (!e.getEnd().isAfter(e.getStart())) e.setEnd(e.getStart().plusDays(1));
            }
        } else if (e.getEnd() == null) {
            e.setEnd(e.getStart().plusHours(1));
        } else if (!e.getEnd().isAfter(e.getStart())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Окончание должно быть позже начала");
        }
        if (e.getColor() == null || !e.getColor().matches("#[0-9a-fA-F]{6}")) {
            e.setColor("#039be5");
        }
    }
}
