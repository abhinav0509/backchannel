import type { Question, QuestionTopic } from '../../src/types/research'
import type { Round } from '../../src/types/tracking'

// Which topics each kind of round is the right place to ask about, most important first.
const TOPICS: Record<Round['kind'], QuestionTopic[]> = {
  recruiter_screen: ['role', 'comp', 'team'],
  hiring_manager: ['role', 'team', 'culture', 'future'],
  portfolio_review: ['role', 'team', 'ai'],
  design_exercise: ['role', 'team'],
  panel: ['team', 'culture', 'role', 'ai'],
  onsite: ['team', 'culture', 'future', 'ai'],
  final: ['future', 'money', 'company', 'comp'],
  other: ['role', 'team', 'company'],
}

/** The few prepared questions that suit this round, so each round has its own short list. */
export function questionsForRound(kind: Round['kind'], questions: Question[], max = 5): Question[] {
  const topics = TOPICS[kind]
  const picked = topics.flatMap((t) => questions.filter((q) => q.topic === t))
  return (picked.length ? picked : questions).slice(0, max)
}
