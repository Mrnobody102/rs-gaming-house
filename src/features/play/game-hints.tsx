import { readHint, type Hint } from "@/features/games/hints";

export function GameHints({ hints }: { hints: Hint[] }) {
  return (
    <ol className="game-hints" aria-label="Gợi ý đã mở">
      {hints.map((value, i) => {
        const hint = readHint(value);
        return (
          <li key={i}>
            <span className="hint-number">{i + 1}</span>
            {hint.type === "text" ? (
              <span>{hint.text}</span>
            ) : (
              <a
                className="hint-image-link"
                href={hint.image}
                target="_blank"
                rel="noreferrer"
              >
                <img src={hint.image} alt={`Gợi ý ${i + 1}`} loading="eager" />
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}
