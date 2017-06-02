require('babel-register');
const Koa = require('koa');
const trace = require('../src/index');
const app = new Koa();

app.use(trace);
app.listen(3000);

console.log('Server start: localhost:3000');