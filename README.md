# 东方归名录 ～ Names Beyond the Boundary.

基于 TS-STG 与 thlib 的完整原创东方 Project 同人弹幕游戏。六面本篇、独立 Extra、灵梦与魔理沙双路线，共 39 张符卡，包含道中、中 Boss、非符、剧情对话和结局。本项目目录名为 Touhou21，是开发时的暂名；本作不是官方东方第 21 作，新增设定不属于官方剧情。

初秋的雨后，幻想乡的牌匾、信封和书脊变成了空白。人们依然认得彼此，却越来越难喊出名字。两位自机沿着灯火、雨信和渡船，寻找把名字带到边界另一侧的铃声。

## 运行

Windows 下双击 `Play.cmd`，使用带 JIT 的 V8 后端；`Play-QuickJS.cmd` 使用 QuickJS。开发启动脚本先编译 TypeScript，再运行 `dist/main.js`。游戏以固定 60 帧模拟，画面为 960 × 720，采用纵向游戏区与右侧状态栏。直接运行已经编译的游戏不需要 Node.js；编译与开发启动脚本需要 Node.js 24+。

Windows 发行 ZIP 只包含 V8：完整解压后双击 `Play.cmd` 即可，不需要 Node.js。原生发行引擎不编译或链接 QuickJS；只支持 V8 录制的回放。制作与验证发行包的命令、内容清单和构建凭据见 [Windows 发行说明](docs/RELEASE.md#windows-可执行包)。构建工具不会上传 GitHub Release。

macOS 下双击 `Play.command`（或在终端执行 `./Play.command`）。首次启动时 `npm run build:macos` 从锁定的引擎提交取出原生源码，逐个核对 `engine.lock.json` 记录的 SHA-256，再与 `tools/macos/` 中基于 CoreText 的系统文字实现一起编译出 `build/macos/ts-stg`；锁文件和这些源码不变时直接启动。编译需要 Xcode 命令行工具、CMake 3.24+、Git 以及 TS-STG 仓库的读取权限，源引擎目录只读。Windows 字体名按同风格映射到系统字体（微软雅黑 → 苹方，楷体 → 楷体-简，メイリオ / ＭＳ ゴシック的中文 → 苹方），位图文字保留原 Windows 字体的 GDI 字号度量，对白排版与 Windows 一致。`Play.command` 使用带 JIT 的 V8 后端，与 Windows 版同为 V8 12.3.219.9：编译时下载 rusty_v8 v0.89.0 中对应本机架构（Intel 或 Apple 芯片）的静态库，以及引擎锁定修订的 V8 头文件，下载文件都核对固定的 SHA-256。终端执行 `./Play.command --backend quickjs` 改用 QuickJS，QuickJS 录制的回放也需这样播放。弹幕密集时脚本耗时约 7–12 ms（QuickJS 为 30–50 ms），在集成显卡上剩余的处理落来自 GPU。`npm run verify:macos` 在 V8 与 QuickJS 下分别运行引擎的矢量文字、位图文字、媒体与绘制合约测试并要求两者快照一致，另运行 V8 后端合约测试。macOS 需要已还原的 `packages/thlib`；`restore:engine` 目前仍要求 Windows 运行时，可从已安装的 Windows 环境复制该目录。

源码克隆不包含私有引擎、thlib 或其导入素材。安装需要 Node.js 24 或更新版本；使用锁文件对应的本地 TS-STG 检出及已构建程序还原依赖：

```powershell
pwsh -NoProfile -File tools/setup-local.ps1 -EngineSource D:\AIWorkspace\TS-STG
npm ci
npm run build
pwsh -NoProfile -File tools/setup-local.ps1 -VerifyOnly
```

安装器先准备固定版本的 TypeScript 编译器，再从锁定的引擎提交构建 thlib，恢复本游戏的 `runtime/` 与 `packages/thlib/`。它分别校验源码、编译器和编译产物的文件大小与 SHA-256，不需要预先生成的 thlib `dist/`；原生运行时仍需要对应构建和 SDK 的文件。安装过程只读源引擎目录。详见 [发行与依赖说明](docs/RELEASE.md)。

已有运行时、更新代码后只需恢复 thlib 时，使用以下命令。它直接读取锁定提交的 Git 对象，不依赖源目录的换行格式、当前 HEAD 或原机器的编译产物；源仓库需要包含该提交，路径可以不同：

```powershell
git pull --ff-only
npm run restore:engine -- --source D:\AIWorkspace\TS-STG --apply
npm ci
npm run build
npm run verify:engine -- --source D:\AIWorkspace\TS-STG
```

省略 `--apply` 只检查并显示计划。恢复前保留旧副本；仅允许补回缺失文件或修正文本换行差异，遇到额外文件、实际内容改动或链接会停止。该命令不改运行时、锁文件或存档；缺少运行时的新安装仍使用上面的安装器。

依赖锁采用 v2 格式，分别记录 Git 中的 TS 源码和资源输入、固定编译器及生成的 JS / 类型声明 / source map。`sourceModified` 固定为 `false`，依赖只来自已提交代码；与依赖无关的编辑器启动偏好单独记在 `sourceState.excludedChanges` 中。旧版 JS 快照与锁格式不再作为兼容分支保留。

## 操作

| 按键 | 功能 |
| --- | --- |
| 方向键 | 移动；菜单选择 |
| Z / Enter | 射击 / 确定；推进对话 |
| X | 使用 Bomb；菜单返回 |
| Shift | 低速移动并显示判定点；对话中长按跳过 |
| Ctrl | 回放中按住快进，松开恢复正常速度 |
| Esc | 暂停；菜单返回 |
| ← / → | 选项页面调整设置 |

灵梦使用追踪火力与梦想封印，魔理沙使用集中火力与魔炮。自机、武器、Bomb、碰撞、擦弹、道具和公共特效均依赖 thlib。非符与后续符卡共用分段血环；符卡期间不 Miss、不使用 Bomb，并在时限内击破可获得符卡奖励。耐久符卡需要存活到倒计时结束。

## 游戏内容

- 本篇六面包含完整道中、各面中 Boss、多段 Boss 战与 26 张符卡（主 Boss 21 张，二至六面中 Boss 各 1 张），提供 Easy / Normal / Hard / Lunatic 四种难度。
- 任一自机在任一本篇难度不续关通关，即获得对应好结局并解锁 Extra。续关通关进入坏结局。
- Extra 为独立固定难度，包含 3 张中 Boss 符卡、10 张主 Boss 符卡与双自机 Extra 结局。
- 七个道中场景使用绘制的地面纹理与透明建筑、植被面片构景：鸟居山路、雨竹溪流、渡口拱桥、织架庭院、书库、云端名柱与倒铃回廊。七位 Boss 的符卡各使用一张独立流墨底图和一张抽象纹样，共十四张图片：朱红花结、雨墨流纹、碧青涡波、梅紫织锦、墨绿印纹、靛紫云莲与镜羽回声；底图、主纹样与加减色弱纹样分别运动，反转、漂移和轻微波动各不相同；参考原作 60 帧进入，24 帧淡出，暂停冻结。公共法阵与背景扭曲继续由 thlib 合成。详见 [背景说明](docs/BACKGROUNDS.md)。
- 道具得分飘字由 thlib 默认绘制，使用原作数字图集；满额蓝点显示黄色得分，普通点显示白色，火力跨档显示 POWER UP。上浮、近自机半透明及逐位退场采用原作规则，显示不重复加分。
- v2.0.0 重做了全部弹幕与关卡流程。道中每面 26～31 个编队，按开场、铺垫、中 Boss、后半、高潮与留白推进；大妖精在中 Boss 前后各放一次本面 Boss 母题的“招牌攻击”。二至六面中 Boss 在非符后使用一张符卡再飞离。详见 [道中设计](docs/ROADS.md)与 [Boss 战斗流程](docs/BOSS-FLOW.md)。
- 每段非符与每张符卡都是独立编写的攻击：扩散后朝自机开门的方形门框、停顿后拆封爆开的信封、调头回航的船环、丝线走廊、留空书页通道、只开一座的庭门、带回声的镜像环等。攻击共享 [`src/danmaku.ts`](src/danmaku.ts) 编写工具，运动与判定全部交给公共 thlib。详见 [非符设计](docs/NONSPELLS.md)与[符卡设计](docs/SPELLS.md)。
- 非符采用参考原作共享血环阈值的独立 HP 配置，主 Boss 与道中 Boss 都显示实际倒计时。同角色道中 Boss 击破后飞离；每次准备只有一次带音效的聚能，普通破卡转段音与成功收取奖励音分别处理。详见 [Boss 战斗流程](docs/BOSS-FLOW.md)。
- 原创中文主菜单、九人立绘、七套 Boss 动画图集、剧情与结局、18 首原创 BGM（15 首为真实乐器采样渲染的无缝循环曲，含满身疮痍画面的 Player's Score），以及附带创作评语的音乐室。
- 标题画面使用缓慢推拉的月夜湖面、上浮的空白名札与金色铃光，配楷体书法标题、朱印和中英双语菜单；难度选择为分色卡片，自机选择配浮动立绘与性能条。
- 七关道中另有各自的环境动态：枫叶与萤火、细雨与路面涟漪、河面碎光与水环、梅瓣与金尘、书库浮尘与纸片、上升光尘与钟光、逆升镜片与镜面涟漪。粒子放在道路的三维空间里，用道路镜头投影，近大远小并随镜头产生视差；灯笼和钟的光晕贴在实际景物上。环境层复用公共粒子材质，按模拟帧运动并批量绘制，不影响战斗随机数，暂停时随场景冻结。
- 游戏状态栏由 thlib 默认框架绘制，使用天空璋汉化包中的原图片标签；灵力下方只显示最大得点与擦弹。游戏只提供名册主题背景和中英文标题皮肤，公共暂停、确认与结果面板也统一选择中文资源。
- 最大得点使用 thlib 的 `classic` 计分配置：每累计 10 次擦弹增加 10，上方自动收取的蓝点获得当前最大得点；普通低位拾取仍按高度衰减。没有引入天空璋的季节系统。暂停及结果页隐藏没有对应汉化图片的 Option 行，标题页的中文设置保留。
- 关卡练习开放已经到达的本篇关卡；符卡练习按出场顺序开放已经遇见的全部 39 张符卡，包括各面中 Boss 的符卡。
- 玩家记录包含最近 30 次结果，以及按自机、四难度 / Extra 分组的符卡成绩，分别统计实战与符卡练习的收取次数、尝试次数。
- 回放使用 20 个固定栏位。通关、练习结束或结束游戏时可选择栏位保存；暂停菜单也可保存并返回标题。覆盖已有回放前需确认，取消或重新开始不会自动写入回放。旧回放按原编号保留，续关后的游戏不能保存回放。回放鉴赏显示全部栏位，Esc 可暂停、恢复或退出，按住 Ctrl 以 8 倍速快进，松开恢复正常速度；Shift 不再控制播放速度。播放使用录制时的脚本后端及内容版本；V8 使用 `Play.cmd`，QuickJS 使用 `Play-QuickJS.cmd`。
- 设置、解锁、成绩与回放保存在本作 `userdata/`，与引擎演示分离。选项可调整 BGM / 音效音量和初始生命。成绩结算与回放保存互相独立，播放不写入新的成绩与解锁。

## 开发与验证

需要 Node.js 24 或更新版本与锁定的 TypeScript 5.9.3。新作唯一业务源码是 `main.ts` 和 `src/**/*.ts`，关卡 / 剧情 / 符卡目录在 `src/content.ts`，弹幕在 `src/attacks/`（每位 Boss 一个模块）与 `src/roads.ts`，攻击目录与导演入口在 `src/patterns.ts`。这些业务代码和素材属于本项目，未写入 TS-STG 或 thlib。`npm run build` 严格检查后输出到忽略的 `dist/`，不再维护手写 JS 副本或旧入口转发。测试及开发验证脚本独立于游戏源码。

```powershell
npm ci
npm run typecheck
npm run build
npm test
npm run verify:engine
npm run audit
npm run verify
npm run verify:visual
npm run verify:routes
node tools/measure-performance.mjs
```

弹幕与菜单另有不依赖私有素材的开发工具：`npm run preview -- --stage 3 --difficulty 1,3` 用真实 thlib 子弹场和避弹机器人输出接触印样到 `reports/danmaku/`，`npm run preview:menu` 用记录型宿主与 System.Drawing 输出标题与工具页的布局预览到 `reports/menu/`。`tests/danmaku.test.js`、`tests/director-flow.test.js` 与 `tests/menu.test.js` 在没有私有素材时也能运行；需要私有素材的测试在缺少素材时会注明原因跳过或失败。

`verify:engine` 检查本地私有依赖是否仍符合锁定快照；追加 `-- --check-source` 或 `-- --source <引擎路径>` 可按锁定 Git 提交核对完整 thlib。`-- --check-build` 额外复核原生成机器的工作区、运行时来源与编译证据，需要它的构建目录；跨机器恢复不需要这个选项。`audit` 检查业务导入、资源清单、依赖边界及 Git 排除规则。`verify` 以 V8 / QuickJS 实际运行完整流程；`verify:visual` 检查实际渲染画面；`verify:routes` 搜索符卡的真实低速输入路线，追加 `-- --kind all` 包含全部非符。报告写入忽略的 `reports/`。自动通关、路线搜索和截图各自验证不同范围，不能代替人工弹幕难度、画面和听感评测。

默认后端为 V8；当前版本的实际场景耗时、QuickJS 对照与适用范围见 [性能实测](docs/PERFORMANCE.md)。

实际验收项目、原生流程与画面报告范围见 [验收记录](docs/VERIFICATION.md)。

## 来源与许可

本项目的原创代码与文档采用 [MIT 许可](LICENSE)。图像、音频、东方角色和私有依赖资源不包含在该许可授权范围内。新作图像由 imagegen 辅助制作，立绘、标题和精灵的提示记录位于 `docs/ART-PROMPTS.json`、`docs/ART-ROOT-PROMPTS.json` 与 `docs/SPRITE-PROMPTS.json`，场景贴图来源记录见 [背景说明](docs/BACKGROUNDS.md)；原创乐谱及渲染实现记录于 [音乐说明](docs/MUSIC.md)、`tools/studio`、`assets/music/studio.json`、`assets/music/scores.json` 和 `tools/compose-music.mjs`；采样库的署名见该说明。

thlib 私有快照中的公共弹幕、自机和 UI 等导入素材仍保留上海爱丽丝幻乐团 / ZUN 的原始权利与来源说明。“公共素材”指可供框架复用，不等于开源美术授权。本工作树不是可直接打包发行的商业资源授权包，公开源码应排除这些私有依赖；不包含原作的专属 Boss、舞台、标题画面或 BGM。具体发布边界及第三方许可见 [docs/RELEASE.md](docs/RELEASE.md)。
