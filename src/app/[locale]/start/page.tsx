import { redirect } from "next/navigation";

export default function StartPage() {
  // 要望に合わせて、同意ページも日本語の Emokai Step1 に誘導
  redirect("/ja/emokai/step/1");
}
