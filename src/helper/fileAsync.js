const fs = require('fs');

module.exports = {
    isDir: function(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (err, stat) => {
                if (!err && stat.isDirectory()) return resolve(true);
                return resolve(false);
            });
        });
    },
    read: function(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
                if (!err) resolve(data.toString());
                else resolve('');
            });
        });
    }
}