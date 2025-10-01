import { notFound } from "next/navigation";

export const locales = ["ja", "en"] as const;

export type Locale = (typeof locales)[number];

export function isLocale(input: string): input is Locale {
  return (locales as readonly string[]).includes(input);
}

export const messages = {
  ja: {
    terms: {
      heading: "Before You Begin",
      device: "検出されたデバイス: {device}",
      permissions: "このアプリは次の機能を利用します:",
      permissionCamera: "カメラ (AR表示・撮影用)",
      permissionPhotos: "写真ライブラリ (画像選択用)",
      termsHeading: "利用規約",
      termsBody: "ボタンをタップすると利用規約とライセンスに同意したことになります。",
      license: "出力物のライセンス: CC BY-SA 4.0",
      accept: "同意して進む",
      sessionId: "同意後に一意のゲストIDを生成してセッションを開始します。"
    },
    stage: {
      title: "Stage Generation",
      instruction: "ステージの説明を入力し、参考写真をアップロードして候補を生成しましょう。",
      descriptionLabel: "ステージの説明",
      descriptionPlaceholder: "例: 黄昏時の屋上庭園。ネオン街の光が遠くに見える。",
      checkButton: "内容をチェック",
      checking: "チェック中…",
      uploadReference: "写真をアップロード",
      generatingTitle: "生成中",
      generatingBody: "ステージの候補を作成しています。最大60秒ほどかかる場合があります。",
      optionLabel: "この候補を選択",
      regenerate: "別の候補を生成",
      next: "次へ",
      imageMetadata: "処理後: 約{size}KB",
      helperAfterModeration: "写真をアップロードしてステージ候補を生成しましょう",
      generationError: "生成に失敗しました。もう一度お試しください"
    },
    character: {
      title: "Character Generation",
      instruction: "キャラクターの説明を入力して候補画像を生成しましょう。",
      descriptionLabel: "キャラクターの説明",
      descriptionPlaceholder: "例: 星明かりを纏った旅人。透き通る翼を持つ。",
      checkButton: "内容をチェック",
      checking: "チェック中…",
      generateButton: "キャラクター候補を生成",
      regenerate: "別の候補を生成",
      optionLabel: "このキャラクターを選択",
      optionAlt: "生成されたキャラクター候補",
      startGeneration: "3D・物語の生成を開始",
      helperAfterModeration: "生成開始後は完了までお待ちください",
      generationError: "生成に失敗しました。もう一度お試しください",
      next: "次へ",
      progressModel: "3Dモデル生成",
      progressComposite: "合成画像生成",
      progressStory: "物語生成",
      progressRunning: "各生成処理を進行中です…",
      progressComplete: "すべての生成が完了しました",
      lockActive: "すでに生成処理中です"
    },
    result: {
      title: "Creation Results",
      instruction: "生成された物語や画像を順番に確認できます。",
      storyTitle: "キャラクターの物語",
      storyHost: "Host: Guest User",
      step: {
        story: "まずは物語をお楽しみください",
        composite: "続いて合成画像を確認しましょう",
        ar: "AR表示の準備が整いました"
      },
      compositeAlt: "生成された合成画像",
      arTitle: "AR表示について",
      arInstruction: "お使いの端末でAR表示を開始するには次のステップに進んでください。",
      arTip1: "平らな場所で端末をゆっくり動かして面を検出してください",
      arTip2: "表示されたモデルはピンチ操作でサイズ調整できます",
      arTip3: "シャッターボタンで写真を撮影し保存できます",
      licenseNotice: "生成物はCC BY-SA 4.0で提供されます",
      goToAR: "AR表示へ進む",
      next: "次へ",
      missing: "生成結果が見つかりません。最初からやり直してください。",
      parseError: "結果データの読み込みに失敗しました。もう一度生成し直してください。",
      saveButton: "保存する",
      saving: "保存しています…",
      saved: "保存しました",
      saveError: "保存に失敗しました",
      limitReached: "本日の作成上限（3回）に達しました。約{hours}時間後にリセットされます",
      shareButton: "共有する",
      shareTitle: "作品を共有",
      shareDescription: "以下のリンクをコピーまたはSNSで共有できます",
      shareSuccess: "共有用リンクを作成しました",
      openGallery: "ギャラリーを開く"
    },
    ar: {
      title: "AR Display",
      status: {
        ar: "ARモードを開始できます",
        fallback: "ARが利用できないため3Dビューアを使用します"
      },
      deviceTitle: "デバイス情報",
      deviceDetected: "検出されたデバイス: {device}",
      device: {
        ios: "iOS",
        android: "Android",
        unknown: "不明"
      },
      support: {
        supported: "このデバイスはARに対応しています",
        fallback: "AR対応が確認できません。3Dビューアに切り替えます",
        unsupported: "このデバイスはAR非対応です"
      },
      permissionTitle: "カメラアクセス",
      permissionDescription: "カメラアクセスを許可するとAR表示が可能になります",
      permissionUnavailable: "カメラアクセス機能を利用できません",
      permissionDenied: "カメラアクセスが拒否されました",
      permissionRequired: "AR表示にはカメラアクセスが必要です",
      permissionGranted: "許可済み",
      requestPermission: "カメラアクセスを許可",
      viewerTitle: "表示モード",
      viewer: {
        ar: "端末のカメラを使ったAR表示を利用します",
        fallback: "3Dビューアでモデルを表示します"
      },
      switchFallback: "3Dビューアに切り替える",
      switchAR: "ARモードに戻す",
      launchAR: "ARを起動",
      openViewer: "3Dビューアを開く",
      missingResults: "結果データが見つかりませんでした",
      session: {
        title: "ARセッション",
        fallbackTitle: "3Dビューア",
        back: "戻る",
        instructions: "端末を動かして平面を検出し、タップしてキャラクターを配置してください",
        fallbackInstructions: "3Dモデルをドラッグで回転できます",
        arPlaceholder: "{device} 用のARセッションを起動中です…",
        viewerPlaceholder: "3Dビューアを準備中です…"
      }
    },
    gallery: {
      title: "Gallery",
      back: "Back",
      instruction: "Browse your recent creations and open them again for AR or sharing.",
      emptyTitle: "No creations saved",
      emptyBody: "Complete a creation and tap Save to see it appear here.",
      thumbnailAlt: "Gallery thumbnail",
      noImage: "No image",
      loadingMore: "Loading more…",
      detailTitle: "Creation Detail",
      close: "Close",
      license: "Assets are provided under CC BY-SA 4.0",
      viewAR: "Open in AR",
      viewResult: "View Result",
      share: "Share",
      shareDescription: "Copy the link below or share it via social networks"
    }
  },
  en: {
    terms: {
      heading: "Before You Begin",
      device: "Detected device type: {device}",
      permissions: "This app requires the following capabilities:",
      permissionCamera: "Camera (for AR placement and capture)",
      permissionPhotos: "Photo Library (to reference your images)",
      termsHeading: "Terms of Use",
      termsBody: "By continuing you agree to the terms and license obligations.",
      license: "Generated assets are released under CC BY-SA 4.0",
      accept: "Accept and continue",
      sessionId: "After acceptance we will create a guest session ID to track progress."
    },
    stage: {
      title: "Stage Generation",
      instruction: "Describe your stage, upload a reference photo, and we will generate photorealistic options.",
      descriptionLabel: "Stage description",
      descriptionPlaceholder: "e.g. Rooftop garden at dusk with neon city lights in the distance.",
      checkButton: "Moderate description",
      checking: "Checking…",
      uploadReference: "Upload photo",
      generatingTitle: "Generating",
      generatingBody: "Creating stage candidates. This can take up to 60 seconds.",
      optionLabel: "Select this option",
      regenerate: "Generate again",
      next: "Next",
      imageMetadata: "Processed: ~{size}KB",
      helperAfterModeration: "Upload a reference photo to generate stage options.",
      generationError: "Generation failed. Please try again"
    },
    character: {
      title: "Character Generation",
      instruction: "Describe your character to generate visual candidates.",
      descriptionLabel: "Character description",
      descriptionPlaceholder: "e.g. A stargazing traveler with translucent wings.",
      checkButton: "Moderate description",
      checking: "Checking…",
      generateButton: "Generate character options",
      regenerate: "Generate again",
      optionLabel: "Select this character",
      optionAlt: "Generated character option",
      startGeneration: "Start 3D & story generation",
      helperAfterModeration: "Please wait while we process your request.",
      generationError: "Generation failed. Please try again",
      next: "Next",
      progressModel: "3D model",
      progressComposite: "Composite image",
      progressStory: "Story",
      progressRunning: "Generation is running in the background…",
      progressComplete: "All generation tasks completed",
      lockActive: "A generation is already in progress"
    },
    result: {
      title: "Your Creation",
      instruction: "Review the generated story, image, and prepare for AR display.",
      storyTitle: "Character Story",
      storyHost: "Host: Guest",
      step: {
        story: "Enjoy the narrative first",
        composite: "Next, review the composite image",
        ar: "AR display is ready"
      },
      compositeAlt: "Generated composite image",
      arTitle: "About AR Display",
      arInstruction: "Follow the next step to launch AR on your device.",
      arTip1: "Move your device slowly to detect a flat surface",
      arTip2: "Use pinch gestures to resize the model",
      arTip3: "Use the shutter button to capture photos",
      licenseNotice: "Outputs are provided under CC BY-SA 4.0",
      goToAR: "Proceed to AR",
      next: "Next",
      missing: "We couldn’t find your results. Please start over.",
      parseError: "Failed to read result data. Please regenerate.",
      saveButton: "Save",
      saving: "Saving…",
      saved: "Saved",
      saveError: "Failed to save",
      limitReached: "You have reached today’s limit of 3 creations. Resets in ~{hours} hours.",
      shareButton: "Share",
      shareTitle: "Share your creation",
      shareDescription: "Copy the link below or share to a social network",
      shareSuccess: "Share link ready",
      openGallery: "Open Gallery"
    },
    ar: {
      title: "AR Display",
      status: {
        ar: "You can launch AR mode",
        fallback: "AR not available. Switching to 3D viewer"
      },
      deviceTitle: "Device Information",
      deviceDetected: "Detected device: {device}",
      device: {
        ios: "iOS",
        android: "Android",
        unknown: "Unknown"
      },
      support: {
        supported: "This device supports AR",
        fallback: "AR support not detected. Using 3D viewer",
        unsupported: "This device does not support AR"
      },
      permissionTitle: "Camera Access",
      permissionDescription: "Grant camera permission to enable AR",
      permissionUnavailable: "Camera access is not available",
      permissionDenied: "Camera permission was denied",
      permissionRequired: "Camera permission is required for AR",
      permissionGranted: "Granted",
      requestPermission: "Allow camera access",
      viewerTitle: "Viewer Mode",
      viewer: {
        ar: "Use AR with your device camera",
        fallback: "View the model in a 3D viewer"
      },
      switchFallback: "Switch to 3D viewer",
      switchAR: "Switch to AR",
      launchAR: "Launch AR",
      openViewer: "Open 3D viewer",
      missingResults: "Couldn't load generation results",
      session: {
        title: "AR Session",
        fallbackTitle: "3D Viewer",
        back: "Back",
        instructions: "Move your device to detect a plane, then tap to place the character",
        fallbackInstructions: "Drag to rotate the model in 3D viewer",
        arPlaceholder: "Launching AR session for {device}…",
        viewerPlaceholder: "Preparing 3D viewer…"
      }
    },
    gallery: {
      title: "Gallery",
      back: "Back",
      instruction: "Browse your recent creations and open them again for AR or sharing.",
      emptyTitle: "No creations saved",
      emptyBody: "Complete a creation and tap Save to see it appear here.",
      thumbnailAlt: "Gallery thumbnail",
      noImage: "No image",
      loadingMore: "Loading more…",
      detailTitle: "Creation Detail",
      close: "Close",
      license: "Assets are provided under CC BY-SA 4.0",
      viewAR: "Open in AR",
      viewResult: "View Result",
      share: "Share",
      shareDescription: "Copy the link below or share it via social networks"
    }
  }
} as const;

export type Messages = typeof messages;
export type MessagesForLocale = Messages[Locale];

export async function getMessages(locale: Locale): Promise<MessagesForLocale> {
  if (!locales.includes(locale)) {
    notFound();
  }
  return messages[locale];
}
