export default {
  app: {
    title: '作物病害検出',
    subtitle: '病害分析のために植物の葉画像をアップロードしてください',
  },
  buttons: {
    uploadImage: '📁 画像をアップロード',
    clickPhoto: '📷 写真を撮る',
    analyzeDisease: '🔍 病害を分析',
  },
  alerts: {
    permissionRequired: '画像をアップロードするには権限が必要です',
    noImage: '最初に画像を選択してください',
    serverUnavailable: 'サーバーが正しいIPアドレスで実行されていることを確認してください',
    timeout: '分析に時間がかかりすぎました。もう一度お試しください。',
    analysisFailed: '画像の分析に失敗しました。もう一度お試しください。',
    cannotOpenLink: 'このリンクを開けません',
    failedToOpenLink: 'リンクを開けませんでした',
  },
  results: {
    plantCrop: '🌿 植物/作物',
    status: '✅ ステータス',
    diseaseDetected: '🦠 病害が検出されました',
    confidence: '🎯 信頼度',
    description: '📖 説明',
    growthTips: '🌱 成長のヒント',
    prevention: '🛡 予防',
    productsForGrowth: '🌟 成長促進製品',
    treatmentProducts: '🧪 推奨される治療製品',
    articles: '📚 教育記事',
  },
  health: {
    healthy: '健康',
    disease: '病害',
  },
  language: {
    selectLanguage: '言語を選択',
  },
};
