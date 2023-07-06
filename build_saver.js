const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const checkGit = require('./check_git');

function BuildSaver() {
    this._WatchCfgs = {};
    this._UpdatedExcels = {};
    this.RelateExcel = {};
    this._WatchDirs = {};
    this._UpdatedDirs = {};
    this._FileWatchInfo = {};
    this.excelMTime = null;
    this.saveFile = null;
    this.innerDepends = null;
    this.localCache = {};
    this._init();
}

const pro = BuildSaver.prototype;

pro._init = function () {
    const localTemp = '.localTemp';
    if (!fs.existsSync(localTemp)) {
        fs.mkdirSync(localTemp);
    }
    const excelMTimeFile = './excelMTime.json';
    const innerDependsFile = './innerDepends.json';
    this.saveFile = `./${localTemp}/${excelMTimeFile}`;
    this.innerDependsFile = `./${localTemp}/${innerDependsFile}`;

    if (fs.existsSync(this.innerDependsFile)) {
        this.innerDepends = require(this.innerDependsFile);
    }

    this.localCacheFile = './localCache.json';
}

pro.getAllUsedTempFiles = function () {
    return [this.saveFile, this.innerDependsFile, this.localCacheFile];
}

pro.getCfgExcelName = function (cfgName) {
    return cfgName.split('_').shift();
}

pro.watchCfgUpdate = function (cfgs) {
    if (!Array.isArray(cfgs)) {
        cfgs = [cfgs];
    }

    cfgs.forEach((cfgName) => {
        const excelName = this.getCfgExcelName(cfgName);
        this._WatchCfgs[excelName] = 1;
    })

    this.relateWatchCfgs();
}

pro.relateWatchCfgs = function () {
    const mutualDepend = this.getWatchCfgs();
    _.forEach(mutualDepend, (name) => {
        this.RelateExcel[name] = this.RelateExcel[name] || [];
        this.RelateExcel[name] = _.chain(this.RelateExcel[name])
            .concat(mutualDepend)
            .uniq()
            .pull(name)
            .value();
    })
}

pro.getWatchCfgs = function () {
    return _.keys(this._WatchCfgs || {});
}

pro.clearWatchCfgs = function () {
    this._WatchCfgs = {};
}

const ExcelUpdateType = {
    Change: 1,
    Depend: 2,
};

pro.setExcelUpdate = function (excelName, updateType = ExcelUpdateType.Depend) {
    this._UpdatedExcels[excelName] = updateType;
}

pro.isExcelChange = function (excelName) {
    return this._UpdatedExcels[excelName] > 0;
}

pro.isPattern = function (excelName) {
    return excelName[0] == '*';
}

pro.getPattern = function (name) {
    return name.substr(1);
}

pro.isPatternMatch = function (excelName, pattern) {
    return excelName.indexOf(pro.getPattern(pattern)) != -1;
}

pro.isCfgUpdated = function (cfgNames) {
    if (!Array.isArray(cfgNames)) {
        cfgNames = [cfgNames];
    }

    const excelNames = cfgNames.map((cfgName) => this.getCfgExcelName(cfgName));
    return excelNames.some((excelName) => {
        if (pro.isPattern(excelName)) {
            const pattern = excelName;
            return _.some(this._UpdatedExcels, (v, updated) => this.isPatternMatch(updated, pattern));
        }
        return this._UpdatedExcels[excelName] > 0;
    });
}

pro.getExcelMTime = function (name) {
    if (!this.excelMTime) {
        this.excelMTime = {};
        if (fs.existsSync(this.saveFile) && this.innerDepends) {
            this.excelMTime = require(this.saveFile);
        }
    }
    return this.excelMTime[name];
}

pro.updateExcelMTime = function (name, time) {
    if (time) {
        this.excelMTime[name] = time;
    }
}

pro.saveExcelMTime = function () {
    fs.writeFileSync(this.saveFile, JSON.stringify(this.excelMTime, null, 4));
}

function getExcelCfgName(csvName) {
    const excelName = csvName.split('_')[0];
    return excelName;
}

pro.save = async function (depends) {
    this.localCache.lastCommitId = await checkGit.getCommitId();
    fs.writeFileSync(this.localCacheFile, JSON.stringify(this.localCache, null, 4));
    this.saveExcelMTime();
    const dependInfo = this.innerDepends || {};
    for (const csvName in depends) {
        const excelName = getExcelCfgName(csvName);
        const dependExcels = _.chain(depends[csvName].dependTbls)
            .map((tbl) => getExcelCfgName(tbl))
            .uniq()
            .value();
        dependInfo[excelName] = dependExcels;
    }
    fs.writeFileSync(this.innerDependsFile, JSON.stringify(dependInfo, null, 4));
}

pro.getRelatedExcel = function getRelatedExcel(excelName) {
    // let related = this.RelateExcel[excelName] || [];
    // if (related.length > 0) {
    //     return related;
    // }

    // _.forEach(this.RelateExcel, (v, pattern) => {
    //     if (pro.isPattern(pattern) && this.isPatternMatch(excelName, pattern)) {
    //         related = related.concat(v);
    //     }
    // })

    // return _.uniq(related);

    return this.RelateExcel[excelName] || [];
}

pro.getExcelName = function (excelName) {
    return excelName.split('#').pop();
}

pro.getMTime = function (file) {
    const stat = fs.statSync(file);
    return stat.mtimeMs;
}

pro.getExportExcels = async function (allExcels) {
    const that = this;
    function handleMutualDepend(depends) {
        depends = depends || [];
        depends.forEach((n) => {
            if (that.isPattern(n)) {
                const pattern = that.getPattern(n);
                allExcels.forEach(({ name: ename }) => {
                    if (that.isPatternMatch(ename, pattern)) {
                        exportFileMap[ename] = 1;
                        handleBeDepended(ename);
                    }
                })
            } else {
                exportFileMap[n] = 1;
                handleBeDepended(n);
            }
        })
    }

    const beDepended = {};
    _.forEach(this.innerDepends, (depends, excelName) => {
        _.forEach(depends, (excel) => {
            const beDepends = beDepended[excel] = beDepended[excel] || [];
            beDepends.push(excelName);
            beDepended[excel] = _.uniq(beDepends);
        })
    })

    function handleBeDepended(excel) {
        const beDepends = beDepended[excel] || [];
        beDepends.forEach((ename) => {
            if (!exportFileMap[ename]) {
                that.setExcelUpdate(ename);
                exportFileMap[ename] = 1;
                handleBeDepended(ename);
            }
        });
    }

    if (fs.existsSync(this.localCacheFile)) {
        this.localCache = require(this.localCacheFile);
    }

    let changed = {};
    const gitInfo = {};
    if (this.localCache.lastCommitId) {
        changed = await checkGit.getChangedFiles(this.localCache.lastCommitId);
        changed.excels.forEach((fileName) => {
            const name = this.getExcelName(fileName);
            gitInfo[name] = 1;
        })
    }

    const exportFileMap = {};
    allExcels
        .filter(({ name }) => {
            if (!this.localCache.lastCommitId || gitInfo[name]) {
                this.setExcelUpdate(name, ExcelUpdateType.Change);
                return true;
            }

            return false;
        })
        .forEach(({ name }) => {
            exportFileMap[name] = 1;

            handleBeDepended(name);

            const depends = this.getRelatedExcel(name);
            handleMutualDepend(depends);
        });

    // handle directory update
    this.checkDirUpdate([...changed.others || []]);
    _.forEach(this._UpdatedDirs, (v, dir) => {
        const depends = this._WatchDirs[dir];
        handleMutualDepend(depends);
    })

    const exportFiles = _.chain(exportFileMap)
        .map((__, ename) => {
            const fileInfo = _.find(allExcels, ({ name }) => ename == name);
            return fileInfo?.file;
        })
        .filter((file) => !!file)
        .value();

    return exportFiles;
}

function getRelaviePath(file, dir) {
    const d = path.dirname(file)
    const p = path.resolve(d, dir);
    const r = path.relative(__dirname, p);
    return r;
}

pro.watchDirUpdate = function (file, dir, cfgs) {
    const r = getRelaviePath(file, dir);

    if (!Array.isArray(cfgs)) {
        cfgs = [cfgs];
    }

    this._WatchDirs[r] = cfgs.map((cfgName) => this.getCfgExcelName(cfgName));
}

pro.checkDirUpdate = function (changedFiles) {
    _.forEach(this._WatchDirs, (v, dir) => {
        const _dir = dir.split(path.sep).join('/');
        const isUpdate = changedFiles.find((f) => f.startsWith(_dir));
        if (isUpdate) {
            this._UpdatedDirs[dir] = 1;
        }
    });
}

pro.isDirUpdated = function (file, dir) {
    const r = getRelaviePath(file, dir);
    return this._UpdatedDirs[r] == 1;
}

pro.watchCfgDirUpdate = function (file, opts) {
    this._FileWatchInfo[file] = opts;
    const { cfgs, dir } = opts;
    this.watchCfgUpdate(cfgs);
    this.watchDirUpdate(file, dir, cfgs);
}

pro.isCfgDirUpdated = function (file) {
    const { cfgs, dir } = this._FileWatchInfo[file];
    return this.isCfgUpdated(cfgs) || this.isDirUpdated(file, dir);
}

module.exports = new BuildSaver();