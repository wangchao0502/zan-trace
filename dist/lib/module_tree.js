'use strict';

// load dependencies and return node_modules path
let getSubModulePath = (() => {
    var _ref = _asyncToGenerator(function* (modulePath) {
        const isDir = yield fsAsync.isDir(modulePath);
        if (!isDir) return null;

        const pkg = yield readPkg(path.join(modulePath, 'package.json'));
        if (!loadNodeInfo(pkg)) return null;

        const subModulePath = path.join(modulePath, 'node_modules');
        const isSubModuleDir = yield fsAsync.isDir(subModulePath);

        if (isSubModuleDir) return subModulePath;

        return null;
    });

    return function getSubModulePath(_x) {
        return _ref.apply(this, arguments);
    };
})();

let readDeptList = (() => {
    var _ref2 = _asyncToGenerator(function* (modulePath) {
        if (!modulePath) return;

        const files = fs.readdirSync(modulePath).filter(function (x) {
            return x.charAt(0) !== '.';
        });
        const subModulePath = [...files.filter(function (x) {
            return x.charAt(0) === '@';
        }).map(function (x) {
            return fs.readdirSync(path.join(modulePath, x)).map(function (y) {
                return `${x}/${y}`;
            });
        }).join().split(','), ...files.filter(function (x) {
            return x.charAt(0) !== '@';
        })];

        try {
            const modulePaths = yield Promise.all(subModulePath.map(function (file) {
                return getSubModulePath(path.join(modulePath, file));
            }));
            yield Promise.all(modulePaths.filter(function (x) {
                return !!x;
            }).map(function (x) {
                return readDeptList(x);
            }));
        } catch (err) {
            console.log(err);
        }
    });

    return function readDeptList(_x2) {
        return _ref2.apply(this, arguments);
    };
})();

let packageFind = (() => {
    var _ref3 = _asyncToGenerator(function* () {
        const dir = process.cwd();
        const pkgPath = path.join(dir, 'package.json');

        if (fs.existsSync(pkgPath)) {
            projectPath = dir;
            packageJsonPath = pkgPath;
            nodeModulesPath = path.join(projectPath, 'node_modules');

            // add main dependency
            const pkg = yield readPkg(pkgPath);

            rootModuleName = pkg.name;
            rootModuleVersion = pkg.version || DEFAULT_VERSION;
            loadNodeInfo(pkg);
        }
    });

    return function packageFind() {
        return _ref3.apply(this, arguments);
    };
})();

let readPkg = (() => {
    var _ref4 = _asyncToGenerator(function* (pkgPath) {
        const data = yield fsAsync.read(pkgPath);
        if (data) return JSON.parse(data);
        return {};
    });

    return function readPkg(_x3) {
        return _ref4.apply(this, arguments);
    };
})();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const fs = require('fs');
const path = require('path');
const semverParser = require('semver');
const util = require('util');
const debuglog = util.debuglog('zan-trace');
const fsAsync = require('../helper/fileAsync');

const Dictionary = function Dictionary() {
    this.items = {};
};

Dictionary.prototype.set = function (key, value) {
    this.items[key] = value;
};
Dictionary.prototype.has = function (key) {
    return this.items.hasOwnProperty(key);
};
Dictionary.prototype.get = function (key) {
    return this.has(key) ? this.items[key] : undefined;
};
Dictionary.prototype.toArray = function () {
    const arr = [];
    Object.keys(this.items).forEach(key => {
        const targets = this.items[key] || [];
        targets.forEach(target => arr.push({ from: key, to: target }));
    });
    return arr;
};

// vertices名称为 包名@version
const Graph = function Graph() {
    // 存储图中所有的顶点
    this.vertices = [];
    // 用字典来存储邻接表
    this.adjList = new Dictionary();
};

// 添加顶点
Graph.prototype.addVertex = function (v) {
    this.vertices.push(v);
    // 顶点为键，字典值为空数组
    this.adjList.set(v.key, []);
};
// 存在顶点
Graph.prototype.hasVertex = function (v) {
    return this.vertices.find(x => x.key === v);
};
// 添加边
Graph.prototype.addEdge = function (v, w) {
    this.adjList.get(v).push(w);
};
Graph.prototype.toString = function () {
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
};
Graph.prototype.toJSON = function () {
    return {
        nodes: this.vertices,
        edges: this.adjList.toArray()
    };
};

const Node = function Node() {
    this.key = '';
    this.name = '';
    this.version = '';
    this.level = 0;
    this.dependencies = [];
};
Node.prototype.getValue = function () {
    return {
        name: this.name,
        version: this.version,
        dependencies: this.dependencies
    };
};

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

    if (loadedMap[node.name]) loadedMap[node.name].push(node);else loadedMap[node.name] = [node];

    return true;
}

function getTree() {
    if (ready) return graph.toJSON();
    return null;
}

_asyncToGenerator(function* () {
    try {
        yield packageFind();
        yield readDeptList(nodeModulesPath);
        // console.log(JSON.stringify(loadedMap, null, '  '));
        generateGraph();
    } catch (err) {
        console.log(err);
    }
})();

module.exports = getTree;