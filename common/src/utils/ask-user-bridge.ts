import type { AskUserQuestion } from '../tools/params/tool/ask-user'

export const DEFAULT_ASK_USER_TIMEOUT_MS = 30_000

export type AskUserResponse = {
  answers?: Array<{
    questionIndex: number
    selectedOption?: string
    selectedOptions?: string[]
    otherText?: string
  }>
  skipped?: boolean
}

export type AskUserRequest = {
  toolCallId: string
  questions: AskUserQuestion[]
  resolve: (response: AskUserResponse) => void
  timeoutId?: ReturnType<typeof setTimeout>
}

type Listener = (request: AskUserRequest | null) => void

let pendingRequest: AskUserRequest | null = null
const listeners: Listener[] = []

export const AskUserBridge = {
  request: (
    toolCallId: string,
    questions: AskUserQuestion[],
    options: { timeoutMs?: number } = {},
  ) => {
    return new Promise<AskUserResponse>((resolve) => {
      const request: AskUserRequest = {
        toolCallId,
        questions,
        resolve,
        timeoutId: undefined,
      }
      request.timeoutId = setTimeout(() => {
        if (pendingRequest !== request) return

        // A multi-select question can be resolved without guessing: selecting
        // every option preserves all possible work. Single-select questions are
        // returned as skipped so the model can judge the safest option itself.
        const answers = questions.flatMap((question, questionIndex) => {
          if (!question.multiSelect) return []
          return [
            {
              questionIndex,
              selectedOptions: question.options.map((option) => option.label),
            },
          ]
        })
        const hasSingleSelect = questions.some((question) => !question.multiSelect)
        settleRequest(request, {
          ...(answers.length > 0 ? { answers } : {}),
          ...(hasSingleSelect || answers.length === 0 ? { skipped: true } : {}),
        })
      }, normalizeTimeout(options.timeoutMs))

      pendingRequest = request
      notifyListeners()
    })
  },

  submit: (response: AskUserResponse) => {
    if (pendingRequest) {
      settleRequest(pendingRequest, response)
    }
  },

  getPendingRequest: () => pendingRequest,

  subscribe: (listener: Listener) => {
    listeners.push(listener)
    listener(pendingRequest)
    return () => {
      const idx = listeners.indexOf(listener)
      if (idx !== -1) listeners.splice(idx, 1)
    }
  },
}

function notifyListeners() {
  listeners.forEach((l) => l(pendingRequest))
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  return Number.isFinite(timeoutMs) && (timeoutMs as number) > 0
    ? (timeoutMs as number)
    : DEFAULT_ASK_USER_TIMEOUT_MS
}

function settleRequest(request: AskUserRequest, response: AskUserResponse) {
  if (pendingRequest !== request) return
  clearTimeout(request.timeoutId)
  pendingRequest = null
  request.resolve(response)
  notifyListeners()
}
