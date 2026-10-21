/*
* @module index
* @description Точка входа консольного приложения "Менеджер задач".
* Отвечает за пользовательский интерфейс и цикл меню.
* */

import process from 'node:process';
import readline from 'node:readline/promises';
import { readTasks, writeTasks } from './storage.js';
import {
    STATUSES,
    STATUS_LABELS,
    TaskError, 
    createTask,
    findTaskById,
    updateTaskStatus,
    deleteTask,
    filterByStatus,
    searchTasks,
    sortTasks,
    isValidStatus,
} from './taskService.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Оформление вывода

const COLORS = {
    reset: '\x1b[0m',
    gray: '\x1b[90m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
};

const STATUS_COLORS = {
    todo: COLORS.gray,
    in_progress: COLORS.yellow,
    done: COLORS.green,
};

const SEPARATOR = '-'.repeat(70);

/*
* Окраска статуса задачи в цвет с помощью ANSI-кодов
* @param {string} status - статус задачи
* @returns {string} - строка статуса с ANSI-кодами
* */
function colorizeStatus(status) {
    const color = STATUS_COLORS[status] ?? COLORS.reset;
    return `${color}${status}${COLORS.reset}`;
}

// Ввод / вывод

/*
* Задание пользователю вопроса и возврат ответа без лишних пробелов
* @param {string} question - текст приглашения
* @returns {Promise<string>} - ответ пользователя
* */
async function ask(question) {
    const answer = await rl.question(question);
    return answer.trim();
}

// Вывод главного меню
function printMenu() {
    console.log(`
    === Менеджер задач === 
    1. Добавить задачу
    2. Просмотреть все задачи
    3. Изменить статус задачи
    4. Удалить задачу
    5. Фильтр по статусу
    6. Поиск ко ключевому слову
    7. Сортировка задач
    8. Выход`);
}

/*
* Вывод задачи в читаемом табличном виде.
* @param {Array<Object>} tasks - массив задач
* @returns {void}
* */
function printTasks(tasks) {
    if (tasks.length === 0) {
        console.log('Список задач пуст.');
        return;
    }
    
    for (const task of tasks) {
        console.log(SEPARATOR);
        console.log(`[${task.id}]`);
        console.log(` Название: ${task.title}`);
        console.log(` Описание: ${task.description || '-'}`);
        console.log(` Статус: ${colorizeStatus(task.status)} (${STATUS_LABELS[task.status] ?? '-'})`);
        console.log(` Создано: ${task.createdAt}`);
        console.log(` Изменено: ${task.updatedAt}`);
    }
    console.log(SEPARATOR);
    console.log(`Всего задач: ${tasks.length}`);
}

/*
* Вывод краткого списка задач (id + название + статус).
* @param {Array<Object>} tasks - массив задач
* @returns {void}
* */
function printCompactList(tasks) {
    for (const task of tasks) {
        console.log(` [${task.id}] ${task.title} - ${task.status}`);
    }
}

// Загрузка / сохранение с обработкой ошибок

/*
* Загрузка задачи с обработкой типовых ошибок файловой системы.
* @returns {Promise<Array<Object>>} - массив задач
* */
async function loadTasks() {
    try {
        return await readTasks();
    } catch (err) {
        if (err.code === 'CORRUPTED_JSON') {
            console.error(`\nОшибка: ${err.message}`);
            const answer = (await ask('Восстановить файл (все данные будут потеряны)? (y/n): ')).toLowerCase();
            if (['y', 'yes', 'д', 'да'].includes(answer)) {
                await saveTasks([]);
                console.log('Файл восстановлен. Список задач пуст.');
                return [];
            }
            console.log('Восстановление отменено. Работа завершена.');
            rl.close();
            process.exit(1);
        }
        
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            console.error(`\nКритическая ошибка: ${err.message}. Работа завершена.`);
            rl.close();
            process.exit(1);
        }
        
        throw err;
    }
}

/*
* Сохранение задач с обработкой типовых ошибок файловой системы.
* @param {Array<Object>} tasks - массив задач
* @returns {Promise<void>}
* */
async function saveTasks(tasks) {
    try {
        await writeTasks(tasks);
    } catch (err) {
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            console.error(`\nКритическая ошибка: ${err.message}. Работа завершена.`)
            rl.close();
            process.exit(1);
        }
        if (err.code === 'ENOSPC') {
            console.error(`\nОшибка: ${err.message}. Изменения не сохранены.`)
            return;
        }
        throw err;
    }
}

// Обработчики меню

// Пункт 1. Добавление задачи
async function handleAddTask() {
    const title = await ask('Название задачи: ');
    if (title === '') {
        console.log('Ошибка: название задачи не может быть пустым.');
        return;
    }
    
    const description = await ask('Описание (необязательно): ');
    // Загрузка текущей задачи
    const tasks = await loadTasks();
    // Создание новой задачи и добавление её в массив
    const task = createTask(title, description);
    tasks.push(task);
    await saveTasks(tasks);
    
    console.log(`Задача "${task.title}" создана (id: ${task.id})`);
}

// Пункт 2. Просмотр всех задач.
async function handleListTasks() {
    const tasks = await loadTasks();
    printTasks(tasks);
}

// Пункт 3. Изменение статуса задачи
async function handleChangeStatus() {
    const tasks = await loadTasks();
    if (tasks.length === 0) {
        console.log('Список задач пуст.');
        return;
    }
    
    printCompactList(tasks);
    const id = await ask('Введите id задачи: ');
    const status = await ask(`Новый статус (${STATUSES.join(' / ')}): `);
    
    const updatedTasks = updateTaskStatus(tasks, id, status);
    await saveTasks(updatedTasks);
    
    console.log(`Статус задачи изменён на "${status}".`);
}

// Пункт 4. Удаление задачи с подтверждением. 
async function handleDeleteTask() {
    const tasks = await loadTasks();
    if (tasks.length === 0) {
        console.log('Список задач пуст.');
        return;
    }
    
    printCompactList(tasks);
    const id = await ask('Введите id задачи для удаления: ');
    
    const task = findTaskById(tasks, id);
    if (!task) {
        throw new TaskError(`Задача с id "${id}" не найдена`, 'NOT_FOUND');
    }
    
    const answer = (await ask(`Удалить задачу "${task.title}"? (y/n): `)).toLowerCase();
    if (!['y', 'yes', 'д', 'да'].includes(answer)) {
        console.log('Удаление отменено.');
        return;
    }
    
    const updatedTasks = deleteTask(tasks, id);
    await saveTasks(updatedTasks);
    
    console.log(`Задача "${task.title}" удалена.`);
}

// Пункт 5. Фильтр по статусу.
async function handleFilterByStatus() {
    const status = await ask(`Введите статус (${STATUSES.join(' / ')}): `);
    
    if (!isValidStatus(status)) {
        throw new TaskError(
            `Недопустимый статус "${status}". Допустимо: ${STATUSES.join(', ')}`,
            'INVALID_STATUS',
        );
    }
    
    const tasks = await loadTasks();
    const filtered = filterByStatus(tasks, status);
    
    if (filtered.length === 0) {
        console.log(`Задачи со статусом "${status}" не найдены.`);
        return;
    }
    
    printTasks(filtered);
}

// Пункт 6. Поиск задач.
async function handleSearchTasks() {
    const keyword = await ask('Введите ключевое слово для поиска: ');
    if (!keyword) {
        console.log('Ошибка: ключевое слово не может быть пустым.');
        return;
    }
    
    const tasks = await loadTasks();
    const found = searchTasks(tasks, keyword);
    
    if (found.length === 0) {
        console.log(`Задачи по запросу "${keyword}" не найдены.`)
        return;
    }
    
    console.log(`\nРезультаты поиска по запросу "${keyword}": `);
    printTasks(found);
}

// Пункт 7. Сортировка задач.
async function handleSortTasks() {
    const tasks = await loadTasks();
    if (tasks.length === 0) {
        console.log('Список задач пуст.');
        return;
    }
    
    console.log(`
    Выберите критерий сортировки:
    1. По дате создания (сначала новые)
    2. По статусу (todo -> in_progress -> done)
    3. По алфавиту (А-Я)`);
    
    const choice = await ask('Ваш выбор (1-3): ');
    
    let criteria;
    if (choice === '1') criteria = 'date';
    else if (choice === '2') criteria = 'status';
    else if (choice === '3') criteria = 'alphabet';
    else {
        console.log('Ошибка: неверный критерий сортировки.');
        return;
    }
    
    const sorted = sortTasks(tasks, criteria);
    console.log('\nОтсортированный список: ');
    printTasks(sorted);
}

// Главный цикл

/*
* Запуск главного цикла приложения: показ меню и обработка выбора пользователя
* до тех пор, пока не будет выбран пункт "Выход".
* @returns {Promise<void>}
* */
async function main() {
    console.log('Менеджер задач');
    
    for (;;) {
        printMenu();
        const choice = await ask('Выберите действие (1-8): ');
        
        try {
            switch (choice) {
                case '1':
                    await handleAddTask();
                    break;
                case '2': 
                    await handleListTasks();
                    break;
                case '3': 
                    await handleChangeStatus();
                    break;
                case '4':
                    await handleDeleteTask();
                    break;
                case '5':
                    await handleFilterByStatus();
                    break;
                case '6':
                    await handleSearchTasks();
                    break;
                case '7': 
                    await handleSortTasks();
                    break;
                case '8':
                    // Принудительная отправка ANSI-кода очистки (надёжнее console.clear)
                    process.stdout.write('\x1Bc');
                    console.log('До свидания!');
                    rl.close();
                    return;
                default:
                    console.log('Ошибка: введите число от 1 до 8.');
            }
        } catch (err) {
            if (err instanceof TaskError) {
                console.log(`Ошибка: ${err.message}`);
            } else {
                console.error(`Непредвиденная ошибка: ${err.message}`);
            }
        }
    }
}

main().catch((err) => {
    console.error(`Критическая ошибка: ${err.message}`);
    rl.close();
    process.exit(1);
});

