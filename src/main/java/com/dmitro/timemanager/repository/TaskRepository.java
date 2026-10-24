package com.dmitro.timemanager.repository;

import com.dmitro.timemanager.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring сам создаст реализацию: save, findAll, findById, deleteById и т.д.
 */
public interface TaskRepository extends JpaRepository<Task, Long> {
}
