const { execSync } = require('child_process');
const path = require('path');
const _ = require('lodash');
const { relativeDesignPath: directory } = require('./options');

function getGitOutput(command) {
    return new Promise((resolve, reject) => {
        try {
            const output = execSync(command).toString();
            resolve(output);
        } catch (error) {
            reject(error);
        }
    });
}

async function getChangedFiles(commitId) {
    try {
        const [diff_output, status_output] = await Promise.all([
            getGitOutput(`git diff --name-status ${commitId} HEAD`),
            getGitOutput('git status --short'),
        ]);

        const diff = parseGitOutput(diff_output);
        const status = parseGitOutput(status_output);
        const excels = new Set([...diff.excel, ...status.excel]);
        const others = new Set([...diff.other, ...status.other]);
        console.log(`changedFiles: ${[...excels]}`);
        return {
            excels,
            others
        };
    } catch (error) {
        console.error(error);
        return {};
    }
}

function parseGitOutput(output) {
    output = output
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => {
            const [, file] = line.trim().split(/\s/);
            return _.trim(file, '"');
        });


    // eslint-disable-next-line no-extra-parens
    const ret = _.groupBy(output, (file) => (file.startsWith(directory) ? 'excel' : 'other'))

    ret.excel = ret.excel || [];
    ret.other = ret.other || [];

    ret.excel = ret.excel.filter((file) => file.startsWith(directory))
        .filter((file) => file.toLowerCase().endsWith('.xlsx'))
        .map((file) => path.basename(file, path.extname(file)));

    return ret;
}

async function getCommitId() {
    const output = await getGitOutput('git rev-parse HEAD');
    const commitId = output.split('\n')[0];
    return commitId;
}

module.exports = {
    getChangedFiles: getChangedFiles,
    getCommitId: getCommitId,
};
