// Presentation state only. This never changes database permissions or JWT claims.
// A future repository must explicitly filter by the selected context before loading.
export type ContextState = {
  userId: string | null;
  contextKey: string | null;
  generation: number;
  data: Readonly<Record<string, unknown>>;
};
export type ContextEvent =
  | { type: 'session'; userId: string | null }
  | { type: 'context'; key: string | null }
  | { type: 'clear' }
  | { type: 'resolved'; generation: number; data: Readonly<Record<string, unknown>> };

export const emptyContext: ContextState = { userId: null, contextKey: null, generation: 0, data: {} };

export function contextReducer(state: ContextState, event: ContextEvent): ContextState {
  switch (event.type) {
    case 'clear': return { ...emptyContext, generation: state.generation + 1 };
    case 'session': return event.userId === state.userId ? state : {
      ...emptyContext, userId: event.userId, generation: state.generation + 1,
    };
    case 'context': return event.key === state.contextKey ? state : {
      ...state, contextKey: event.key, data: {}, generation: state.generation + 1,
    };
    case 'resolved': return state.userId && state.contextKey && event.generation === state.generation
      ? { ...state, data: event.data } : state;
  }
}
