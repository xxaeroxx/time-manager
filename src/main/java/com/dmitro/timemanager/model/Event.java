package com.dmitro.timemanager.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * Событие календаря (встреча, пара, тренировка и т.п.).
 * Таблица называется CALENDAR_EVENT, потому что EVENT — зарезервированное слово в SQL.
 */
@Entity
@Table(name = "calendar_event")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Название не может быть пустым")
    @Size(max = 200)
    private String title;

    @Size(max = 1000)
    private String description;

    @NotNull(message = "Укажите начало")
    @Column(name = "start_at")
    private LocalDateTime start;

    @Column(name = "end_at")
    private LocalDateTime end;

    /** Событие на весь день (без времени) */
    private boolean allDay;

    /** Цвет в формате #RRGGBB */
    @Size(max = 7)
    private String color = "#039be5";

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getStart() { return start; }
    public void setStart(LocalDateTime start) { this.start = start; }

    public LocalDateTime getEnd() { return end; }
    public void setEnd(LocalDateTime end) { this.end = end; }

    public boolean isAllDay() { return allDay; }
    public void setAllDay(boolean allDay) { this.allDay = allDay; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
}
