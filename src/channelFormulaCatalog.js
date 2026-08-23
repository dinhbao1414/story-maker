import { createChannelFormula } from './channelFormula.js';

const DAILY_SCAT_FORMULA = createChannelFormula({
  id: 'builtin-daily-scat-family-drama-ja',
  name: 'Daily Scat – Drama gia đình Nhật',
  builtIn: true,
  sourceCount: 40,
  sourceFingerprint: 'approved-40-file-channel-set',
  analysis: {
    genre: '日本語の家族因果応報ドラマ',
    audience: '身近な不公平が証拠で反転し、主人公が生活を取り戻す物語を好む視聴者',
    pointOfView: '主人公に寄り添う近接三人称または一人称',
    tone: '静かな違和感から緊張を高める共感的な社会派ドラマ',
    openingHook: '日常の場で侮辱・隠し事・不自然な要求を一つ提示し、主人公の我慢の理由を匂わせる',
    protagonistPattern: '家族のために耐えてきた普通の人物が、記録と自分の意思を取り戻す',
    antagonistPattern: '身近な立場や評判を利用して否認・責任転嫁を続ける人物',
    escalationPattern: ['小さな違和感', '否認と孤立', '証拠の積み上げ', '公開の場での反転'],
    revealPattern: '時系列、記録、第三者の証言を組み合わせ、過去の意味を反転させる',
    evidenceMotifs: ['メッセージ記録', '領収書・契約書', '写真・録音', '第三者の証言'],
    justicePayoff: '主人公自身の具体的な選択で支配関係を終わらせ、相手の言い訳を現実の結果に変える',
    epiloguePattern: '生活の小さな再建、選び直した関係、静かな余韻で閉じる',
    narrationRules: ['日本語のみ', '説明より行動・会話・物の変化で感情を示す', '同じ心理説明を繰り返さない'],
    pacingRules: ['4章構成', '各章に新事実と不可逆な選択', '中盤で証拠の意味を反転', '最終章で後日談まで完結'],
    forbiddenPatterns: ['原文の固有名詞・台詞・チャンネル名・CTAの再利用', '固有事件のなぞり', '未完の結末', 'プロンプト・分析メモの出力'],
  },
  reproductionPrompt: [
    '抽象化された構成規則だけを使い、原文の固有名詞、台詞、チャンネル名、CTA、固有事件を再利用しない。',
    '日本語のみで、主人公の視点に近い散文小説を書く。感情は具体的な行動、会話、物の変化で示す。',
    '4章で、導入の違和感、孤立と証拠、意味の反転、決断と後日談を順に進める。',
    '空白を除く20,000字以上、目標22,000字。各章で新しい事実と不可逆な選択を置き、同じ場面を言い換えて水増ししない。',
    '最後は具体的な行動と生活の変化で完結させ、未完・続く・説明だけの結末にしない。',
  ].join('\n'),
});

export const BUILTIN_CHANNEL_FORMULAS = Object.freeze([DAILY_SCAT_FORMULA]);

export { DAILY_SCAT_FORMULA };
