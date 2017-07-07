'use strict';

const fs = require('fs');
const path = require('path');

let graph = new Graph();
let projectPath;
let nodeModulePath;
let installed = [];

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
    return this.has(key) ? items[key] : undefined;
};

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
    this.adjList.set(v, []);
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

const Node = function Node() {
    this.name = '';
    this.semver = '';
    this.version = '';
};

Node.prototype.getValue = function () {
    return {
        name: this.name,
        semver: this.semver,
        version: this.version
    };
};
Node.prototype.toString = function () {
    return `${this.name}@${this.version}`;
};
Node.prototype.parseSemver = function () {
    if (!this.semver) throw new Error('empty semver');
};

function readDeptList() {
    // read node_modules and get all installed module info
    //
}

function packageFind(paths) {
    if (!paths) return null;

    for (let i = 0; i < paths.length; ++i) {
        const dir = path.dirname(paths[i]);
        const pkgPath = path.join(dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            projectPath = dir;
            nodeModulePath = path.join(projectPath, 'node_modules');
            return pkgPath;
        }
    }

    return null;
}

function getDefaultPackageJsonPath() {
    const selfModule = module.parent;

    if (selfModule) {
        return packageFind(selfModule.parent.paths);
    } else {
        return null;
    }
}

function readPkg(packageName, cb) {
    let pkgPath = '';

    if (packageName) {
        pkgPath = path.join(nodeModulePath, packageName, 'package.json');
    } else {
        pkgPath = getDefaultPackageJsonPath();
    }

    fs.readFile(pkgPath, (err, data) => {
        if (err) throw err;
        try {
            const root = tree;
            const pkg = JSON.parse(data);
            console.log(pkgPath);
            cb(pkg);
        } catch (e) {
            throw e;
        }
    });
}

function getTree(cb) {}

module.exports = getTree;