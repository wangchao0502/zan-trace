'use strict';

const os = require('os');

const cpu = () => {
    let result = {};
    const cpus = os.cpus();

    for (let i = 0, len = cpus.length; i < len; i++) {
        const cpu = cpus[i];
        let total = 0;

        for (const type in cpu.times) {
            total += cpu.times[type];
        }

        for (const type in cpu.times) {
            if (!result[type]) result[type] = 0;
            result[type] += 100 * cpu.times[type] / total;
        }
    }

    Object.keys(result).forEach(key => result[key] /= cpus.length);
    return result;
};

module.exports = cpu;