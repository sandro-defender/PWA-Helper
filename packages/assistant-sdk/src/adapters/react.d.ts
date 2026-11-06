import type { AssistantConfigInput } from '../config/index.js';
import type { AssistantEnvironment, AssistantInstance, AssistantState } from '../index.js';

export type UseSyncExternalStoreFn = <Snapshot>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot?: () => Snapshot
) => Snapshot;

export interface ExternalStoreBindings<Selected = AssistantState> {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => Selected;
  getServerSnapshot: () => Selected;
}

export interface UseAssistantHook {
  (): AssistantState;
  <Selected>(selector: (state: AssistantState) => Selected): Selected;
}

export interface ReactAdapterOptions {
  useSyncExternalStore: UseSyncExternalStoreFn;
  assistant?: AssistantInstance;
  config?: AssistantConfigInput;
  env?: AssistantEnvironment;
  fallbackState?: AssistantState;
  source?: string;
}

export interface ReactAssistantAdapter {
  getAssistant(): AssistantInstance;
  useAssistant: UseAssistantHook;
  dispatchAction(id: string, kind?: string): void;
}

export declare const FALLBACK_ASSISTANT_STATE: AssistantState;

export declare function getExternalStoreBindings<Selected = AssistantState>(
  assistantOrGetter?: AssistantInstance | (() => AssistantInstance),
  selector?: ((state: AssistantState) => Selected) | null,
  fallbackState?: AssistantState
): ExternalStoreBindings<Selected>;

export declare function createUseAssistant(
  useSyncExternalStore: UseSyncExternalStoreFn,
  assistantOrGetter?: AssistantInstance | (() => AssistantInstance),
  fallbackState?: AssistantState
): UseAssistantHook;

export declare function dispatchAssistantAction(
  id: string,
  kind?: string,
  options?: {
    assistant?: AssistantInstance | null;
    pwa?: Record<string, unknown> | null;
    document?: Document | null;
    root?: Record<string, unknown> | null;
    source?: string;
  }
): void;

export declare function createReactAdapter(options: ReactAdapterOptions): ReactAssistantAdapter;
