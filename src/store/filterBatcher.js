export const FILTER_BATCH_IDLE_STATE = Object.freeze({
  _filterDirty: false,
  _filterPending: false,
});

export function scheduleBatchedFilterRecompute({ get, set, compute }) {
  set({ _filterDirty: true });

  if (get()._filterPending) {
    return;
  }

  set({ _filterPending: true });

  queueMicrotask(() => {
    if (!get()._filterDirty) {
      set({ _filterPending: false });
      return;
    }

    const updates = compute(get());
    set({
      ...FILTER_BATCH_IDLE_STATE,
      ...updates,
    });
  });
}
