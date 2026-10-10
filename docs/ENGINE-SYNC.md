# 引擎依赖同步与恢复

本作的 `main.ts` 和 `src/**/*.ts` 是唯一游戏源码，`npm run build` 将它们编译到 `dist/`。运行入口为 `dist/main.js`。公共库通过 `@ts-stg/thlib` 与 `@ts-stg/thlib/touhou` 导入，其入口和声明由库的 `package.json` 指向 `dist/`。生成的 JavaScript、声明及 source map 不提交 Git。

## 锁定的内容

`engine.lock.json` 使用 `touhou21-engine-lock-v2`，只接受已提交的 TypeScript 公共库：

- `commit` 是完整的 40 位引擎 Git 提交；`thlibContent` 固定为 `git-typescript-build`。
- `thlibBuild.sourceFiles` 锁定该提交中选定的公共源码、配置、许可证和资源的字节数及 SHA-256。工具直接读取 Git 对象，不采用工作区文件或 Git 换行转换后的内容。
- `thlibBuild.compiler` 锁定精确 TypeScript 版本（当前为 `5.9.3`），并记录编译器实现、包元数据和标准声明库清单的哈希。
- `thlibBuild.outputFiles` 锁定重新编译得到的 `dist/` 全清单和哈希。`thlibFiles` 必须恰好等于输入清单与输出清单的并集。
- `runtimeFiles`、`executableSha256` 和 `nativeBuild` 分别记录原生运行时、许可证和本机构建证据。恢复 thlib 不会更换运行时。

公开源码必须全部是 `.ts`。编译过程检查提交中的 `tsconfig.json`：严格检查、错误时禁止输出、生成声明和映射、完整选择 `src/**/*.ts`，输出只允许落在 `dist/`。本工具不执行源仓库脚本，也不依赖生产者已经生成的 thlib 目录。

各清单按相对路径排序，以 `路径 + NUL + 字节数 + NUL + 小写 SHA-256 + LF` 的 UTF-8 内容计算总摘要。编译器或输出不同都会使验证失败，不能只更新提交号来绕过内容校验。旧锁格式和未提交依赖快照不受支持。

## 首次取得项目

需要 Node.js 24+、npm、Git 和 PowerShell。先恢复本地依赖，再安装本作的 npm 依赖，避免 `file:packages/thlib` 尚不存在时安装失败：

```powershell
pwsh -NoProfile -File tools/setup-local.ps1 -EngineSource D:\AIWorkspace\TS-STG
npm ci
npm run typecheck
npm run build
npm run verify:engine
```

`setup-local.ps1` 的目标始终是脚本所在项目。它检查现有文件与锁是否一致，并校验需要恢复的原生运行时字节；需要编译器时，在 `build/compiler-cache/typescript-5.9.3/` 单独用 npm 安装锁定版本，并校验编译器指纹。该独立缓存不需要本作的 `node_modules` 已存在，也不需要先解析本作的 `file:` 依赖。

随后安装器从锁定 Git 提交重建 thlib，在本作 `build/` 中暂存并校验，再恢复 `packages/thlib`、缺失的 `runtime/` 文件和指向本作公共库的 `node_modules/@ts-stg/thlib` 连接。编译器首次获取可能访问 npm registry。已有依赖的内容修改、额外文件或错误连接会阻止安装；安装器不覆盖它们。

首次恢复缺失的运行时，需要 `-EngineSource` 所指目录具有锁中记录的原生文件和许可证；只有 Git 源码的克隆不足以提供这些二进制。已有完整运行时、仅缺 thlib 时，可以使用下面的恢复流程，无需生产者 SDK 或原生构建目录。

从旧 JS 版本首次升级时，原依赖不符合 v2 锁，安装器会拒绝覆盖。先将旧 `packages/thlib/` 和 `runtime/` 完整移到本作 `build/` 下的独立备份目录，再执行上述安装步骤；保留 `userdata/`。这是一次性的工作副本迁移，运行时和工具不保留旧 JS 加载或 v1 锁兼容分支。

```powershell
pwsh -NoProfile -File tools/setup-local.ps1 -EngineSource D:\AIWorkspace\TS-STG -WhatIf
pwsh -NoProfile -File tools/setup-local.ps1 -VerifyOnly
```

`-WhatIf` 预览缺失内容和编译器安装需求，`-VerifyOnly` 只验证现有依赖；二者不写文件，也不安装编译器。安装和恢复都不写源引擎、不修改用户存档。源与目标必须是独立目录，复制路径不能经过符号链接或目录联接；本作的 Node 公共库连接单独校验。

## 恢复同一版本的 thlib

已具备锁定运行时和编译器时，以下命令从任意具有锁定提交对象的引擎克隆恢复公共库：

```powershell
npm run restore:engine -- --source D:\AIWorkspace\TS-STG
npm run restore:engine -- --source D:\AIWorkspace\TS-STG --apply
npm run verify:engine
```

首条命令只规划，`--apply` 才安装。源克隆的 HEAD 可以不同，也可以有本地修改，因为恢复只读取锁定提交的 Git 对象。工具重新核对编译器、输入、输出和完整清单，不需要生产者 SDK、CMake 构建或原生编译器。

恢复不改变 `engine.lock.json`、`runtime/` 或存档，也不自动替换已有 Node 安装。它允许补齐缺失文件及恢复纯文本的 CRLF/LF 差异；其他本地修改和额外文件会被拒绝。旧库保存在本作 `build/engine-restore-*` 内，替换失败时恢复旧库。若 Node 依赖尚未安装，完成依赖恢复后再执行 `npm ci`。

## 升级到新的引擎提交

先在引擎仓库提交公共源码，并完成对应 Release 构建和 SDK 打包。将 `$engineCommit` 设为已审阅、准备同步的完整提交：

```powershell
$engineCommit = '<40位引擎提交SHA>'
node tools/sync-engine.mjs --source D:\AIWorkspace\TS-STG --commit $engineCommit
node tools/sync-engine.mjs --source D:\AIWorkspace\TS-STG --commit $engineCommit --apply
npm run typecheck
npm test
npm run verify:engine
```

规划和执行均要求源 HEAD 等于指定提交，现有本作快照与旧锁完全一致，公共输入已跟踪且依赖输入没有本地修改。新原生程序必须与 SDK 内的程序及元数据一致；工具检查所有原生编译单元、依赖日志、对象及链接库。本地对象和时间检查属于构建匹配证据，不是原生二进制的可复现构建保证。

`sourceModified` 固定为 `false`，表示同步内容全部来自已提交依赖。源仓库中仅允许未暂存的 `start-spellcard-editor.cmd` 个人启动偏好；该文件不参与公共库、原生编译或运行时输入，不复制到游戏。若存在，它的状态、大小、内容哈希和 HEAD blob 单独写入 `sourceState.excludedChanges`，同时 `sourceState.gitClean` 为 `false`、`dependencyInputsClean` 为 `true`。除此之外的修改、暂存变化、删除或未跟踪文件均阻止升级。

工具不提供旧锁迁移、放行依赖修改或派生 SDK 元数据的开关。升级在 `build/engine-upgrade-*` 中暂存并复核，保存旧依赖与旧锁；替换失败时回退。工具不 stash、reset 或修改源引擎。

## 验证范围

```powershell
npm run verify:engine
node tools/verify-engine-lock.mjs --source D:\AIWorkspace\TS-STG
node tools/verify-engine-lock.mjs --check-source
node tools/verify-engine-lock.mjs --check-build
npm run verify:engine-smoke
```

默认验证本作安装内容及 Node 解析。`--source` 或 `--check-source` 还从锁定 Git 提交重新编译公共库，对比编译器指纹、源码与输出清单；前者指定本地克隆，后者使用锁中的源路径。两者都不要求源 HEAD 等于锁定提交。

`--check-build` 额外检查原机器的源 HEAD、已记录的源状态、原生输入、编译日志和二进制，因此需要锁定版本对应的本机构建目录。运行时 smoke 验证分别使用 V8 与 QuickJS；该检查不能代替 GPU 画面和实际音频试听。游戏或引擎的改动若改变确定性模拟，还需更新回放修订并运行相关回归。
