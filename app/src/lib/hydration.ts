/** 等待 zustand persist 完成异步读取（这些 store 都带 hydrated 标记）。 */
export function waitForHydration<T extends { hydrated: boolean }>(store: {
  getState: () => T;
  subscribe: (listener: (state: T) => void) => () => void;
}): Promise<void> {
  if (store.getState().hydrated) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve();
    };
    const unsubscribe = store.subscribe((state) => {
      if (state.hydrated) finish();
    });
    // 存储损坏时 onRehydrateStorage 可能不会标记 hydrated，避免一直卡住。
    window.setTimeout(finish, 3000);
  });
}
