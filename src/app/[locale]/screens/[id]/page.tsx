import { notFound } from 'next/navigation';
import { Divider, Header, InstructionBanner, MessageBlock, RichInput, ImageOption, StoryCard, ProgressBar } from '@/components/ui';
import Image from 'next/image';
import Ref01 from '../../../../../docs/UI_Reference/01_ScreenMessage.png';
import Ref02 from '../../../../../docs/UI_Reference/02_ScreenMessage.png';
import Ref03 from '../../../../../docs/UI_Reference/03_ScreenMessage.png';
import Ref04 from '../../../../../docs/UI_Reference/04_ScreenMessage.png';
import Ref05 from '../../../../../docs/UI_Reference/05_ScreenMessage.png';
import Ref06 from '../../../../../docs/UI_Reference/06_ScreenInput.png';
import Ref07 from '../../../../../docs/UI_Reference/07_ScreenInput.png';
import Ref08 from '../../../../../docs/UI_Reference/08_ScreenInput.png';
import Ref09 from '../../../../../docs/UI_Reference/09_ScreenInput.png';
import Ref10 from '../../../../../docs/UI_Reference/10_ScreenInput.png';
import Ref11 from '../../../../../docs/UI_Reference/11_ScreenImageSelection.png';
import Ref12 from '../../../../../docs/UI_Reference/12_ScreenImageSelection.png';
import Ref13 from '../../../../../docs/UI_Reference/13_ScreenImageSelection.png';
import Ref14 from '../../../../../docs/UI_Reference/14_ScreenEmokaiCard.png';
import Ref15 from '../../../../../docs/UI_Reference/15_ScreenCamera.png';

type Props = { params: { locale: string; id: string } };

function PlaceholderImage({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[rgba(237,241,241,0.05)] text-xs text-textSecondary">
      {label}
    </div>
  );
}

export default function ScreenDemo({ params }: Props) {
  const { locale, id } = params;
  const title = `Screen ${id}`;

  const num = parseInt(id, 10);
  if (Number.isNaN(num) || num < 1 || num > 15) notFound();

  const refs: Record<number, any> = {
    1: Ref01,
    2: Ref02,
    3: Ref03,
    4: Ref04,
    5: Ref05,
    6: Ref06,
    7: Ref07,
    8: Ref08,
    9: Ref09,
    10: Ref10,
    11: Ref11,
    12: Ref12,
    13: Ref13,
    14: Ref14,
    15: Ref15
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <Header title={title} />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-divider">
          <Image src={refs[num]} alt={`UI Reference ${id}`} placeholder="blur" />
        </div>
        {num <= 5 && (
          <>
            <InstructionBanner tone={num === 3 ? 'error' : 'default'}>
              {num === 3 ? 'エラーが発生しました。もう一度お試しください。' : 'この画面はお知らせ/注意/完了のメッセージ用です。'}
            </InstructionBanner>
            <MessageBlock
              title={num === 4 ? '完了しました' : 'お知らせ'}
              body={<p className="text-textSecondary">参考文を配置します。文量が増えても崩れにくい構成です。</p>}
            />
          </>
        )}

        {num >= 6 && num <= 10 && (
          <>
            <InstructionBanner tone={num === 10 ? 'error' : 'default'}>
              {num === 10 ? '入力内容を確認してください。' : '説明を入力し、チェック/アップロードを行います。'}
            </InstructionBanner>
            <RichInput
              label={locale === 'ja' ? '説明' : 'Description'}
              placeholder={locale === 'ja' ? '例: 黄昏時の屋上庭園…' : 'e.g. Rooftop garden at dusk…'}
              value={''}
              onChange={() => {}}
              maxLength={300}
              helperText={num === 6 || num === 8 ? 'チェックまたはアップロードを行ってください。' : ''}
              error={num === 10 ? (locale === 'ja' ? '不適切な内容が含まれています' : 'Inappropriate content detected') : undefined}
            />
            {num === 7 || num === 9 ? (
              <MessageBlock title={locale === 'ja' ? '生成中' : 'Generating'} body={<p>{locale === 'ja' ? '候補を作成しています…' : 'Creating candidates…'}</p>} />
            ) : null}
          </>
        )}

        {num >= 11 && num <= 13 && (
          <>
            <InstructionBanner tone="default">候補を選択してください。</InstructionBanner>
            <div className="grid gap-4">
              {['A', 'B', 'C', 'D'].map((k) => (
                <ImageOption key={k} id={k} label={`Select ${k}`} image={<PlaceholderImage label={`Option ${k}`} />} />
              ))}
            </div>
          </>
        )}

        {num === 14 && (
          <>
            <InstructionBanner tone="default">生成された物語の例です。</InstructionBanner>
            <StoryCard
              numberLabel="No. 01"
              characterName={locale === 'ja' ? 'キャラクターの物語' : 'Character Story'}
              hostName={locale === 'ja' ? 'Host: Guest' : 'Host: Guest'}
              story={<p>これはデモの文章です。長文になってもカード内でスクロール可能です。</p>}
              footer={locale === 'ja' ? '生成物はCC BY-SA 4.0で提供されます' : 'CC BY-SA 4.0'}
            />
          </>
        )}

        {num === 15 && (
          <>
            <InstructionBanner tone="default">AR / 3D ビューア画面の例</InstructionBanner>
            <MessageBlock
              title={locale === 'ja' ? 'デバイス情報' : 'Device Information'}
              body={
                <div className="space-y-2 text-textSecondary">
                  <p>{locale === 'ja' ? 'この端末のAR対応状況: 自動判定' : 'AR capability: auto-detected'}</p>
                  <p>{locale === 'ja' ? 'カメラ権限: 未許可/許可済み' : 'Camera permission: pending/granted'}</p>
                </div>
              }
            />
          </>
        )}

        {(num === 9 || num === 8) && (
          <div className="pt-2">
            <ProgressBar
              stages={[
                { id: 'model', label: '3D', status: num === 9 ? 'active' : 'pending' },
                { id: 'composite', label: 'Composite', status: 'pending' },
                { id: 'story', label: 'Story', status: 'pending' }
              ]}
              footer={locale === 'ja' ? '進行中…' : 'Running…'}
            />
          </div>
        )}
      </div>
    </main>
  );
}
