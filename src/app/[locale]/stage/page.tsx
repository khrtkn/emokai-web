import { StageBuilder } from "@/components/stage-builder";

export default function StagePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <StageBuilder />
    </main>
  );
}
