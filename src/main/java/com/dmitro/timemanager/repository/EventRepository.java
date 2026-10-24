package com.dmitro.timemanager.repository;

import com.dmitro.timemanager.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {

    /**
     * События, которые пересекаются с промежутком [from, to).
     * Spring сам построит SQL по имени метода:
     * WHERE start_at < :to AND end_at > :from
     */
    List<Event> findByStartLessThanAndEndGreaterThan(LocalDateTime to, LocalDateTime from);
}
