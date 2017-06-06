const fs = require('fs');
const profiler = require('v8-profiler');
const SAVEDIR = require('../config/path').SAVEDIR;

const profile = (ctx) => {
    const name = `profile_${Date.now()}.cpuprofile`;
    const duration = ctx.request.query.duration || 1000;

    profiler.startProfiling(name);
    setTimeout(() => {
        const profile = profiler.stopProfiling(name);
        profile.export((error, result) => {
            fs.writeFile(`${SAVEDIR}/${name}`, result, (err) => {
                if (err) throw err;
                profile.delete();
            });
        });
    }, duration);

    return {
        filename: name,
        msg: `Please download profile file ${duration}ms later`
    };
};

module.exports = profile;