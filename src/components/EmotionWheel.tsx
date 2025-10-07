import { useMemo } from 'react';

type EmotionRing = 'inner' | 'middle' | 'outer';

type EmotionWheelNode = {
  value: string;
  ring: EmotionRing;
};

type EmotionWheelPetal = {
  id: string;
  colors: [string, string];
  nodes: EmotionWheelNode[];
};

type EmotionWheelProps = {
  petals: EmotionWheelPetal[];
  selected: string[];
  onToggle: (value: string) => void;
  getLabel: (value: string) => string;
  allEmotions: string[];
  instructions: string;
};

const RING_RADIUS: Record<EmotionRing, number> = {
  inner: 24,
  middle: 45,
  outer: 66,
};

const BASE_BUTTON_CLASS =
  'absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-2 text-[11px] font-semibold leading-tight text-black shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function EmotionWheel({
  petals,
  selected,
  onToggle,
  getLabel,
  allEmotions,
  instructions,
}: EmotionWheelProps) {
  const segmentAngle = 360 / petals.length;

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="relative aspect-square w-full max-w-[320px]">
        <div className="absolute inset-0 rounded-full border border-[rgba(237,241,241,0.08)] bg-[rgba(237,241,241,0.02)]" />
        <div className="absolute inset-[12%] rounded-full border border-[rgba(237,241,241,0.1)]" />
        <div className="absolute inset-[28%] rounded-full border border-[rgba(237,241,241,0.06)]" />
        <div className="absolute inset-[44%] flex items-center justify-center rounded-full border border-[rgba(237,241,241,0.12)] bg-[rgba(237,241,241,0.05)] px-6 text-center text-[11px] text-textSecondary">
          <span>{instructions}</span>
        </div>
        {petals.map((petal, index) => {
          const angleBase = index * segmentAngle - 90;
          return petal.nodes.map((node) => {
            const radius = RING_RADIUS[node.ring];
            const rad = (angleBase * Math.PI) / 180;
            const x = 50 + radius * Math.cos(rad);
            const y = 50 + radius * Math.sin(rad);
            const isSelected = selectedSet.has(node.value);
            const gradient = `linear-gradient(145deg, ${petal.colors[0]}, ${petal.colors[1]})`;
            return (
              <button
                key={`${petal.id}-${node.value}`}
                type="button"
                aria-pressed={isSelected}
                title={getLabel(node.value)}
                onClick={() => onToggle(node.value)}
                className={`${BASE_BUTTON_CLASS} ${isSelected ? 'ring-2 ring-accent ring-offset-[1px]' : 'opacity-70 hover:opacity-100'}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  backgroundImage: gradient,
                  boxShadow: isSelected
                    ? '0 6px 18px rgba(20, 20, 20, 0.32)'
                    : '0 3px 12px rgba(12, 12, 12, 0.22)',
                }}
              >
                {getLabel(node.value)}
              </button>
            );
          });
        })}
      </div>
      <div className="sr-only" aria-hidden={false}>
        <fieldset>
          <legend>{instructions}</legend>
          <ul>
            {allEmotions.map((emotion) => (
              <li key={emotion}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(emotion)}
                    onChange={() => onToggle(emotion)}
                  />
                  {getLabel(emotion)}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>
    </div>
  );
}

export type { EmotionWheelPetal, EmotionWheelNode, EmotionRing };
