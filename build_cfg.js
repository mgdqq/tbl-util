const _ = require('lodash');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const fileHelp = require('./src/tools/file_help');
const options = require('./options');
const common = require('./build_common');
// const csvMd5 = require('./csvMd5.json');
const saver = require('./build_saver');

const FS = common.FS;
const RS = common.RS;
// const jsonPath = common.jsonPath;
// const csvPath = common.csvPath;
// var designPath = common.designPath;
const csv2json = common.csv2json;
const buildScriptPath = common.buildScriptPath;
const processDependTables = common.processDependTables;
// const jsPath = common.jsPath;

const UsedExcelName = {};
const Config = require('./config');
Config.exportExcept.sort();
const ExportExcept = [];


function preBulid() {
    Config.exportExcept.forEach(function (exp) {
        ExportExcept.push(new RegExp(exp, 'i'));
    });

    fileHelp.mkdir(options.csvPath);
    if (Config.jsonIgnore) {
        fileHelp.mkdir(options.jsPath);
    } else {
        fileHelp.mkdir(options.jsonPath);
    }
    //fileHelp.mkdir(options.constPath);
    fileHelp.mkdir(options.transPath);

    checkAfterBuildScripts();
}

function checkAfterBuildScripts() {
    const scripts = getAfterBuildScripts();
    scripts.forEach(function (file) {
        saver.clearWatchCfgs();
        try {
            require(file);
        } catch (err) {
            console.warn(`require ${file} error!`)
        }

        const modulePath = require.resolve(file);
        delete require.cache[modulePath];
    });

    common.cleanJosnFileCache();
}

function getExcelName(file) {
    let excelName = path.basename(file);
    excelName = excelName.substr(0, excelName.length - 5);
    return excelName;
}

function getExcelCfgName(excelName) {
    return excelName.split('#').pop();
}

function getRealExcelName(file) {
    const excelName = getExcelName(file);
    const excelCfgName = getExcelCfgName(excelName);
    return excelCfgName;
}

function getCsvName(excelName, sheetName) {
    excelName = getExcelCfgName(excelName);
    if (/^Sheet\d+/.test(sheetName)) {
        return excelName;
    }

    return excelName + '_' + sheetName;
}

async function build(opts, cb) {

    let designPath = options.designPath;
    if (typeof opts === 'object') {
        designPath = opts.designPath;
    } else if (typeof opts === 'function') {
        cb = opts;
        opts = null;
    }

    preBulid();

    const allExcels = fileHelp.getAllFileByPath(designPath, ".xlsx")
        .filter((file) => {
            let excelName = path.basename(file);
            if (!/\.xls[xm]$/.test(excelName) || /^~\$/.test(excelName) || /^\./.test(excelName)) {
                return false;
            }
            return true;
        })
        .map((file) => {
            const name = getRealExcelName(file);
            return { name, file };
        });

    let list = await saver.getExportExcels(allExcels);

    list.forEach(function (file) {
        const excelName = getExcelName(file);

        const workbook = XLSX.readFile(file);

        console.log(`start processing excel: ${excelName}`);
        const excelCfgName = getExcelCfgName(excelName);

        if (!/^[A-Z][a-zA-Z\d]+$/g.test(excelCfgName)) {
            console.error(`工作簿命名不规范， '${excelName}'`);
        }

        if (!excelCfgName) {
            console.error(`表名不能为空: ${excelName}`);
            return;
        }

        if (UsedExcelName[excelCfgName]) {
            console.error(`表名重复: ${excelName} <-----> ${UsedExcelName[excelCfgName]}`);
            return;
        }

        UsedExcelName[excelCfgName] = excelName;

        console.log(`processing excel: ${excelName} ---> sheets: ${workbook.SheetNames}`);

        const sheetPrefixs = _.filter(workbook.SheetNames, function (name) {
            return /^Sheet\d+/.test(name);
        });

        if (sheetPrefixs.length > 1) {
            console.error(`太多未命名的sheet!!!`);
            return;
        }

        workbook.SheetNames.forEach(function (sheetName) {
            if (/^#/.test(sheetName)) {
                return;
            }

            const csvName = getCsvName(excelName, sheetName);

            if (!/^[A-Z#][a-zA-Z\d]+$/g.test(sheetName)) {
                console.error(`工作表命名不规范, 表：'${csvName}'`);
            }

            console.log(`converting sheet: ${csvName}`);

            const csvData = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: FS, RS: RS, strip: true, blankrows: false });
            const csvFile = path.join(options.csvPath, csvName + '.csv');
            fs.writeFileSync(csvFile, csvData);

            const isExport = testExport(csvName);
            // console.log(`${csvName} isExport: ${isExport}`);
            if (isExport) {
                csv2json({ csvName: csvName, csvData: csvData });
            }
        });
    })

    processDependTables();

    if (options.build_res) {
        runBuildScriptResAfter();
    } else {
        runBuildScriptAfter();
        runBuildScriptResAfter();
    }

    await saver.save(common.depends);
    return cb && cb();
}

function getAfterBuildScripts() {
    const afterPath = path.join(buildScriptPath, './after');
    return fs.readdirSync(afterPath)
        .filter((file) => /\.js$/.test(file))
        .map((file) => path.join(afterPath, file));
}

function runBuildScriptAfter() {

    const scripts = getAfterBuildScripts();
    scripts.forEach(function (file) {
        console.log(`running ${file}`)
        const builder = require(file);
        if (typeof builder == 'function') {
            builder();
        }
    });
}

function runBuildScriptResAfter() {
    const afterPath = path.join(buildScriptPath, './resAfter');
    fs.readdirSync(afterPath).forEach(function (file) {

        if (!/\.js$/.test(file)) {
            return;
        }

        var builderPath = path.join(afterPath, file);
        console.log(`running ${builderPath}`)
        var builder = require(builderPath);
        if (typeof builder == 'function') {
            builder();
        }
    });
}

function testExport(csvName) {
    for (var i = 0; i < ExportExcept.length; i++) {
        var reg = ExportExcept[i];
        if (csvName.match(reg)) {
            console.log(`Info: export disable, csv: ${csvName} reg: ${reg}`);
            return false;
        }
    }

    return true;
}


exports.buildCfg = build;
