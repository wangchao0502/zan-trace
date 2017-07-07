'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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
const util = require('util');
const memwatch = require('memwatch-next');
const cpu = require('./lib/cpu');
const profile = require('./lib/cpu_profile');
const snapshot = require('./lib/heap_snapshot');
const trace = require('../build/Release/zan-trace');
const moduleTree = require('./lib/module_tree');

const ENV = process.env.NODE_ENV;

let gcstats = {};
let moduleDepts = {};

const init = () => {
    memwatch.on('stats', stats => gcstats = stats);
    moduleTree(data => console.log(JSON.stringify(data, null, '  ')));
};

init();

module.exports = (() => {
    var _ref = _asyncToGenerator(function* (ctx, next) {
        const pathname = ctx.path;
        let perf = {};

        if (/^\/perf\//.test(pathname)) {
            const type = pathname.replace('/perf/', '');
            switch (type) {
                case 'help':
                    perf = require('./config/intro');
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
                    // dev environment will make nodemon unwork
                    if (ENV === 'production') {
                        perf = require('node-report').getReport();
                    }
                    break;
                case 'test':
                    break;
                case 'module':
                    perf = moduleDepts;
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
            }

            ctx.body = perf;
        } else {
            yield next();
        }
    });

    return function (_x, _x2) {
        return _ref.apply(this, arguments);
    };
})();