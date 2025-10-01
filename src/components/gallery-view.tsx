"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  Divider,
  Header,
  InstructionBanner,
  MessageBlock,
  Button
} from "@/components/ui";
import ShareSheet from "@/components/share-sheet";
import { listCreations, type CreationPayload } from "@/lib/persistence";
import { GENERATION_RESULTS_KEY, CHARACTER_SELECTION_KEY, STAGE_SELECTION_KEY } from "@/lib/storage-keys";
import { createShareUrl } from "@/lib/share";
import { trackEvent } from "@/lib/analytics";

const PAGE_SIZE = 8;

function deriveCompositeUrl(creation: CreationPayload) {
  const composite = (creation.results as any)?.composite;
  if (composite && typeof composite.url === "string") {
    return composite.url;
  }
  return "";
}

function deriveStory(creation: CreationPayload) {
  const story = (creation.results as any)?.story;
  if (story && typeof story.content === "string") {
    return story.content;
  }
  return "";
}

function deriveCharacterName(creation: CreationPayload) {
  const story = (creation.results as any)?.story;
  if (story && typeof story.locale === "string") {
    return story.id ?? "Character";
  }
  return "Character";
}

type GalleryItem = {
  id: string;
  createdAt: string;
  compositeUrl: string;
  story: string;
  characterLabel: string;
  payload: CreationPayload;
};

export function GalleryView() {
  const t = useTranslations("gallery");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    trackEvent("gallery_open", { locale });
    const creations = listCreations();
    const mapped = creations.map((creation, index) => ({
      id: `${creation.createdAt}-${index}`,
      createdAt: creation.createdAt,
      compositeUrl: deriveCompositeUrl(creation),
      story: deriveStory(creation),
      characterLabel: deriveCharacterName(creation),
      payload: creation
    }));
    setItems(mapped);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisible((prev) => Math.min(prev + PAGE_SIZE, items.length));
        }
      });
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length]);

  const visibleItems = useMemo(() => items.slice(0, visible), [items, visible]);

  const handleOpenDetail = (item: GalleryItem) => {
    const { payload } = item;
    sessionStorage.setItem(GENERATION_RESULTS_KEY, JSON.stringify(payload.results));
    sessionStorage.setItem(STAGE_SELECTION_KEY, JSON.stringify(payload.stageSelection));
    sessionStorage.setItem(CHARACTER_SELECTION_KEY, JSON.stringify(payload.characterSelection));
    setSelected(item);
    trackEvent("gallery_detail", { id: item.id, locale });
  };

  const handleCloseDetail = () => {
    setSelected(null);
    setShareOpen(false);
    setShareUrl("");
  };

  const handleLaunchAR = () => {
    if (!selected) return;
    router.push(`/${locale}/ar`);
  };

  const handleViewResult = () => {
    router.push(`/${locale}/result`);
  };

  const handleSave = () => {
    if (!selected) return null;
    if (shareUrl) return shareUrl;

    const link = createShareUrl();
    setShareUrl(link.url);
    return link.url;
  };

  const handleShare = () => {
    const url = handleSave();
    if (!url) return;
    setShareOpen(true);
    trackEvent("share_action", { action: "gallery_share", locale });
  };

  return (
    <div className="flex flex-col pb-12">
      <Header
        title={t("title")}
        action={{ type: "button", label: t("back"), onClick: () => router.back() }}
      />
      <Divider />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <InstructionBanner tone="default">{t("instruction")}</InstructionBanner>
        {visibleItems.length === 0 ? (
          <MessageBlock title={t("emptyTitle")} body={<p>{t("emptyBody")}</p>} />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="overflow-hidden rounded-3xl border border-divider bg-[rgba(237,241,241,0.04)]"
                onClick={() => handleOpenDetail(item)}
              >
                {item.compositeUrl ? (
                  <img
                    src={item.compositeUrl}
                    alt={t("thumbnailAlt")}
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center text-xs text-textSecondary">
                    {t("noImage")}
                  </div>
                )}
                <div className="space-y-1 p-3 text-left text-xs text-textSecondary">
                  <p className="font-semibold text-textPrimary">{new Date(item.createdAt).toLocaleDateString()}</p>
                  <p className="line-clamp-2">{item.story}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {visibleItems.length < items.length ? (
          <div ref={sentinelRef} className="py-6 text-center text-sm text-textSecondary">
            {t("loadingMore")}
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-[32px] border border-divider bg-canvas/95 p-6 text-textSecondary">
            <header className="flex items-center justify-between">
              <h2 className="heading-prosty">{t("detailTitle")}</h2>
              <button type="button" onClick={handleCloseDetail} className="text-xs uppercase tracking-[0.2em]">
                {t("close")}
              </button>
            </header>
            {selected.compositeUrl ? (
              <img
                src={selected.compositeUrl}
                alt={t("compositeAlt")}
                className="w-full rounded-3xl border border-divider object-cover"
              />
            ) : null}
            <div className="space-y-3 text-sm">
              <p className="text-xs uppercase tracking-[0.3em] opacity-70">
                {new Date(selected.createdAt).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap text-textPrimary">{selected.story}</p>
              <p className="text-xs opacity-70">{t("license")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleLaunchAR} showArrow>
                {t("viewAR")}
              </Button>
              <Button onClick={handleViewResult}>{t("viewResult")}</Button>
              <Button onClick={handleShare}>{t("share")}</Button>
              <Button onClick={handleCloseDetail}>{t("close")}</Button>
            </div>
          </div>
        </div>
      ) : null}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={shareUrl}
        description={t("shareDescription")}
      />
    </div>
  );
}

export default GalleryView;
