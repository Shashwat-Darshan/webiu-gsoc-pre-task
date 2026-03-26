import type { Difficulty } from "../types/analyzer";

const STYLE_BY_DIFFICULTY: Record<Difficulty, string> = {
  Beginner: "badge badge-beginner",
  Intermediate: "badge badge-intermediate",
  Advanced: "badge badge-advanced",
  Unknown: "badge badge-unknown"
};

const LABEL_BY_DIFFICULTY: Record<Difficulty, string> = {
  Beginner: "Simple and Beginner-Friendly",
  Intermediate: "Moderate Complexity and Guidance Needed",
  Advanced: "Complex and Newcomer-Challenging",
  Unknown: "Insufficient Data"
};

interface DifficultyBadgeProps {
  difficulty: Difficulty;
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  return <span className={STYLE_BY_DIFFICULTY[difficulty]}>{LABEL_BY_DIFFICULTY[difficulty]}</span>;
}
