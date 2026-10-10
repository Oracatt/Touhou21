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

默认 Git 排除 `packages/`、`runtime/`、`node_modules/`、`userdata/`、`reports/`、`build/`、`dist/`、日志与环境文件。公开源码包不得绕过这些规则把私有公共原作资源或用户存档混入。若未来制作可执行发行包，应使用具有明确发行权限的依赖资源，并保留运行时第三方许可；本地可运行不代表获得商业素材授权。此任务没有上传或发布发行包。

当前游戏版本为 `2.0.0`，回放内容修订为 `GAME_REVISION = 12`。修订 12 重排七面道中（见 [ROADS.md](ROADS.md)）：自机狙改为编队内接力开火，单列编队拉开间隔，各面换用专属的入场路线与小妖精弹幕样式。修订 9～11 调整道中 Boss：被击破或撤退时保留气场与黑雾（9），改为从左上方入场（10），平滑 Boss 移动曲线并取消重复的入场聚能（11），详见 [BOSS-FLOW.md](BOSS-FLOW.md)。修订 8 改写了三面二非、四面二非与终符、五面一非与道中符卡的弹道，并降低二面道中符卡与六面第三符卡的密度，同时重写灵梦 / 魔理沙两条路线的对白，因此同时递增 `GAME.contentRevision` 与回放修订。修订 7 改用 thlib 的 `classic` 最大得点计分（见 [VERIFICATION.md](VERIFICATION.md)）；其后的公共拾取飘字和七位 Boss 的动态抽象纹样仅改变表现，不改变计分、模拟、RNG 或输入时钟，没有递增修订。修订 6 的状态栏与语言包只改变表现，未改变模拟或输入时钟。更早的 Boss 出场对白分离场中角色与立绘，并新增 60 帧文字等待 / 94 帧输入门控，改变了确定性对白推进时钟，因此同时递增 `GAME.contentRevision` 与回放修订。旧回放保留在存档中，当前版本会提示其版本不兼容。会改变确定性模拟的版本更新应递增该修订号，同时更新依赖锁与验证报告；不同后端的回放不混播。发布前运行 `npm run typecheck`、`npm test`、`npm run verify:engine`、`npm run audit`、`npm run verify` 和 `npm run verify:visual`，并人工确认弹幕可读性、结局、音乐播放与输入响应。

静态审计是范围检查：它验证公开导入、资源清单和排除规则；流程验证实际检查公共对象与状态。它们均不等同于对全部资源权利、游戏体验或未执行平台的保证。
