const fs = require('fs');
const profiler = require('v8-profiler');
const SAVEDIR = require('../config/path').SAVEDIR;

const snapshot = (ctx) => {
    const name = `snapshot_${Date.now()}.heapsnapshot`;
    const snapshot = profiler.takeSnapshot(name);
    snapshot.export((error, result) => {
        fs.writeFile(`${SAVEDIR}/${name}`, result, (err) => {
            if (err) throw err;
            snapshot.delete();
        });
    });

    return {
        filename: name,
        msg: 'Please download snapshot file several seconds later'
    };
};

module.exports = snapshot;
