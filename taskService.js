/*
* @module takService
* @description Бизнес-логика работы с задачами.
* Модуль не обращается к файловой системе: получает и возвращает данные через аргументы.
* */

import { randomUUID } from 'node:crypto';

// Список допустимых статусов задачи
export const STATUSES = Object.freeze(['todo', 'in_progress', 'done']);
// Человекочитаемые названия статусов
export const STATUS_LABELS = Object.freeze({
    todo: 'К выполнению',
    in_progress: 'В работе',
    done: 'Выполнено',
});

// Ошибка бизнес-логики (невалидные данные, задача не найдена и т.п.).
export class TaskError extends Error {
    /*
    * @param {string} message - описание ошибки для пользователя
    * @param {string} code - машиночитаемый код ошибки
    * */
    constructor(message, code) {
        super(message);
        this.name = 'TaskError';
        this.code = code;
    }
}

/*
* Проверка - является ли статус допустимым.
* @param {string} status - проверяемый статус
* @returns {boolean} `true` - если статус входит в список допустимых
* */
export function isValidStatus(status) {
    return STATUSES.includes(status);
}

/*
* Создание нового объекта со статусом `todo`.
* @param {string} title - краткое название задачи (обязательно)
* @param {string} [description=''] - подробное описание задачи
* @returns {{id: string, title: string, description: string, status: string, createdAt: string, updatedAt: string}} - новая задача
* @throws {TaskError} - если название пустое (code: 'EMPTY_TITLE')
* */
export function createTask(title, description = '') {
    const normalizedTitle = String(title ?? '').trim();
    if (normalizedTitle === '') {
        throw new TaskError('Название задачи не может быть пустым', 'EMPTY_TITLE');
    }
    
    const now = new Date().toISOString();
    
    return {
        id: randomUUID(),
        title: normalizedTitle,
        description: String(description ?? '').trim(),
        status: 'todo',
        createdAt: now,
        updatedAt: now,
    };
}

/*
* Поиск задачи по идентификатору.
* @param {Array<Object>} tasks - массив задачи
* @param {string} id - идентификатор задачи
* @returns {Object|undefined} - найденная задача или `undefined`
* */
export function findTaskById(tasks, id) {
    return tasks.find((task) => task.id === id);
}

/*
* Изменение статуса задачи и обновление поля `updatedAt`.
* @param {Array<Object>} tasks - текущий массив задач
* @param {string} id 
* @param {string} status - ('todo' | 'in_progress' | 'done')
* @returns {Array<Object>} - 
* @throws {TaskError} - ('INVALID_STATUS')  ('NOT_FOUND')
* */
export function updateTaskStatus(tasks, id, status) {
    if (!isValidStatus(status)) {
        throw new TaskError(
            `Недопустимый статус "${status}". Допустимо: ${STATUSES.join(', ')}`,
            'INVALID_STATUS',
        );
    }
    
    const task = findTaskById(tasks, id);
    if (!task) {
        throw new TaskError(`Задача с id "${id}" не найдена`, 'NOT_FOUND');
    }
    
    const updatedTask = { ...task, status, updatedAt: new Date().toISOString() };
    return tasks.map((t) => (t.id === id ? updatedTask : t));
}

/*
* Удаление задачи по идентификатору
* @param {Array<Object>} tasks - текущий массив задач 
* @param {string} id - идентификатор задач
* @returns {Array<Object>} - новый массив задач без удалённой задачи 
* @throws {TaskError} - если задача не найдена (code: 'NOT_FOUND') 
* */
export function deleteTask(tasks, id) {
    if (!findTaskById(tasks, id)) {
        throw new TaskError(`Задача с id "${id}" не найдена`, 'NOT_FOUND')
    }
    return tasks.filter((task) => task.id !== id);
}

/*
* Фильтр задачи по статусу.
* @param {Array<Object>} tasks - массив задач
* @param {string} status - статус для фильтрации
* @returns {Array<Object>} - массив задач с указанным статусом
* @throws {TaskError} - если статус недопустим (code: 'INVALID_STATUS')
* */
export function filterByStatus(tasks, status) {
    if (!isValidStatus(status)) {
        throw new TaskError(
            `Недопустимый статус "${status}". Допустимо: ${STATUSES.join(', ')}`,
            'INVALID_STATUS',
        );
    }
    return tasks.filter((task) => task.status === status);
}

/*
* Поиск задачи по ключевым словам в названии или описании.
* @param {Array<Object>} tasks - массив задач
* @param {string} keyword - ключевое слово для поиска
* @returns {Array<Object>} - массив найденных задач
* */
export function searchTasks(tasks, keyword) {
    if (!Array.isArray(tasks) || typeof keyword !== 'string') {
        return [];
    }
    
    const lowerKeyword = keyword.toLowerCase().trim();
    if (lowerKeyword === '') return [...tasks]; // Возврат всего при пустом вводе
    return tasks.filter(
        (task) => 
            task.title.toLowerCase().includes(lowerKeyword) ||
            (task.description && task.description.toLowerCase().includes(lowerKeyword))
    );
}

/*
* Сортировка задачи по заданному критерию.
* @param {Array<Object>} tasks - массив задач
* @param {string} criteria - критерий сортировки ('date', 'status', 'alphabet')
* @param {Array<Object>} - новый отсортированный массив задач
* */
export function sortTasks(tasks, criteria) {
    if (!Array.isArray(tasks)) {
        return [];
    }
    
    // Создание копии массива, чтобы не мутировать исходный
    const sorted = [...tasks];
    
    switch (criteria) {
        case 'date':
            // Сначала новые
            return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        case 'status': {
            // Порядок: todo -> in_progress -> done
            const statusOrder = { todo: 1, in_progress: 2, done: 3};
            // Если статус неизвестен, то ставится 99 (в конец)
            return sorted.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));
        }    
        case 'alphabet':
            // По алфавиту (название)
            return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        default: 
            return sorted;
    }
}
