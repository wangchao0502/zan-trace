const fs = require('fs');
const path = require('path');
const semverParser = require('semver');
const util = require('util');
const debuglog = util.debuglog('zan-trace');
const fsAsync = require('../helper/fileAsync');

const Dictionary = function() {
    this.items = {};
}

Dictionary.prototype.set = function(key, value) { this.items[key] = value }
Dictionary.prototype.has = function(key) { return this.items.hasOwnProperty(key) }
Dictionary.prototype.get = function(key) { return this.has(key) ? this.items[key] : undefined }
Dictionary.prototype.toArray = function () {
    const arr = [];
    Object.keys(this.items).forEach(key => {
        const targets = this.items[key] || [];
        targets.forEach(target => arr.push({ from: key, to: target }));
    });
    return arr;
}

// vertices名称为 包名@version
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
    this.adjList.set(v.key, []);
}
// 存在顶点
Graph.prototype.hasVertex = function(v) {
    return this.vertices.find(x => x.key === v);
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
Graph.prototype.toJSON = function() {
    return {
        nodes: this.vertices,
        edges: this.adjList.toArray()
    }
}

const Node = function() {
    this.key = '';
    this.name = '';
    this.version = '';
    this.level = 0;
    this.dependencies = [];
}
Node.prototype.getValue = function() {
    return {
        name: this.name,
        version: this.version,
        dependencies: this.dependencies
    };
}

let rootModuleName;
let rootModuleVersion;
let projectPath;
let nodeModulesPath;
let packageJsonPath;
let loaded = new Set();
let graph = new Graph();
/**
 * key: package name
 * value: array<Node>
 */
let loadedMap = {};
let ready = false;

const DEFAULT_VERSION = '0.0.0';

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

function printDependencyTree() {
    console.log(graph.toString());
}

function generateGraph() {
    // console.log(loaded);
    // console.log(loadedMap);

    const copyLoadedSet = new Set(loaded);
    const findNode = (name, version) => {
        const nodes = loadedMap[name];
        if (nodes && nodes.length) {
            return nodes.find(x => x.version === version);
        }
        return null;
    };
    const findFitSemverNode = (name, semver) => {
        const nodes = loadedMap[name];
        if (nodes && nodes.length) {
            const versions = nodes.map(x => x.version);
            const maxSatisfyingVersion = semverParser.maxSatisfying(versions, semver);
            return nodes.find(x => x.version === maxSatisfyingVersion);
        }
        return null;
    };

    // init root node
    const root = findNode(rootModuleName, rootModuleVersion);
    const stack = [root];

    root.level = 0;
    graph.addVertex(root);

    while (stack.length) {
        const cur = stack.pop();
        const fromKey = cur.key;
        const name = cur.name;
        const version = cur.version;
        const node = findNode(name, version);

        if (!copyLoadedSet.has(fromKey)) continue;
        copyLoadedSet.delete(fromKey);

        if (node) {
            const dept = node.dependencies;
            if (!dept) continue;

            // add node connect dependency edge
            Object.keys(dept).forEach(name => {
                const semver = dept[name];
                const node = findFitSemverNode(name, semver);

                if (node) {
                    const toKey = node.key;
                    node.level = cur.level + 1;

                    if (!graph.hasVertex(toKey)) {
                        // add vertex
                        graph.addVertex(node);
                        // add addEdge
                        graph.addEdge(fromKey, toKey);
                        // add into stack
                        stack.push(node);
                    }
                } else {
                    debuglog(`Packge ${name} is behind version ${semver}, please execute 'npm update ${name}'`);
                }
            });
        } else {
            debuglog(`Packge ${name} is not installed, please execute 'npm install ${name}'`);
        }
    }

    ready = true;
}

function loadNodeInfo(pkg) {
    const node = new Node();

    node.name = pkg.name;
    node.version = pkg.version || DEFAULT_VERSION;
    node.key = `${node.name}@${node.version}`;
    // production only
    node.dependencies = pkg.dependencies;

    if (loaded.has(node.key)) return false;

    loaded.add(node.key);

    if (loadedMap[node.name]) loadedMap[node.name].push(node);
    else loadedMap[node.name] = [node];

    return true;
}

// load dependencies and return node_modules path
async function getSubModulePath(modulePath) {
    const isDir = await fsAsync.isDir(modulePath);
    if (!isDir) return null;

    const pkg = await readPkg(path.join(modulePath, 'package.json'));
    if (!loadNodeInfo(pkg)) return null;

    const subModulePath = path.join(modulePath, 'node_modules');
    const isSubModuleDir = await fsAsync.isDir(subModulePath);
    
    if (isSubModuleDir) return subModulePath;

    return null;
}

async function readDeptList(modulePath) {
    if (!modulePath) return;

    const files = fs.readdirSync(modulePath).filter(x => x.charAt(0) !== '.');
    const subModulePath = [
        ...files
            .filter(x => x.charAt(0) === '@')
            .map(x => fs.readdirSync(path.join(modulePath, x)).map(y => `${x}/${y}`))
            .join()
            .split(','),
        ...files.filter(x => x.charAt(0) !== '@')
    ];

    try {
        const modulePaths = await Promise.all(subModulePath.map(file => getSubModulePath(path.join(modulePath, file))));
        await Promise.all(modulePaths.filter(x => !!x).map(x => readDeptList(x)));
    } catch (err) {
        console.log(err);
    }
}

async function packageFind() {
    const dir = process.cwd();
    const pkgPath = path.join(dir, 'package.json');

    if (fs.existsSync(pkgPath)) {
        projectPath = dir;
        packageJsonPath = pkgPath;
        nodeModulesPath = path.join(projectPath, 'node_modules');

        // add main dependency
        const pkg = await readPkg(pkgPath);

        rootModuleName = pkg.name;
        rootModuleVersion = pkg.version || DEFAULT_VERSION;
        loadNodeInfo(pkg)
    }
}

async function readPkg(pkgPath) {
    const data = await fsAsync.read(pkgPath);
    if (data) return JSON.parse(data);
    return {};
}

function getTree() {
    if (ready) return graph.toJSON();
    return null;
}

(async () => {
    try {
        await packageFind();
        await readDeptList(nodeModulesPath);
        // console.log(JSON.stringify(loadedMap, null, '  '));
        generateGraph();
    } catch(err) {
        console.log(err);
    }
})();

module.exports = getTree;
