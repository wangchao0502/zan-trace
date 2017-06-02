# zan-trace
koa middleware, expose api for collecting node runtime info.

## install

```bash
npm install --save zan-trace
```

```javascript
const Koa = require('koa');
const trace = require('zan-trace');
const app = new Koa();

app.use(trace);
app.listen(3000);
```

## API

url: /perf/{key}

```json
{
    "arch": "Operating system CPU architecture for which the Node.js binary was compiled.",
    "platform": "Operating system platform as set during compile time of Node.js.",
    "endianness": "Return the endianness of the CPU for which the Node.js binary was compiled.",
    "uptime": "System uptime in number of seconds.",
    "release": "Operating system release.",
    "type": "Operating system name",
    "user": "Return information about the currently effective user.",
    "cpus": "Return an array of objects containing information about each CPU/core installed.",
    "cpu": "Current CPU load.",
    "totalmem": "Total amount of system in bytes.",
    "freemem": "Amount of free system memory in bytes.",
    "memory": "Returns an object describing the memory usage of the Node.js process measured in bytes.",
    "gc": "Return gc space info.",
    "snapshot": "Generate heap snapshot record file.",
    "profile": "Generate cpu profile record file.",
    "forcegc": "Manually excute gc.",
    "version": "Return an object describing the versions of node deps.",
    "pid": "Return PID of this application.",
    "memwatch": "Record gc count."
}
```
