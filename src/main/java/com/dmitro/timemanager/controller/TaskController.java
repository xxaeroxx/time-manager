package com.dmitro.timemanager.controller;

import com.dmitro.timemanager.model.Status;
import com.dmitro.timemanager.model.Task;
import com.dmitro.timemanager.repository.TaskRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * REST API для задач. Фронтенд (app.js) обращается сюда через fetch().
 *
 * GET    /api/tasks            — список задач
 * POST   /api/tasks            — создать задачу
 * PUT    /api/tasks/{id}       — изменить задачу
 * PATCH  /api/tasks/{id}/status — сменить статус
 * POST   /api/tasks/{id}/time  — добавить потраченное время {"seconds": 60}
 * DELETE /api/tasks/{id}       — удалить задачу
 * GET    /api/stats            — статистика
 */
@RestController
@RequestMapping("/api")
public class TaskController {

    private final TaskRepository repository;

    public TaskController(TaskRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/tasks")
    public List<Task> getAll() {
        return repository.findAll();
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public Task create(@Valid @RequestBody Task task) {
        task.setId(null);
        task.setSpentSeconds(0);
        return repository.save(task);
    }

    @PutMapping("/tasks/{id}")
    public Task update(@PathVariable Long id, @Valid @RequestBody Task updated) {
        Task task = find(id);
        task.setTitle(updated.getTitle());
        task.setDescription(updated.getDescription());
        task.setPriority(updated.getPriority());
        task.setStatus(updated.getStatus());
        task.setDeadline(updated.getDeadline());
        return repository.save(task);
    }

    @PatchMapping("/tasks/{id}/status")
    public Task changeStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Task task = find(id);
        try {
            task.setStatus(Status.valueOf(body.get("status")));
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неверный статус");
        }
        return repository.save(task);
    }

    @PostMapping("/tasks/{id}/time")
    public Task addTime(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long seconds = body.get("seconds");
        if (seconds == null || seconds <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "seconds должно быть > 0");
        }
        Task task = find(id);
        task.setSpentSeconds(task.getSpentSeconds() + seconds);
        if (task.getStatus() == Status.TODO) {
            task.setStatus(Status.IN_PROGRESS);
        }
        return repository.save(task);
    }

    @DeleteMapping("/tasks/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Задача не найдена");
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        List<Task> tasks = repository.findAll();
        long done = tasks.stream().filter(t -> t.getStatus() == Status.DONE).count();
        long totalSeconds = tasks.stream().mapToLong(Task::getSpentSeconds).sum();
        return Map.of(
                "total", tasks.size(),
                "done", done,
                "totalSeconds", totalSeconds
        );
    }

    private Task find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Задача не найдена"));
    }
}
