const fs = require("fs");
const { promisify } = require('util');
const { EventEmitter } = require('events');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const setNestedProperty = (object, key, value) => {
    const properties = key.split('.');
    let index = 0;
    for (; index < properties.length - 1; ++index) {
        object = object[properties[index]];
    }
    object[properties[index]] = value;
}

const getNestedProperty = (object, key) => {
    const properties = key.split('.');
    let index = 0;
    for (; index < properties.length; ++index) {
        object = object && object[properties[index]];
    }
    return object;
}

module.exports = class EasyJsonDB extends EventEmitter {

    /**
     * @typedef {object} SnapshotOptions
     * @property {boolean} [enabled=false] Whether the snapshots are enabled
     * @property {number} [interval=86400000] The interval between each snapshot
     * @property {string} [path='./backups/'] The path of the backups
     */

    /**
     * @typedef {object} DatabaseOptions
     * @property {SnapshotOptions} snapshots
     */

    /**
     * @param {string} filePath The path of the json file used for the database.
     * @param {DatabaseOptions} options
     */
    constructor(filePath, options){
        super();

        /**
         * The path of the json file used as database.
         * @type {string}
         */
        this.jsonFilePath = filePath || "./db.json";

        /**
         * The options for the database
         * @type {DatabaseOptions}
         */
        this.options = options || {};

        if (this.options.snapshots && this.options.snapshots.enabled) {
            const path = this.options.snapshots.path || './backups/';
            if (!fs.existsSync(path)) {
                fs.mkdirSync(path);
            }
            setInterval(() => {
                this.makeSnapshot();
            }, (this.options.snapshots.interval || 86400000));
        }

        /**
         * The data stored in the database.
         * @type {object}
         */
        this.data = {};

        /**
         * Un verrou pour empêcher les accès concurrents au fichier JSON
         * @type {boolean}
         */
        this.lock = false;

        /**
         * Utiliser un Set pour suivre les clés modifiées
         * @type {Set<string>}
         */
        this.modifiedKeys = new Set();

        /**
         * Planifier les écritures dans le fichier toutes les X ms
         * @type {number}
         */
        this.autoSaveInterval = options.autoSaveInterval || 5000;

        this.autoSave();

        if(!fs.existsSync(this.jsonFilePath)){
            fs.writeFileSync(this.jsonFilePath, "{}", "utf-8");
        } else {
            this.fetchDataFromFile();
        }

        /**
         * Activer la compression des données
         * @type {boolean}
         */
        this.compress = options.compress || false;

        /**
         * Activer le cache en mémoire
         * @type {boolean}
         */
        this.cache = options.cache || false;

        /**
         * Les données en cache
         * @type {object}
         */
        this.cachedData = {};
    }

    /**
     * Make a snapshot of the database and save it in the snapshot folder
     * @param {string} path The path where the snapshot will be stored
     */
    makeSnapshot (path) {
        path = path || this.options.snapshots.path || './backups/';
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
        const fileName = `snapshot-${Date.now()}.json`;
        fs.writeFileSync(path.join(path, fileName));
    }

    /**
     * Obtenir les données du fichier JSON et les stocker dans la propriété data, avec un verrou
     */
    async fetchDataFromFile(){
        while (this.lock) {
            // Attendre si le verrou est activé
        }
        this.lock = true;
        try {
            let savedData = await readFileAsync(this.jsonFilePath, 'utf8');
            if (this.compress) savedData = decompress(savedData);
            savedData = JSON.parse(savedData);
            if(typeof savedData === "object"){
                this.data = savedData;
            }
            if (this.cache) this.cachedData = this.data;
        } finally {
            this.lock = false;
        }
    }

    /**
     * Écrire les données dans le fichier JSON, avec un verrou
     */
    async saveDataToFile(){
        while (this.lock) {
            // Attendre si le verrou est activé  
        }
        this.lock = true;
        try {
            let dataToWrite = JSON.stringify(this.data, null, 2);
            if (this.compress) dataToWrite = compress(dataToWrite);
            await writeFileAsync(this.jsonFilePath, dataToWrite, 'utf8');
            this.modifiedKeys.clear();
            this.emit('save');
        } finally {
            this.lock = false;  
        }
    }

    autoSave() {
        if (this.modifiedKeys.size > 0) {
            this.saveDataToFile();
        }
        setTimeout(() => this.autoSave(), this.autoSaveInterval);
    }

    /**
     * Get data for a key in the database
     * @param {string} key 
     */
    get(key){
        if (this.cache) return getNestedProperty(this.cachedData, key);
        return getNestedProperty(this.data, key);
    }

    /**
     * Check if a key data exists.
     * @param {string} key 
     */
    has(key){
        return getNestedProperty(this.data, key) != undefined;
    }
    
    /**
     * Set new data for a key in the database.
     * @param {string} key
     * @param {*} value 
     */
    set(key, value){
        setNestedProperty(this.data, key, value);
        if (this.cache) setNestedProperty(this.cachedData, key, value);
        this.modifiedKeys.add(key);
        this.emit('change', key, value);
    }

    /**
     * Delete data for a key from the database.
     * @param {string} key 
     */
    delete(key){
        deleteNestedProperty(this.data, key);
        if (this.cache) deleteNestedProperty(this.cachedData, key);
        this.modifiedKeys.add(key);
        this.emit('delete', key);
    }

    /**
     * Add a number to a key in the database.
     * @param {string} key 
     * @param {number} count 
     */
    add(key, count){
        if(!this.data[key]) this.data[key] = 0;
        this.data[key] += count;
        this.saveDataToFile();
    }

    /**
     * Subtract a number to a key in the database.
     * @param {string} key 
     * @param {number} count 
     */
    subtract(key, count){
        if(!this.data[key]) this.data[key] = 0;
        this.data[key] -= count;
        this.saveDataToFile();
    }

    /**
     * Ajouter un élément à une clé dans la base de données, en créant le tableau si nécessaire
     * @param {string} key
     * @param {*} element
     */
    push(key, element){
        setNestedProperty(this.data, key, [...(getNestedProperty(this.data, key) || []), element]);
        this.saveDataToFile();
    }

    /**
     * Clear the database.
     */
    clear(){
        this.data = {};
        this.saveDataToFile();
    }

    /**
     * Get all the data from the database.
     */
    all(){
        return Object.keys(this.data).map((key) => {
            return {
                key,
                data: this.data[key]
            }
        });
    }

};

/**
 * Supprimer récursivement une propriété imbriquée
 * @param {object} obj 
 * @param {string} key 
 */
function deleteNestedProperty(obj, key) {
    const properties = key.split('.');
    const lastProperty = properties.pop();
    
    for (const prop of properties) {
        if (!obj[prop]) return;
        obj = obj[prop];
    }

    delete obj[lastProperty];
}

/**
 * Compresser une chaîne JSON
 * @param {string} json 
 * @returns {string}
 */
function compress(json) {
    return json.replace(/[\s\r\n]/g, '');
}

/**
 * Décompresser une chaîne JSON
 * @param {string} compressedJson 
 * @returns {string} 
 */
function decompress(compressedJson) {
    return compressedJson.replace(/([{,])([^{:]+):/g, '$1"$2":');
}