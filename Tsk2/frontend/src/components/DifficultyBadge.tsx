import type { Difficulty } from "../types/analyzer";

const STYLE_BY_DIFFICULTY: Record<Difficulty, string> = {
  Beginner: "badge badge-beginner",
  Intermediate: "badge badge-intermediate",
  Advanced: "badge badge-advanced",
  Unknown: "badge badge-unknown"
};

const LABEL_BY_DIFFICULTY: Record<Difficulty, string> = {
  Beginner: "Beginner-Friendly",
  Intermediate: "Moderate Complexity and Guidance Needed",
  Advanced: "Complex and Newcomer-Challenging",
  Unknown: "Insufficient Data"
};

const ICON_BY_DIFFICULTY: Record<Difficulty, string> = {
  Beginner: "BF",
  Intermediate: "MD",
  Advanced: "AD",
  Unknown: "UN"
};

interface DifficultyBadgeProps {
  difficulty: Difficulty;
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  return (
    <span className={STYLE_BY_DIFFICULTY[difficulty]} aria-label={`Difficulty ${LABEL_BY_DIFFICULTY[difficulty]}`}>
      <span className="badge-icon" aria-hidden="true">{ICON_BY_DIFFICULTY[difficulty]}</span>
      <span>{LABEL_BY_DIFFICULTY[difficulty]}</span>
    </span>
  );
}
