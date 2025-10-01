import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function HomePage() {
  // 要望に合わせて、言語別トップは一律で日本語の Emokai Step1 に誘導
  redirect("/ja/emokai/step/1");
}
