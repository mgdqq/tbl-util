# 说明

## 配置表命名规范
- 表（工作簿）名、Sheet页（工作表）名
    - 首字母大写，驼峰，只允许字母、数字
- 字段名
    - 单词间下划线分割，无大写
- key字段命名
    - 通常情况下，无特殊需求：cfg_id

## 配置方式说明
- 需要导出的策划表名以及sheet页工作表名要使用英文名命名
- 脚本导出的配置文件名格式为：表名_sheet页名.csv
- 一张表中只允许一个以默认方式（“Sheet+数字”）命名的sheet页工作表存在	
- ”#“的使用，可以理解为注释用
    - [表名注释]，例如：英雄#Hero
        - #号前：策划中文助记名
        - #号后：导出的表名
    - [页名注释] sheet页名前加#号，脚本不会导出此页
    - [列注释] 列名前加#号， 脚本不会导处此列（导出的csv文件中会出现，但js或json文件中不会出现）
    - [行注释] 一行首列首个字符为#号，脚本将不会导出此行
- 表的前三行作为表头
    - 第一行策划辅助列名
    - 第二行导出的列名，程序用，需要使用英文名
        - 特殊配置方式1：英文名中间使用点分隔符
            | pos.x | pos.y | pos.z |
            | ------- | ------- | ------- |
            | 1 | 10 | 100 |

             导出结果为:

            ``` js
                pos: {
                    x: 1,
                    y: 10,
                    z: 100
                }
            ```
        - 特殊配置方式2：上述配置方式，两端增加“[]”,比如[pos.x], [pos.y], 将导出对象数组，数组分隔符使用竖划线。

            | [pos.x] | [pos.y] | [pos.z] |
            | ------- | ------- | ------- |
            | 1\|2\|3 | 10\|20\|30 | 100\|200\|300 |

            导出结果为:

            ``` js
                pos: [{
                    x: 1,
                    y: 10,
                    z: 100
                },
                {
                    x: 2,
                    y: 20,
                    z: 200
                },
                {
                    x: 3,
                    y: 30,
                    z: 300
                }]
            ```
    - 第三行#号前：代表字段类型，目前支持的类型：
        - string 字符
        - number 数字
        - auto 自动类型（如果是数字，转成数字，否则字符）
        - depend 依赖
        - func 函数
        - trans 多语言单独导出配置文件
        - [string] 字符数组
        - [number] 数值数组
        - [auto] 自动类型数组
    - depend类型，表示依赖其它表的输出， 例如
        | depend#BattleConst |
        | ------- |
        | 行动时 |
        - “#”号后接表名
        - 具体可参考AAAExample.xlsx，Sheet1工作表
        - 导出结果为BattleConst表中“行动时”对应的配置值
        - 后序“#”号后表示取相应字段下的数据
        - “.”点后表示用相应列的数据取值后获得的对象，进行取值操作
        - “.”点可以有多个，类似操作js对象
    - dependCK类型，同depend类型
        - 不同的是只做值得检查，不做替换
    - func类型，表示使用#后的函数对数据进行转换，函数定义在commonFunction.js文件中
        - 具体可参考AAAExample.xlsx，Sheet1工作表
        - 参数1: 当前单元格数据
        - 参数2：当前行数据
        - 参数3：当前列英文key
        - 有时定制函数需要依赖其它配置表，当前表的导出需要等到依赖表导出之后才能导出，在函数上增加dependTables字段设置依赖的表
    - trans类型，用于单独导出多语言的配置文件，导出文件路径使用options.transPath字段配置
        - 具体可参考AAAExample.xlsx，Translate工作表
    - kv类型, 方便key-value结构表的导出
        - 具体可参考AAAExample.xlsx，KeyValue工作表
    - 第三行#号后，代表字段属性，目前支持类型：
        - unique（唯一）
        - required（必填）
        - optional（选填）
        - discard（选填，未填则不导出）
        - index（索引）: 用于将相同字段的归类一起导出
        - uniqsub（子字段唯一）

## 工程简介
- input/design目录：存放策划配置表
- build_script目录： 存放build过程中不同阶段的脚本
    - script目录：存放自定义脚本，用于替换默认导出方式
        - 自定义脚本命名方式：build_表名_sheet页名
        - 在导出sheet页是会检查此目录有没有相应的自定义脚本， 有则使用自定义脚本导出
    - after：存放build完所有的配置文件之后，需要执行的善后脚本
        用于导出一些特殊的配置文件
- config.json
    - exportExcept字段
        - 用于配置不愿导出的sheet页对应的程序配置文件
        - 配置方式
            - 采用正则表达式匹配的方式
            - 例如：“表名_sheet页名”： 此页不导出
            - 例如：“表名_”: 此表都不导出
