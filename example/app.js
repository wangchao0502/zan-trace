const fs = require('fs');
const Koa = require('koa');
const path = require('path');
const Router = require('koa-router');
const body = require('koa-body')();
const trace = require('../src/index');

const app = new Koa();
const router = new Router();

const readFileThunk = src => new Promise((resolve, reject) => {
    fs.readFile(src, { encoding: 'utf8' }, (err, data) => {
        if(err) return reject(err);
        resolve(data);
    });
});

router.get('/index', async (ctx, next) => {
    ctx.body = await readFileThunk(path.join(__dirname, 'index.html'));
});

app.use(trace);
app.use(body);
app.use(router.routes());
app.use(router.allowedMethods());
app.listen(3000);

console.log('Server start: localhost:3000');