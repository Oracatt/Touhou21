# 东方归名录 ～ Names Beyond the Boundary.

基于 TS-STG 与 thlib 的完整原创东方 Project 同人弹幕游戏。六面本篇、独立 Extra、灵梦与魔理沙双路线，共 34 张符卡，包含道中、中 Boss、非符、剧情对话和结局。本项目目录名为 Touhou21，是开发时的暂名；本作不是官方东方第 21 作，新增设定不属于官方剧情。

初秋的雨后，幻想乡的牌匾、信封和书脊变成了空白。人们依然认得彼此，却越来越难喊出名字。两位自机沿着灯火、雨信和渡船，寻找把名字带到边界另一侧的铃声。

## 运行

Windows 下双击 `Play.cmd`，使用带 JIT 的 V8 后端；`Play-QuickJS.cmd` 使用 QuickJS。游戏以固定 60 帧模拟，画面为 960 × 720，采用纵向游戏区与右侧状态栏。已经还原本地依赖时，运行游戏不需要 Node.js。

源码克隆不包含私有引擎、thlib 或其导入素材。使用锁文件对应的本地 TS-STG 检出及已构建程序还原依赖：

```powershell
pwsh -NoProfile -File tools/setup-local.ps1 -EngineSource D:\AIWorkspace\TS-STG
pwsh -NoProfile -File tools/setup-local.ps1 -VerifyOnly
```

安装器只把锁定的文件复制到本游戏内的 `runtime/` 与 `packages/thlib/`，并建立本地依赖连接。它校验引擎提交、文件大小和 SHA-256；若已有文件不符合锁定内容，会停止并保留文件。源引擎目录始终只读。详见 [发行与依赖说明](docs/RELEASE.md)。

## 操作

| 按键 | 功能 |
| --- | --- |
| 方向键 | 移动；菜单选择 |
| Z / Enter | 射击 / 确定；推进对话 |
| X | 使用 Bomb；菜单返回 |
| Shift | 低速移动并显示判定点；对话中长按跳过 |
| Esc | 暂停；菜单返回 |
| ← / → | 选项页面调整设置 |

灵梦使用追踪火力与梦想封印，魔理沙使用集中火力与魔炮。自机、武器、Bomb、碰撞、擦弹、道具和公共特效均依赖 thlib。非符与后续符卡共用分段血环；符卡期间不 Miss、不使用 Bomb，并在时限内击破可获得符卡奖励。耐久符卡需要存活到倒计时结束。

## 游戏内容

- 本篇六面包含完整道中、各面中 Boss、多段 Boss 战与 21 张符卡，提供 Easy / Normal / Hard / Lunatic 四种难度。
- 任一自机在任一本篇难度不续关通关，即获得对应好结局并解锁 Extra。续关通关进入坏结局。
- Extra 为独立固定难度，包含 3 张中 Boss 符卡、10 张主 Boss 符卡与双自机 Extra 结局。
- 七个场景使用绘制的地面纹理与透明建筑、植被面片构景：鸟居山路、雨竹溪流、渡口拱桥、织架庭院、书库、云端名柱与倒铃回廊。符卡另有持续流动的底纹和主题层，包括环游门灯、雨信、水流、穿梭丝带、浮动纸札、云铃和镜像回声；进入与退出各自淡化，暂停冻结。详见 [背景说明](docs/BACKGROUNDS.md)。
- 道中采用七套独立的分段编队时间表，各面分别发展灯火、斜雨、双流水路、经纬针线、折页朱印、答铃与反向回声；移动路径、敌人分工、停顿与复合攻击随段落和难度变化。详见 [道中设计](docs/ROADS.md)。
- 七位 Boss 的非符各有自己的母题，后续组发展同一套攻击；准备期间移动，锁定目标后分批发射，再留下休止。符卡使用独立短句时钟，间隔保留仍在飞行的旧弹。详见 [非符设计](docs/NONSPELLS.md)与[符卡节奏](docs/SPELLS.md)。
- 原创中文主菜单、九人立绘、七套 Boss 动画图集、剧情与结局、17 首原创合成 BGM，以及附带创作评语的音乐室。
- 关卡练习开放已经到达的本篇关卡；符卡练习开放已经遇见的全部 34 张符卡，包括 Extra 中 Boss 的符卡。
- 玩家记录包含最近 30 次结果，以及按自机、四难度 / Extra 分组的符卡成绩，分别统计实战与符卡练习的收取次数、尝试次数。
- 最近 20 次输入回放可在回放鉴赏中播放。Esc 可暂停、恢复或退出，按住 Shift 以 2 倍速播放。输入、种子、续关事件、初始配置、最高分显示数据与校验点随回放保存；播放使用录制时的脚本后端及内容版本。V8 回放通过 `Play.cmd` 播放，QuickJS 回放通过 `Play-QuickJS.cmd` 播放。
- 设置、解锁、成绩与回放保存在本作 `userdata/`，与引擎演示分离。选项可调整 BGM / 音效音量、初始生命和自动保存回放。回放播放不写入新的成绩与解锁。

## 开发与验证

需要 Node.js 24 或更新版本；公共库依赖由本地安装器建立，不需要联网安装。新作源码位于 `src/`，关卡 / 剧情 / 符卡目录在 `src/content.js`，弹幕设计在 `src/patterns.js`。这些业务代码和素材属于本项目，未写入 TS-STG 或 thlib。

```powershell
npm test
npm run verify:engine
npm run audit
npm run verify
npm run verify:visual
npm run verify:routes
node tools/measure-performance.mjs
```

`verify:engine` 检查本地私有依赖是否仍符合锁定快照；追加 `-- --check-source` 可同时检查本地源引擎。`audit` 检查业务导入、资源清单、依赖边界及 Git 排除规则。`verify` 以 V8 / QuickJS 实际运行完整流程；`verify:visual` 检查实际渲染画面；`verify:routes` 搜索符卡的真实低速输入路线，追加 `-- --kind all` 包含全部非符。报告写入忽略的 `reports/`。自动通关、路线搜索和截图各自验证不同范围，不能代替人工弹幕难度、画面和听感评测。

默认后端为 V8；当前版本的实际场景耗时、QuickJS 对照与适用范围见 [性能实测](docs/PERFORMANCE.md)。

实际验收项目、原生流程与画面报告范围见 [验收记录](docs/VERIFICATION.md)。

## 来源与许可

本项目的原创代码与文档采用 [MIT 许可](LICENSE)。图像、音频、东方角色和私有依赖资源不包含在该许可授权范围内。新作图像由 imagegen 辅助制作，立绘、标题和精灵的提示记录位于 `docs/ART-PROMPTS.json`、`docs/ART-ROOT-PROMPTS.json` 与 `docs/SPRITE-PROMPTS.json`，场景贴图来源记录见 [背景说明](docs/BACKGROUNDS.md)；原创乐谱及合成实现记录于 [音乐说明](docs/MUSIC.md)、`assets/music/scores.json` 和 `tools/compose-music.mjs`。

thlib 私有快照中的公共弹幕、自机和 UI 等导入素材仍保留上海爱丽丝幻乐团 / ZUN 的原始权利与来源说明。“公共素材”指可供框架复用，不等于开源美术授权。本工作树不是可直接打包发行的商业资源授权包，公开源码应排除这些私有依赖；不包含锦上京的专属 Boss、魔石、舞台、标题画面或 BGM。具体发布边界及第三方许可见 [docs/RELEASE.md](docs/RELEASE.md)。
