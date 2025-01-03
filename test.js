const Database = require("./index");
const db = new Database("./db.json", {
    compress: true,
    cache: true
});

db.on('save', () => {
    console.log('La base de données a été sauvegardée sur le disque');
});

db.on('change', (key, value) => {
    console.log(`La clé "${key}" a été modifiée avec la valeur:`, value);
});

db.on('delete', (key) => {
    console.log(`La clé "${key}" a été supprimée de la base de données`);
});

db.set("user.name", "John");
db.set("user.age", 30);
console.log(db.get("user")); // { name: 'John', age: 30 }

db.push("fruits", "apple");
db.push("fruits", "banana");
console.log(db.get("fruits")); // [ 'apple', 'banana' ]

db.add("counter", 1);
db.add("counter", 5);
console.log(db.get("counter")); // 6

db.delete("user.age");
console.log(db.get("user")); // { name: 'John' }

db.clear();
console.log(db.all()); // []
