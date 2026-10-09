# 发行范围与本地依赖

## 项目边界

《东方归名录 ～ Names Beyond the Boundary.》是原创东方 Project 同人游戏，不是官方系列编号作品。仓库目录名 `Touhou21` 与存档内部标识仅是本项目名称。原作东方 Project、博丽灵梦、雾雨魔理沙等相关权利属于上海爱丽丝幻乐团 / ZUN；本仓库不授予这些权利。

本作独立保存在新目录中。`src/`、`main.js`、剧情、对话、新 Boss、符卡形状、三维场景、原创菜单皮肤和 BGM 均属于游戏业务层。TS-STG 负责宿主、渲染、音频和脚本运行；thlib 负责可复用应用框架、自机、武器、Bomb、敌弹、判定、道具、Boss 展示与结算。游戏通过公开模块导入组合功能，不修改公共库来承载本作角色或关卡。

## 锁定快照

依赖源为本地 `D:/AIWorkspace/TS-STG`，Git 提交为 `a6487455888d86b9569a3d8e3254e0df44ba9a23`。游戏的日常业务开发将源引擎视为只读依赖；按用户要求，公共暂停层次修复、场上气泡、逐句入口和立绘撤回 / 再入能力在源 thlib 独立提交，再用同步工具升级本作。公共状态栏的行、字图、数字、图层和语言选择也由 thlib 实现；本作只提供背景 / 标题皮肤、颜色与 zh-CN 选择。角色的出场台词、出现顺序、锚点和音乐选择仍在本作业务层。`engine.lock.json` 完整列出 355 个 thlib 文件与 150 个运行时 / 许可文件；可执行程序 SHA-256 为 `c62172a90bfb25892a99be0be5411b5b6d6ff8b5c8f5946ec9d09397960745e8`，与升级前一致。thlib 包含该提交全部公开 `src/` 代码、声明和选定的公共资源；运行时保留完整第三方许可，没有复制演示业务、符卡编辑器或源引擎仓库。

锁中 `nativeBuild` 保存全部原生输入、八个编译对象、编译 / 链接依赖日志及三个本地静态库的哈希。此次采用源引擎现成 Release 构建：2026-10-05 10:58:11 UTC 编译 host 对象，11:39:52 UTC 编译最新 V8 对象，11:39:53 UTC 链接程序。逐个编译单元检查依赖文件时间不晚于对应对象，八个对象均在链接输入中，二进制晚于全部原生输入和对象。这是本地构建匹配证据，不是可复现构建认证。

源 `dist/TS-STG` 尚保存旧程序（SHA-256 `9bf136d648f821a1af67eccd6c61ca0e7b331c19b3629b6608b51a1e9c80198d`），因此不能声称新构建与源 SDK 已一致。本作 `runtime/PACKAGE.json` 使用源 SDK 元数据模板在目标目录派生，替换程序哈希和时间，并加入提交、构建路径、旧模板及旧程序哈希的 `derivedFor` 记录。锁保存派生文件的完整文本及摘要，安装器能精确重建；源模板和源 SDK 程序均未修改。静态 V8 库哈希另与 SDK 模板记录核对。

同步时源 Git 有且仅有未暂存的 `start-spellcard-editor.cmd` 用户修改：559 字节，SHA-256 `7121aa214d9f0e526f8c8188293cb07d93d6b9200600f8eab4c13e26fccd4901`。此启动文件不在原生、编译 / 链接、公共库或运行时输入中；工具仅允许显式指定的这个例外。锁如实记录 `sourceModified:true`、`sourceState.gitClean:false`、状态和内容哈希，同步操作结果记录 `sourceWritten:false`。任何其它源改动、暂存修改、删除、重命名或此文件内容变化均拒绝；也接受没有本地修改的同提交检出。公共修复在同步前已提交，同步工具本身没有写源文件，没有 stash、reset 或更改用户启动脚本。

thlib 使用 `thlibContent: "git-blob"`，从锁定 Git 提交直接计算哈希和导出字节，不从可能带 CRLF 的工作区复制；换行变化也不能绕过已安装文件的严格校验。`sourceModified` 仅保留生成锁时的工作区审计记录，允许的编辑器启动脚本不属于库内容。每条文件记录包含相对路径、大小和 SHA-256；运行时文件还记录只读源位置。总清单摘要按路径排序，将 `路径 + NUL + 字节数 + NUL + 小写SHA-256 + LF` 的 UTF-8 内容整体计算 SHA-256。锁文件用于验证版本和内容一致性，不是资源使用授权。

`tools/setup-local.ps1`（canonical Git 锁需要 Node.js 24+）根据该清单恢复缺失文件，目标固定为脚本所在项目。它先验证源提交、全部源哈希、已有目标文件、路径和连接，再在本项目 `build/` 内暂存及安装；不会覆盖不符合锁定内容的已有依赖。源与目标不得相同或互相包含，不允许复制路径经过符号连接或目录联接。唯一允许的依赖连接为 `node_modules/@ts-stg/thlib` 指向本项目 `packages/thlib`。安装器不下载网络资源、不读取凭据、不删除存档，不写源引擎。

```powershell
pwsh -NoProfile -File tools/setup-local.ps1 -EngineSource D:\AIWorkspace\TS-STG
pwsh -NoProfile -File tools/setup-local.ps1 -VerifyOnly
node tools/verify-engine-lock.mjs --check-source
node tools/verify-setup.mjs
node tools/verify-engine-smoke.mjs
```

`setup-local.ps1` 只恢复锁定版本；`-WhatIf` 可预览安装操作，`-VerifyOnly` 不写文件。升级使用下面的同步工具，必须给出预期完整提交；不带 `--apply` 时只校验和预览。

```powershell
node tools/sync-engine.mjs --source D:\AIWorkspace\TS-STG --commit a6487455888d86b9569a3d8e3254e0df44ba9a23 --allow-source-change start-spellcard-editor.cmd --derive-sdk-manifest
node tools/sync-engine.mjs --source D:\AIWorkspace\TS-STG --commit a6487455888d86b9569a3d8e3254e0df44ba9a23 --allow-source-change start-spellcard-editor.cmd --derive-sdk-manifest --apply
```

公共资源清单从源提交中完整、已跟踪的 `assets/touhou-common` 目录建立，包含新增标签与语言包；不沿用旧锁的资源名单。生产者资源及其父目录不得为链接。`--check-source` / `--source <路径>` 按锁定提交核对完整公共源码和公共资源清单，无需该仓库的当前 HEAD 等于锁；`--check-build` 另检查原机器的工作区和编译产物。已有运行时的其他机器可用 `npm run restore:engine -- --source <本地引擎仓库> --apply` 重建 thlib；它不要求构建目录，不修改运行时、锁或存档，保留备份，并拒绝覆盖换行以外的内容差异。没有 `--apply` 时仅预览。

同步前必须通过旧快照校验、本地 Node 依赖连接、源 Git 的严格范围校验、完整公开源码及原生构建校验。默认不允许源修改或旧 SDK；上面两个选项分别授权这一启动脚本例外和经新构建验证后的目标 SDK 元数据派生，不是跳过依赖检查。本地依赖已有修改、额外文件、错误连接或过期原生构建都会使操作停止。工具先在本项目 `build/engine-upgrade-*` 中暂存新文件，再复核并替换包；旧依赖目录和锁文件完整保留在同一暂存目录，失败时恢复旧目录。整个操作不删除用户数据、不写源引擎、不覆盖未经校验的本地修改。

公开框架继续支持可注入世界边界、自机策略、子系统工厂、自定义道具和场景；原灵梦、魔理沙预置仍保留原数值。Boss HP 耗尽会持有实体并通知业务，业务明确决定下一阶段、退场或最终爆炸；下一阶段需要恢复持有的 Boss。聚能与 combat 激活、清理也是独立调用。此次新增公共 `TouhouMusicPlayer`、应用 / GameOver 的可选音乐播放器及 `bullets.emit(parameters,{random})`，旧调用形式兼容；Boss 死亡摇屏采样与场地合成节奏改变，符卡名层不继承摇屏。原生新增编辑器帧传输和 V8 动态导入错误传播修复，既有输入、纹理和 `mesh3d` ABI 保持原接口。改变确定性行为的游戏升级应同步递增回放修订号。

`verify-setup.mjs` 在忽略的 `build/setup-verification-*` 目录执行真实恢复、幂等安装、缺失文件恢复和拒绝覆盖 / 路径检查，并保留测试目录供复查。同步测试同样在独立 `build/engine-sync-verification-*` 内验证拒绝覆盖本地修改、保留旧包和存档。`verify-engine-smoke.mjs` 在 V8 与 QuickJS 执行短时原生无窗口验证，检查公共预置自机/武器、世界、Boss 持有恢复、输入、纹理区域和 mesh 命令，报告存入 `reports/engine-upgrade/`；它不声称验证 GPU 像素或音乐实际听感。

## 许可分别保留

| 内容 | 来源与许可范围 |
| --- | --- |
| 本作原创 JavaScript、PowerShell、Python 与文档 | 根 `LICENSE` 的 MIT，仅覆盖原创代码与文档 |
| 新作立绘、背景与 Boss 动画图集 | imagegen 辅助生成；保留生成提示、来源记录与 `assets/art-manifest.json` 哈希。根 MIT 不自动授权图像或其中的原作角色权利 |
| 新作 18 首 BGM | 本作独立乐谱：15 首由 `tools/studio` 以授权采样库离线渲染（`assets/music/studio.json` 记录循环点与采样来源），另 3 首由 `tools/compose-music.mjs` 合成。采样库不进入仓库；Salamander Grand Piano（CC BY 3.0）与 MuldjordKit（CC BY 4.0）需署名，已写入游戏内制作名单与 `docs/MUSIC.md`。音频文件不在根 MIT 范围内 |
| TS-STG 引擎代码 | 源引擎原有 MIT；私有运行时保留 `runtime/LICENSE.TS-STG` |
| thlib 原创代码及其数学实现 | 保留 `packages/thlib/LICENSE`，包括 Microsoft 的归属说明；根项目许可不替代依赖自身许可 |
| thlib 本地导入的东方公共图像、音效与动画数据 | 上海爱丽丝幻乐团 / ZUN 的既有资源，见 `packages/thlib/assets/touhou-common/NOTICE.md`；属于私有引用素材，非 MIT 美术资产 |
| thlib 的 zh-CN 公共 UI 字图 | 用户提供的喵玉×THB 天空璋汉化补丁（2017-11-17）；保留 ZUN 及汉化图像作者归属、RAR / SQLite / PNG 哈希和裁切记录，不包含补丁程序、原作剧情和季节内容。基础语言缺少的最大得点 / Graze 标签另记录 LuaSTG THlib-Evo 的来源；不视为 MIT 图像 |
| raylib、QuickJS-NG、V8 与其他运行时依赖 | 保留 `runtime/THIRD_PARTY.md` 与整个 `runtime/licenses/`，分别遵循各自许可 |

本地公共素材包含通用弹幕、消弹、自机武器 / Bomb、普通敌人、道具、效果和框架 UI 等既有资源；“通用”是库的职责范围，不表示这些图像原本就来自公共授权素材库。没有将锦上京专属 Boss、魔石、原作标题、舞台背景或原作 BGM 纳入新作业务资源。本作 BGM 的旋律、和声与编曲全部原创；其中 15 首的音色来自上述授权采样库，其余为本项目合成。

## 发布清单

源码发布可以收录原创 `main.js`、`src/`、`tools/`、`tests/`、`docs/`、启动脚本、依赖锁、配置和根许可证。新作 `assets/` 应按独立美术 / 音频授权范围决定分发方式，并保留生成 / 编曲来源记录，不能以根 MIT 推定全部素材可任意再授权。

默认 Git 排除 `packages/`、`runtime/`、`node_modules/`、`userdata/`、`reports/`、`build/`、日志与环境文件。公开源码包不得绕过这些规则把私有公共原作资源或用户存档混入。若未来制作可执行发行包，应使用具有明确发行权限的依赖资源，并保留运行时第三方许可；本地可运行不代表获得商业素材授权。此任务没有上传或发布发行包。

当前游戏版本为 `2.0.0`，回放内容修订为 `GAME_REVISION = 7`。本次依赖锁换行修复不改变游戏代码、模拟或输入时钟，维持修订 7。此前的 Boss 出场对白分离场中角色与立绘，并新增 60 帧文字等待 / 94 帧输入门控，改变了确定性对白推进时钟，因此同时递增 `GAME.contentRevision` 与回放修订。旧回放保留在存档中，当前版本会提示其版本不兼容。会改变确定性模拟的版本更新应递增该修订号，同时更新依赖锁与验证报告；不同后端的回放不混播。发布前运行 `npm test`、`npm run verify:engine`、`npm run audit`、`npm run verify` 和 `npm run verify:visual`，并人工确认弹幕可读性、结局、音乐播放与输入响应。

静态审计是范围检查：它验证公开导入、资源清单和排除规则；流程验证实际检查公共对象与状态。它们均不等同于对全部资源权利、游戏体验或未执行平台的保证。
