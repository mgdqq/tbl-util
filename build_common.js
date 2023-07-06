/* eslint-disable no-inner-declarations */
/* eslint-disable no-loop-func */
/* eslint-disable guard-for-in */
/* eslint-disable brace-style */
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const options = require('./options');
const Config = require('./config');

const FS = ";";
const RS = "\r\r\n";
const KeyFS = '.';

// const designPath = options.designPath;
// const csvPath = options.csvPath;
// const jsonPath = options.jsonPath;
// const jsPath = options.jsPath;

const buildScriptPath = path.resolve('./build_script');
const DependType = 'depend';
const DependCkType = 'dependck';
const FuncType = 'func';
const TranslateType = 'trans';
const KVType = 'kv';
const DataTypes = ['string', 'number', 'date', 'auto', '[string]', '[number]', '[date]', '[auto]', DependType, `[${DependType}]`, DependCkType, `[${DependCkType}]`, FuncType, TranslateType, KVType];
const UniqOpt = 'unique';
const UniqSubOpt = 'uniqsub';
const IndexOpt = 'index';
const RequiredOpt = 'required';
const DiscardOpt = 'discard';
const OptionalOpt = 'optional';
const DataOpts = [UniqOpt, RequiredOpt, OptionalOpt, IndexOpt, DiscardOpt, UniqSubOpt];

const depends = {};
const csvInfoMap = {};

function checkCsvHeader(csvName, csvData) {
    const commonFunc = require('./build_script/common/commonFunction');
    var errRet = { isOk: false };

    if (!csvData) {
        return errRet;
    }

    var datas = [];
    csvData.split(RS)
        .forEach(function (rowData) {
            if (rowData)
                datas.push(rowData.split(FS));
        });

    var cnCols = datas.shift();
    var keys = datas.shift().map((key) => key.trim());
    var valProps = datas.shift();

    var validKeyIndexs = [];
    var uniqOrIndexs = [];
    var cn = null;
    const dependTbls = [];
    const usedKey = {};
    for (var index = 0; index < cnCols.length; index++) {
        // 表头第一行
        cn = cnCols[index];

        if (!cn || /^#/.test(cn)) {
            continue;
        }

        // 表头第二行
        var key = keys[index].trim();
        if (key == '') {
            console.error(`表头第二行不能为空, ${csvName} ${cn}`);
            return errRet;
        }

        if (usedKey[key]) {
            console.error(`表头第二行列名重复, ${csvName} ${cn} ${key}`);
            return errRet;
        }
        usedKey[key] = 1;

        // 字段命名检查
        var isMatch = true;
        var splits = _.trim(key, '[]').split('.');
        var i = 0;
        var text = splits[i++];
        if (!/^[\da-z_]+$/.test(text)) {
            isMatch = false;
        }

        while (isMatch && i < splits.length) {
            text = splits[i++];
            if (!/^[\w]+$/.test(text)) {
                isMatch = false;
            }
        }

        if (!isMatch) {
            console.error(`表头第二行命名不规范, 表：'${csvName}' 字段：'${key}'`);
        }

        // 表头第三行
        var opts = valProps[index];
        if (_.isEmpty(opts)) {
            console.error(`表头第三行不能为空, ${csvName} ${cn}`);
            return errRet;
        }

        opts = valProps[index].split('#');

        if (!opts[0]) {
            console.error(`表头第三行填写错误, ${csvName} ${cn} ${valProps[index]}`);
            return errRet;
        }

        var dataType = opts[0].toLowerCase();
        var dataOpt = opts[1] || null;
        var dataIsArray = false;

        if (dataType != KVType && !dataOpt) {
            console.error(`表头第三行填写错误, ${csvName} ${cn} ${valProps[index]}`);
            return errRet;
        }

        if (!dataType || DataTypes.indexOf(dataType) == -1) {
            console.error(`表头第三行填写的数据类型不支持, ${csvName} ${cn} ${valProps[index]}`);
            return errRet;
        }

        if (dataType[0] == '[' && dataType[dataType.length - 1] == ']') {
            dataIsArray = true;
            dataType = dataType.substr(1, dataType.length - 2);
        }

        var isSkipOptCheck = false;
        if (dataType == DependType || dataType == DependCkType) {
            isSkipOptCheck = true;
        } else if (dataType == FuncType) {
            isSkipOptCheck = true;
            if (typeof commonFunc[dataOpt] !== 'function') {
                console.error(`表头第三行填写的函数不存在, ${csvName} ${cn} ${valProps[index]}`);
                return errRet;
            }

            let deps = commonFunc[dataOpt].dependTables || [];
            if (typeof commonFunc[dataOpt].dependTables === 'function') {
                deps = commonFunc[dataOpt].dependTables.call(null, csvName);
            }
            deps.forEach(function (tbl) {
                dependTbls.push(tbl);
            })
        } else if (dataType == KVType) {
            dataOpt = dataOpt || UniqOpt;
        }
        else {
            dataOpt = dataOpt.toLowerCase();
        }

        if (!isSkipOptCheck && (!dataOpt || DataOpts.indexOf(dataOpt) == -1)) {
            console.error(`表头第三行填写的数据属性不支持, ${csvName} ${cn} ${valProps[index]}`);
            return errRet;
        }

        valProps[index] = { type: dataType, opt: dataOpt, params: opts.slice(2), isArray: dataIsArray, fs: '|' };

        if (dataType == DependType || dataType == DependCkType) {
            let [, ...rest] = opts;
            rest = rest.join('#').split('.');
            let [dependTable, ...dependColumn] = rest.shift().split('#');
            let dependKey = rest;

            valProps[index].dependTbl = dependTable;
            valProps[index].dependCol = dependColumn;
            valProps[index].dependKey = dependKey;

            dependTbls.push(dependTable);
        }

        if (dataOpt == UniqOpt || dataOpt == IndexOpt || dataOpt == UniqSubOpt) {
            uniqOrIndexs.push(index);
        }

        validKeyIndexs.push(index);
    }

    const csvInfo = {
        converted: false,
        isOk: true,
        csvName: csvName,
        datas: datas,
        validKeyIndexs: validKeyIndexs,
        cnCols: cnCols,
        keys: keys,
        valProps: valProps,
        uniqOrIndexs: uniqOrIndexs,
        dependTbls: _.uniq(dependTbls),
        get isDepend() {
            return dependTbls.length > 0;
        }
    };

    if (csvInfo.isOk && csvInfo.isDepend) {
        depends[csvName] = csvInfo;
    }

    return csvInfo;
}

function getCsvHeaders(csvName, csvData) {
    if (!csvData) {
        csvData = getCsvData(csvName);
    }
    // const commonFunc = require('./build_script/common/commonFunction');
    var errRet = { isOk: false };

    if (!csvData) {
        return errRet;
    }

    var datas = [];
    csvData.split(RS)
        .forEach(function (rowData) {
            if (rowData)
                datas.push(rowData.split(FS));
        });

    var cnCols = datas.shift();
    var keys = datas.shift();
    var ret = {};

    var cn = null,
        key = null;
    for (var index = 0; index < cnCols.length; index++) {
        // 表头第一行
        cn = cnCols[index];

        if (!cn || /^#/.test(cn)) {
            continue;
        }

        // 表头第二行
        key = keys[index].trim();
        if (key == '') {
            console.error(`表头第二行不能为空, ${csvName} ${cn}`);
            return errRet;
        }

        ret[cn] = key;
    }
    return ret;
}

function processDependTables() {
    console.log(`start processDependTables`);
    for (let csvName in depends) {
        var csvInfo = depends[csvName];
        processCsv(csvInfo);
    }
}

function processCsv(csvInfo) {
    if (csvInfo.converted) return;

    const d = csvInfo.dependTbls;
    for (let i = 0; i < d.length; i++) {
        let tbl = d[i];
        if (tbl in depends) {
            processCsv(depends[tbl]);
        }
    }

    console.log(`converting sheet: ${csvInfo.csvName}`);
    csv2json({ csvInfo: csvInfo });
}

function convertRowData(row, csvInfo) {
    const data = {};
    var keys = csvInfo.keys;
    var validKeyIndexs = csvInfo.validKeyIndexs;
    for (var i = 0; i < validKeyIndexs.length; i++) {
        var col = validKeyIndexs[i];
        var key = keys[col];
        var val = row[col];
        data[key] = val;
    }
    return data;
}

function csv2ArrayJson(csvInfo) {
    const commonFunc = require('./build_script/common/commonFunction');
    const csvName = csvInfo.csvName;
    let datas = csvInfo.datas;
    let keys = csvInfo.keys;
    let validKeyIndexs = csvInfo.validKeyIndexs;
    let valProps = csvInfo.valProps;

    let out = [];
    let uniqSets = {};
    let firstCol = csvInfo.uniqOrIndexs[0] || validKeyIndexs[0];
    let tranlates = {};

    datas.forEach(function (row) {
        // 注释行
        if (row[0][0] == '#') {
            return;
        }

        let obj = {};
        let firstColName = keys[firstCol];
        let col = null;
        for (let i = 0; i < validKeyIndexs.length; i++) {
            col = validKeyIndexs[i];
            let key = keys[col];
            let val = _.trim(row[col] || '', '"').replace(/\r\n/g, '\n');
            let opts = valProps[col];

            // 注释行
            if (i == 0 && val[0] == '#') {
                return;
            }

            if (opts.opt == RequiredOpt && !val) {
                console.error(`参数必填, ${csvName} ${firstColName}: ${row[firstCol]} ${keys[col]}: ${row[col]}`);
                return;
            }

            if (opts.opt == DiscardOpt && !val) {
                continue;
            }

            if (opts.isArray) {
                if (val) {
                    val = _.trim(val, opts.fs);
                    val = val.split(opts.fs);
                } else {
                    val = [];
                }
            }

            if (opts.type == 'auto' || opts.type == KVType) {
                if (opts.isArray) {
                    for (let x = 0; x < val.length; x++) {
                        const v = +(val[x] || 0);
                        if (!isNaN(v)) {
                            val[x] = v;
                        }
                    }
                } else {
                    const v = +(val || 0);
                    if (!isNaN(v)) {
                        val = v;
                    }
                }
            } else if (opts.type == 'number') {
                let checkedVal = val;
                if (opts.isArray) {
                    for (let x = 0; x < val.length; x++) {
                        let v = +(val[x] || 0);
                        val[x] = v;
                    }
                } else {
                    val = +(val || 0);
                    checkedVal = [val]
                }

                for (let y = 0; y < checkedVal.length; y++) {
                    if (isNaN(checkedVal[y])) {
                        console.error(`参数类型错误, 参数类型: ${opts.type}, ${csvName} ${firstColName}: ${row[firstCol]} ${keys[col]}: ${row[col]}`);
                        return;
                    }
                }

            } else if (opts.type == 'date') {
                let checkedVal = val;
                if (opts.isArray) {
                    for (let x = 0; x < val.length; x++) {
                        let v = Date.parse(val[x]);
                        val[x] = v;
                    }
                } else {
                    val = Date.parse(val);
                    checkedVal = [val]
                }

                for (let y = 0; y < checkedVal.length; y++) {
                    if (isNaN(checkedVal[y])) {
                        console.error(`参数类型错误, 参数类型: ${opts.type}, ${csvName} ${firstColName}: ${row[firstCol]} ${keys[col]}: ${row[col]}`);
                        return;
                    }
                }

            } else if (opts.type == DependType || opts.type == DependCkType) {

                // eslint-disable-next-line no-shadow
                function getDependVal(val) {
                    if (val) {
                        let tblCfg = require(`./${options.outDir}/${opts.dependTbl}`);
                        if (!tblCfg) {
                            console.error(`依赖表不存在, 依赖表：${opts.dependTbl}, ${csvName} `);
                            return;
                        }

                        let data = tblCfg;
                        if (data.data) {
                            data = data.data;
                        }

                        for (let j = 0; j < opts.dependCol.length; j++) {
                            const e = opts.dependCol[j];
                            data = data[e];
                            if (!data) {
                                console.error(`依赖表中的字段不存在, 依赖表：${opts.dependTbl}, 字段：${e}, 表：${csvName} `);
                                return;
                            }
                        }

                        let tmpVal = data[val];
                        if (typeof tmpVal == 'undefined') {
                            console.error(`依赖表 ${opts.dependTbl} 中不存在: "${row[col]}", ${firstColName}: ${row[firstCol]}`);
                            return;
                        }

                        for (let j = 0; j < opts.dependKey.length; j++) {
                            const k = opts.dependKey[j];
                            tmpVal = tmpVal[k];
                            if (!tmpVal) {
                                console.error(`依赖表中的key不存在, 依赖表：${opts.dependTbl}, key: ${k}, 表：${csvName} `);
                                return;
                            }
                        }

                        if (opts.type == DependType) {
                            val = tmpVal;
                        }
                    } else {
                        // eslint-disable-next-line no-undefined
                        val = undefined;
                    }
                    // eslint-disable-next-line consistent-return
                    return val;
                }

                if (opts.isArray) {
                    val = _.map(val, (v) => getDependVal(v));
                } else {
                    val = getDependVal(val)
                }

            } else if (opts.type == FuncType) {
                const funcName = opts.opt;
                val = commonFunc[funcName].call(null, val, convertRowData(row, csvInfo), key, csvInfo, opts.params);
            } else if (opts.type == TranslateType) {
                let strId = csvName + '_' + key;
                let keyIndexs = csvInfo.uniqOrIndexs.length ? csvInfo.uniqOrIndexs : [];

                let lastId = keyIndexs[keyIndexs.length - 1];
                if (keyIndexs.length == 0 || csvInfo.valProps[lastId].opt == IndexOpt) {
                    lastId = typeof lastId == 'undefined' ? -1 : lastId;
                    const addIndex = csvInfo.validKeyIndexs.find((c) => c > lastId);
                    if (typeof addIndex !== "undefined") {
                        keyIndexs = keyIndexs.concat(addIndex);
                    }
                }

                strId += '_' + keyIndexs.map((iCol) => row[iCol]).join('_');
                tranlates[strId] = val;
                val = strId;
            }

            if (val === '') {
                if (opts.opt == UniqOpt || opts.opt == UniqSubOpt || opts.opt == IndexOpt) {
                    console.error(`数据不能为空, 参数属性或类型：${opts.opt || opts.type}, ${csvName} ${firstColName}: ${row[firstCol]} ${keys[col]}: ${row[col]}`);
                    return;
                }
            }

            if (opts.opt == UniqOpt) {
                let set = uniqSets[key] = uniqSets[key] || new Set();
                if (set.has(val)) {
                    console.error(`数据重复, 参数属性或类型：${opts.opt || opts.type}, ${csvName} ${firstColName}: ${row[firstCol]} ${keys[col]}: ${row[col]}`);
                    return;
                }

                set.add(val);
            }

            if (typeof val == 'undefined') {
                continue;
            }

            let targetObj = obj;

            let isObjArray = false;
            if (key[0] == '[' && key[key.length - 1] == ']') {
                isObjArray = true;
                key = _.trim(key, '[]');
            }

            let keySplits = _.trim(key, KeyFS);
            keySplits = keySplits.split(KeyFS);
            key = keySplits.shift();

            if (keySplits.length) {
                if (isObjArray) {
                    if (targetObj[key]) {
                        if (targetObj[key].length != val.length) {
                            console.error(`数组参数长度不一致, ${csvName} ${firstColName}: ${row[firstCol]} ${keys[col]}: ${row[col]}`);
                            return;
                        }
                    } else {
                        targetObj[key] = new Array(val.length);
                    }

                    targetObj = targetObj[key]
                    for (let z = 0; z < val.length; z++) {
                        setTargetObj(targetObj, z, keySplits, val[z]);
                    }
                } else {
                    setTargetObj(targetObj, key, keySplits, val);
                }
            } else {
                targetObj[key] = val;
            }
        }
        out.push(obj);
    });

    csvInfo.arrayJson = out;
    csvInfo.tranlates = tranlates;
}

function setTargetObj(obj, key, keySplits, val) {
    var targetObj = obj[key] = obj[key] || {};
    var keyIndex = 0;
    key = keySplits[keyIndex++];
    while (keyIndex < keySplits.length) {
        targetObj = targetObj[key] = targetObj[key] || {};
        key = keySplits[keyIndex++];
    }

    targetObj[key] = val;
}

function getCsvInfo(csvName, csvData) {
    let csvInfo = csvInfoMap[csvName];
    if (csvInfo) {
        return csvInfo;
    }

    if (!csvData) {
        csvData = getCsvData(csvName);
    }

    csvInfo = checkCsvHeader(csvName, csvData);
    csvInfoMap[csvName] = csvInfo;
    return csvInfo;
}

// function getAllCsvInfo() {
//     return csvInfoMap;
// }

// 仅使用在after脚本中
function getCsvArrayJson(csvName, csvData) {
    var csvInfo = getCsvInfo(csvName, csvData);
    if (csvInfo.isOk) {
        csv2ArrayJson(csvInfo);
    }
    return csvInfo.arrayJson;
}

function getCsvData(csvName) {
    var csvFile = path.join(options.csvPath, csvName + '.csv');
    var data = null;
    if (fs.existsSync(csvFile)) {
        data = fs.readFileSync(csvFile, 'utf8');
    } else {
        console.error(`${csvName}.csv not exists`);
    }
    return data;
}

function getCustomBuildScript(csvName) {
    const scriptFile = path.join(buildScriptPath, 'script', 'build_' + csvName + '.js');
    // console.log(`scriptFile：${scriptFile}`);
    if (fs.existsSync(scriptFile)) {
        return scriptFile;
    }
    return null;
}


function csv2json(opts) {
    var csvName = opts.csvName;
    var csvData = opts.csvData;
    var csvInfo = opts.csvInfo;

    if (csvInfo) {
        csvName = csvInfo.csvName;
    } else {
        csvInfo = getCsvInfo(csvName, csvData);
        if (csvInfo.isDepend) return;
    }

    if (!csvInfo.isOk)
        return;

    csv2ArrayJson(csvInfo);
    var out = [];
    var scriptFile = getCustomBuildScript(csvName);
    if (scriptFile) {
        const builder = require(scriptFile);
        out = builder(csvInfo.arrayJson);

    } else {
        out = defalutCsv2Json(csvInfo);
    }
    writeJs(csvName, out);

    if (_.size(csvInfo.tranlates)) {
        writeJs(csvName, csvInfo.tranlates, true);
    }

    csvInfo.converted = true;
}

function getKeyOpt(csvInfo, keyIndex) {
    return csvInfo.valProps[keyIndex].opt;
}

function defalutCsv2Json(csvInfo) {
    const keys = csvInfo.keys;
    const uniqOrIndexs = csvInfo.uniqOrIndexs;

    const { type: dataType, opt: dataOpt } = csvInfo.valProps[csvInfo.validKeyIndexs[0]]
    if (dataType == KVType) {
        return toKeyValueJson(csvInfo, dataOpt);
    }

    var out = csvInfo.arrayJson;
    if (uniqOrIndexs.length > 0) {
        out = {};
        var obj = null;
        for (var i = 0; i < csvInfo.arrayJson.length; i++) {
            obj = csvInfo.arrayJson[i];
            var current = out;
            var lvK = 0;
            var key = keys[lvK];
            var opt = null;
            for (var j = 1; j < uniqOrIndexs.length; j++) {
                lvK = uniqOrIndexs[j - 1];
                key = keys[lvK];
                current[obj[key]] = current[obj[key]] || {};
                current = current[obj[key]];
            }

            lvK = uniqOrIndexs[uniqOrIndexs.length - 1];
            opt = getKeyOpt(csvInfo, lvK);
            key = keys[lvK];
            if (opt == IndexOpt) {
                current[obj[key]] = current[obj[key]] || [];
                current = current[obj[key]];
            } else if (opt == UniqSubOpt) {
                if (current[obj[key]]) {
                    console.error(`参数重复, 参数属性：${opt}, ${csvInfo.csvName} ${keys[0]}: ${obj[keys[0]]} ${key}: ${obj[key]}`);
                    continue;
                }
            }

            if (Array.isArray(current)) {
                current.push(obj);
            } else {
                current[obj[key]] = obj;
            }
        }
    }

    return out;
}


function toKeyValueJson(csvInfo, dataOpt) {
    const lvK = csvInfo.validKeyIndexs[0]
    const keyName = csvInfo.keys[lvK];
    const keyCnt = csvInfo.validKeyIndexs.length;

    let out = {};

    if (keyCnt == 1 && dataOpt == IndexOpt) {
        out = [];
    }

    for (let i = 0; i < csvInfo.arrayJson.length; i++) {
        const obj = csvInfo.arrayJson[i];
        const key = obj[keyName];
        if (keyCnt == 1) {
            if (dataOpt == IndexOpt) {
                out.push(key)
            } else {
                out[key] = 1;
            }
        } else {
            const val = _.find(obj, function (v, k) {
                return k != keyName;
            });

            if (dataOpt == IndexOpt) {
                out[key] = out[key] || [];
                out[key].push(val);
            } else {
                out[key] = val;
            }
        }
    }
    return out;
}

function writeJson(jsonName, jsonData) {
    var jsonFile = path.join(options.jsonPath, jsonName + '.json');
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 4));
}

function writeJs(jsonName, jsonData, isTrans, extPatn) {
    function hasChinese(str) {
        const reg = /[\u4e00-\u9fa5]/g; // 匹配中文的正则表达式
        return reg.test(str); // 测试字符串中是否含有中文
    }

    if (hasChinese(jsonName)) {
        console.error(`配置文件名中不能使用中文：${jsonName}`);
    }
    var out = { data: jsonData };

    var header = 'module.exports = \n';
    var formated = JSON.stringify(out, null, 4).replace(/\\\\/g, '\\');
    var footer = ';\n'

    var outPath = isTrans ? options.transPath : options.jsonPath;
    if (extPatn) {
        outPath = extPatn;
    }
    if (Config.jsonIgnore) {
        var jsFile = path.join(outPath, jsonName + '.js');
        fs.writeFileSync(jsFile, header + formated + footer);
    } else {
        var jsonFile = path.join(outPath, jsonName + '.json');
        fs.writeFileSync(jsonFile, formated);
    }
}

// after script will be required firstly in build period 
// config may be changed after required
// the config loaded in the memory is dirty
// they should delete from memory
const CachedCfgName = {};
function cacheJosnFileForClean(jsonFile) {
    CachedCfgName[jsonFile] = 1;
}

function cleanJosnFileCache() {
    for (const jsonFile in CachedCfgName) {
        delete require.cache[jsonFile];
    }
}

function getJsonCfg(jsonName, isTrans) {
    const inputPath = isTrans ? options.transPath : options.jsonPath;
    const jsonFile = path.join(__dirname, inputPath, jsonName + '.json');
    if (fs.existsSync(jsonFile)) {
        cacheJosnFileForClean(jsonFile);
        return require(jsonFile).data;
    }

    return null;
}

module.exports = {
    FS: FS,
    RS: RS,
    get designPath() { return options.designPath; },
    get csvPath() { return options.csvPath; },
    get jsonPath() { return options.jsonPath },
    get jsPath() { return options.jsPath; },
    buildScriptPath: buildScriptPath,
    getCsvInfo: getCsvInfo,
    csv2json: csv2json,
    getCsvArrayJson: getCsvArrayJson,
    getCsvHeaders: getCsvHeaders,
    writeJson: writeJson,
    writeJs: writeJs,
    processDependTables: processDependTables,
    depends: depends,
    getJsonCfg: getJsonCfg,
    cleanJosnFileCache: cleanJosnFileCache,
}

