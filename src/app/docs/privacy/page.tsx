import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-canvas px-6 py-12 text-textSecondary">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-textPrimary">プライバシーポリシー / Privacy Policy</h1>
        <p className="text-sm text-textSecondary/80">
          こちらはプレースホルダーのポリシーです。正式な内容に差し替えて公開してください。
        </p>
      </header>
      <section className="space-y-4 text-sm leading-7">
        <p>
          本アプリで取り扱う個人情報や生成データの保存期間、第三者提供、利用目的などを明記します。利用者の
          権利と問い合わせ窓口も忘れずに記載してください。
        </p>
        <p>
          Replace this placeholder with the finalized privacy policy that explains data collection, retention,
          analytics, and user controls. Ensure compliance with applicable regulations before launch.
        </p>
      </section>
      <footer>
        <Link href="/" className="text-sm text-accent hover:underline">
          戻る / Return to splash
        </Link>
      </footer>
    </main>
  );
}

