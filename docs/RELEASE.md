# 发行范围与本地依赖

## 项目边界

《东方归名录 ～ Names Beyond the Boundary.》是原创东方 Project 同人游戏，不是官方系列编号作品。仓库目录名 `Touhou21` 与存档内部标识仅是本项目名称。原作东方 Project、博丽灵梦、雾雨魔理沙等相关权利属于上海爱丽丝幻乐团 / ZUN；本仓库不授予这些权利。

本作独立保存在新目录中。`src/`、`main.js`、剧情、对话、新 Boss、符卡形状、三维场景、原创菜单皮肤和 BGM 均属于游戏业务层。TS-STG 负责宿主、渲染、音频和脚本运行；thlib 负责可复用应用框架、自机、武器、Bomb、敌弹、判定、道具、Boss 展示与结算。游戏通过公开模块导入组合功能，不修改公共库来承载本作角色或关卡。

## 锁定快照

依赖源为只读本地 `D:/AIWorkspace/TS-STG`，Git 提交为 `40db0ae0fa59f659d3677c212035d9c9509fe527`。`engine.lock.json` 完整列出 329 个选定 thlib 文件与 149 个运行时 / 许可文件；可执行程序 SHA-256 为 `F06C80BF000F3C4B1C32B823DA3867E3F9A3D7E68F0044976AA52A7A8F11CCD5`。这些文件是最小私有运行快照，未将整个引擎仓库或演示业务复制过来。

每条文件记录包含相对路径、大小和 SHA-256；运行时文件还记录只读源位置。总清单摘要按路径排序，将 `路径 + NUL + 字节数 + NUL + 小写SHA-256 + LF` 的 UTF-8 内容整体计算 SHA-256。锁文件用于验证版本和内容一致性，不是资源使用授权。

`tools/setup-local.ps1` 根据该清单复制缺失文件，目标固定为脚本所在项目。它先验证源提交、全部源哈希、已有目标文件、路径和连接，再在本项目 `build/` 内暂存及安装；不会覆盖不符合锁定内容的已有依赖。源与目标不得相同或互相包含，不允许复制路径经过符号连接或目录联接。唯一允许的依赖连接为 `node_modules/@ts-stg/thlib` 指向本项目 `packages/thlib`。安装器不下载网络资源、不读取凭据、不删除存档，不写源引擎。

```powershell
pwsh -NoProfile -File tools/setup-local.ps1 -EngineSource D:\AIWorkspace\TS-STG
pwsh -NoProfile -File tools/setup-local.ps1 -VerifyOnly
node tools/verify-engine-lock.mjs --check-source
node tools/verify-setup.mjs
```

源版本不同或本地依赖被修改时，应先保存自己的修改，再明确更新依赖快照与锁文件。本安装器不会替用户覆盖这些更改。`-WhatIf` 可预览安装操作；`-VerifyOnly` 不写文件。

`verify-setup.mjs` 在忽略的 `build/setup-verification-*` 目录执行真实恢复、幂等安装、缺失文件恢复和拒绝覆盖 / 路径检查，并保留测试目录供复查。它不启动游戏、不改源引擎，也不改本作已安装的依赖。

## 许可分别保留

| 内容 | 来源与许可范围 |
| --- | --- |
| 本作原创 JavaScript、PowerShell、Python 与文档 | 根 `LICENSE` 的 MIT，仅覆盖原创代码与文档 |
| 新作立绘、背景与 Boss 动画图集 | imagegen 辅助生成；保留三个提示记录与 `assets/art-manifest.json` 哈希。根 MIT 不自动授权图像或其中的原作角色权利 |
| 新作 17 首 BGM | 本作独立乐谱与离线合成编曲；保留 `assets/music/scores.json`、`src/music-data.js` 和合成工具。音频文件不在根 MIT 范围内 |
| TS-STG 引擎代码 | 源引擎原有 MIT；私有运行时保留 `runtime/LICENSE.TS-STG` |
| thlib 原创代码及其数学实现 | 保留 `packages/thlib/LICENSE`，包括 Microsoft 的归属说明；根项目许可不替代依赖自身许可 |
| thlib 本地导入的东方公共图像、音效与动画数据 | 上海爱丽丝幻乐团 / ZUN 的既有资源，见 `packages/thlib/assets/touhou-common/NOTICE.md`；属于私有引用素材，非 MIT 美术资产 |
| raylib、QuickJS-NG、V8 与其他运行时依赖 | 保留 `runtime/THIRD_PARTY.md` 与整个 `runtime/licenses/`，分别遵循各自许可 |

本地公共素材包含通用弹幕、消弹、自机武器 / Bomb、普通敌人、道具、效果和框架 UI 等既有资源；“通用”是库的职责范围，不表示这些图像原本就来自公共授权素材库。没有将锦上京专属 Boss、魔石、原作标题、舞台背景或原作 BGM 纳入新作业务资源。本作 BGM 全部来自本项目的原创合成编曲。

## 发布清单

源码发布可以收录原创 `main.js`、`src/`、`tools/`、`tests/`、`docs/`、启动脚本、依赖锁、配置和根许可证。新作 `assets/` 应按独立美术 / 音频授权范围决定分发方式，并保留生成 / 编曲来源记录，不能以根 MIT 推定全部素材可任意再授权。

默认 Git 排除 `packages/`、`runtime/`、`node_modules/`、`userdata/`、`reports/`、`build/`、日志与环境文件。公开源码包不得绕过这些规则把私有公共原作资源或用户存档混入。若未来制作可执行发行包，应使用具有明确发行权限的依赖资源，并保留运行时第三方许可；本地可运行不代表获得商业素材授权。此任务没有上传或发布发行包。

回放内容修订为 `GAME_REVISION = 1`。会改变确定性模拟的版本更新应递增该修订号，同时更新依赖锁与验证报告；不同后端的回放不混播。发布前运行 `npm test`、`npm run verify:engine`、`npm run audit`、`npm run verify` 和 `npm run verify:visual`，并人工确认弹幕可读性、结局、音乐播放与输入响应。

静态审计是范围检查：它验证公开导入、资源清单和排除规则；流程验证实际检查公共对象与状态。它们均不等同于对全部资源权利、游戏体验或未执行平台的保证。
