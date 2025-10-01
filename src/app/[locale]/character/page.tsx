import { CharacterBuilder } from "@/components/character-builder";

export default function CharacterPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <CharacterBuilder />
    </main>
  );
}
