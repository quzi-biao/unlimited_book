/** 可离线验收的原创入门内容；明确标注为示例，不冒充完整教材图谱。 */
export const starterTrees = [
  { id:'starter-primary-2',title:'小学二年级 · 身边的发现',grade:'小学二年级',curriculum:'原创入门示例，非完整教材范围',nodes:[
    {id:'water',title:'一滴水的旅行',domain:'自然科学',parent:null,kind:'water',text:'水可以以液态水、冰和水蒸气的形态存在。阳光让地表的一部分水蒸发成水蒸气；水蒸气遇冷凝结，形成小水滴或冰晶，许多小水滴与冰晶组成云。它们长大后可能形成降雨或降雪，水又回到地表。这个循环不是一条固定的路线。',anchors:['云里有什么','水为什么会结冰']},
    {id:'cloud',title:'云里有什么',domain:'自然科学',parent:'water',kind:'water',text:'云不是一团看得见的水蒸气。水蒸气通常看不见；我们看见的云由悬浮在空气里的小水滴或冰晶组成。小水滴非常小，空气中的上升运动能帮助它们悬浮。它们碰撞、合并或长大后，在合适条件下形成降水。',anchors:['雨滴从哪里来','为什么会有雾']},
    {id:'ice',title:'水为什么会结冰',domain:'自然科学',parent:'water',kind:'water',text:'在通常的大气压下，纯水冷却到约零摄氏度时可以开始结冰。水分子并没有停止运动，而是排成比较有序的结构。冰的密度通常比液态水小，因此冰块能够浮在水面。含盐量、压力等条件都会影响结冰温度。',anchors:['冰为什么浮在水面','盐水容易结冰吗']},
    {id:'plants',title:'种子醒来了',domain:'生命科学',parent:null,kind:'plant',text:'许多种子在有适量水、氧气和合适温度时开始萌发。萌发初期，幼苗利用种子里储存的养分；长出绿色叶片后，植物可以利用光能制造有机物。不同植物需要的条件并不完全一样，有些种子还需要额外的环境信号。',anchors:['根在忙什么','叶子怎样利用阳光']},
    {id:'roots',title:'根在忙什么',domain:'生命科学',parent:'plants',kind:'plant',text:'植物的根帮助固定身体，并从土壤中吸收水和无机盐。根尖附近的根毛增加了吸收的表面积。根也需要呼吸；土壤长期积水可能使根缺少氧气。因此，给植物浇水并不是越多越好。',anchors:['土壤里有空气吗','植物需要多少水']},
    {id:'pattern',title:'叶片里的图案',domain:'数学',parent:'plants',kind:'pattern',text:'观察叶片，可以找到形状、对称和重复的线索。有些叶片左右近似对称，但真实叶片不一定完全相同。数学里的对称是一种精确关系，自然中的形状常常只是近似符合。你可以画下两片叶子，比较哪些地方相似，哪些地方不同。',anchors:['怎样判断对称','自然里的形状都规则吗']},
  ]},
  {id:'starter-junior-1',title:'初一 · 从观察到解释',grade:'初中一年级',curriculum:'原创跨学科入门示例，非完整人教版图谱',nodes:[
    {id:'cell',title:'走近细胞',domain:'生命科学',parent:null,kind:'plant',text:'细胞是生物体结构和功能的基本单位，但病毒不具有细胞结构。常见植物细胞具有细胞壁、细胞膜、细胞质等结构，许多植物细胞还具有细胞核。并非每个植物细胞都有叶绿体，例如多数根部细胞没有叶绿体。观察和解释需要区分具体样本与一般规律。',anchors:['植物细胞的边界','显微镜怎样放大']},
    {id:'membrane',title:'植物细胞的边界',domain:'生命科学',parent:'cell',kind:'plant',text:'细胞膜把细胞内部与外部环境分隔开，并参与控制物质的进出。植物细胞膜外一般还有细胞壁，细胞壁提供支持和保护。把细胞比作房子可以帮助入门，但比喻不等于真实结构，细胞膜是一种动态的生物结构。',anchors:['物质如何进出细胞','细胞壁都一样吗']},
    {id:'lens',title:'显微镜怎样放大',domain:'物理',parent:'cell',kind:'pattern',text:'普通光学显微镜利用物镜和目镜形成放大的像。总放大倍数通常是物镜倍数与目镜倍数的乘积，例如十倍目镜和四十倍物镜组合约为四百倍。放大倍数与分辨能力不同：放得更大，不一定看得到更多细节。',anchors:['分辨率是什么','透镜如何成像']},
    {id:'number',title:'负数与方向',domain:'数学',parent:null,kind:'number',text:'在选定的约定下，正数和负数可以表示相反的方向或变化。数轴上先选原点、正方向和单位长度，再把数表示为点。负数不等于“坏”或“少”，例如零下温度只表示相对于零摄氏度这个基准的位置。',anchors:['绝对值表示什么','基准怎样改变表达']},
    {id:'distance',title:'绝对值表示什么',domain:'数学',parent:'number',kind:'number',text:'数 a 的绝对值表示数轴上代表 a 的点到原点的距离。距离不为负，所以绝对值也不为负。例如 −3 和 3 到原点的距离都为 3，它们的绝对值相等。距离相同并不代表位置相同，方向信息仍有作用。',anchors:['相反数有什么关系','距离能表示差异吗']},
    {id:'history',title:'从不同位置看记录',domain:'人文',parent:'number',kind:'pattern',text:'研究过去时，我们会遇到不同来源的记录。同一件事可能因记录者的观察位置、用途和保存条件而留下不同描述。比较来源、年代与证据，有助于提出可以继续核查的解释。与数学中选择基准的联系只是一个暂定的思考建议，不能把历史判断简化成算式。',anchors:['怎样比较两份史料','什么证据会改变解释'],relation:'temporary'},
  ]},
];

/** 原创矢量教材插图，固定 16:9；无远程素材依赖。 */
export function starterSvg(node) {
  const drawings = {
    water:'<path d="M280 530 Q200 330 390 180 Q510 350 480 460 Q440 600 280 530" fill="#69bcc7"/><path d="M680 330 Q630 220 740 220 Q790 125 885 210 Q1000 185 1000 310Z" fill="#c9e1db"/><path d="M1020 530H1300L1160 370Z" fill="#d4e6df"/><path d="M510 260Q600 180 650 220M1000 370Q1080 430 1100 490M1000 580Q800 700 480 580" fill="none" stroke="#e9cf86" stroke-width="9" stroke-dasharray="20 15"/>',
    plant:'<path d="M770 630V320M770 470Q570 300 500 390Q540 540 770 470M770 410Q900 200 1050 300Q1030 470 770 410" fill="#85bb87" stroke="#b8d68f" stroke-width="12"/><path d="M770 620L650 760M770 620L860 770M770 680L760 790M710 690L600 705M820 690L940 710" fill="none" stroke="#c9ac83" stroke-width="12"/><path d="M200 635H1330" stroke="#6d8666" stroke-width="5"/>',
    number:'<path d="M200 450H1330M1290 420L1330 450L1290 480" fill="none" stroke="#cbded5" stroke-width="7"/><path d="M400 430V470M600 430V470M800 420V480M1000 430V470M1200 430V470" stroke="#9fbeaa" stroke-width="5"/><g fill="#dbead5" font-size="42" text-anchor="middle"><text x="400" y="530">−2</text><text x="600" y="530">−1</text><text x="800" y="530">0</text><text x="1000" y="530">1</text><text x="1200" y="530">2</text></g><path d="M600 390Q700 240 800 390Q900 240 1000 390" fill="none" stroke="#e3c680" stroke-width="7"/><circle cx="600" cy="450" r="13" fill="#e3c680"/><circle cx="1000" cy="450" r="13" fill="#e3c680"/>',
    pattern:'<circle cx="535" cy="440" r="180" fill="none" stroke="#9ac7a3" stroke-width="8"/><circle cx="1000" cy="440" r="180" fill="none" stroke="#e3c580" stroke-width="8"/><path d="M535 260V620M355 440H715M1000 260L820 440L1000 620L1180 440Z" fill="none" stroke="#76aaa4" stroke-width="6"/><path d="M715 440H820" stroke="#d6e1d5" stroke-width="5" stroke-dasharray="9 9"/>',
  };
  const title = node.title.replace(/[<>&]/g,'');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="864" viewBox="0 0 1536 864"><defs><radialGradient id="bg"><stop stop-color="#234c42"/><stop offset="1" stop-color="#101e26"/></radialGradient></defs><rect width="1536" height="864" fill="url(#bg)"/><text x="96" y="105" fill="#edf0d5" font-family="sans-serif" font-size="46">${title}</text><text x="100" y="155" fill="#a9c3b3" font-family="sans-serif" font-size="22">无限之书 · 观察，然后提出自己的问题</text>${drawings[node.kind]}<text x="100" y="815" fill="#a7c0b0" font-family="sans-serif" font-size="20">示意图 · 形状与比例经过简化，请结合文字理解</text></svg>`;
}
