# 发行范围与本地依赖

## 项目边界

《东方归名录 ～ Names Beyond the Boundary.》是原创东方 Project 同人游戏，不是官方系列编号作品。仓库目录名 `Touhou21` 与存档内部标识仅是本项目名称。原作东方 Project、博丽灵梦、雾雨魔理沙等相关权利属于上海爱丽丝幻乐团 / ZUN；本仓库不授予这些权利。

本作独立保存在新目录中。`src/`、`main.ts`、剧情、对话、新 Boss、符卡形状、三维场景、原创菜单皮肤和 BGM 均属于游戏业务层。TS-STG 负责宿主、渲染、音频和脚本运行；thlib 负责可复用应用框架、自机、武器、Bomb、敌弹、判定、道具、Boss 展示与结算。游戏通过公开模块导入组合功能，不修改公共库来承载本作角色或关卡。

## 锁定快照与构建

本作仅维护 TypeScript 游戏源码：根 `main.ts` 与 `src/**/*.ts`。`npm run build` 将其输出到 `dist/`，原生入口为 `dist/main.js`。生成的 JavaScript、声明和 source map 不提交 Git；引擎运行 V8 / QuickJS 所需的编译产物。原生 C++ 宿主仍负责底层服务。

依赖以 `engine.lock.json` 为准，不在文档中重复记录会过期的提交、文件数或二进制哈希。锁格式为 `touhou21-engine-lock-v2`，`thlibContent` 固定为 `git-typescript-build`。公共 TypeScript、配置、许可证及公共资源直接读取锁定提交的 Git 对象；使用精确锁定的 TypeScript 编译器（当前 `5.9.3`）生成库的 `dist/`。锁同时记录编译器实现、包元数据、标准声明库指纹，以及输入、输出与最终安装内容的完整清单和 SHA-256。公共入口及类型声明通过 `@ts-stg/thlib` 包导出访问，不引用源码 JavaScript 路径。

`sourceModified` 固定为 `false`，公共依赖必须已提交。源引擎中未暂存的个人 `start-spellcard-editor.cmd` 修改不参与依赖输入，也不会复制；它单独记录在 `sourceState.excludedChanges` 中。任何依赖输入修改都会阻止升级。工具只支持当前 v2 锁，不维护旧格式兼容或未提交工作区快照。

原生运行时与第三方许可另由 `runtimeFiles`、`executableSha256` 和 `nativeBuild` 固定。升级要求源 Release 构建与 SDK 内容一致，并检查对象、编译 / 链接依赖及库哈希。该证据用于验证本机构建与输入匹配，不是原生可复现构建认证。恢复 thlib 时不更换现有原生运行时。

首次取得项目，先运行 `tools/setup-local.ps1`，再运行 `npm ci`。安装器可在独立的 `build/compiler-cache/typescript-5.9.3/` 安装并验证编译器，然后恢复锁定的公共库源码与输出、运行时和本地依赖连接，避免 `file:packages/thlib` 的安装顺序循环。初次获取编译器可能访问 npm registry；`-WhatIf` 和 `-VerifyOnly` 不写文件。恢复缺失的运行时需源目录提供锁定原生文件；已有运行时而只恢复公共库时，具有锁定 Git 提交的克隆即可，无需生产者 SDK 或原生构建。

详细命令、源目录要求、升级和恢复的区别见 [ENGINE-SYNC.md](ENGINE-SYNC.md)。`verify-engine-lock.mjs --check-source` 从锁定提交重新编译并验证编译器、源码与输出；它不依赖源工作区 HEAD。`--check-build` 另外检查锁中原机器的构建证据。工具拒绝覆盖本地依赖修改或错误连接，在本作 `build/` 中保留恢复 / 升级备份，不写源引擎或用户存档。

thlib 包含可复用的应用流程、自机、武器、Bomb、弹幕、道具、Boss 展示与公共 UI。关卡、具体 Boss、剧情、对话、动态符卡纹样、背景皮肤和音乐选择属于游戏。公开框架保留世界边界、子系统工厂、道具、场景和表现回调的扩展通路。改变确定性模拟的升级须同时更新游戏回放修订；本次 TypeScript 迁移保留运行时逻辑、数值和帧序，包括道中切换 Boss BGM 前的 42 帧等待。

## 许可分别保留

| 内容 | 来源与许可范围 |
| --- | --- |
| 本作原创 TypeScript、构建 / 测试脚本、PowerShell、Python 与文档 | 根 `LICENSE` 的 MIT，仅覆盖原创代码与文档 |
| 新作立绘、背景与 Boss 动画图集 | imagegen 辅助生成；保留生成提示、来源记录与 `assets/art-manifest.json` 哈希。根 MIT 不自动授权图像或其中的原作角色权利 |
| 新作 18 首 BGM | 本作独立乐谱：15 首由 `tools/studio` 以授权采样库离线渲染（`assets/music/studio.json` 记录循环点与采样来源），另 3 首由 `tools/compose-music.mjs` 合成。采样库不进入仓库；Salamander Grand Piano（CC BY 3.0）与 MuldjordKit（CC BY 4.0）需署名，已写入游戏内制作名单与 `docs/MUSIC.md`。音频文件不在根 MIT 范围内 |
| TS-STG 引擎代码 | 源引擎原有 MIT；私有运行时保留 `runtime/LICENSE.TS-STG` |
| thlib 原创代码及其数学实现 | 保留 `packages/thlib/LICENSE`，包括 Microsoft 的归属说明；根项目许可不替代依赖自身许可 |
| thlib 本地导入的东方公共图像、音效与动画数据 | 上海爱丽丝幻乐团 / ZUN 的既有资源，见 `packages/thlib/assets/touhou-common/NOTICE.md`；属于私有引用素材，非 MIT 美术资产 |
| thlib 的 zh-CN 公共 UI 字图 | 用户提供的喵玉×THB 天空璋汉化补丁（2017-11-17）；保留 ZUN 及汉化图像作者归属、RAR / SQLite / PNG 哈希和裁切记录，不包含补丁程序、原作剧情和季节内容。基础语言缺少的最大得点 / Graze 标签另记录 LuaSTG THlib-Evo 的来源；不视为 MIT 图像 |
| raylib、QuickJS-NG、V8 与其他运行时依赖 | 保留 `runtime/THIRD_PARTY.md` 与整个 `runtime/licenses/`，分别遵循各自许可 |

本地公共素材包含通用弹幕、消弹、自机武器 / Bomb、普通敌人、道具、效果和框架 UI 等既有资源；“通用”是库的职责范围，不表示这些图像原本就来自公共授权素材库。没有将原作专属 Boss、原作标题、舞台背景或原作 BGM 纳入新作业务资源。本作 BGM 的旋律、和声与编曲全部原创；其中 15 首的音色来自上述授权采样库，其余为本项目合成。

## 发布清单

源码发布可以收录原创 `main.ts`、`src/`、`tools/`、`tests/`、`docs/`、启动脚本、依赖锁、配置和根许可证。新作 `assets/` 应按独立美术 / 音频授权范围决定分发方式，并保留生成 / 编曲来源记录，不能以根 MIT 推定全部素材可任意再授权。

默认 Git 排除 `packages/`、`runtime/`、`node_modules/`、`userdata/`、`reports/`、`build/`、`dist/`、日志与环境文件。源码发布不包含本机运行副本或用户存档；Windows 可执行包按下述白名单独立构建，并保留素材来源、归属与运行时第三方许可。发行包不改变这些资源各自的权利与许可范围。

当前游戏版本为 `4.0.0`，回放内容修订以 `src/storage.ts` 的 `GAME_REVISION` 和 `src/content.ts` 的 `GAME.contentRevision` 为准（当前为 25）。两者必须相同，打包器会检查。仅提升发行版本号不改变模拟或再次递增修订；旧修订回放保留在存档中，须使用录制版本播放。会改变确定性模拟的版本更新应递增修订号，同时更新依赖锁与验证报告；不同后端的回放不混播。发布前运行 `npm run typecheck`、`npm test`、`npm run verify:engine`、`npm run audit`、`npm run verify` 和 `npm run verify:visual`，并人工确认弹幕可读性、结局、音乐播放与输入响应。历史修订与验收结果见 [VERIFICATION.md](VERIFICATION.md)、[ROADS.md](ROADS.md) 和 [BOSS-FLOW.md](BOSS-FLOW.md)。

## Windows 可执行包

Windows 发行版仅包含 V8。在 Windows x64 的已还原开发环境中，先准备下述仅 V8 的原生构建审计输入，再运行：

```powershell
npm run package:windows -- --native-allowlist build/native-v8-only-4739859-release/packaging-allowlist.json
```

游戏入口和业务资源必须已提交，thlib 全部文件必须匹配锁；工具先使用锁定的 TypeScript 编译器构建游戏，再以白名单暂存文件。原生构建凭据必须声明仅 V8，并通过实际后端检查；不接受双后端 EXE。输出在独立的 `build/releases/<时间与随机标识>/` 中，包含 `Touhou-Guiminglu-<版本>-r<修订>-windows-x64-v8.zip`、对应 `.sha256` 和 `release-result.json`。工具不创建标签、推送代码或上传 GitHub Release。

包内保留编译后的游戏与 thlib、游戏图像与18首音乐、当前使用的两个公共资源包、仅 V8 的原生引擎及所编入依赖的原始许可说明。不会复制 Node.js、npm、开发依赖、TypeScript 源码、source map、测试、用户存档或本机环境文件。`runtime/licenses/` 中部分第三方原始声明嵌在 C/C++ 头文件内，按原样保留。专用发行启动器直接运行原生引擎，不执行 `npm run build`。完整解压后双击 `Play.cmd`；数据在包内的 `userdata/`，升级前保留该目录。没有 QuickJS 启动器、实现、库或单独许可文件，旧 QuickJS 回放不能在此发行版中播放。

每个包包含 `RELEASE-MANIFEST.json`（游戏提交、内容修订、引擎提交与实际 EXE 哈希、逐文件 SHA-256）及 `runtime/NATIVE-BUILD.json`。清单不把自身纳入文件哈希，以避免自引用。打包器先将暂存包复制到含中文和空格的全新目录，使用仅包含 Windows 系统目录的 PATH，从包外运行 CMD，随后检查七关背景、符卡、UI 输入和回放，并验证 `--backend quickjs` 会正常报错退出。所有原生检查均有帧数上限。最终 ZIP 再单独解压并逐文件比对；测试副本生成的存档和 QA 文件不会进入 ZIP。报告位于同一输出目录的 `verification/`。

可以独立复查一个解压包：

```powershell
npm run verify:windows-release -- --package <解压后的Touhou-Guiminglu目录> --report build/release-recheck
```

### 仅 V8 的本地 Release 构建

引擎锁保留开发所用的双后端依赖。发行构建在 `build/native-v8-only-4739859-release/source/` 中，从锁定 Git 提交复制原生源文件后，仅修改 CMake、后端工厂声明、宿主创建器与命令行路由四处：不拉取/编译/链接 QuickJS，固定构造 V8，拒绝其他后端。不修改 TS-STG 源仓库、开发 `runtime/` 或引擎锁。打包只接受经过核验的本地构建清单：

```powershell
npm run package:windows -- --native-allowlist build/native-v8-only-4739859-release/packaging-allowlist.json
```

此清单及其原生凭据由构建审计生成，属于本机构建输入，不提交 Git。它必须记录当前锁中全部原始源码的 SHA-256、实际构建输入的 SHA-256、四份补丁全文与前后哈希、Release 配置、V8 检查结果、实际 EXE 和所附每份第三方声明的 SHA-256。打包器重查所有输入哈希，并再次执行发行包验证。实际 EXE 与锁内双后端 EXE 不同，清单明确标记 `exactLockedBinary: false`，同时保留两个哈希；这是以锁定源码为基础的仅 V8 发行配置，不宣称未修改源码或二进制可复现。仅编入 raylib 和 V8，声明清单不包含 QuickJS；原引擎的第三方总说明可以作为上游来源文档保留，发行凭据明确指出实际编入范围。开发依赖验证与发行包验证分别记录结果。没有提供相应审计输入时会报错并停止打包。

静态审计是范围检查：它验证公开导入、资源清单和排除规则；流程验证实际检查公共对象与状态。它们均不等同于对全部资源权利、游戏体验或未执行平台的保证。
