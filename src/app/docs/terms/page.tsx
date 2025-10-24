import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-canvas px-6 py-12 text-textSecondary">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-textPrimary">利用規約 / Terms of Use</h1>
        <p className="text-sm text-textSecondary/80">
          こちらはプレースホルダーの規約です。正式な文面が整い次第差し替えてください。
        </p>
      </header>
      <section className="space-y-4 text-sm leading-7">
        <p>
          このドキュメントには、SOFU AR Character Creator の利用条件、データの取り扱い、安全上の注意点を
          記載してください。利用者が理解しやすいよう、日本語と英語の併記をおすすめします。
        </p>
        <p>
          Replace this placeholder copy with the finalized legal terms that cover user responsibilities, content
          ownership, acceptable use, and disclaimers. Ensure the final language is reviewed by legal counsel.
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

