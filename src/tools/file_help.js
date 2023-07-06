/* eslint-disable consistent-return */
/* eslint-disable block-scoped-var */
/* eslint-disable no-redeclare */
/* eslint-disable init-declarations */
/* eslint-disable guard-for-in */

var fs = require('fs');
var path = require('path');
const crypto = require('crypto');

module.exports = {
    //默认忽略
    defaultIgnore: [
        ".DS_Store",
        "~"
    ],

    mkdir: function (dirPath) {
        if (fs.existsSync(dirPath)) {
            return true;
        }

        if (this.mkdir(path.dirname(dirPath))) {
            fs.mkdirSync(dirPath);
            return true;
        }

        return false;
    },

    checkAndCreateDir: function (filePath) {
        var lineArray = filePath.split('/');
        var root = '';
        for (var lineIdx = 0; lineIdx < lineArray.length; lineIdx++) {
            var dic = lineArray[lineIdx];
            root += dic + '/';
            if (dic.indexOf('.') < 0) {
                // 创建目录
                if (!fs.existsSync(root)) {
                    fs.mkdirSync(root);
                }
            }
        }
    },

    // 检查过滤器
    checkFilter: function (file, filter) {
        var ret = true;
        for (var k in this.defaultIgnore) {
            if (file.indexOf(this.defaultIgnore[k]) > -1) {
                ret = false;
                break;
            }
        }

        if (ret && filter) {
            if (filter.ignore) {
                // 处理忽略
                for (var k in filter.ignore) {
                    if (file.indexOf(filter.ignore[k]) > -1) {
                        ret = false;
                        break;
                    }
                }

            } else if (filter.need) {
                // 处理只需要的
                ret = false;
                for (var k in filter.need) {
                    if (file.indexOf(filter.need[k]) > -1) {
                        ret = true;
                        break;
                    }
                }
            }
        }

        return ret;
    },

    copyFile: function (from, to, log_lv, is_check) {
        if (!fs.existsSync(from)) {
            log_lv = log_lv || 1;
            if (log_lv > 1) {
                console.warn('文件不存在!' + from);
            }else{
                console.error('文件不存在!' + from);
            }
            return false;
        }

        if (is_check) {
            return true;
        }

        this.checkAndCreateDir(to);
        fs.writeFileSync(to, fs.readFileSync(from));

        return true;
    },

    copyDir: function (fromDir, toDir, filter) {
        if (typeof fromDir == "string") {
            if (fs.existsSync(fromDir)) {
                var files = fs.readdirSync(fromDir);
                var curPath, toPath;
                for (var k in files) {
                    curPath = fromDir + "/" + files[k];
                    if (fs.statSync(curPath).isDirectory()) {
                        toPath = toDir + "/" + files[k];
                        this.copyDir(curPath, toPath, filter)

                    } else if (this.checkFilter(curPath, filter)) {
                        toPath = toDir + "/" + files[k];
                        this.copyFile(curPath, toPath);
                    }
                }

            }

        } else {
            for (var k in fromDir) {
                this.copyDir(fromDir[k], toDir, filter)
            }
        }

    },

    moveDir: function (fromDir, toDir, filter) {
        if (fs.existsSync(fromDir)) {
            var files = fs.readdirSync(fromDir);
            var curPath, toPath;
            for (var k in files) {
                curPath = fromDir + "/" + files[k];
                if (fs.statSync(curPath).isDirectory()) {
                    toPath = toDir + "/" + files[k];
                    this.moveDir(curPath, toPath, filter)

                } else if (this.checkFilter(curPath, filter)) {
                    toPath = toDir + "/" + files[k];
                    this.copyFile(curPath, toPath);
                    this.cleanFile(curPath);
                }
            }
        }
    },

    copySpine: function (fromDir, toDir, fileName, log_lv, is_check) {
        let idx = fileName.lastIndexOf('/')
        if (idx > -1) {
            fromDir = fromDir + "/" + fileName.slice(0, idx)
            toDir = toDir + "/" + fileName.slice(0, idx)
            fileName = fileName.slice(idx+1, fileName.length)
        }

        let is_atlas = false
        let is_skel = false
        let is_png = false
        if (fs.existsSync(fromDir)) {
            var files = fs.readdirSync(fromDir);
            var curPath, toPath;
            for (var k in files) {
                curPath = fromDir + "/" + files[k];
                if (fs.statSync(curPath).isDirectory()) {
                } else if (curPath.indexOf(fileName) > -1) {
                    toPath = toDir + "/" + files[k];
                    if (this.copyFile(curPath, toPath, null, is_check)) {
                        if (curPath.indexOf(".atlas") > -1) {
                            is_atlas = true
                        }else if (curPath.indexOf(".skel") > -1) {
                            is_skel = true
                        }else if (curPath.indexOf(".png") > -1) {
                            is_png = true
                        }
                    }
                }
            }
        }

        let res_suffix = null
        if (false == is_atlas) {
            res_suffix = ".atlas";
        }
        if (false == is_skel) {
            res_suffix = ".skel";
        }
        if (false == is_png) {
            res_suffix = ".png";
        }

        if(res_suffix) {
            log_lv = log_lv || 1;
            if (log_lv > 1) {
                console.warn('文件不存在!' + fromDir + "/" + fileName + res_suffix);
            }else{
                console.error('文件不存在!' + fromDir + "/" + fileName + res_suffix);
            }
        }
    },

    // 删除文件
    cleanFile: function (from) {
        if (fs.existsSync(from)) {
            fs.unlinkSync(from)
        }
    },

    // 删除目录
    cleanDir: function (fromDir) {
        if (fs.existsSync(fromDir)) {
            fs.rmdirSync(fromDir, { recursive: true });
        }
    },

    getAllFileByPath: function (rt, filter) {
        const self = this;
        let fileList = [];
        function find(root) {
            let jsList = [];
            let curDirList = fs.readdirSync(root);
            curDirList.forEach(function (item) {
                let fullPath = path.join(root, item);
                if (fs.statSync(fullPath).isDirectory()) {
                    find(fullPath, filter);

                } else if (self.checkFilter(item, filter)) {
                    jsList.push(fullPath);
                }

            });
            jsList.forEach(function (value) {
                fileList.push(value);
            });
        }
        find(rt);
        // console.log(`getAllFileByRoot ${fileList}`);
        return fileList;
    },
    /**
     * [md5 description]
     *
     * @param   {[type]}  content  [content description]
     *
     * @return  {[type]}           [return description]
     */
    md5: function (content) {
        return crypto.createHash('md5').update(content, 'utf-8').digest('hex');
    },

    readDir: function (dir) {
        const that = this;
        let list = [];
        const files = fs.readdirSync(dir, { withFileTypes: true });
        files.forEach(function(f) {
            if (/^\./.test(f.name)) {
                return;
            }   
            const entry = path.join(dir, f.name);
            if (f.isDirectory()) {
                list.push(entry + path.sep);
                list = list.concat(that.readDir(entry));
            } else {
                list.push(entry);
            }
        })
    
        return list;
    }
};