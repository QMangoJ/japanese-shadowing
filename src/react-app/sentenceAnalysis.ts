export type VocabularyInsight = {
	term: string;
	reading?: string;
	meaning: string;
	detail: string;
	aliases?: string[];
};

export type GrammarInsight = {
	point: string;
	explanation: string;
};

export type SentenceInsight = {
	vocabulary: VocabularyInsight[];
	grammar: GrammarInsight[];
};

// This is intentionally a learner-focused glossary rather than a mechanical
// word splitter. It prefers useful words and expressions over particles,
// counters, and speaker names. Add aliases when a word appears conjugated in
// the book text.
const glossary: VocabularyInsight[] = [
	{ term: "はじめまして", meaning: "初次见面", detail: "第一次与对方见面时使用的固定寒暄语。" },
	{ term: "どうぞよろしく", meaning: "请多关照", detail: "自我介绍后常用的礼貌表达；完整说法是「どうぞよろしくお願いします」。" },
	{ term: "今", reading: "いま", meaning: "现在", detail: "说话时所处的时间点。" },
	{ term: "何", reading: "なに／なん", meaning: "什么／哪一个", detail: "读音随接续变化；「何時」中读「なん」。" },
	{ term: "何時", reading: "なんじ", meaning: "几点", detail: "询问钟点时间时使用。" },
	{ term: "時", reading: "じ", meaning: "点（钟点）", detail: "接在数字后表示时间，如「9時」。" },
	{ term: "時半", reading: "じはん", meaning: "……点半", detail: "接在小时后，表示该小时过了三十分钟。" },
	{ term: "昨日", reading: "きのう", meaning: "昨天", detail: "相对日期名词，通常不需要接助词「に」。" },
	{ term: "今日", reading: "きょう", meaning: "今天", detail: "相对日期名词，通常不需要接助词「に」。" },
	{ term: "明日", reading: "あした", meaning: "明天", detail: "相对日期名词，通常不需要接助词「に」。" },
	{ term: "一昨日", reading: "おととい", meaning: "前天", detail: "「昨日」的前一天。" },
	{ term: "曜日", reading: "ようび", meaning: "星期／周几", detail: "与「月・火・水…」组合，如「水曜日」。" },
	{ term: "誕生日", reading: "たんじょうび", meaning: "生日", detail: "「誕生」加「日」，指一个人出生的日期。" },
	{ term: "銀行", reading: "ぎんこう", meaning: "银行", detail: "办理存款、取款等金融业务的场所。" },
	{ term: "午前", reading: "ごぜん", meaning: "上午", detail: "对应 AM；与「午後」相对。" },
	{ term: "午後", reading: "ごご", meaning: "下午", detail: "对应 PM；与「午前」相对。" },
	{ term: "今年", reading: "ことし", meaning: "今年", detail: "「今の年」的常用说法。" },
	{ term: "年", reading: "ねん", meaning: "年", detail: "接在数字后可表示年份或持续年数。" },
	{ term: "月", reading: "がつ", meaning: "月", detail: "接在数字后表示月份；单独读法会因词而变化。" },
	{ term: "日", reading: "にち", meaning: "日／号", detail: "接在数字后表示日期；1日、20日等有特殊读法。" },
	{ term: "ヶ月", reading: "かげつ", meaning: "个月", detail: "表示时长时常接在数字后，如「3ヶ月」。" },
	{ term: "どのくらい", meaning: "多久／多少", detail: "询问时间长度、数量或程度：大约……。" },
	{ term: "寝る", reading: "ねる", meaning: "睡觉", detail: "躺下入睡；过去礼貌形是「寝ました」。", aliases: ["ねました", "寝ま"] },
	{ term: "テスト", meaning: "考试／测验", detail: "来自英语 test；学校语境中指测验。" },
	{ term: "水曜日", reading: "すいようび", meaning: "星期三", detail: "「水」加「曜日」构成星期三。" },
	{ term: "日本", reading: "にほん／にっぽん", meaning: "日本", detail: "两种读法都存在；教材中常按固定词使用。" },
	{ term: "日本語", reading: "にほんご", meaning: "日语", detail: "语言名称；「語」表示语言。" },
	{ term: "英語", reading: "えいご", meaning: "英语", detail: "「英」指英国／英语，「語」表示语言。" },
	{ term: "学校", reading: "がっこう", meaning: "学校", detail: "学习的场所。" },
	{ term: "神社", reading: "じんじゃ", meaning: "神社", detail: "日本神道的祭祀场所；与佛教寺院「お寺」不同。" },
	{ term: "部屋", reading: "へや", meaning: "房间", detail: "住宅、旅馆或建筑物中的一个房间。" },
	{ term: "名前", reading: "なまえ", meaning: "名字", detail: "前面加「お」成为礼貌说法「お名前」。" },
	{ term: "一つ", reading: "ひとつ", meaning: "一个", detail: "日语固有数词，点餐或数普通物品时很常用。" },
	{ term: "駅", reading: "えき", meaning: "车站", detail: "火车、地铁等铁路交通的站点。" },
	{ term: "歩く", reading: "あるく", meaning: "走路", detail: "句中常以「歩いて」表示方式：步行……。", aliases: ["歩い", "歩いて"] },
	{ term: "映画", reading: "えいが", meaning: "电影", detail: "观看的作品或影片。" },
	{ term: "赤い", reading: "あかい", meaning: "红色的", detail: "い形容词；直接放在名词前修饰。" },
	{ term: "難しい", reading: "むずかしい", meaning: "难的", detail: "い形容词，也可形容情况复杂。", aliases: ["むずかしい", "むずかしかっ"] },
	{ term: "簡単", reading: "かんたん", meaning: "简单", detail: "な形容词；说「簡単です」「簡単な問題」。", aliases: ["かんたん", "かんたんでした"] },
	{ term: "楽しい", reading: "たのしい", meaning: "开心／有趣", detail: "い形容词，描述主观感受。", aliases: ["楽しかっ", "たのしかっ"] },
	{ term: "大きい", reading: "おおきい", meaning: "大的", detail: "い形容词，描述大小。", aliases: ["大きい", "おおきい"] },
	{ term: "きれい", meaning: "漂亮／干净", detail: "な形容词；可形容外观美丽或整洁。" },
	{ term: "人", reading: "ひと", meaning: "人", detail: "指人；与数字搭配时读法会变化。" },
	{ term: "天気", reading: "てんき", meaning: "天气", detail: "常与「いい／悪い」搭配。" },
	{ term: "本当に", reading: "ほんとうに", meaning: "真的／非常", detail: "用于加强语气，也可单独回应对方。" },
	{ term: "漢字", reading: "かんじ", meaning: "汉字", detail: "日语书写系统中的表意文字。" },
	{ term: "勉強", reading: "べんきょう", meaning: "学习", detail: "与「する」搭配成动词「勉強する」。" },
	{ term: "週末", reading: "しゅうまつ", meaning: "周末", detail: "一周的末尾，通常指周六、周日。" },
	{ term: "親切", reading: "しんせつ", meaning: "亲切／热心", detail: "な形容词，修饰名词时说「親切な人」。" },
	{ term: "自転車", reading: "じてんしゃ", meaning: "自行车", detail: "日常交通工具。" },
	{ term: "病院", reading: "びょういん", meaning: "医院", detail: "看病、治疗的医疗机构。" },
	{ term: "切符", reading: "きっぷ", meaning: "车票／票券", detail: "搭乘交通工具或入场所需的票。" },
	{ term: "お返し", reading: "おかえし", meaning: "返还／找零", detail: "「返す」的名词形式；店员语境中常指找零。" },
	{ term: "お好み焼き", reading: "おこのみやき", meaning: "大阪烧", detail: "把面糊、卷心菜等在铁板上煎制的日本料理。" },
	{ term: "試合", reading: "しあい", meaning: "比赛", detail: "体育或竞技比赛。" },
	{ term: "最高", reading: "さいこう", meaning: "最棒／最好", detail: "表示程度达到最高，也常作口语感叹。" },
	{ term: "選手", reading: "せんしゅ", meaning: "选手", detail: "参加比赛的人。" },
	{ term: "申請", reading: "しんせい", meaning: "申请", detail: "向机构正式提出请求，如护照申请。" },
	{ term: "用紙", reading: "ようし", meaning: "表格用纸", detail: "填写申请、登记等专用纸张。" },
	{ term: "記入", reading: "きにゅう", meaning: "填写", detail: "在表格、文件上写入所需信息。" },
	{ term: "郵便局", reading: "ゆうびんきょく", meaning: "邮局", detail: "寄信、寄包裹及部分金融服务的机构。" },
	{ term: "今週中", reading: "こんしゅうちゅう", meaning: "本周内", detail: "「中」表示限定在某个时间范围之内。" },
	{ term: "最近", reading: "さいきん", meaning: "最近", detail: "指离现在不久的一段时间。" },
	{ term: "寒くなる", reading: "さむくなる", meaning: "变冷", detail: "い形容词词干加「くなる」表示状态变化。" },
	{ term: "流行る", reading: "はやる", meaning: "流行／盛行", detail: "疾病、事物或风潮广泛出现。", aliases: ["流行っ", "流行って"] },
	{ term: "気をつける", reading: "きをつける", meaning: "注意／当心", detail: "固定搭配；对健康、安全等保持警惕。" },
	{ term: "新しい", reading: "あたらしい", meaning: "新的", detail: "い形容词，修饰名词或作谓语。" },
	{ term: "仕事", reading: "しごと", meaning: "工作", detail: "职业、任务或要做的事。" },
	{ term: "慣れる", reading: "なれる", meaning: "习惯／适应", detail: "对象常用助词「に」标记，如「新しい仕事に慣れる」。", aliases: ["なれた", "なれません", "慣れ"] },
	{ term: "朝", reading: "あさ", meaning: "早晨", detail: "一天开始的时段。" },
	{ term: "申し上げる", reading: "もうしあげる", meaning: "说／表达（自谦）", detail: "「言う」的郑重自谦语；「と申します」也用于自我介绍。", aliases: ["申し", "申します"] },
	{ term: "お世話になる", reading: "おせわになる", meaning: "承蒙关照", detail: "表达受到对方照顾、帮助的礼貌说法。" },
	{ term: "予定", reading: "よてい", meaning: "计划／安排", detail: "预先定好的日程或打算。" },
	{ term: "特に", reading: "とくに", meaning: "特别／尤其", detail: "常与否定搭配，如「特にない」。" },
	{ term: "久しぶり", reading: "ひさしぶり", meaning: "好久不见／久违", detail: "隔了较长时间后再次见面或做某事。" },
	{ term: "台風", reading: "たいふう", meaning: "台风", detail: "热带低气压带来的强风暴雨天气。" },
	{ term: "出張", reading: "しゅっちょう", meaning: "出差", detail: "因工作暂时前往外地。" },
	{ term: "飛行機", reading: "ひこうき", meaning: "飞机", detail: "航空交通工具。" },
	{ term: "欠航", reading: "けっこう", meaning: "停飞／航班取消", detail: "航班、轮船等因天气等原因取消。" },
	{ term: "旅行", reading: "りょこう", meaning: "旅行", detail: "离开日常地点前往其他地方游览或办事。" },
	{ term: "おすすめ", meaning: "推荐／推荐的选择", detail: "名词或サ变动词；店员常问「おすすめは何ですか」。" },
	{ term: "花束", reading: "はなたば", meaning: "花束", detail: "把多枝花扎成的一束，常作为礼物。" },
	{ term: "予算", reading: "よさん", meaning: "预算", detail: "为购买或活动预先计划的金额。" },
	{ term: "内定", reading: "ないてい", meaning: "内定／录用通知", detail: "正式入职前由公司给出的录用决定。" },
	{ term: "条件", reading: "じょうけん", meaning: "条件", detail: "工作、约定或判断成立所需的要求。" },
	{ term: "会社", reading: "かいしゃ", meaning: "公司", detail: "商业组织；自己的公司在正式场合常说「弊社」。" },
	{ term: "注文", reading: "ちゅうもん", meaning: "点单／订购", detail: "在餐厅或商店提出想要的商品、料理。" },
	{ term: "定食", reading: "ていしょく", meaning: "套餐", detail: "主菜配米饭、汤、小菜等的一套餐点。" },
	{ term: "大盛り", reading: "おおもり", meaning: "大份／加大份量", detail: "餐厅中指增加饭、面等的分量。" },
	{ term: "美術展", reading: "びじゅつてん", meaning: "美术展", detail: "展出绘画、雕塑等作品的活动。" },
	{ term: "会場", reading: "かいじょう", meaning: "会场", detail: "活动、演出、展览举办的地点。" },
	{ term: "作品", reading: "さくひん", meaning: "作品", detail: "艺术、文学或创作完成的成果。" },
	{ term: "希望", reading: "きぼう", meaning: "希望", detail: "期待实现的愿望，也可指希望的选项。" },
	{ term: "洗濯物", reading: "せんたくもの", meaning: "洗好的衣物", detail: "需要晾晒或收起的衣物。" },
	{ term: "掃除", reading: "そうじ", meaning: "打扫", detail: "清理房间、地板等；与「する」搭配。" },
	{ term: "迷惑", reading: "めいわく", meaning: "麻烦／困扰", detail: "「迷惑をかける」表示给别人添麻烦。" },
	{ term: "申し訳ない", reading: "もうしわけない", meaning: "非常抱歉", detail: "比「すみません」更郑重的道歉。" },
	{ term: "甘いもの", reading: "あまいもの", meaning: "甜食", detail: "「〜に目がない」表示对某物特别喜欢、难以抗拒。" },
	{ term: "会社帰り", reading: "かいしゃがえり", meaning: "下班回家途中", detail: "「帰り」接在地点或活动后，表示返回途中。" },
	{ term: "寄る", reading: "よる", meaning: "顺路去／顺便停留", detail: "常用「〜に寄る」表示顺道去某地。", aliases: ["寄ると", "寄っ"] },
	{ term: "無名", reading: "むめい", meaning: "无名／不知名", detail: "尚未广为人知。" },
	{ term: "新人", reading: "しんじん", meaning: "新人", detail: "刚进入某领域、组织的人。" },
	{ term: "優勝", reading: "ゆうしょう", meaning: "夺冠", detail: "比赛中获得第一名。" },
	{ term: "一発屋", reading: "いっぱつや", meaning: "昙花一现的艺人", detail: "靠一次走红却难以持续活跃的人，略带评价色彩。" },
	{ term: "野菜", reading: "やさい", meaning: "蔬菜", detail: "日常食材类别。" },
	{ term: "異常", reading: "いじょう", meaning: "异常", detail: "与正常状态不同。" },
	{ term: "手が出ない", reading: "てがでない", meaning: "买不起／无力尝试", detail: "这里指价格太高，难以下手购买。" },
	{ term: "この間", reading: "このあいだ", meaning: "前些天／最近一次", detail: "离现在不远的过去某个时候。" },
	{ term: "手に入れる", reading: "てにいれる", meaning: "得到／弄到手", detail: "通过购买、抽选等获得想要的东西。" },
	{ term: "地震", reading: "じしん", meaning: "地震", detail: "地面突然震动的自然现象。" },
	{ term: "心配", reading: "しんぱい", meaning: "担心", detail: "对未来或某事感到不安。" },
	{ term: "防災", reading: "ぼうさい", meaning: "防灾", detail: "为预防和减轻灾害影响所做的准备。" },
	{ term: "人材紹介", reading: "じんざいしょうかい", meaning: "人才介绍／招聘中介", detail: "为求职者与企业牵线的服务。" },
	{ term: "ご存知", reading: "ごぞんじ", meaning: "您知道（敬语）", detail: "「知っている」的尊敬说法；对对方使用。" },
	{ term: "就職", reading: "しゅうしょく", meaning: "就业", detail: "找到工作、进入公司任职。" },
	{ term: "目標", reading: "もくひょう", meaning: "目标", detail: "希望达成的具体方向或结果。" },
	{ term: "英会話", reading: "えいかいわ", meaning: "英语会话", detail: "用英语进行口头交流的能力或课程。" },
	{ term: "継続", reading: "けいぞく", meaning: "坚持／持续", detail: "不中断地继续做某事。" },
	{ term: "実現", reading: "じつげん", meaning: "实现", detail: "使目标、愿望成为现实。" },
	{ term: "旅館", reading: "りょかん", meaning: "日式旅馆", detail: "传统日本住宿设施，常提供餐食。" },
	{ term: "機会", reading: "きかい", meaning: "机会", detail: "适合做某事的时机或可能。" },
	{ term: "一石二鳥", reading: "いっせきにちょう", meaning: "一举两得", detail: "直译为一块石头打到两只鸟；表示一次行动有两个好处。" },
	{ term: "置き忘れる", reading: "おきわすれる", meaning: "忘在某处", detail: "把东西放下后忘记带走。" },
	{ term: "届く", reading: "とどく", meaning: "送到／到达", detail: "物品、信件等抵达目的地。", aliases: ["届い", "届いて"] },
	{ term: "構成", reading: "こうせい", meaning: "结构／构成", detail: "文章、报告等各部分如何组织。" },
	{ term: "文字数", reading: "もじすう", meaning: "字数", detail: "文字的数量。" },
	{ term: "合格", reading: "ごうかく", meaning: "合格", detail: "考试、审核等达到通过标准。" },
	{ term: "両親", reading: "りょうしん", meaning: "父母", detail: "父亲和母亲。" },
	{ term: "報告", reading: "ほうこく", meaning: "报告／告知", detail: "把结果、情况正式告诉别人。" },
	{ term: "卒業見込み", reading: "そつぎょうみこみ", meaning: "预计毕业", detail: "尚未毕业，但预计能在规定时间完成学业。" },
	{ term: "証明書", reading: "しょうめいしょ", meaning: "证明书", detail: "用来证明某项事实的正式文件。" },
	{ term: "必要事項", reading: "ひつようじこう", meaning: "必要事项", detail: "表格中必须填写的信息。" },
	{ term: "早めに", reading: "はやめに", meaning: "尽早／早点", detail: "比通常时间更早地做某事。" },
	{ term: "小学生", reading: "しょうがくせい", meaning: "小学生", detail: "就读小学的学生。" },
	{ term: "意見", reading: "いけん", meaning: "意见／看法", detail: "对某事的判断或主张。" },
	{ term: "保護者", reading: "ほごしゃ", meaning: "监护人", detail: "对儿童负责、照顾其生活的人。" },
	{ term: "連絡を取る", reading: "れんらくをとる", meaning: "取得联系", detail: "通过电话、消息等与对方沟通。" },
	{ term: "状況", reading: "じょうきょう", meaning: "状况／情形", detail: "事情所处的状态。" },
	{ term: "可能性", reading: "かのうせい", meaning: "可能性", detail: "某事可能发生的程度。" },
	{ term: "問題点", reading: "もんだいてん", meaning: "问题点", detail: "需要解决或注意的地方。" },
	{ term: "十分", reading: "じゅうぶん", meaning: "充分／足够", detail: "程度达到所需标准。" },
	{ term: "面接", reading: "めんせつ", meaning: "面试", detail: "为了解应聘者而进行的正式会谈。" },
	{ term: "動機", reading: "どうき", meaning: "动机", detail: "促使一个人行动的原因。" },
	{ term: "憧れ", reading: "あこがれ", meaning: "向往／憧憬", detail: "对理想人、生活等抱有强烈向往。" },
	{ term: "現実", reading: "げんじつ", meaning: "现实", detail: "实际存在的状况。" },
	{ term: "将来", reading: "しょうらい", meaning: "将来", detail: "从现在往后的时间。" },
	{ term: "環境", reading: "かんきょう", meaning: "环境", detail: "围绕人或事物的自然、社会条件。" },
	{ term: "行く", reading: "いく", meaning: "去", detail: "向目的地移动；常接地点助词「に／へ」。", aliases: ["行き", "行か", "行け", "行っ", "行った"] },
	{ term: "来る", reading: "くる", meaning: "来", detail: "向说话人所在或基准地点移动。", aliases: ["来て", "来る", "来た", "来そう"] },
	{ term: "帰る", reading: "かえる", meaning: "回去／回家", detail: "回到原来的地点。", aliases: ["帰っ", "帰り"] },
	{ term: "会う", reading: "あう", meaning: "见面", detail: "与人相见；对象通常用助词「に」。", aliases: ["合っ", "会っ"] },
	{ term: "見る", reading: "みる", meaning: "看", detail: "观看、查看。", aliases: ["見", "見て", "見た", "見え"] },
	{ term: "食べる", reading: "たべる", meaning: "吃", detail: "进食；对象通常用助词「を」。", aliases: ["食べ", "食べて"] },
	{ term: "飲む", reading: "のむ", meaning: "喝", detail: "饮用液体；对象通常用助词「を」。", aliases: ["飲み", "飲ん"] },
	{ term: "買う", reading: "かう", meaning: "买", detail: "用钱取得商品。", aliases: ["買っ", "買い"] },
	{ term: "使う", reading: "つかう", meaning: "使用", detail: "把物品、工具用于某种目的。", aliases: ["使い", "使える", "使っ"] },
	{ term: "思う", reading: "おもう", meaning: "想／认为", detail: "表达自己的判断或想法。", aliases: ["思っ", "思い", "思うと"] },
	{ term: "知る", reading: "しる", meaning: "知道", detail: "获得信息或知识；「知っている」表示已知状态。", aliases: ["知っ", "存知"] },
	{ term: "書く", reading: "かく", meaning: "写", detail: "书写文字、文章或文件。", aliases: ["書い", "書く"] },
	{ term: "聞く", reading: "きく", meaning: "听／询问", detail: "既可表示听声音，也可表示向人询问。", aliases: ["聞い", "聞く"] },
	{ term: "待つ", reading: "まつ", meaning: "等", detail: "等待人、物或时间。", aliases: ["待っ", "待ち"] },
	{ term: "持つ", reading: "もつ", meaning: "拿着／拥有", detail: "持有物品，也可指具备能力、特征。", aliases: ["持っ", "持たせ"] },
	{ term: "忘れる", reading: "わすれる", meaning: "忘记", detail: "没有记住，或忘记带某物。", aliases: ["忘れ"] },
	{ term: "調べる", reading: "しらべる", meaning: "查找／调查", detail: "为确认信息而查询、检查。", aliases: ["調べ"] },
	{ term: "頑張る", reading: "がんばる", meaning: "努力／加油", detail: "为目标坚持努力。", aliases: ["頑張っ", "頑張り"] },
];

type GrammarRule = { point: string; explanation: string; matches: (text: string) => boolean };

const grammarRules: GrammarRule[] = [
	{ point: "〜なければならない／〜なくちゃ", explanation: "表示必须做某事；「〜なくちゃ」是口语中省略后的说法。", matches: (text) => /なければならない|なくちゃ|なきゃ/.test(text) },
	{ point: "〜たほうがいい", explanation: "用于给建议，意思是“最好……”。", matches: (text) => /たほうがいい/.test(text) },
	{ point: "〜てしまう／〜ちゃう", explanation: "表示动作完成，也常带有意外、遗憾的语气；「〜ちゃう」是口语缩略。", matches: (text) => /てしま|ちゃう|じゃう/.test(text) },
	{ point: "〜ておく", explanation: "表示预先为将来做准备：先把……做好。", matches: (text) => /ておく|ておき/.test(text) },
	{ point: "〜てみる", explanation: "表示尝试做某事：试着……看看。", matches: (text) => /てみる|てみて/.test(text) },
	{ point: "〜てもらう／〜てくれる", explanation: "表示接受或得到他人为自己做某事的帮助。", matches: (text) => /てもら|てくれ/.test(text) },
	{ point: "〜ようと思う", explanation: "表示说话人目前的打算：想要……。", matches: (text) => /ようと思/.test(text) },
	{ point: "〜ことができる", explanation: "表示能力或可能：能够……。", matches: (text) => /ことができ/.test(text) },
	{ point: "〜ことにする", explanation: "表示说话人作出决定：决定……。", matches: (text) => /ことにし/.test(text) },
	{ point: "〜ことになる", explanation: "表示外部决定、规则或自然结果：变成／决定……。", matches: (text) => /ことにな/.test(text) },
	{ point: "〜ように", explanation: "常表示目的、结果或方式；根据前后文理解为“为了能……”或“像……那样”。", matches: (text) => /ように/.test(text) },
	{ point: "〜らしい", explanation: "表示传闻或根据线索作出的推测：听说／好像……。", matches: (text) => /らしい/.test(text) },
	{ point: "〜そう", explanation: "表示样态或传闻；这里结合前文理解为“看起来／听说……”。", matches: (text) => /そう/.test(text) },
	{ point: "〜かもしれない", explanation: "表示不确定的可能性：也许……。", matches: (text) => /かもしれ/.test(text) },
	{ point: "〜たり〜たりする", explanation: "列举代表性的动作或状态：时而……时而……。", matches: (text) => /たり.*たり/.test(text) },
	{ point: "〜ても", explanation: "表示让步：即使……也……。", matches: (text) => /ても/.test(text) },
	{ point: "〜ので", explanation: "表示原因，语气通常比「から」更柔和：因为……所以……。", matches: (text) => /ので/.test(text) },
	{ point: "〜から", explanation: "可表示原因“因为……”，也可表示起点“从……开始”；需按句意判断。", matches: (text) => /から/.test(text) },
	{ point: "〜けど", explanation: "连接前后内容，表示转折、铺垫或语气缓和：不过／但是……。", matches: (text) => /けど/.test(text) },
	{ point: "〜んです", explanation: "用于补充说明理由、背景或强调解释；口语中很常见。", matches: (text) => /んです|のです/.test(text) },
	{ point: "〜てください", explanation: "礼貌地请求对方做某事：请……。", matches: (text) => /てください/.test(text) },
	{ point: "〜たい", explanation: "接在动词词干后表示愿望：想要……。", matches: (text) => /(?:たい|たく)/.test(text) },
	{ point: "〜ている", explanation: "可表示正在进行、习惯动作或状态持续；结合语境理解。", matches: (text) => /ている|ていま|てる/.test(text) },
	{ point: "〜ですか", explanation: "礼貌疑问句；句末「か」把陈述变成问题。", matches: (text) => /ですか[？?]?/.test(text) },
	{ point: "时间＋に", explanation: "「に」标记动作发生的具体时间，如「9時に」。", matches: (text) => /(?:時|日|曜日|月|年)に/.test(text) },
	{ point: "〜から〜まで", explanation: "表示时间或地点的起点与终点：从……到……。", matches: (text) => /から.*まで/.test(text) },
];

function firstMatch(text: string, words: string[]) {
	return words.reduce<{ position: number; length: number } | null>((match, word) => {
		const position = text.indexOf(word);
		if (position < 0) return match;
		if (!match || position < match.position || (position === match.position && word.length > match.length)) return { position, length: word.length };
		return match;
	}, null);
}

/** Returns a compact, sentence-level explanation for beginner Sections 3+. */
export function getSentenceInsight(section: number, text: string): SentenceInsight | null {
	if (section < 3) return null;
	const plain = text
		.replace(/\{\{(.+?)\|.*?\}\}/g, "$1")
		.replace(/^\s*[AB]\s*[：:]\s*/gm, "")
		.replace(/\s+/g, "");
	const candidates = glossary
		.map((entry) => ({ entry, match: firstMatch(plain, [entry.term, ...(entry.aliases ?? [])]) }))
		.filter((candidate): candidate is { entry: VocabularyInsight; match: { position: number; length: number } } => candidate.match !== null)
		.sort((a, b) => a.match.position - b.match.position || b.match.length - a.match.length);
	const occupied: Array<{ start: number; end: number }> = [];
	const vocabulary = candidates.filter(({ match }) => {
		const overlaps = occupied.some((range) => match.position < range.end && match.position + match.length > range.start);
		if (!overlaps) occupied.push({ start: match.position, end: match.position + match.length });
		return !overlaps;
	}).slice(0, 6).map(({ entry }) => entry);
	const grammar = grammarRules.filter((rule) => rule.matches(plain)).slice(0, 3).map(({ point, explanation }) => ({ point, explanation }));
	return { vocabulary, grammar };
}
