import ARLauncher from "@/components/ar-launcher";
import { ScreenBackground } from "@/components/ui";

export default function ARPage() {
  return (
    <ScreenBackground>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 sm:px-6">
        <ARLauncher />
      </main>
    </ScreenBackground>
  );
}
