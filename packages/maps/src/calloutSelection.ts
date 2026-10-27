export type CalloutDismissReason =
  | 'selection'
  | 'hide'
  | 'map-press'
  | 'unmount'
  | 'style'
  | 'drag'
  | 'dispose'
  | 'content';

type Registration = {
  id: string;
  owner: object;
  callbacks: {
    select(): void;
    deselect(reason: CalloutDismissReason): void;
  };
};
export type CalloutSelection = Readonly<{ id: string; owner: object }>;

/** Map-owned selection. Owner tokens keep old refs and cleanups harmless. */
export function createCalloutSelection() {
  const registrations = new Map<string, Registration>();
  const listeners = new Set<() => void>();
  let active = false;
  let selected: { entry: Registration; notified: boolean } | null = null;
  let snapshot: CalloutSelection | null = null;

  const transition = (
    entry: Registration | null,
    reason: CalloutDismissReason,
  ) => {
    if (selected?.entry === entry || (!selected && !entry)) return;
    const previous = selected;
    const next = entry ? { entry, notified: false } : null;
    selected = next;
    snapshot = entry
      ? Object.freeze({ id: entry.id, owner: entry.owner })
      : null;
    try {
      if (previous?.notified) previous.entry.callbacks.deselect(reason);
    } finally {
      try {
        // A deselect handler may remove the target or select another marker.
        // Only notify a selection that is still current after that callback.
        if (
          next &&
          selected === next &&
          registrations.get(next.entry.id) === next.entry
        ) {
          next.notified = true;
          next.entry.callbacks.select();
        }
      } finally {
        // Even an application callback failure must publish consistent state.
        for (const listener of [...listeners]) listener();
      }
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    activate() {
      active = true;
    },
    deactivate(reason: CalloutDismissReason) {
      active = false;
      transition(null, reason);
    },
    register(id: string, owner: object, callbacks: Registration['callbacks']) {
      const entry: Registration = { id, owner, callbacks };
      registrations.set(id, entry);
      if (selected?.entry.id === id) transition(null, 'unmount');
      return () => {
        if (registrations.get(id) !== entry) return;
        registrations.delete(id);
        if (selected?.entry === entry) transition(null, 'unmount');
      };
    },
    show(id: string, owner: object) {
      const entry = registrations.get(id);
      if (active && entry?.owner === owner) transition(entry, 'selection');
    },
    hide(id: string, owner: object) {
      if (selected?.entry.id === id && selected.entry.owner === owner)
        transition(null, 'hide');
    },
    reset(reason: CalloutDismissReason) {
      transition(null, reason);
    },
  };
}
