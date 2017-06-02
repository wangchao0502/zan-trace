/**
 * heapdump
 * heapdump.writeSnapshot('/var/local/' + Date.now() + '.heapsnapshot');
 * 生成堆快照文件，使用chrome开发工具分析
 */

/**
 * v8-profiler
 * 获取cpu profiler数据，使用chrome开发工具分析
 * v8-cpu-analysis 支持分析 https://cnodejs.org/topic/587c7b6ffdd6b6c41b473649
 *
 * const snapshot1 = profiler.takeSnapshot();
 * const snapshot2 = profiler.takeSnapshot();
 * console.log(snapshot1.getHeader(), snapshot2.getHeader());
 * console.log(snapshot1.compare(snapshot2));
 */

/**
 * node-inspector
 * 6.3以上版本的node提供--inspect指令通过chrome dev-tool调试
 * https://medium.com/@paul_irish/debugging-node-js-nightlies-with-chrome-devtools-7c4a1b95ae27
 */

/**
 * memwatch-next
 * - leak event, emitted when it appears your code is leaking memory.
 * - stats event, emitted occasionally, giving you data describing your heap usage and trends over time.
 * - HeapDiff class that lets you compare the state of your heap between two points in time, telling you
 *   what has been allocated, and what has been released.
 */

const os = require('os');
const fs = require('fs');
const util = require('util');
const profiler = require('v8-profiler');
const nodereport = require('node-report');
const memwatch = require('memwatch-next');
const trace = require('../build/Release/zan-trace');
const cwd = process.cwd();

let gcstats = {};

const init = () => {
    memwatch.on('stats', stats => gcstats = stats);
};

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

const snapshot = (ctx) => {
    const name = `snapshot_${Date.now()}.heapsnapshot`;
    const snapshot = profiler.takeSnapshot(name);
    snapshot.export((error, result) => {
        fs.writeFile(`${cwd}/static/${name}`, result, (err) => {
            if (err) throw err;
            snapshot.delete();
        });
    });

    return {
        filename: name,
        msg: 'Please download snapshot file several seconds later'
    };
};

const profile = (ctx) => {
    const name = `profile_${Date.now()}.cpuprofile`;
    const duration = ctx.request.query.duration || 1000;

    profiler.startProfiling(name);
    setTimeout(() => {
        const profile = profiler.stopProfiling(name);
        profile.export((error, result) => {
            fs.writeFile(`${cwd}/static/${name}`, result, (err) => {
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

init();

module.exports = async (ctx, next) => {
    const pathname = ctx.path;
    let perf = {};

    if (/^\/perf\//.test(pathname)) {
        const type = pathname.replace('/perf/', '');
        switch (type) {
            case 'help':
                perf = {
                    arch: 'Operating system CPU architecture for which the Node.js binary was compiled.',
                    platform: 'Operating system platform as set during compile time of Node.js.',
                    endianness: 'Return the endianness of the CPU for which the Node.js binary was compiled.',
                    uptime: 'System uptime in number of seconds.',
                    release: 'Operating system release.',
                    type: 'Operating system name',
                    user: 'Return information about the currently effective user.',
                    cpus: 'Return an array of objects containing information about each CPU/core installed.',
                    cpu: 'Current CPU load.',
                    totalmem: 'Total amount of system in bytes.',
                    freemem: 'Amount of free system memory in bytes.',
                    memory: 'Returns an object describing the memory usage of the Node.js process measured in bytes.',
                    gc: 'Return gc space info.',
                    snapshot: 'Generate heap snapshot record file.',
                    profile: 'Generate cpu profile record file.',
                    forcegc: 'Manually excute gc.',
                    version: 'Return an object describing the versions of node deps.',
                    pid: 'Return PID of this application.',
                    memwatch: 'Record gc count.',
                    report: 'Get human-readable diagnostic summary'
                    // enable_aysnc_hook: 'Enable async hook.',
                    // disable_async_hook: 'Disable async hook.'
                };
                break;
            case 'arch':
                perf = os.arch();
                break;
            case 'type':
                perf = os.type();
                break;
            case 'user':
                perf = os.userInfo();
                break;
            case 'endianness':
                perf = os.endianness();
                break;
            case 'uptime':
                perf = os.uptime();
                break;
            case 'platform':
                perf = os.platform();
                break;
            case 'release':
                perf = os.release();
                break;
            case 'version':
                perf = process.versions;
                break;
            case 'pid':
                perf = process.pid;
                break;
            case 'cpus':
                perf = os.cpus();
                break;
            case 'cpu':
                perf = cpu(ctx);
                break;
            case 'totalmem':
                perf = os.totalmem();
                break;
            case 'freemem':
                perf = os.freemem();
                break;
            case 'memory':
                /**
                 * 在V8中所有对象都是通过堆来进行分配的
                 *
                 * Understanding Garbage Collection and hunting Memory Leaks in Node.js
                 * https://www.dynatrace.com/blog/understanding-garbage-collection-and-hunting-memory-leaks-in-node-js/
                 *
                 * A tour of V8: Garbage Collection
                 * http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection
                 *
                 * Node.js Garbage Collection Explained
                 * https://blog.risingstack.com/node-js-at-scale-node-js-garbage-collection/
                 *
                 * process.memoryUsage()
                 * {
                 *   rss: 22319104,       // 实际使用物理内存大小
                 *   heapTotal: 6328320,  // 申请到的堆内存大小
                 *   heapUsed: 3137632,   // 当前使用堆内存大小
                 *   external: 8236       // C++对象使用内存大小
                 * }
                 * 堆内存大小会影响到GC的效率，所以64位默认为1.4GB，32位默认为0.7GB
                 * --max-old-space-size   // 单位MB
                 * --max-new-space-size   // 单位KB
                 */
                perf = process.memoryUsage();
                break;
            case 'gc':
                perf = trace.gcstats();
                break;
            case 'memwatch':
                perf = {
                    // Old GC/Full GC (mark-sweep-compact ~100ms) TypeMarkSweepCompact
                    fullGcCount: gcstats.num_full_gc,
                    // Young GC (scavenge)
                    incGcCount: gcstats.num_inc_gc,
                    usageTrend: gcstats.usage_trend,
                    minHeapUsage: gcstats.min,
                    maxHeapUsage: gcstats.max
                };
                break;
            case 'report':
                perf = nodereport.getReport();
                break;
            case 'test':
                fs.access(__filename, () => console.log('access this file'));
                break;
            case 'snapshot':
                perf = snapshot(ctx);
                break;
            case 'heap':
                perf = trace.heapstats();
                break;
            case 'profile':
                perf = profile(ctx);
                break;
            case 'forcegc':
                memwatch.gc();
                perf = 'success';
                break;
            case 'enable_aysnc_hook':
                // waiting for node async_hooks api support
                break;
            case 'disable_async_hook':
                break;
        }

        ctx.body = perf;
    } else {
        await next();
    }
};
