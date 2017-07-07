const fs = require('fs');
const path = require('path');

let projectPath;
let nodeModulesPath;
let packageJsonPath;
let loaded = new Set();
/**
 * key: package name
 * value: array<Node>
 */
let loadedMap = {};

const Dictionary = function() {
    this.items = {};
}

Dictionary.prototype.set = function(key, value) { this.items[key] = value }
Dictionary.prototype.has = function(key) { return this.items.hasOwnProperty(key) }
Dictionary.prototype.get = function(key) { return this.has(key) ? items[key] : undefined }

const Graph = function() {
    // 存储图中所有的顶点
    this.vertices = [];
    // 用字典来存储邻接表
    this.adjList = new Dictionary();
}

// 添加顶点
Graph.prototype.addVertex = function(v) {
    this.vertices.push(v);
    // 顶点为键，字典值为空数组
    this.adjList.set(v, []);
}
// 添加边
Graph.prototype.addEdge = function(v, w) { this.adjList.get(v).push(w) }
Graph.prototype.toString = function() {
    let s = '';
    for (let i = 0; i < this.vertices.length; i++) {
        s += this.vertices[i].toString() + ' -> ';
        const neighbors = this.adjList.get(this.vertices[i]);
        for (let j = 0; j < neighbors.length; j++) {
            s += neighbors[j].toString() + ' ';
        }
        s += '\n';
    }
    return s;
}

const Node = function() {
    this.name = '';
    this.version = '';
    this.dependencies = [];
}
Node.prototype.getKey = function() { return `${this.name}@${this.version}` }
Node.prototype.getValue = function() {
    return {
        name: this.name,
        version: this.version,
        dependencies: this.dependencies
    };
}
Node.prototype.parseSemver = function() {
    if (!this.semver) throw new Error('empty semver');


}

function printNodes() {
    Object.keys(loadedMap).forEach(key => {
        const nodes = loadedMap[key];
        nodes.forEach((node, i) => {
            if (i === 0) {
                console.log(`${node.name} ${nodes.length > 1 ? '┬─' : '──'} ${node.version}`);
            } else {
                console.log(`${' '.repeat(node.name.length)} ${i < nodes.length - 1 ? '├─' : '└─'} ${node.version}`);
            }
        });
    });
}

function loadNodeInfo(pkg) {
    const node = new Node();

    node.name = pkg.name;
    node.version = pkg.version;
    node.dependencies = pkg.dependencies;

    const key = node.getKey();

    if (loaded.has(key)) return false;

    loaded.add(key);

    if (loadedMap[node.name]) loadedMap[node.name].push(node);
    else loadedMap[node.name] = [node];

    return true;
}

/**
 * load dependencies and return node_modules path
 * @returns {Promise}
 */
function readDeptListPromisify(modulePath) {
    return new Promise((resolve, reject) => {
        fs.stat(modulePath, (err, stat) => {
            if (!err && stat.isDirectory()) {
                // read pkg
                const pkgPath = path.join(modulePath, 'package.json');

                readPkg(pkgPath, pkg => {
                    if (!loadNodeInfo(pkg)) {
                        resolve('');
                        return;
                    }

                    // if has node_modules dir
                    const subModulePath = path.join(modulePath, 'node_modules');

                    fs.stat(subModulePath, (err, stat) => {
                        if (!err && stat.isDirectory()) resolve(subModulePath);
                        else resolve('');
                    });
                });
            } else {
                resolve('');
            }
        });
    });
}

function readDeptList(modulePath) {
    if (!modulePath) return;

    const files = fs.readdirSync(modulePath);

    console.log(modulePath, files);
    Promise
        .all(files.filter(x => x.charAt(0) !== '.').map(file => readDeptListPromisify(path.join(modulePath, file))))
        .then(modulePaths => modulePaths.filter(x => !!x).forEach(x => readDeptList(x)))
        .catch(err => console.log(err));
}

function packageFind() {
    const dir = path.dirname(require.main.filename);
    const pkgPath = path.join(dir, 'package.json');

    if (fs.existsSync(pkgPath)) {
        projectPath = dir;
        packageJsonPath = pkgPath;
        nodeModulesPath = path.join(projectPath, 'node_modules');

        // add main dependency
        readPkg(pkgPath, pkg => loadNodeInfo(pkg));
    }
}

function readPkg(pkgPath, cb) {
    fs.readFile(pkgPath, (err, data) => {
        if (!err) cb(JSON.parse(data.toString()));
    });
}

function getTree(cb) {
    packageFind();
    readDeptList(nodeModulesPath);
    setTimeout(printNodes, 1000);
}

module.exports = getTree;