"use client";
import Link from 'next/link';
import { Divider, Header, InstructionBanner, MessageBlock, RichInput, ImageOption } from '@/components/ui';

type Props = { params: { locale: string; id: string } };

function StepLabel({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-textSecondary">{text}</p>;
}
function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-textPrimary">{title}</h2>
      {children}
    </section>
  );
}

export default function EmokaiStepPage({ params }: Props) {
  const { locale, id } = params;
  const step = parseInt(id, 10);

  const next = (n: number) => `/${locale}/emokai/step/${n}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header title="EMOKAI" />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        {step === 1 && (
          <>
            <InstructionBanner tone="default">感情の妖怪を発見する旅へ</InstructionBanner>
            <Section title="EMOKAI">
              <p className="text-sm text-textSecondary">感情の妖怪を発見する旅へ</p>
              <div className="pt-4">
                <Link href={next(2)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  はじめる
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 2 && (
          <>
            <StepLabel text="Step. 1/8" />
            <Section title="エモカイとは">
              <p className="text-sm text-textSecondary">
                あなたにとって、大切な場所を思い浮かべてください。なぜか忘れられない場所、気づくとそこにいる場所、なんとなく写真に撮った場所...
              </p>
              <div className="pt-4">
                <Link href={next(3)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 3 && (
          <>
            <StepLabel text="Step. 2/8" />
            <Section title="大切な場所を思い浮かべる">
              <p className="text-sm text-textSecondary">目を瞑り、その場所を妄想で歩いてください...なにかが動くのを感じる...</p>
              <div className="pt-4">
                <Link href={next(4)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 4 && (
          <>
            <StepLabel text="Step. 3/8" />
            <Section title="あなたの大切な場所">
              <p className="text-sm text-textSecondary">
                あなたにとって大切な場所について教えてください（地名、見えているもの、雰囲気など）
              </p>
              <RichInput
                label=""
                placeholder="都内の公園のベンチ、日当たりが心地よい..."
                value={''}
                onChange={() => {}}
                maxLength={300}
              />
              <div className="pt-2">
                <Link href={next(5)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 5 && (
          <>
            <StepLabel text="Step. 4/8" />
            <Section title="場所への想い">
              <p className="text-sm text-textSecondary">その場所は、なぜあなたにとって大切なのですか？</p>
              <RichInput label="" placeholder="自由記述" value={''} onChange={() => {}} maxLength={300} />
              <div className="pt-2">
                <Link href={next(6)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 6 && (
          <>
            <StepLabel text="Step. 5/8" />
            <Section title="イメージに合う場所">
              <p className="text-sm text-textSecondary">あなたのイメージに合う場所を選択してください。</p>
              <div className="grid gap-4 pt-2">
                {['A', 'B', 'C', 'D'].map((id) => (
                  <ImageOption key={id} id={id} label="選択肢" image={<div className="aspect-square" />} />
                ))}
              </div>
              <div className="pt-2">
                <Link href={next(7)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  選択して次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 7 && (
          <>
            <StepLabel text="Step. 6/8" />
            <Section title="場所への感情">
              <p className="text-sm text-textSecondary">その場所に対して抱く感情を選択してください。</p>
              <div className="space-y-2 text-sm text-textSecondary">
                <p>基本感情: Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger, Anticipation</p>
                <p>詳細感情: Ecstasy, Admiration, Terror, Amazement, Grief, Loathing, Rage, Vigilance, Serenity, Acceptance, Apprehension, Distraction, Pensiveness, Boredom, Annoyance, Interest</p>
              </div>
              <div className="pt-2">
                <Link href={next(8)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  選択して次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 8 && (
          <>
            <StepLabel text="Step. 7/8" />
            <Section title="エモカイのアクション">
              <p className="text-sm text-textSecondary">あなたのエモカイはこの場所に来たあなたに、何をしますか？具体的なアクションを教えてください。</p>
              <RichInput label="" placeholder="自由記述" value={''} onChange={() => {}} maxLength={300} />
              <div className="pt-2">
                <Link href={next(9)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 9 && (
          <>
            <StepLabel text="Step. 8/8" />
            <Section title="エモカイの姿">
              <p className="text-sm text-textSecondary">あなたのエモカイはどのような見た目なのでしょうか？</p>
              <p className="text-sm text-textSecondary">他にも思いつく特徴を教えてください。（動き、色、匂い、口癖など）</p>
              <RichInput label="" placeholder="自由記述" value={''} onChange={() => {}} maxLength={300} />
              <div className="pt-2">
                <Link href={next(10)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 10 && (
          <>
            <Section title="エモカイを選ぶ">
              <p className="text-sm text-textSecondary">あなたのイメージに合うエモカイを選択してください。</p>
              <div className="grid gap-4 pt-2">
                {['1', '2', '3', '4'].map((id) => (
                  <ImageOption key={id} id={id} label="候補" image={<div className="aspect-square" />} />
                ))}
              </div>
              <div className="pt-2">
                <Link href={next(11)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  選択して次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 11 && (
          <>
            <Section title="エモカイ生成中...">
              <p className="text-sm text-textSecondary">この場所に対する感情を、この場所に住まう感情の妖怪「エモカイ」へと昇華させていきます...</p>
              <p className="text-sm text-textSecondary">あなたの感情は今、はじめて質量を持ち、常世に現れ始めている...</p>
              <div className="pt-2">
                <Link href={next(12)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 12 && (
          <>
            <Section title="新しいエモカイが発見されました！">
              <p className="text-sm text-textSecondary">エモカイが発見されました。データベースへ登録しています...</p>
              <div className="aspect-square w-full rounded-2xl border border-divider" />
              <div className="pt-2">
                <Link href={next(13)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  次へ
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 13 && (
          <>
            <Section title="エモカイ詳細">
              <div className="space-y-2 text-sm text-textSecondary">
                <p>ナンバー: No. [番号]</p>
                <p>名前: *NAME* emokaiの名前をここに</p>
                <p>ホスト: *HOST* ホストの名前をここに</p>
                <p>感情: *EMOTION* [選択された感情]</p>
                <p>ストーリー: *STORY* emokaiの物語をここに記載する</p>
              </div>
              <div className="pt-2">
                <Link href={next(14)} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  登録する
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 14 && (
          <>
            <Section title="エモカイを呼び出す">
              <p className="text-sm text-textSecondary">あなたのエモカイを実際に呼んでみましょう！</p>
              <div className="pt-2">
                <Link href={`/${locale}/ar`} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  ARで召喚
                </Link>
              </div>
            </Section>
          </>
        )}

        {step === 15 && (
          <>
            <Section title="エモカイコレクション">
              <div className="grid gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-2xl border border-divider p-3 text-sm text-textSecondary">
                    <div className="mb-2 h-40 w-full rounded-xl bg-[rgba(237,241,241,0.06)]" />
                    <p>名前: サンプル{n}</p>
                    <p>感情: Joy</p>
                    <p>場所: 都内の公園</p>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <Link href={next(1)} className="inline-block rounded-lg border border-divider px-4 py-2 text-sm text-textPrimary">
                  新しいエモカイを作る
                </Link>
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
