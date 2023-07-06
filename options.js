const path = require('path');

const language = 'cn';

const relativeDesignPath = 'input/design';
const designPath = path.resolve(relativeDesignPath);
const inputDir = 'input';
const dir = `output/share/cfg_`;
const outDir = `${dir}${language}`;
const transPath = `${dir}str_${language}`;
const csvPath = path.resolve(`./${inputDir}/csv`);
const jsonPath = outDir;
const jsPath = outDir;
// const constPath = 'output/share/cfg_const';


const opts = {
    language: language,
    relativeDesignPath,
    designPath: designPath,
    inputDir: inputDir,
    dir: 'output',
    outDir: outDir,
    csvPath: csvPath,
    jsonPath: jsonPath,
    jsPath: jsPath,
    transPath: transPath,
    
    resourceOpts: {
        designPath: path.resolve('./input/design/resource'),
        dir: 'outputRes',
        build_res: true
    }
}


module.exports = opts;