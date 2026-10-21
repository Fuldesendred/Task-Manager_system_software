/*
* @module storage
* @description Модуль чтения/записи задач в JSON-файл.
* Единственное место в проекте, где используется модуль 'fs'.
* */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const _dirname = path.dirname(fileURLToPath(import.meta.url));

// Путь к файлу с данными
export const DATA_FILE = path.join(_dirname, 'tasks.json');

// Путь к резервной копии файла с данными
export const BACKUP_FILE = path.join(_dirname, 'tasks.backup.json');

// Ошибка уровня хранилища (файловая система / формат данных).
export class StorageError extends Error {
    /*
    * @param {string} message - описание ошибки для пользователя
    * @param {string} code -машиночитаемый код ошибки
    * */
    constructor(message, code) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
    }
}

/*
* Чтение массива задач из JSON-файла.
* @returns {Promise<Array<Object>>} Массив задач. Пустой массив, если файла ещё нет. 
* @throws {StorageError} Если JSON повреждён (code: 'CORRUPTED_JSON'),
*   нет прав доступа (code: 'EACCES' / 'EPERM') или произошла другая ошибка ФС.
* */
export async function readTasks() {
    let raw;
    try {
        raw = await readFile(DATA_FILE, 'utf-8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return []; // файла нет (при первом запуске его и не будет)
        }
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            throw new StorageError(`Нет прав на чтение файла ${DATA_FILE}`, err.code);
        }
        throw new StorageError(`Не удалось прочитать файл задач: ${err.message}`, err.code ?? 'EUNKNOWN');
    }
    
    if (raw.trim() === '') {
        return [];
    }
    
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new StorageError('Файл tasks.json содержит некорректный JSON', 'CORRUPTED_JSON');
    }
    
    if (!Array.isArray(data)) {
        throw new StorageError('Ожидался массив задач в tasks.json', 'CORRUPTED_JSON');
    }
    
    return data;
}

/*
* Запись массива задач в JSON-файл, предварительно создавая резервную копию.
* @param {Array<Object>} tasks - массив задач для сохранения
* @returns {Promise<void>} 
* @throws {StorageError} - при ошибках записи (нет прав, диск переполнен и т.п.)
* */
export async function writeTasks(tasks) {
    await createBackup();
    
    try {
        await writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
    } catch (err) {
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            throw new StorageError(`Нет прав на запись файла ${DATA_FILE}`, err.code);
        }
        if (err.code === 'ENOSPC') {
            throw new StorageError('На диске недостаточно места для сохранения задач', err.code);
        }
        throw new StorageError(`Не удалось сохранить задачи: ${err.message}`, err.code ?? 'EUNKNOWN');
    }
}

/*
* Создание резервной копии файла данных перед записью.
* отсутствие исходного файла не считается ошибкой.
* @returns {Promise<void>}
* */
async function createBackup() {
    try {
        await copyFile(DATA_FILE, BACKUP_FILE);
    } catch (err) {
        if (err.code === 'ENOENT') return; // копировать нечего
        // Ошибка бэкапа не срывает основную запись - только предупреждение.
        console.warn(`Предупреждение: не удалось создать резервную копию (${err.code}).`)
    }
}












