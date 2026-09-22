// What's new: one entry per APK build, newest first. Human-edited; see AGENTS.md before each build.
// `id` is what the phone remembers as seen, so every build that should show notes needs a new, unique id.
export type Entry = { id: string; title: string; items: string[] };

export const CHANGELOG: Entry[] = [
  {
    id: '2026-09-22',
    title: 'Plan the week, shop together',
    items: [
      'Browse Filipino dishes, with category chips and search.',
      'Pick dishes and get one market list, merged and grouped by aisle.',
      'Tick items off as you shop, even with no signal. Tapped by mistake? Undo it until it syncs.',
      'Share a list with your partner by email invite and watch each other’s ticks arrive live.',
      'Every ingredient, aisle and category now shows in plain English.',
      'History keeps your finished trips, and Repeat puts one back on your list.',
    ],
  },
];
