/**
 * 东方归名录 ～ Names Beyond the Boundary.
 * Original fan-work story, characters and spell-card catalogue.
 * These records belong to the game, never to the public thlib package.
 */

export const GAME = Object.freeze({
  id: 'touhou21',
  title: '东方归名录',
  subtitle: 'Names Beyond the Boundary.',
  fullTitle: '东方归名录 ～ Names Beyond the Boundary.',
  version: '2.0.0',
  contentRevision: 7,
  genre: '东方 Project 二次创作弹幕射击游戏',
  attribution: '东方 Project 原作：上海爱丽丝幻乐团 / ZUN',
  fanWork: true,
  premise: '牌匾、信札和记忆里的名字陆续空白。事物和人与人的关系依旧存在，唯独呼唤它们的词语，被铃声带到了边界另一侧。',
  season: '初秋，连续三日的细雨之后',
  difficultyNames: ['Easy', 'Normal', 'Hard', 'Lunatic'],
  difficultyDescriptions: [
    '灯影可辨。给初次追寻名字的人。',
    '归途尚明。标准的六面异变调查。',
    '字迹纷乱。熟悉符卡之后的另一条路。',
    '百名齐鸣。让每一声铃都得到回答。',
  ],
  extraTitle: '旧名回声',
  extraRequirement: '任一自机在任一本篇难度不续关通关。',
  manual: [
    '方向键移动；Z 射击、确定；X 使用 Bomb、取消；Shift 低速移动；Esc 暂停。',
    '灵梦与魔理沙使用 thlib 的原作自机、武器与 Bomb。低速移动时显示判定点。',
    '贴近敌弹而未被击中可擦弹；Bomb 可以消弹并在危险时保护自机。',
    '符卡期间不 Miss、不使用 Bomb，在时限内击破可取得符卡奖励。耐久符卡需要生存至倒计时结束。',
    '本篇有六个关卡。二面起中 Boss 在非符之后还会使用一张符卡；道中、中 Boss、非符和符卡均可在练习中反复挑战。',
    '不续关通关开启对应角色的好结局，并开启 Extra；续关通关进入坏结局。',
    '回放、成绩和设置保存在本游戏的 userdata 目录，不与 TS-STG 演示共享。',
    '本作为原创东方同人游戏。人物、异变、对话、背景和音乐中的新增内容不属于官方设定。',
  ],
});

export const PLAYERS = Object.freeze([
  {
    id: 'reimu', name: '博丽灵梦', title: '为名字而出门的巫女', preset: 'reimu',
    colors: ['#D6373C', '#FFF3E4'],
    description: '神社的名字消失了，香火箱却一分不少地空着。比起找回字迹，她更在意是谁把这件事算作祝福。',
    route: '从日常秩序出发，先制止异变，再给异变的主人找一份不会惹事的工作。',
    portrait: 'reimu',
  },
  {
    id: 'marisa', name: '雾雨魔理沙', title: '打算借走归名册的魔法使', preset: 'marisa',
    colors: ['#252738', '#F9E47B'],
    description: '藏书的书脊变成空白，内容却没有少一页。她把异变看成一种难得的魔法，准备一边调查一边取样。',
    route: '追逐异变的原理，把名字看作可以传递的魔法，最后学会不必拥有每一样发现。',
    portrait: 'marisa',
  },
]);

export const CHARACTERS = Object.freeze([
  {
    id: 'akari', name: '扉灯祈', reading: 'Tobitō Akari', title: '替空白守门的灯火',
    species: '灯笼付丧神', ability: '把曾经写下的字照出来程度的能力',
    occupation: '在村外旧路上为归途照明', location: '人间之里外的灯笼坂',
    colors: ['#B9783D', '#E54632', '#FFE8A0'], portrait: 'akari',
    personality: '热情、爱多管闲事；认为灯亮着就该让所有人都看见。容易把告示与邀请混为一谈。',
    backstory: '她原是换掉旧招牌时留下的一盏纸灯。归名册的纸屑落进灯芯后，失去的字迹在灯光中又能短暂出现。她便把所有空白都点亮，连通向封藏之地的指路字也一起照了出来。',
    design: {
      ageAppearance: '少女', hair: '深栗色齐肩短发，发尾像卷起的灯笼纸；右侧两枚铜色小铃发夹。',
      costume: '朱红短外袍，米白内衬，袖口呈六角灯框形；深棕及膝百褶裙，裙边画旧招牌的断字纹；深红绑带木屐。',
      prop: '左手提一盏六角铜框纸灯，灯面留有一枚没有字的白色题签；腰间挂三片木制门牌。',
      silhouette: '小巧而明快，上身宽袖、下身窄裙；灯笼位于身体侧面，不遮住脸。',
      expression: '自信地笑，眉梢上扬，像刚替人找到回家的路。',
      backgroundMotif: '六角灯框、旧门牌、向上飞的暖色纸屑。',
    },
    spellTheme: '会合的灯、留出门缝的火环、整齐而有误差的灯笼街。',
  },
  {
    id: 'shizuri', name: '雨巻静织', reading: 'Amamaki Shizuri', title: '不写收件人的雨',
    species: '雨女', ability: '把雨声装进信封程度的能力',
    occupation: '在雨中送出寄不出去的信', location: '湿墨竹林与古驿道',
    colors: ['#649EC7', '#DDEBF2', '#364C83'], portrait: 'shizuri',
    personality: '说话安静而认真，偶尔把字面上的话理解得过于准确。并不忧郁，只是觉得晴天有些吵。',
    backstory: '她保管着多年没有收件人的旧信。名字消失以后，每封信都像能被她送达了。她误以为这是一场让天下人平等收信的好雨，把归名册外溢的空白信封送向各地。',
    design: {
      ageAppearance: '青年少女', hair: '雾蓝色长发，低束在背后，几缕发丝贴在颊侧；白色细纸带扎发。',
      costume: '蓝白渐层的短和服式雨衣，透明轻纱披肩，袖子像未展开的信封；深靛长裙，裙摆有细小雨滴和邮路折线。',
      prop: '一把白竹骨油纸伞；伞内侧挂若干空白信封，右手握细长的卷信筒。',
      silhouette: '细长、伞面倾向身后，上半身和手臂清晰；衣角有雨丝般的垂线。',
      expression: '轻轻微笑，目光平静；不是悲伤哭泣。',
      backgroundMotif: '雨线、折叠信纸、向下滑落的淡蓝墨滴。',
    },
    spellTheme: '斜雨与留白、错开的信封边线、雨点落在纸上的扩散。',
  },
  {
    id: 'watari', name: '渡守澪舟', reading: 'Watarimori Miofune', title: '只渡去处的船娘',
    species: '渡河妖', ability: '让一条水路忘记岸名程度的能力',
    occupation: '驾驶不定期到岸的小渡船', location: '无名渡口',
    colors: ['#6CA99B', '#253D65', '#DED5AF'], portrait: 'watari',
    personality: '悠闲而嘴快，喜欢讨价还价；遇到真正迷路的人反而不收钱。',
    backstory: '她用旧船票上写的去处维持水路。岸名空白以后，渡船却沿着纸票背面的线驶入了边界。她发现那里有人照常收票，便把这条新航线当成了意外的生意。',
    design: {
      ageAppearance: '青年少女', hair: '深靛色长发编成松辫，辫尾缠浅湖绿布；额前斜刘海，贝壳形发饰。',
      costume: '湖绿色短上衣，米色宽腰带，深蓝不对称裙裤；一侧裙摆像折叠的船帆，衣领有水路图刺绣。',
      prop: '右手握一支短船桨，左手夹空白船票；腰边挂铜钱串与小小的纸船。',
      silhouette: '站姿稳、重心低；船桨斜向外侧，长度不过画面高度；衣装方便划船。',
      expression: '带一点坏心眼的爽朗笑容，仿佛正宣布一笔不便宜的船费。',
      backgroundMotif: '涟漪、船票孔、相互错开的航线。',
    },
    spellTheme: '摆渡的双流、回转水路、缓慢漂移而突然靠岸的纸船。',
  },
  {
    id: 'shino', name: '糸守紫乃', reading: 'Itomori Shino', title: '为记忆缝边的蜘蛛',
    species: '女郎蜘蛛', ability: '把两段记忆接在一起程度的能力',
    occupation: '修补坏掉的织物与混乱的回忆', location: '记忆织庭',
    colors: ['#8C65AC', '#D7C58A', '#5D436E'], portrait: 'shino',
    personality: '温柔、爱捉弄人，喜欢故意不把话说完，等别人替她接上。重视具体的小事。',
    backstory: '她不需要名字便能找回记忆之间的联系。为了防止村人把旧故事说乱，她用丝线给回忆缝了边，结果每条线都指向归名册。她阻拦自机，是怕粗暴拆线会把回忆一并扯破。',
    design: {
      ageAppearance: '成熟女性', hair: '梅紫色长发，左右各绾一束低发髻，剩余长发自然披下；金色细线穿过发饰。',
      costume: '淡金与梅紫相间的层叠和服，袖口形似织梭；紫色腰封上系八枚小金线环，裙边是稀疏的网格纹。',
      prop: '手持小木梭，指尖牵三根发光细线；身后线环暗示蜘蛛的八足，但不画恐怖写实蜘蛛肢体。',
      silhouette: '宽袖展开时呈弧形，细线向外延伸，衣服主体清楚完整。',
      expression: '半眯眼的笑，像已经知道对方会说什么。',
      backgroundMotif: '丝结、织梭、留有缺口的八辐线网。',
    },
    spellTheme: '织物经纬、螺旋打结、先铺线再沿线移动的珠弹。',
  },
  {
    id: 'fusae', name: '御影房枝', reading: 'Mikage Fusae', title: '空白书库的正襟',
    species: '纸札式神', ability: '把规则折进纸里程度的能力',
    occupation: '保管归名册与封藏的旧名', location: '归名书库',
    colors: ['#3E6C5B', '#D6453B', '#E8DFBE'], portrait: 'fusae',
    personality: '一板一眼，礼貌得让人难以插话；把规则记得很清楚，却会认真接受指出的例外。',
    backstory: '她由言音留下的第一张纸札化成，负责给归名册分类。主人将活着的名字误列成旧名时，她也照着新规则执行。败北之后，她主动为所有名字重新盖印，并给书库加上一条不再收取原件的规矩。',
    design: {
      ageAppearance: '青年少女', hair: '墨绿色齐腰直发，前发整齐，左右一对折纸式方形发结；发梢微微卷成纸边。',
      costume: '墨绿立领外袍配米白内裙，红色细腰绳，袖子像翻开的书页；衣领与袖口有朱印方框，不使用现实宗教经文。',
      prop: '左手托一本厚的无字书，右手持朱印；身后漂浮五张空白符札。',
      silhouette: '端正对称，书本贴近腰部，方形与竖线为主；脸部不被纸札遮住。',
      expression: '冷静而认真，嘴角略带公事公办的微笑。',
      backgroundMotif: '书页、红色方印、翻折的纸角。',
    },
    spellTheme: '方印阵列、翻页的弧形弹层、分类之后重新排序的札弹。',
  },
  {
    id: 'kotone', name: '白识言音', reading: 'Shirashiki Kotone', title: '最后被呼唤的命名神',
    species: '被遗忘的命名神', ability: '把无人呼唤的名字留存下来程度的能力',
    occupation: '守护归名册', location: '无名之庭',
    colors: ['#F5ECD6', '#DDBD65', '#9ED3BD'], portrait: 'kotone',
    personality: '庄重却有些天然，容易从善意出发做得太多；听到有人叫她名字时会不自觉地高兴。',
    backstory: '她原本守着旧时代的路名、器物名与已经无人呼唤的神名。越来越多的名字抵达幻想乡，她担心它们再次消失，于是把归名册变成不会褪色的所在。三日雨中听见人们说怕忘记，她误将这句话当作请托，收进了仍被使用的名字。',
    design: {
      ageAppearance: '成熟女性', hair: '象牙白长发，一小束淡薄荷绿挑染，发尾呈缓慢弯曲的书页状；细金发冠上挂一枚小铃。',
      costume: '象牙色宽袖礼服，内层薄荷绿、外层淡金边；下摆由六片像空白书页的布片构成，腰间以金绳结成圆环。',
      prop: '右手执细长金铃杖，左手轻托打开的空白名册；铃杖的环是圆形，不是具体神社徽记。',
      silhouette: '高而舒展，左右不完全对称；铃杖、书本、宽袖三者构成稳定三角。',
      expression: '温和而自信，带一点没有意识到自己闯祸的天真。',
      backgroundMotif: '圆铃、空白书页、金色声纹与薄荷色光。',
    },
    spellTheme: '呼唤与应答、环形声纹、被擦去又重现的间隙；最后一张把六面形状重新写成可读的名字。',
  },
  {
    id: 'mio', name: '玉继未央', reading: 'Tamatsugi Mio', title: '旧名字里没说完的声音',
    species: '封藏于旧名的言灵', ability: '让一次呼唤继续回响程度的能力',
    occupation: '在已经不用的名字中接续声音', location: '倒铃回廊',
    colors: ['#E6EDF5', '#354979', '#C64655'], portrait: 'mio',
    personality: '顽皮、敏锐，喜欢重复别人的最后半句话再加上自己的意思；想被听见，却也享受没人找得到她。',
    backstory: '归名册中的旧名字有最后一次被呼唤的声音。那些声音久而久之成为她。归还活人的名字后，书库变得安静，她便把旧回声送出边界，想证明旧名也能在今天被听见。她不是言音的另一面，而是一位从许多小声音中诞生的新妖怪。',
    design: {
      ageAppearance: '少女', hair: '银白色略卷的双长辫，发辫末端染靛蓝；绯红细绳绑发，左右各一枚倒挂的小铃。',
      costume: '白与靛蓝的短礼服，披肩像翻到背面的书页，内衬绯红；裙摆交错长短，胸前一枚没有字的圆牌。',
      prop: '一对方向相反的银铃，一枚铃口向下，一枚铃口向上；几条细红飘带在身后画出回声。',
      silhouette: '活泼而略不对称，双辫与双铃成四条清楚的外轮廓；腿和衣摆完整可见。',
      expression: '侧头坏笑，眼睛明亮，像刚把别人的话说反。',
      backgroundMotif: '倒转圆环、重复的短弧、双色回声线。',
    },
    spellTheme: '镜像但不完全对称的重复、延迟回声、正逆旋转；耐久符卡中旧声依次消退。',
  },
]);

const line = (speaker, text) => ({ speaker, text });
const spell = (id, name, motif, pattern, description, seconds = 45, survival = false) => ({
  id, name, motif, pattern, description, seconds, survival,
});
/** Spell record codes are persistent save keys. Main Boss cards keep 1..31,
 * the Extra midboss keeps 32..34, and stage midboss cards append 35..39. */
const MIDBOSS_CODES = { 2: 35, 3: 36, 4: 37, 5: 38, 6: 39, 7: 32 };

export const STAGES = [
  {
    id: 1, title: '第一面　门牌不在的归路', subtitle: 'A Lamp for an Unwritten Door',
    location: '人间之里外·灯笼坂', bossId: 'akari',
    colors: ['#172C40', '#CF7042', '#F2CE81'], background: 'stage01',
    bgmStage: 'stage01', bgmBoss: 'boss01', roadFrames: 3900, midbossAt: 1680,
    nonspellNames: ['提灯旋转', '无字门前的灯列'],
    phaseLayout: 'NSNS',
    midbossSpells: [],
    spells: [
      spell('s01-01', '灯符「无人认领的门灯」', 'lantern', 'lantern_gate', '方形门框一圈圈扩散并缓缓旋转，每个门框都在自机方向留出一扇门；两侧灯笼的中玉成列瞄准自机。高难度在门框内再套一层错位的小门框。', 35),
      spell('s01-02', '迎火「百户空白的灯笼坂」', 'lantern', 'lantern_street', '坂道两侧的灯笼自上而下依次点亮，每盏灯放出缺口朝向自机、缓慢回旋的灯环，交织成一条街；点亮过的灯笼稍后落下。', 40),
    ],
    dialogues: {
      reimu: {
        before: [
          line('reimu', '神社牌匾没有字也就算了，村子的路牌也空了。'),
          line('reimu', '前面有光……这个时候，是谁在点灯？'),
          line('boss', '你要找哪一扇门？照一下就能看见旧字哦。'),
          line('reimu', '博丽神社。先说好，不收照明费。'),
          line('boss', '啊，那扇门昨晚也托我保管名字了。'),
          line('reimu', '门可没有嘴。到底是谁在替它说话？'),
          line('boss', '铃一响，纸上的字就自己走了。真省事。'),
          line('reimu', '擅自搬走别人家的招牌，哪里省事了。'),
          line('boss', '那就来认一认吧。所有的灯，哪一盏属于你？'),
        ],
        after: [
          line('boss', '唔，灯里面也没有你的名字。只有一条向雨里去的路。'),
          line('reimu', '所以你只负责把异变照得更显眼。'),
          line('boss', '让人看清楚不是坏事嘛。前面有人在送空白信。'),
          line('reimu', '下次先照照送信人的脸。'),
        ],
      },
      marisa: {
        before: [
          line('marisa', '书脊、瓶签、路牌全空了。倒省得我重新分类。'),
          line('marisa', '路边的灯笼亮着，里头塞满了纸条。'),
          line('boss', '我的灯能照回旧字！要照哪一个？'),
          line('marisa', '先照这瓶。\n要是毒药，今天就麻烦了。'),
          line('boss', '上面写着……不要喝。'),
          line('marisa', '这种重要的字果然不能丢。灯借我一下。'),
          line('boss', '借灯可以，灯芯里的名字可不能拿走。'),
          line('marisa', '那我把照字的办法学走好了。'),
          line('boss', '先试着穿过我的灯笼街吧！'),
        ],
        after: [
          line('marisa', '灯芯是纸屑。魔法藏在纸里啊。'),
          line('boss', '雨里的信使留下的。她还有好多。'),
          line('marisa', '很好，我正缺写实验笔记的纸。'),
          line('boss', '别烧掉呀，那些信还等着送回去呢。'),
        ],
      },
    },
  },
  {
    id: 2, title: '第二面　雨把称呼洗得很轻', subtitle: 'Letters Addressed to the Rain',
    location: '湿墨竹林·旧驿道', bossId: 'shizuri',
    colors: ['#244B68', '#79A9BC', '#C2D9DC'], background: 'stage02',
    bgmStage: 'stage02', bgmBoss: 'boss02', roadFrames: 4500, midbossAt: 1980,
    nonspellNames: ['雨信的折角', '散落的问候'],
    phaseLayout: 'NSNSS',
    midbossSpells: [
      spell('s02-mid', '封缄「雨停前请勿拆阅」', 'rain', 'rain_sealed', '信封向上飞出后悬在空中，拆封时各自洒下一小束针雨，信封本身随即投向自机；细雨贯穿全程。', 35),
    ],
    spells: [
      spell('s02-01', '雨符「收件人空白的细雨」', 'rain', 'rain_envelope', '摇曳的细针雨持续落下；瞄准自机的信封飞出后停住，拆封化作一圈写着空白地址的小玉。', 40),
      spell('s02-02', '墨雨「被洗去的第一句问候」', 'rain', 'rain_ink', '墨滴被抛向高空后在重力下坠落，落到下半场时溅成一圈墨点并向上飞溅细粒；细雨始终不停。', 45),
      spell('s02-03', '送雨「千万封尚未抵达的信」', 'rain', 'rain_letters', '方形信束先展开到很大，停住片刻，随后所有信件同时改投自机方向，汇成楔形；高难度追加错拍的第二束。', 45),
    ],
    dialogues: {
      reimu: {
        before: [
          line('reimu', '真会挑地方。连雨也把脚印洗掉了。'),
          line('reimu', '信封一封接一封飘着，这雨不对劲。'),
          line('boss', '欢迎。你是信上说的“那位巫女”吗？'),
          line('reimu', '别用这种叫法。我有名字。'),
          line('boss', '可信里只剩下这几个字了。问候还在，就能送达。'),
          line('reimu', '问候还在，寄信的人在哪里？'),
          line('boss', '在河对面的书库。她说今后谁都不会被忘记。'),
          line('reimu', '把所有名字弄丢，是很容易做到这一点。'),
          line('boss', '请别急着下结论。先听一封信的雨声。'),
        ],
        after: [
          line('boss', '你说得对。没有名字，也不是谁都能成为收件人。'),
          line('reimu', '这封给村子的就送回村子，别再到处撒了。'),
          line('boss', '渡船还在等信。跟着水声，就不会走错。'),
          line('reimu', '但愿船费还记得怎么收。'),
        ],
      },
      marisa: {
        before: [
          line('marisa', '这雨下得很讲究，每滴都像有东西要说。'),
          line('marisa', '落在帽子上的……好像是字？'),
          line('boss', '那是我装在信里的声音。你愿意收一封吗？'),
          line('marisa', '要是附带照出旧字的办法，我收十封。'),
          line('boss', '纸从河对面的书库来，我只是借雨送信。'),
          line('marisa', '原来不是你的魔法。那把路告诉我吧。'),
          line('boss', '路要等雨停才能看清。'),
          line('marisa', '我赶时间，帮你把雨吹散怎么样？'),
          line('boss', '雨也有雨的次序。让它把这封信说完。'),
        ],
        after: [
          line('marisa', '最后一句是“请勿将原件带出”。这信真不友好。'),
          line('boss', '书库的规矩一直如此。渡口就在前面。'),
          line('marisa', '规矩写在空白纸上，倒很方便改。'),
          line('boss', '雨已经记住了。你改纸也没有用哦。'),
        ],
      },
    },
  },
  {
    id: 3, title: '第三面　去处未写的船票', subtitle: 'A Fare to the Nameless Shore',
    location: '无名渡口·芦苇水路', bossId: 'watari',
    colors: ['#1C3E58', '#6CA99B', '#D2C79A'], background: 'stage03',
    bgmStage: 'stage03', bgmBoss: 'boss03', roadFrames: 4800, midbossAt: 2160,
    nonspellNames: ['摆渡双流', '纸票回航', '靠岸前的涟漪'],
    phaseLayout: 'NSNSNS',
    midbossSpells: [
      spell('s03-mid', '船费「一枚铜钱的渡口」', 'ferry', 'ferry_toll', '铜钱被抛成喷泉状的抛物线落下，带缺口的船票环随重力下坠，船票束定时瞄准自机。', 35),
    ],
    spells: [
      spell('s03-01', '舟符「不记彼岸的单程票」', 'ferry', 'ferry_ticket', '两岸交替放出扇形船票，船票弯向下游，左右弧线交叉成网；Boss 的鳞弹定时瞄准自机。', 45),
      spell('s03-02', '水路「回到原处的渡船」', 'ferry', 'ferry_return', '椭圆船弹环形驶出后减速调头，回到出发处再向另一侧散开，与下一圈去程交叉；Boss 沿水面缓缓摇摆。', 45),
      spell('s03-03', '渡符「两岸都不回答的芦苇洲」', 'ferry', 'ferry_reeds', '芦苇米弹成列摇摆落下，交错成菱形水道；纸船从两岸横渡，船尾不断沉下水纹小玉。', 50),
    ],
    dialogues: {
      reimu: {
        before: [
          line('reimu', '这里原本没有河，也没有桥才对。'),
          line('reimu', '船？还是渡口自己长出来了？'),
          line('boss', '一位乘客？这条新航线今天只收一枚名字。'),
          line('reimu', '这种船费听起来就该退钱。'),
          line('boss', '空白票不收铜钱。你瞧，两边都没写岸名。'),
          line('reimu', '连目的地都没有，还敢开船。'),
          line('boss', '那边的客人很守时呀。只不过从不自我介绍。'),
          line('reimu', '我不坐船。你把拦路的水路让开。'),
          line('boss', '飞过去也算乘客。水路上可没有逃票的风。'),
          line('reimu', '好，那这次就用符卡结算。'),
        ],
        after: [
          line('boss', '票剪好了。算你赢来的，别说我乱收钱。'),
          line('reimu', '票背面的线在往岸上爬。'),
          line('boss', '岸上的蜘蛛替这条路缝了边。她知道书库的门在哪。'),
          line('reimu', '一场异变倒养活了不少生意。'),
        ],
      },
      marisa: {
        before: [
          line('marisa', '地图上画的是路，眼前却是一条河。'),
          line('marisa', '这条河昨天还没有。难道水路也被借走了？'),
          line('boss', '河一直在，只是岸名暂时不在。船费一枚名字。'),
          line('marisa', '我给你取个新名字，算不算？'),
          line('boss', '那要看取得好不好。'),
          line('marisa', '无偿渡船。听起来就很好。'),
          line('boss', '听起来就很亏。我还是收符卡吧。'),
          line('marisa', '早这样说就好了，我身上这种票最多。'),
          line('boss', '别在船上放火，我还要送下一位呢。'),
        ],
        after: [
          line('marisa', '票的背面有魔力，正面却什么也没有。反过来用啊。'),
          line('boss', '岸上的丝线总会拉着它到书库，你照着走就行。'),
          line('marisa', '这张我带走了。研究船费也不违法吧。'),
          line('boss', '下次记得先补上“有偿”两个字！'),
        ],
      },
    },
  },
  {
    id: 4, title: '第四面　记忆有边，名字无线', subtitle: 'The Seam Between Two Memories',
    location: '旧林深处·记忆织庭', bossId: 'shino',
    colors: ['#372F57', '#9A79B8', '#D5C58F'], background: 'stage04',
    bgmStage: 'stage04', bgmBoss: 'boss04', roadFrames: 5100, midbossAt: 2280,
    nonspellNames: ['经纬的起针', '隔着丝线的旧事', '解不开的小结'],
    phaseLayout: 'NSNSNSS',
    midbossSpells: [
      spell('s04-mid', '缝符「先缝住影子的一针」', 'weave', 'weave_shadow', '针弹飞到自机周围排成一圈，停留片刻后一同向圆心缝合；两侧袖口持续洒下米弹。', 35),
    ],
    spells: [
      spell('s04-01', '糸符「相识之人的经纬」', 'weave', 'weave_grid', '预告后的竖直丝线把场地分成几条走廊，珠弹在走廊内落下；每轮丝线松开并错开半条走廊。', 45),
      spell('s04-02', '结忆「昨天与明天的错针」', 'weave', 'weave_cross', '昨天的珠链顺时针、明天的珠链逆时针旋转，交叉出不断移动的菱形缝隙；针弹定时瞄准自机。', 50),
      spell('s04-03', '蛛符「八方皆有归路的丝庭」', 'weave', 'weave_eight', '八条预告丝线从 Boss 身边展开并缓慢转动，每轮反向；网环在丝线之间扩散，安全的扇区随丝线迁移。', 50),
      spell('s04-04', '缝忆「没有署名的团圆衣」', 'weave', 'weave_garment', '两只袖口把珠弹扫向墙壁与天顶，反弹一次后落下成为衣边；方形补丁珠阵定时投向自机。', 55),
    ],
    dialogues: {
      reimu: {
        before: [
          line('reimu', '整片林子都被丝线缝在一起了。'),
          line('reimu', '每根线都亮着，像写满了字。'),
          line('boss', '沿着线来的客人，别把脚下的小结踩散了。'),
          line('reimu', '你把整片林子缝起来，别人怎么过？'),
          line('boss', '不缝起来，昨天买过谁家的豆腐都要讲错。'),
          line('reimu', '名字没有了，买豆腐这件事还记得。'),
          line('boss', '是呀。所以我才帮大家把这些小事接好。'),
          line('reimu', '那就别替拿走名字的人挡路。'),
          line('boss', '急着拔掉一根线，有时会带走整块布。'),
          line('reimu', '放心，我会先找到缝错的那一针。'),
        ],
        after: [
          line('boss', '你的手还算稳。门在这些线的另一端。'),
          line('reimu', '它们全连着一本册子？'),
          line('boss', '她只想替旧名字留个家，却把新名字也收进去了。'),
          line('reimu', '我会让她退回来。你继续看好村里的小事。'),
        ],
      },
      marisa: {
        before: [
          line('marisa', '名字消失了，这些线却还会认人。好魔法。'),
          line('marisa', '线在抖。是有人在那一头拉着吧。'),
          line('boss', '线认的是你昨天做过的事。'),
          line('marisa', '那就别翻昨天的了，从今天开始。'),
          line('boss', '昨天似乎有一本没还的书呢。'),
          line('marisa', '名字没了你还找得出书主，真不方便。'),
          line('boss', '今天要去的书库，也不喜欢客人带书走。'),
          line('marisa', '我只是去看看。顺便把这团线理顺。'),
          line('boss', '请慢慢来。这件衣服可没有第二块布。'),
        ],
        after: [
          line('marisa', '顺着这根线，能直接找到所有书的名字吧。'),
          line('boss', '能找到的是大家还在读的书。没人读的得另问她。'),
          line('marisa', '正好，我喜欢没人碰过的书。'),
          line('boss', '书库的门是纸，千万别点火。'),
        ],
      },
    },
  },
  {
    id: 5, title: '第五面　空白册页的礼仪', subtitle: 'The Library Accepts No Originals',
    location: '边界背侧·归名书库', bossId: 'fusae',
    colors: ['#263E3A', '#AFAE8A', '#C4544A'], background: 'stage05',
    bgmStage: 'stage05', bgmBoss: 'boss05', roadFrames: 5400, midbossAt: 2400,
    nonspellNames: ['藏书印的序列', '归名册的索引', '闭架书库'],
    phaseLayout: 'NSNSNSS',
    midbossSpells: [
      spell('s05-mid', '规章「借阅证不得转借」', 'archive', 'archive_sorting', '纸札环展开后按颜色分拣：红札折向一岸、绿札折向另一岸，两片斜幕在下方交叉。', 35),
    ],
    spells: [
      spell('s05-01', '札符「不收原件的归名书库」', 'archive', 'archive_stamp', '一行行空白书页从上方落下，每行留出的空格连成蜿蜒的通道；朱红大印沿通道盖下。', 45),
      spell('s05-02', '翻页「今名与旧名的错页」', 'archive', 'archive_pages', '放射状的书页线像翻页一样从一侧扫到另一侧，随后整页向旁折转；左右两页交替翻动。', 50),
      spell('s05-03', '印符「五重禁带出之印」', 'archive', 'archive_five', '五枚印章绕 Boss 公转，各自写出一条螺旋臂，并定时一同盖出带缺口的印环；朱红大印瞄准自机。', 55),
      spell('s05-04', '式札「守门人无字的签名」', 'archive', 'archive_signature', '纸札组成的五芒星签名向外扩散，停顿后整体折向一侧；三枚朱印成扇形盖向自机。', 55),
    ],
    dialogues: {
      reimu: {
        before: [
          line('reimu', '好大的书库，连门都是纸糊的。'),
          line('reimu', '满屋都是旧墨水和没人翻的纸味。'),
          line('boss', '欢迎来到归名书库。请将活着的名字放在门外。'),
          line('reimu', '不放。里面有没有一块写着博丽神社的牌匾？'),
          line('boss', '我们只收名字，不收牌匾。它已依新例归入旧名。'),
          line('reimu', '那神社现在还在营业，算哪门子的旧名？'),
          line('boss', '主人说所有怕被忘记的名字，都应先行保管。'),
          line('reimu', '怕雨淋就把房子搬走？她到底在想什么。'),
          line('boss', '若你认为登记有误，请亲自向主人说明。'),
          line('reimu', '我正要去。'),
          line('boss', '在此之前，先按书库的规矩通过这一页。'),
        ],
        after: [
          line('boss', '我认输。你的神社确实仍有人在使用。'),
          line('reimu', '使用它的人多了去，只是出钱的很少。'),
          line('boss', '主人在无名之庭。请让她听到一个仍被呼唤的名字。'),
          line('reimu', '让她先学会听人把话说完吧。'),
        ],
      },
      marisa: {
        before: [
          line('marisa', '这就是让书脊全空白的书库？藏书真不少。'),
          line('marisa', '这味道，全是从没被翻开过的纸。'),
          line('boss', '请先登记。这里不接受抄本之外的物品带出。'),
          line('marisa', '抄本能带走？你们的规矩比我想的友善。'),
          line('boss', '但你正在使用的名字，也已登记成旧名。'),
          line('marisa', '有人每天都喊我还书，这名字新鲜得很。'),
          line('boss', '若声音仍在，便与归名册的新例相矛盾。'),
          line('marisa', '很好，我们一起把有问题的那页翻掉。'),
          line('boss', '请先证明你可以翻页，而不是把整本拿走。'),
        ],
        after: [
          line('boss', '你的名字不应封藏。主人也需要知道这件事。'),
          line('marisa', '这本空白册子，我也需要知道怎么做出来的。'),
          line('boss', '获准后会给你一份抄本。原件必须留在这里。'),
          line('marisa', '成交。赶紧让你主人来盖个印吧。'),
        ],
      },
    },
  },
  {
    id: 6, title: '第六面　把最后一声唤回人间', subtitle: 'The Name That Answers Last',
    location: '归名册尽头·无名之庭', bossId: 'kotone',
    colors: ['#7BAA9B', '#E7E0C1', '#D6B668'], background: 'stage06',
    bgmStage: 'stage06', bgmBoss: 'boss06', roadFrames: 3900, midbossAt: 1680,
    nonspellNames: ['最初的呼唤', '薄荷色的声纹', '无声的答复', '最后一页之前'],
    phaseLayout: 'NSNSNSNSS',
    midbossSpells: [
      spell('s06-mid', '名札「请在空白处写上名字」', 'name', 'name_writing', '白札飞到空中写出一笔笔字划，停顿后按字形滴落成幕；带缺口的金铃环定时扩散。', 35),
    ],
    spells: [
      spell('s06-01', '名符「无人再唤的白纸神」', 'name', 'name_white', '三张纸神绕 Boss 旋转，各自放出缺口朝向自机、左右交替弯曲的白札环；金星束定时瞄准自机。', 45),
      spell('s06-02', '铃名「千户应答的金色声纹」', 'name', 'name_bells', '每一拍 Boss 放出带缺口的金色声环，半拍后两岸的人家自上而下依次瞄准自机应答。', 50),
      spell('s06-03', '归名「生者与旧称的错列」', 'name', 'name_sort', '暖色今名向一侧、冷色旧名向另一侧斜落，越过墙壁后从对侧回来，交织成移动的菱形格；每隔数秒两者交换方向。', 55),
      spell('s06-04', '神名「连忘却也不许抵达的庭」', 'name', 'name_garden', '下方六座庭门中只开一座，两道预告光线标出门柱，其余方向被白札填满；开放的门依次移向相邻的门。', 60),
      spell('s06-05', '「写回幻想乡的每一个名字」', 'name', 'name_return', '金色名字之花持续绽放；每十秒依次回响灯门、雨信、回航渡船、交错珠链、空白书页与铃声六段旅程。', 65),
    ],
    dialogues: {
      reimu: {
        before: [
          line('reimu', '无名之庭……连花草的名字也没有了。'),
          line('reimu', '风里也没有人在叫谁。'),
          line('boss', '欢迎。归名册里还有地方，你的名字不会再次消失。'),
          line('reimu', '就是你，把还在用的名字都搬进来了？'),
          line('boss', '大家都说不想被忘记。我只是替他们保管。'),
          line('reimu', '保管以后，外面的人反而叫不出名字了。'),
          line('boss', '关系没有变。家人还是家人，归处也还是归处。'),
          line('reimu', '所以我才一路找得到这里。但谁让你替他们决定的？'),
          line('boss', '没有人曾反对一个名字被记住。'),
          line('reimu', '记住和拿走是两回事。你先把我的名字还来。'),
          line('boss', '那请告诉我，该如何让无人呼唤的名字也留下？'),
          line('reimu', '先留下你自己的。你叫什么？'),
          line('boss', '白识言音。……这个声音，已经很久没有听到了。'),
          line('reimu', '言音，按幻想乡的规矩。输了就把名字全部归还！'),
        ],
        after: [
          line('boss', '原来，名字要有人在外面叫它，才算被记住。'),
          line('reimu', '活人的名字放回去。旧名留个抄本就足够了。'),
          line('boss', '那我的名字，也可以放回去吗？'),
          line('reimu', '可以。你要是再闯祸，我还会来叫的。'),
          line('boss', '听起来，倒是很不会被忘记的办法。'),
          line('reimu', '还有神社的名字，优先还回来。'),
        ],
      },
      marisa: {
        before: [
          line('marisa', '这就是归名册的原件？竟然连封皮也没标题。'),
          line('marisa', '封皮上的空白，也太整齐了点。'),
          line('boss', '有名字的书，会先被自己的名字占去一页。'),
          line('marisa', '为了省一页，倒让全乡的书都没了标题。'),
          line('boss', '无人再叫的名字，总得有一个不会褪色的地方。'),
          line('marisa', '这我懂。可我还在叫的名字，也被你拿走了。'),
          line('boss', '若今天忘不掉，就能替明天省下一个遗憾。'),
          line('marisa', '那明天要找这本书的人，今天就先有遗憾了。'),
          line('boss', '你认为册子应当只收旧名？'),
          line('marisa', '还得能借抄本。让人读到，比锁在这里有用。'),
          line('boss', '白识言音。先记下我的名字，再谈你的条件吧。'),
          line('marisa', '雾雨魔理沙。要不要用符卡把名字写大一点？'),
          line('boss', '那就让每一个名字，都有一次清楚的应答！'),
        ],
        after: [
          line('boss', '今名归还，旧名留存。房枝会重新整理每一页。'),
          line('marisa', '我的抄本呢？'),
          line('boss', '可以借你一份。请在别人还记得书名时归还。'),
          line('marisa', '条件够严格的。那我先给它取个名字。'),
          line('boss', '叫作“借阅中的归名册”，如何？'),
          line('marisa', '一听就是不能装作忘记的名字啊。'),
        ],
      },
    },
  },
  {
    id: 7, extra: true, title: 'Extra　旧名仍然在回响', subtitle: 'The Echo After the Bell',
    location: '归名书库背面·倒铃回廊', bossId: 'mio',
    colors: ['#1E2E56', '#B3BED0', '#BA4B60'], background: 'stage07',
    bgmStage: 'extra', bgmBoss: 'bossExtra', roadFrames: 5100, midbossAt: 2280,
    nonspellNames: ['说到一半的声音', '两声之间', '旧名轻叩', '墙上的回响', '半句玩笑', '回廊的重叠', '重播的声线', '听不到的名字'],
    phaseLayout: 'NSNSNSNSNSNSNSNSSS',
    midbossSpells: [
      spell('ex-mid-01', '抄札「只准借阅的旧名目录」', 'archive', 'archive_copy', '纸札成列落下，行至半途相邻两列交换车道；红札束定时瞄准自机。', 45),
      spell('ex-mid-02', '封印「回声不可携出之页」', 'archive', 'archive_echo_seal', '方形书页展开后被拉回封印，穿过中心再向另一侧展开；朱印成扇形盖向自机。', 50),
      spell('ex-mid-03', '订正「原件归还，抄本留存」', 'archive', 'archive_errata', '红色原件环飞出后折返书库，每张原件在折返处留下一张白色抄本，停留后缓缓落下。', 55),
    ],
    spells: [
      spell('ex-01', '回声「迟到半拍的自我介绍」', 'echo', 'echo_introduction', '每一拍放出声环，半拍后从镜像位置响起错开半格的回声环；瞄准自机的自我介绍也会在原处再说一遍。', 45),
      spell('ex-02', '倒铃「从铃口归来的声音」', 'echo', 'echo_inverse', '鳞弹铃环飞出、停下、折返穿过中心，再次停下后斜向散开，与新铃环层层交错。', 50),
      spell('ex-03', '回廊「只在静默处通行的长廊」', 'echo', 'echo_corridor', '成串的声点沿长廊来回穿行，相邻两条回廊方向相反、略微倾斜并相互交织；每条回廊都留有一处静默，各条的静默依次错开。瞄准自机的扇面会在镜像位置再响一次。', 50),
      spell('ex-04', '余响「远处才响起的钟」', 'echo', 'echo_bell', '缓慢下沉的大钟一路敲响，每一声都放出缺口朝向自机的声环，半拍后再落下一圈没有缺口的余响。', 50),
      spell('ex-05', '回环「绕回原处的呼唤」', 'echo', 'echo_loop', '声环离开 Boss 时卷成紧密的螺旋；半拍后的回声环向相反方向卷曲，穿过前一环的缝隙。', 55),
      spell('ex-06', '镜声「与你相反的回响」', 'echo', 'echo_mirror', 'Boss 总是移到与自机相反的一侧，倾泻左右摇摆的针雨；瞄准自机的扇面同时从 Boss 与它的镜像位置射来。', 55),
      spell('ex-07', '封名「旧册背面的白纸花」', 'echo', 'echo_archive', '五瓣纸花向外扩散后整朵向反方向折回，红白两色交替；针弹束定时瞄准自机。', 55),
      spell('ex-08', '耐响「最后一次呼唤的六十余息」', 'echo', 'echo_survival', '耐久符卡。长廊、远钟、回环、镜声、墙上的回响与重播的声线六段回声依次响起，每段十秒、中间留一口气；需要生存至时限结束，不因自机射击提前结束。', 65, true),
      spell('ex-09', '言灵「没有说出口的第一个名字」', 'echo', 'echo_first', '两个声点绕 Boss 互相追逐，轮流放出缺口朝向自机的声环；中央的星弹螺旋不断写下名字。', 60),
      spell('ex-10', '「愿旧名也有人轻轻应答」', 'echo', 'echo_answer', '六种旅途的形状与它们的回声依次出现；回声起初与原形相差半圈，随时间逐渐转向同一方向，直到完全应答。', 65),
    ],
    dialogues: {
      reimu: {
        before: [
          line('reimu', '铃声明明已经停了，怎么还在响？'),
          line('reimu', '……不是铃。是有人在喊名字。'),
          line('boss', '……会来叫的。你果然又来啦。'),
          line('reimu', '我说的不是你。铃都停了，哪来的回声？'),
          line('boss', '每个旧名字都留下了最后一声。我替它们接下去。'),
          line('reimu', '接得太长，村里喊谁都会听见第二个回答。'),
          line('boss', '不是第二个，是曾经那个。我也有新的名字了。'),
          line('reimu', '那就用新的名字自己说话。'),
          line('boss', '玉继未央。可一开口，大家总想起别的人。'),
          line('reimu', '妖怪想被人记住，方法多得很。'),
          line('boss', '你认识的方法，莫非只有符卡？'),
          line('reimu', '对你正好。别再拿村民的声音当你的招牌。'),
          line('boss', '好，那听清这一次！这是我自己的应答。'),
        ],
        after: [
          line('boss', '这次你听见的是谁？'),
          line('reimu', '玉继未央。笑得太大声的那个。'),
          line('boss', '只剩我一个，回廊倒有些空呢。'),
          line('reimu', '想热闹就来神社。别把别人的话重复收费。'),
          line('boss', '神社，神社。第二声免费。'),
          line('reimu', '免费也给我停下！'),
        ],
      },
      marisa: {
        before: [
          line('marisa', '书页自己在翻，是回声在读它们？'),
          line('marisa', '三天前的话，怎么又响起来了。'),
          line('boss', '……取个名字。你那本书取好了吗？'),
          line('marisa', '连三天前的话也能听见。你是书库的回音？'),
          line('boss', '是所有旧名字的回音。现在也算我自己的声音。'),
          line('marisa', '好，那我取个样，看看声音怎么留下。'),
          line('boss', '借我、学走、带回去。你说的总是这几个词。'),
          line('marisa', '以前的声音重复太多，可就不算自己的了。'),
          line('boss', '玉继未央。这个名字还没有旧声音，你要不要先听？'),
          line('marisa', '只听可不够。要听能把铃都震响的。'),
          line('boss', '那就不会只是取一个小样了哦。'),
          line('marisa', '正好，我也带着够亮的回答。'),
          line('boss', '将最后一声留给我！'),
        ],
        after: [
          line('marisa', '这段我记下了。玉继未央的第一次大失败。'),
          line('boss', '大失败也算自己的声音吗？'),
          line('marisa', '当然。没人会认错，够响亮。'),
          line('boss', '那下次我要让整片林子都听见。'),
          line('marisa', '下次先到我家敲门，别把书名再喊空了。'),
          line('boss', '……敲门，敲门。两次也是我的习惯。'),
        ],
      },
    },
  },
];

let mainCode = 0;
for (const stage of STAGES) {
  for (const [spellIndex, card] of stage.spells.entries())
    Object.assign(card, { code: stage.extra ? 22 + spellIndex : ++mainCode, stageId: stage.id, spellIndex, midboss: false });
  for (const [spellIndex, card] of stage.midbossSpells.entries())
    Object.assign(card, { code: MIDBOSS_CODES[stage.id] + spellIndex, stageId: stage.id, spellIndex, midboss: true });
}

/** Every midboss card, including Extra's three Fusae cards. */
export const MIDBOSS_SPELLS = STAGES.flatMap((stage) => stage.midbossSpells);
export const EXTRA_MIDBOSS_SPELLS = STAGES[6].midbossSpells;

/** Stages 1-6 open with an ordinary attack timed by `seconds`; from stage 2
 * that attack hands over to one midboss card. Extra's midboss is all cards. */
export const MIDBOSSES = STAGES.map((stage) => ({
  stageId: stage.id,
  bossId: stage.extra ? 'fusae' : stage.bossId,
  entrance: 'flyIn',
  title: stage.extra ? '归名书库的更正页' : `途中相遇·${CHARACTERS.find((c) => c.id === stage.bossId).name}`,
  atFrame: stage.midbossAt,
  nonspell: !stage.extra,
  seconds: stage.extra ? 0 : stage.id === 1 ? 30 : 20,
  spells: stage.midbossSpells,
  dialogues: stage.extra ? {
    reimu: [
      line('boss', '这次是旧名自己在响，主人没有再收任何活名。'),
      line('reimu', '知道了。可先别拿纸把路堵住。'),
      line('boss', '这是防止声音逃走的封页。请用符卡打开。'),
    ],
    marisa: [
      line('boss', '抄本准备好了。背面的声音却跑了出来。'),
      line('marisa', '有声音的书更好借。一起带回去不行吗？'),
      line('boss', '不行。请先通过“不可携出”的三页。'),
    ],
  } : null,
}));

export const ENDINGS = {
  reimu: {
    good: [
      '初秋的午后，博丽神社的牌匾又有了名字。',
      '归名册只留下不再被使用的旧名。村里的门牌、信札与书脊，一夜之间恢复如初。',
      '言音第一次以客人的身份来到神社，带着一张写满自己名字的纸。',
      '灵梦让她把纸收起来。别人记不记得，不是靠把名字贴满墙决定的。',
      '房枝随后送来一块小牌，写着“旧名抄本，免费借阅”。',
      '灵梦想了一会儿，把牌挂在香火箱旁。总比把名字收走的生意强。',
      '言音问这里能不能替她再设一个铃。灵梦回答：只要别把别人的名字摇掉。',
      '风吹过神社。新铃响了，香火箱依然没响。',
      '灵梦终于发现，这场异变至少有一样东西从未改变。',
    ],
    bad: [
      '细雨停了，神社的名字却还隔一天才出现一次。',
      '灵梦这一趟有几次没能直接叫醒归名册，只好回来重新理清那些松掉的线。',
      '言音答应慢慢归还活人的名字，房枝则坚持每一页都要核对。',
      '没有字的牌匾暂时挂在原处。常来的人依旧知道这里是博丽神社。',
      '不常来的人走到门前，问这是不是一家新开的无名茶屋。',
      '灵梦收下茶钱以后，决定明天再去书库一趟。',
      '这一次，她要让那本册子一次就听清楚。',
    ],
    extra: [
      '神社多了一位总把招呼说两遍的客人。',
      '未央说第一次是旧声音，第二次才是自己的。灵梦让她先练习只说一次。',
      '言音替她在归名册中空出新的一页。这一页暂时不写，因为名字仍有人在叫。',
      '扉灯祈把神社门口照得太亮，静织送来一封不用找收件人的短笺。',
      '澪舟没有收这次的船费，紫乃给几条松线重新打了结。',
      '大家终于不必互相猜名字了，只是一起喝茶时仍然抢着说话。',
      '未央站到香火箱边，想替每个落入的铜钱接一声回响。',
      '过了很久，她发现这是幻想乡最安静的工作。',
    ],
  },
  marisa: {
    good: [
      '魔法之森的藏书重新长出了标题。魔理沙趁它们清楚时做了一份目录。',
      '归名册的抄本被房枝亲自送到门前，封皮写着“借阅中的归名册”。',
      '魔理沙翻到最后一页，发现借阅者的名字已经端端正正地写好。',
      '言音在页边添了一枚小铃。主人只要叫出书名，铃就会轻轻应答。',
      '原来让书被记住的办法，也可以用来让书被归还。',
      '魔理沙决定先研究铃，研究结束再研究如何延长借期。',
      '她给那瓶不该喝的药水补上大大的红字，然后把灯芯纸屑夹在目录里。',
      '空白不再吞掉名字，却仍给新魔法留着地方。',
      '到了傍晚，小铃响起。她合上书，装作没听见第二声。',
    ],
    bad: [
      '名字归还得有些慢。魔理沙的书架仍有好几排无字的书脊。',
      '房枝说核对之前不能给出抄本，免得旧名和今名再次混页。',
      '魔理沙只好先画出每一本书的位置。第二天看，纸上又多了几处墨迹。',
      '那是旧名字正在自己找回原处。她把这现象写进新的实验笔记。',
      '笔记第一页的标题还没想好，倒省得这一回也被收走。',
      '等雨停得彻底一点，她准备带足符卡，再去向那位神讨一份抄本。',
      '只借到半个办法，不能算一次成功的调查。',
    ],
    extra: [
      '魔理沙为声音专门腾出一只空瓶。未央说瓶口太窄，只肯住在瓶外。',
      '最后留下的只有一次笑声。房枝给瓶子贴了“允许携出”的小札。',
      '言音把旧名抄本改成可以借阅的目录，每个名字旁边都留出新的注释。',
      '未央第一次写自己的注释：不必重复，也能让人听见。',
      '这句话刚说完，她便忍不住又说了一遍。',
      '魔理沙没有指出来。把小铃、灯纸和那瓶笑声排在一起，已经足够忙了。',
      '夜里有人在门外叫她归还书。第一声来自房枝，第二声来自未央。',
      '魔理沙叹了一口气。这回的回声，实在不该带回家。',
    ],
  },
};

export const MUSIC_COMMENTS = {
  title: { title: '东方归名录之名路', comment: '标题画面的曲子。想象一块刚写好却还没挂上的门牌，铃响两次，第二次比第一次轻。异变之前的幻想乡并没有特别安静，只是没人想到要留意称呼。' },
  stage01: { title: '灯笼亮起以前', comment: '第一面的曲子。暖色灯火与夜路的蓝色交替，旋律向上跑，低音却一步一步走。起初只是一次出门，拐过几个灯笼才发现路牌都空了。' },
  boss01: { title: '借路的火，借名的影', comment: '扉灯祈的主题。短小的呼唤反复从不同方向出现，像灯笼围着人转。她没有恶意，所以节奏要亮；她认错了路，所以旋律总会多迈半步。' },
  stage02: { title: '雨滴写给远方的信', comment: '第二面的曲子。纸上的雨点不必沉重，落到竹叶上可以很轻。连续的细音底下放一条清楚的旋律，好像没有署名的信，内容仍能读懂。' },
  boss02: { title: '无人签收的天晴', comment: '雨巻静织的主题。每句旋律都留一个没有唱满的尾音，让雨接完它。中段稍微明亮，因为这位雨女其实很喜欢送信成功的时候。' },
  stage03: { title: '渡口没有写在地图上', comment: '第三面的曲子。航道看似回到原处，其实已经走到另一岸。低音像划桨，旋律像岸边晃过的芦苇；票上没有字，水声倒记得节拍。' },
  boss03: { title: '一文钱也渡不过的彼岸', comment: '渡守澪舟的主题。带一点爽快的讨价还价感，不需要阴森。短句问价，长句讲理，鼓点负责让渡船准时出发。她通常会在最后把船费降下来。' },
  stage04: { title: '蛛丝上的旧日记', comment: '第四面的曲子。织物不是一根线，要让数条旋律在不同时间进入。看起来复杂，听起来仍有清楚的归处；中间偶尔漏掉一拍，像一枚没打紧的结。' },
  boss04: { title: '八只脚书写的昨日', comment: '糸守紫乃的主题。圆滑、轻巧，同时有一点越走越深的感觉。她不愿把话说尽，所以乐句总有另一个声部替她接上，最后才发现两边早已织在一起。' },
  stage05: { title: '翻到无字的那一页', comment: '第五面的曲子。节奏端正到有些顽固，纸页翻动却带来新的色彩。进入后半段时让和声变宽，书库的规模比入口看上去大得多。' },
  boss05: { title: '校勘者与消失的句号', comment: '御影房枝的主题。方正的重音与卷起的音阶相碰，像书页和印章。她不是坏心眼的守门人，只是每一条规矩都记得太认真。改正一条，也会认真执行。' },
  stage06: { title: '万物尚未开口的清晨', comment: '第六面的曲子。道中较短，旋律也像走到最后一页前的深呼吸。薄荷色的声音和金色的铃彼此留白，直到能听见自己的名字。' },
  boss06: { title: '给世界最后一个名字', comment: '白识言音的主题。庄重的开头之后，需要一段足够坦然的旋律。她所做的事来自善意，解决的方法也应当明亮。终段让最初的两声铃得到完整的回答。' },
  extra: { title: '今晚请用旧名字呼唤我', comment: 'Extra 道中的曲子。前六面的零星节奏从背面走回来，却不会原样出现。旧书翻过来还有一面，旧名字也可能藏着新的声音。' },
  bossExtra: { title: '言灵在零点之后复活', comment: '玉继未央的主题。快速而爱玩，旋律总抢着重复自己的最后几个音。并行的正逆动机在末段同向，不是回声终于停止，而是她终于能自己接上下一句。' },
  ending: { title: '名字留在茶杯边', comment: '结局的曲子。名字都回来了，大家还是要过原来的日子。放轻旋律，把几声铃留在窗外；那些日常的小麻烦，便是异变已经结束的证据。' },
  staff: { title: '归名的旅途还没有结束', comment: '制作名单的曲子。让各段归途的感觉汇在一起，保持向前的节拍。一本册子读完了，空白页也不必急着填满。下一次开口，总会有新的名字。' },
  playersScore: { title: "Player's Score", comment: '满身疮痍时的曲子。分数停在那里，名字也没有走远。钢琴放慢脚步，把一路上的灯火、雨信、渡船和铃声各数一遍；钟琴在旁边小声提醒，续关的机会还在，换个方向再找一次也来得及。' },
};

/** Spell practice order: each stage's midboss card, then its Boss cards. */
export const ALL_SPELLS = STAGES.flatMap((stage) => [...stage.midbossSpells, ...stage.spells]);
export const SPELL_BY_ID = new Map(ALL_SPELLS.map((card) => [card.id, card]));
export const SPELL_BY_CODE = new Map(ALL_SPELLS.map((card) => [card.code, card]));
export const CHARACTER_BY_ID = new Map(CHARACTERS.map((character) => [character.id, character]));
